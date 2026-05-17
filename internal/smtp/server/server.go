// Package server is the SMTP server implementation (RFC 5321 minimal core).
package server

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/mail"
	"strings"
	"sync"
	"time"

	"elvish/internal/smtp/sasl"
	"elvish/internal/smtp/wire"
)

// Mode controls behaviour: MX (port 25, no AUTH) vs Submission (587, AUTH required).
type Mode int

const (
	ModeMX Mode = iota
	ModeSubmission
)

// Backend processes accepted mail and (optionally) authenticates submission users.
type Backend interface {
	// HandleInbound is called after a successful DATA on a mail-exchanger session.
	HandleInbound(ctx context.Context, from string, rcpt []string, body []byte, peer net.Addr, hello string) error
	// HandleSubmission is called after DATA on an authenticated submission session.
	HandleSubmission(ctx context.Context, principal string, from string, rcpt []string, body []byte, peer net.Addr) error
	// LookupRecipient returns nil if rcpt is acceptable for an MX session, else an *wire.SMTPError to send.
	LookupRecipient(ctx context.Context, rcpt string) error
	// Authenticator is used in submission mode (nil → AUTH disabled).
	Authenticator() sasl.Authenticator
}

// Config configures a server.
type Config struct {
	Addr            string
	Hostname        string // greeting hostname (FQDN)
	Mode            Mode
	MaxMessageBytes int
	MaxRecipients   int
	Logger          *slog.Logger
	TLSConfig       *tls.Config // STARTTLS/implicit TLS
	AllowPlainAuth  bool        // permit AUTH PLAIN before TLS (dev only)
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
}

// Server is a TCP listener that runs SMTP sessions until Close is called.
type Server struct {
	cfg    Config
	be     Backend
	ln     net.Listener
	mu     sync.Mutex
	closed bool
	wg     sync.WaitGroup
}

// New returns a Server bound to cfg + backend (must not be nil).
func New(cfg Config, be Backend) (*Server, error) {
	if be == nil {
		return nil, errors.New("smtp/server: nil backend")
	}
	if cfg.Hostname == "" {
		cfg.Hostname = "localhost"
	}
	if cfg.MaxMessageBytes <= 0 {
		cfg.MaxMessageBytes = 26 << 20
	}
	if cfg.MaxRecipients <= 0 {
		cfg.MaxRecipients = wire.MaxRecipients
	}
	if cfg.ReadTimeout <= 0 {
		cfg.ReadTimeout = 60 * time.Second
	}
	if cfg.WriteTimeout <= 0 {
		cfg.WriteTimeout = 60 * time.Second
	}
	if cfg.IdleTimeout <= 0 {
		cfg.IdleTimeout = 5 * time.Minute
	}
	return &Server{cfg: cfg, be: be}, nil
}

// ListenAndServe binds the configured address and serves until ctx is cancelled.
func (s *Server) ListenAndServe(ctx context.Context) error {
	ln, err := net.Listen("tcp", s.cfg.Addr)
	if err != nil {
		return fmt.Errorf("smtp listen %s: %w", s.cfg.Addr, err)
	}
	return s.Serve(ctx, ln)
}

// Serve accepts connections on ln until ctx is cancelled.
func (s *Server) Serve(ctx context.Context, ln net.Listener) error {
	s.mu.Lock()
	s.ln = ln
	s.mu.Unlock()
	go func() {
		<-ctx.Done()
		_ = s.Close()
	}()
	for {
		conn, err := ln.Accept()
		if err != nil {
			s.mu.Lock()
			closed := s.closed
			s.mu.Unlock()
			if closed {
				s.wg.Wait()
				return nil
			}
			if isTemporary(err) {
				time.Sleep(50 * time.Millisecond)
				continue
			}
			return err
		}
		s.wg.Add(1)
		go func() {
			defer s.wg.Done()
			s.handle(ctx, conn)
		}()
	}
}

// Close stops accepting new connections; in-flight sessions complete.
func (s *Server) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}
	s.closed = true
	if s.ln != nil {
		return s.ln.Close()
	}
	return nil
}

func isTemporary(err error) bool {
	type tempErr interface{ Temporary() bool }
	var te tempErr
	return errors.As(err, &te) && te.Temporary()
}

func (s *Server) log(msg string, args ...any) {
	if s.cfg.Logger == nil {
		return
	}
	s.cfg.Logger.Info(msg, args...)
}

func (s *Server) handle(ctx context.Context, raw net.Conn) {
	defer func() { _ = raw.Close() }()
	var conn net.Conn = raw
	r := wire.NewReader(conn)
	w := wire.NewWriter(conn)
	if err := w.Reply(220, fmt.Sprintf("%s ESMTP Elvish", s.cfg.Hostname)); err != nil {
		return
	}
	state := &session{
		srv:        s,
		conn:       conn,
		r:          r,
		w:          w,
		extensions: s.advertiseExtensions(false),
	}
	for {
		_ = conn.SetDeadline(time.Now().Add(s.cfg.IdleTimeout))
		line, err := r.ReadLine()
		if err != nil {
			return
		}
		if state.handleLine(ctx, line) {
			return
		}
		// If STARTTLS upgraded the connection, swap reader/writer to the wrapped conn.
		if state.upgradedConn != nil {
			conn = state.upgradedConn
			r = wire.NewReader(conn)
			w = wire.NewWriter(conn)
			state.conn = conn
			state.r = r
			state.w = w
			state.upgradedConn = nil
			state.greeted = false
			state.extensions = s.advertiseExtensions(true)
		}
	}
}

func (s *Server) advertiseExtensions(afterTLS bool) []string {
	exts := []string{
		fmt.Sprintf("SIZE %d", s.cfg.MaxMessageBytes),
		"8BITMIME",
		"PIPELINING",
		"ENHANCEDSTATUSCODES",
	}
	if s.cfg.TLSConfig != nil && !afterTLS {
		exts = append(exts, "STARTTLS")
	}
	if s.cfg.Mode == ModeSubmission && (afterTLS || s.cfg.AllowPlainAuth) {
		exts = append(exts, "AUTH PLAIN LOGIN")
	}
	return exts
}

type session struct {
	srv          *Server
	conn         net.Conn
	r            *wire.Reader
	w            *wire.Writer
	greeted      bool
	hello        string
	tlsActive    bool
	authed       bool
	principal    string
	from         string
	rcpt         []string
	extensions   []string
	upgradedConn net.Conn
}

// handleLine returns true to terminate the session.
func (st *session) handleLine(ctx context.Context, line string) bool {
	verb, args := wire.ParseCommand(line)
	switch verb {
	case "EHLO":
		return st.cmdEHLO(args)
	case "HELO":
		return st.cmdHELO(args)
	case "STARTTLS":
		return st.cmdSTARTTLS()
	case "AUTH":
		return st.cmdAUTH(args)
	case "MAIL":
		return st.cmdMAIL(args)
	case "RCPT":
		return st.cmdRCPT(ctx, args)
	case "DATA":
		return st.cmdDATA(ctx)
	case "RSET":
		st.from = ""
		st.rcpt = nil
		_ = st.w.Reply(250, "Reset")
	case "VRFY":
		_ = st.w.Reply(252, "Cannot verify")
	case "NOOP":
		_ = st.w.Reply(250, "OK")
	case "QUIT":
		_ = st.w.Reply(221, "Bye")
		return true
	default:
		_ = st.w.ReplyErr(wire.ErrUnknownCommand)
	}
	return false
}

func (st *session) cmdEHLO(args string) bool {
	name, err := wire.ParseHelloName(args)
	if err != nil {
		_ = st.w.ReplyErr(err)
		return false
	}
	st.hello = name
	st.greeted = true
	lines := []string{fmt.Sprintf("%s greets %s", st.srv.cfg.Hostname, name)}
	lines = append(lines, st.extensions...)
	_ = st.w.MultiReply(250, lines)
	return false
}

func (st *session) cmdHELO(args string) bool {
	name, err := wire.ParseHelloName(args)
	if err != nil {
		_ = st.w.ReplyErr(err)
		return false
	}
	st.hello = name
	st.greeted = true
	_ = st.w.Reply(250, fmt.Sprintf("%s greets %s", st.srv.cfg.Hostname, name))
	return false
}

func (st *session) cmdSTARTTLS() bool {
	if !st.greeted {
		_ = st.w.ReplyErr(wire.ErrBadSequence)
		return false
	}
	if st.srv.cfg.TLSConfig == nil {
		_ = st.w.Reply(454, "TLS not available")
		return false
	}
	if err := st.w.Reply(220, "Ready to start TLS"); err != nil {
		return true
	}
	tlsConn := tls.Server(st.conn, st.srv.cfg.TLSConfig)
	if err := tlsConn.Handshake(); err != nil {
		st.srv.log("starttls handshake", "err", err)
		return true
	}
	st.tlsActive = true
	st.upgradedConn = tlsConn
	return false
}

func (st *session) cmdAUTH(args string) bool {
	if !st.greeted {
		_ = st.w.ReplyErr(wire.ErrBadSequence)
		return false
	}
	if st.srv.cfg.Mode != ModeSubmission {
		_ = st.w.Reply(503, "AUTH not allowed on this port")
		return false
	}
	if !st.tlsActive && !st.srv.cfg.AllowPlainAuth {
		_ = st.w.ReplyErr(wire.ErrTLSRequired)
		return false
	}
	auth := st.srv.be.Authenticator()
	if auth == nil {
		_ = st.w.Reply(504, "AUTH mechanism not implemented")
		return false
	}
	mech, rest := splitMechanism(args)
	switch strings.ToUpper(mech) {
	case "PLAIN":
		var b64 string
		if rest != "" {
			b64 = rest
		} else {
			if err := st.w.Reply(334, ""); err != nil {
				return true
			}
			line, err := st.r.ReadLine()
			if err != nil {
				return true
			}
			b64 = line
		}
		identity, user, pass, err := sasl.DecodePlain(b64)
		if err != nil {
			_ = st.w.ReplyErr(wire.ErrSyntax)
			return false
		}
		if err := auth.Authenticate(identity, user, pass); err != nil {
			_ = st.w.ReplyErr(wire.ErrAuthFailed)
			return false
		}
		st.authed = true
		st.principal = user
		_ = st.w.Reply(235, "Authentication succeeded")
	case "LOGIN":
		if err := st.w.Reply(334, "VXNlcm5hbWU6"); err != nil {
			return true
		}
		userLine, err := st.r.ReadLine()
		if err != nil {
			return true
		}
		user, err := sasl.DecodeLogin(userLine)
		if err != nil {
			_ = st.w.ReplyErr(wire.ErrSyntax)
			return false
		}
		if err := st.w.Reply(334, "UGFzc3dvcmQ6"); err != nil {
			return true
		}
		passLine, err := st.r.ReadLine()
		if err != nil {
			return true
		}
		pass, err := sasl.DecodeLogin(passLine)
		if err != nil {
			_ = st.w.ReplyErr(wire.ErrSyntax)
			return false
		}
		if err := auth.Authenticate("", user, pass); err != nil {
			_ = st.w.ReplyErr(wire.ErrAuthFailed)
			return false
		}
		st.authed = true
		st.principal = user
		_ = st.w.Reply(235, "Authentication succeeded")
	default:
		_ = st.w.Reply(504, "AUTH mechanism not implemented")
	}
	return false
}

func splitMechanism(args string) (mech, rest string) {
	args = strings.TrimSpace(args)
	idx := strings.IndexByte(args, ' ')
	if idx < 0 {
		return args, ""
	}
	return args[:idx], strings.TrimSpace(args[idx+1:])
}

func (st *session) cmdMAIL(args string) bool {
	if !st.greeted {
		_ = st.w.ReplyErr(wire.ErrBadSequence)
		return false
	}
	if st.srv.cfg.Mode == ModeSubmission && !st.authed {
		_ = st.w.ReplyErr(wire.ErrAuthRequired)
		return false
	}
	addr, err := wire.ParseMailFromOrRcptTo(args)
	if err != nil {
		_ = st.w.ReplyErr(err)
		return false
	}
	if addr != "" {
		if _, perr := mail.ParseAddress(addr); perr != nil {
			_ = st.w.Reply(553, "bad sender address")
			return false
		}
	}
	st.from = addr
	st.rcpt = nil
	_ = st.w.Reply(250, "Sender OK")
	return false
}

func (st *session) cmdRCPT(ctx context.Context, args string) bool {
	if st.from == "" {
		_ = st.w.ReplyErr(wire.ErrBadSequence)
		return false
	}
	addr, err := wire.ParseMailFromOrRcptTo(args)
	if err != nil {
		_ = st.w.ReplyErr(err)
		return false
	}
	parsed, perr := mail.ParseAddress(addr)
	if perr != nil || parsed.Address == "" {
		_ = st.w.Reply(553, "bad recipient address")
		return false
	}
	em := strings.ToLower(strings.TrimSpace(parsed.Address))
	if len(st.rcpt) >= st.srv.cfg.MaxRecipients {
		_ = st.w.ReplyErr(wire.ErrTooManyRcpts)
		return false
	}
	if st.srv.cfg.Mode == ModeMX {
		if err := st.srv.be.LookupRecipient(ctx, em); err != nil {
			_ = st.w.ReplyErr(err)
			return false
		}
	}
	st.rcpt = append(st.rcpt, em)
	_ = st.w.Reply(250, "Recipient OK")
	return false
}

func (st *session) cmdDATA(ctx context.Context) bool {
	if len(st.rcpt) == 0 {
		_ = st.w.ReplyErr(wire.ErrBadSequence)
		return false
	}
	if err := st.w.Reply(354, "End data with <CR><LF>.<CR><LF>"); err != nil {
		return true
	}
	body, err := st.r.ReadDATA(st.srv.cfg.MaxMessageBytes)
	if err != nil {
		_ = st.w.ReplyErr(err)
		return false
	}
	var hErr error
	if st.srv.cfg.Mode == ModeMX {
		hErr = st.srv.be.HandleInbound(ctx, st.from, append([]string(nil), st.rcpt...), body, st.conn.RemoteAddr(), st.hello)
	} else {
		hErr = st.srv.be.HandleSubmission(ctx, st.principal, st.from, append([]string(nil), st.rcpt...), body, st.conn.RemoteAddr())
	}
	if hErr != nil {
		_ = st.w.ReplyErr(hErr)
		st.from = ""
		st.rcpt = nil
		return false
	}
	_ = st.w.Reply(250, "Message accepted")
	st.from = ""
	st.rcpt = nil
	return false
}
