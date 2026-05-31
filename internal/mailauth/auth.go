// Package mailauth evaluates inbound SMTP authentication (SPF, DKIM, DMARC).
// See docs/adr/0014-inbound-mail-authentication.md.
package mailauth

import (
	"context"
	"log/slog"
	"net"
	"os"
	"strings"

	"elvish/internal/netaddr"
	"elvish/internal/smtp/wire"
)

// Mode controls how auth failures affect delivery.
type Mode string

const (
	ModeNone       Mode = "none"
	ModeQuarantine Mode = "quarantine"
	ModeReject     Mode = "reject"
)

// Results holds compact authentication outcomes for one inbound message.
type Results struct {
	Mode  Mode
	SPF   string
	DKIM  string
	DMARC string
	From  string
	Peer  string
}

// Checker evaluates inbound mail authentication per ADR 0014.
type Checker struct {
	mode   Mode
	logger *slog.Logger
}

// NewChecker returns a checker using ELVISH_INBOUND_AUTH_MODE (default none).
func NewChecker(logger *slog.Logger) *Checker {
	mode := Mode(strings.ToLower(strings.TrimSpace(os.Getenv("ELVISH_INBOUND_AUTH_MODE"))))
	switch mode {
	case ModeQuarantine, ModeReject:
	default:
		mode = ModeNone
	}
	return &Checker{mode: mode, logger: logger}
}

// Check evaluates SPF, DKIM, and DMARC for an inbound SMTP message.
func (c *Checker) Check(ctx context.Context, peer net.Addr, from string, raw []byte) Results {
	res := Results{
		Mode: c.mode,
		From: strings.TrimSpace(from),
		Peer: netaddr.HostFromAddr(peer),
		SPF:  "none",
		DKIM: "none",
		DMARC: "none",
	}
	if c == nil {
		return res
	}
	domain := domainFromAddr(from)
	if domain == "" {
		return res
	}
	res.SPF = checkSPF(ctx, res.Peer, domain)
	res.DKIM = checkDKIM(raw)
	res.DMARC = checkDMARC(ctx, domain, res.SPF, res.DKIM)
	return res
}

// Enforce applies the configured mode. none mode never rejects.
func (c *Checker) Enforce(res Results) error {
	if c == nil || c.mode == ModeNone {
		return nil
	}
	fail := authFailed(res)
	if !fail {
		return nil
	}
	switch c.mode {
	case ModeReject:
		return &wire.SMTPError{Code: 550, Message: "mail authentication failed"}
	case ModeQuarantine:
		// Quarantine routing is applied in mailpipe via a future spam-folder hook.
		// For now, accept and log; operators can switch to reject once confident.
		if c.logger != nil {
			c.logger.Warn("inbound mail auth would quarantine", "from", res.From, "spf", res.SPF, "dkim", res.DKIM, "dmarc", res.DMARC)
		}
	}
	return nil
}

func authFailed(res Results) bool {
	return res.SPF == "fail" || res.DKIM == "fail" || res.DMARC == "fail"
}

func domainFromAddr(addr string) string {
	addr = strings.TrimSpace(addr)
	if addr == "" {
		return ""
	}
	if i := strings.LastIndexByte(addr, '@'); i >= 0 && i+1 < len(addr) {
		dom := strings.ToLower(strings.TrimSpace(addr[i+1:]))
		if j := strings.IndexAny(dom, "> \t"); j >= 0 {
			dom = strings.TrimSpace(dom[:j])
		}
		return dom
	}
	return strings.ToLower(addr)
}
