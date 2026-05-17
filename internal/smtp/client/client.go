// Package client is Elvish's SMTP client (outbound) implementation (RFC 5321).
package client

import (
	"bufio"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"net/textproto"
	"sort"
	"strings"
	"time"

	"elvish/internal/smtp/sasl"
	"elvish/internal/smtp/wire"
)

// Result is the per-recipient delivery outcome from one DATA transaction.
type Result struct {
	Recipient    string
	Code         int
	EnhancedCode string
	Message      string
	Permanent    bool
}

// Conn is one open SMTP transaction-capable connection.
type Conn struct {
	conn      net.Conn
	tp        *textproto.Conn
	host      string
	hostname  string // EHLO name we used
	tlsActive bool
	exts      map[string]string
}

// DialOptions controls dial + connection setup.
type DialOptions struct {
	Hostname    string // EHLO name (FQDN)
	DialTimeout time.Duration
	TLSConfig   *tls.Config
	UseTLS      bool // implicit TLS (port 465); STARTTLS used otherwise
	UseSTARTTLS bool // attempt STARTTLS when advertised (default true)
}

// Dial connects to addr ("host:port") and reads the greeting.
func Dial(ctx context.Context, addr string, opt DialOptions) (*Conn, error) {
	if opt.DialTimeout <= 0 {
		opt.DialTimeout = 30 * time.Second
	}
	d := &net.Dialer{Timeout: opt.DialTimeout}
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, err
	}
	if opt.UseTLS {
		if opt.TLSConfig == nil {
			return nil, errors.New("smtp/client: implicit TLS requires TLSConfig")
		}
		host, _, _ := net.SplitHostPort(addr)
		cfg := opt.TLSConfig.Clone()
		if cfg.ServerName == "" {
			cfg.ServerName = host
		}
		tconn := tls.Client(conn, cfg)
		if err := tconn.HandshakeContext(ctx); err != nil {
			_ = conn.Close()
			return nil, fmt.Errorf("tls handshake: %w", err)
		}
		c := newConn(tconn, addr, opt.Hostname, true)
		if err := c.greet(); err != nil {
			_ = c.Close()
			return nil, err
		}
		return c, nil
	}
	c := newConn(conn, addr, opt.Hostname, false)
	if err := c.greet(); err != nil {
		_ = c.Close()
		return nil, err
	}
	if opt.UseSTARTTLS && opt.TLSConfig != nil {
		if _, ok := c.exts["STARTTLS"]; ok {
			if err := c.startTLS(opt.TLSConfig); err != nil {
				_ = c.Close()
				return nil, err
			}
		}
	}
	return c, nil
}

func newConn(conn net.Conn, host, hostname string, tlsActive bool) *Conn {
	if hostname == "" {
		hostname = "localhost"
	}
	return &Conn{
		conn:      conn,
		tp:        textproto.NewConn(conn),
		host:      host,
		hostname:  hostname,
		tlsActive: tlsActive,
		exts:      map[string]string{},
	}
}

func (c *Conn) greet() error {
	if _, _, err := c.expect(220); err != nil {
		return fmt.Errorf("greeting: %w", err)
	}
	return c.ehlo()
}

func (c *Conn) ehlo() error {
	if err := c.cmdf("EHLO %s", c.hostname); err != nil {
		return err
	}
	code, msg, err := c.expect(250)
	if err != nil {
		// Fall back to HELO.
		if err2 := c.cmdf("HELO %s", c.hostname); err2 != nil {
			return err
		}
		_, _, err2 := c.expect(250)
		return err2
	}
	c.exts = parseExtensions(msg, code)
	return nil
}

func (c *Conn) startTLS(cfg *tls.Config) error {
	if err := c.cmdf("STARTTLS"); err != nil {
		return err
	}
	if _, _, err := c.expect(220); err != nil {
		return fmt.Errorf("starttls: %w", err)
	}
	host, _, _ := net.SplitHostPort(c.host)
	cc := cfg.Clone()
	if cc.ServerName == "" {
		cc.ServerName = host
	}
	tconn := tls.Client(c.conn, cc)
	if err := tconn.Handshake(); err != nil {
		return fmt.Errorf("tls handshake: %w", err)
	}
	c.conn = tconn
	c.tp = textproto.NewConn(tconn)
	c.tlsActive = true
	return c.ehlo()
}

func parseExtensions(msg string, _ int) map[string]string {
	out := map[string]string{}
	for _, line := range strings.Split(msg, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		idx := strings.IndexByte(line, ' ')
		var name, args string
		if idx < 0 {
			name = line
		} else {
			name = line[:idx]
			args = line[idx+1:]
		}
		out[strings.ToUpper(name)] = args
	}
	return out
}

// Auth performs AUTH PLAIN if the server advertises it.
func (c *Conn) Auth(username, password string) error {
	if _, ok := c.exts["AUTH"]; !ok {
		return errors.New("smtp/client: server does not advertise AUTH")
	}
	if err := c.cmdf("AUTH PLAIN %s", sasl.EncodePlain("", username, password)); err != nil {
		return err
	}
	if _, _, err := c.expect(235); err != nil {
		return fmt.Errorf("auth: %w", err)
	}
	return nil
}

// Mail sends MAIL FROM:<from>.
func (c *Conn) Mail(from string) error {
	if err := c.cmdf("MAIL FROM:<%s>", from); err != nil {
		return err
	}
	_, _, err := c.expect(250)
	return err
}

// Rcpt sends RCPT TO:<to> and returns the parsed result (code/message + permanent flag).
func (c *Conn) Rcpt(to string) (Result, error) {
	res := Result{Recipient: to}
	if err := c.cmdf("RCPT TO:<%s>", to); err != nil {
		return res, err
	}
	code, msg, err := c.read()
	if err != nil {
		return res, err
	}
	res.Code = code
	res.Message = msg
	if code/100 != 2 {
		res.Permanent = code/100 == 5
		return res, fmt.Errorf("rcpt: %d %s", code, msg)
	}
	return res, nil
}

// Data sends DATA + payload (dot-stuffed) + ".".
func (c *Conn) Data(payload []byte) (int, string, error) {
	if err := c.cmdf("DATA"); err != nil {
		return 0, "", err
	}
	if _, _, err := c.expect(354); err != nil {
		return 0, "", err
	}
	dw := c.tp.DotWriter()
	if _, err := io.Copy(dw, bytesReader(payload)); err != nil {
		_ = dw.Close()
		return 0, "", err
	}
	if err := dw.Close(); err != nil {
		return 0, "", err
	}
	return c.read()
}

// Quit sends QUIT.
func (c *Conn) Quit() error {
	if err := c.cmdf("QUIT"); err != nil {
		return err
	}
	_, _, _ = c.expect(221)
	return nil
}

// Close closes the underlying connection.
func (c *Conn) Close() error {
	if c == nil || c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Conn) cmdf(format string, args ...any) error {
	cmd := fmt.Sprintf(format, args...)
	if len(cmd)+2 > wire.MaxLineBytes {
		return wire.ErrLineTooLong
	}
	_, err := c.tp.Cmd("%s", cmd)
	return err
}

// read reads one server response (handles multiline 250-continuation).
func (c *Conn) read() (int, string, error) {
	br := bufio.NewReader(c.conn)
	var msgBuilder strings.Builder
	var firstCode int
	for {
		line, err := br.ReadString('\n')
		if err != nil {
			return 0, "", err
		}
		line = strings.TrimRight(line, "\r\n")
		if len(line) < 4 {
			return 0, "", fmt.Errorf("short response %q", line)
		}
		code, _, err := wire.CodeFromText(line)
		if err != nil {
			return 0, "", err
		}
		if firstCode == 0 {
			firstCode = code
		}
		msgBuilder.WriteString(line[4:])
		if line[3] == ' ' {
			break
		}
		msgBuilder.WriteByte('\n')
	}
	return firstCode, msgBuilder.String(), nil
}

func (c *Conn) expect(want int) (int, string, error) {
	code, msg, err := c.read()
	if err != nil {
		return 0, "", err
	}
	if code != want {
		return code, msg, fmt.Errorf("smtp: want %d got %d %s", want, code, msg)
	}
	return code, msg, nil
}

func bytesReader(b []byte) io.Reader { return strings.NewReader(string(b)) }

// LookupMX returns the MX hostnames for domain ordered by preference.
func LookupMX(ctx context.Context, domain string) ([]string, error) {
	mxs, err := net.DefaultResolver.LookupMX(ctx, domain)
	if err != nil || len(mxs) == 0 {
		return []string{domain}, err
	}
	type rec struct {
		host string
		pref uint16
	}
	recs := make([]rec, 0, len(mxs))
	for _, m := range mxs {
		h := strings.TrimSuffix(strings.TrimSpace(m.Host), ".")
		if h == "" {
			continue
		}
		recs = append(recs, rec{host: h, pref: m.Pref})
	}
	if len(recs) == 0 {
		return []string{domain}, nil
	}
	sort.SliceStable(recs, func(i, j int) bool { return recs[i].pref < recs[j].pref })
	out := make([]string, len(recs))
	for i := range recs {
		out[i] = recs[i].host
	}
	return out, nil
}
