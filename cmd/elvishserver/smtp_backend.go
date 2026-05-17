package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"elvish/internal/mailmeta"
	"elvish/internal/mailpipe"
	"elvish/internal/smtp/sasl"
	"elvish/internal/smtp/wire"
	"elvish/internal/store"
	"elvish/internal/telemetry"
)

// smtpBackend bridges internal/smtp/server to mailpipe and the user store.
//
// MX mode (port 25): rejects unknown recipients via LookupRecipient, then
// hands accepted messages to mailpipe.IngestExternal (gateway-encrypts to the
// recipient's identity public key before persisting).
//
// Submission mode (port 587): authenticates against store.UserByEmail using
// bcrypt, then hands the message to mailpipe.IngestSubmission (encrypts to the
// sender's own identity for sent-folder readback) and queues per-recipient
// outbound delivery via the existing outbox state in mailmeta.
type smtpBackend struct {
	pipe       *mailpipe.Pipe
	logger     *slog.Logger
	submission bool
	store      *store.Store
	meta       *mailmeta.Store
	telemetry  *telemetry.Service
}

func newSMTPBackend(pipe *mailpipe.Pipe, logger *slog.Logger, submission bool, st *store.Store, meta *mailmeta.Store, tel *telemetry.Service) *smtpBackend {
	return &smtpBackend{pipe: pipe, logger: logger, submission: submission, store: st, meta: meta, telemetry: tel}
}

func (b *smtpBackend) HandleInbound(ctx context.Context, from string, rcpt []string, body []byte, peer net.Addr, hello string) error {
	startedAt := time.Now()
	for _, to := range rcpt {
		res, err := b.pipe.IngestExternal(ctx, from, strings.ToLower(strings.TrimSpace(to)), append([]byte(nil), body...))
		if err != nil {
			if b.logger != nil {
				b.logger.Warn("smtp inbound ingest", "rcpt", to, "err", err)
			}
			b.recordSMTP(ctx, "inbound", false, startedAt)
			return &wire.SMTPError{Code: 451, Message: "temporary failure, please retry"}
		}
		if res != nil && res.Dropped {
			// User ingest-time block: accept without persisting (no third-party checks, no body indexing).
			continue
		}
	}
	b.recordSMTP(ctx, "inbound", true, startedAt)
	return nil
}

func (b *smtpBackend) HandleSubmission(ctx context.Context, principal, from string, rcpt []string, body []byte, peer net.Addr) error {
	startedAt := time.Now()
	resolveStartedAt := time.Now()
	principalEmail, err := b.resolveSubmissionPrincipal(ctx, principal)
	b.recordDependency(ctx, "principal_resolve", err == nil, resolveStartedAt)
	if err != nil {
		b.recordSMTP(ctx, "submission", false, startedAt)
		return &wire.SMTPError{Code: 554, Message: "principal unavailable"}
	}
	if _, err := b.pipe.IngestSubmission(ctx, principalEmail, from, rcpt, append([]byte(nil), body...)); err != nil {
		if b.logger != nil {
			b.logger.Warn("smtp submission ingest", "from", from, "err", err)
		}
		b.recordSMTP(ctx, "submission", false, startedAt)
		return &wire.SMTPError{Code: 451, Message: "temporary failure, please retry"}
	}
	b.recordSMTP(ctx, "submission", true, startedAt)
	return nil
}

func (b *smtpBackend) LookupRecipient(ctx context.Context, rcpt string) error {
	startedAt := time.Now()
	if b.meta == nil {
		b.recordSMTP(ctx, "lookup", false, startedAt)
		return &wire.SMTPError{Code: 550, Message: "mailbox unavailable"}
	}
	lookupStartedAt := time.Now()
	_, err := b.meta.IdentityForEmail(ctx, strings.ToLower(strings.TrimSpace(rcpt)))
	b.recordDependency(ctx, "identity_lookup", err == nil, lookupStartedAt)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			b.recordSMTP(ctx, "lookup", false, startedAt)
			return &wire.SMTPError{Code: 550, Message: "no such user here"}
		}
		b.recordSMTP(ctx, "lookup", false, startedAt)
		return &wire.SMTPError{Code: 451, Message: "temporary lookup failure"}
	}
	b.recordSMTP(ctx, "lookup", true, startedAt)
	return nil
}

func (b *smtpBackend) resolveSubmissionPrincipal(ctx context.Context, principal string) (string, error) {
	p := strings.ToLower(strings.TrimSpace(principal))
	if p == "" {
		return "", errors.New("empty principal")
	}
	if b.store != nil {
		if u, err := b.store.UserByEmail(ctx, p); err == nil {
			return u.Email, nil
		}
	}
	if b.meta != nil {
		uid, _, err := b.meta.SMTPCredentialForAuth(ctx, p)
		if err == nil {
			ik, err := b.meta.DefaultIdentityForUser(ctx, uid)
			if err != nil {
				return "", err
			}
			return ik.Email, nil
		}
		if !errors.Is(err, mailmeta.ErrNotFound) {
			return "", err
		}
	}
	return "", errors.New("unknown principal")
}

func (b *smtpBackend) Authenticator() sasl.Authenticator {
	if !b.submission || b.store == nil {
		return nil
	}
	return sasl.AuthenticatorFunc(func(identity, username, password string) error {
		startedAt := time.Now()
		uStr := strings.ToLower(strings.TrimSpace(username))
		if uStr == "" || password == "" {
			b.recordSMTP(context.Background(), "auth", false, startedAt)
			return sasl.ErrAuthFailed
		}
		if b.meta != nil {
			authLookupStartedAt := time.Now()
			_, hash, err := b.meta.SMTPCredentialForAuth(context.Background(), uStr)
			b.recordDependency(context.Background(), "auth_lookup", err == nil, authLookupStartedAt)
			if err == nil {
				if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil {
					b.recordSMTP(context.Background(), "auth", true, startedAt)
					return nil
				}
			}
		}
		b.recordSMTP(context.Background(), "auth", false, startedAt)
		return sasl.ErrAuthFailed
	})
}

func (b *smtpBackend) recordSMTP(ctx context.Context, stage string, success bool, startedAt time.Time) {
	if b == nil || b.telemetry == nil {
		return
	}
	if err := b.telemetry.RecordSMTPEvent(ctx, stage, success, time.Since(startedAt)); err != nil && b.logger != nil {
		b.logger.Warn("smtp telemetry", "err", err, "stage", stage)
	}
}

func (b *smtpBackend) recordDependency(ctx context.Context, operation string, success bool, startedAt time.Time) {
	if b == nil || b.telemetry == nil {
		return
	}
	if err := b.telemetry.RecordDependencyPerf(ctx, "smtp_backend", operation, "smtp", success, time.Since(startedAt)); err != nil && b.logger != nil {
		b.logger.Warn("smtp dependency telemetry", "err", err, "operation", operation)
	}
}
