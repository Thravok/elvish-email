package server

import (
	"context"
	"net"
	"sync"
	"testing"
	"time"

	"elvish/internal/smtp/client"
	"elvish/internal/smtp/sasl"
	"elvish/internal/smtp/wire"
)

type mockBackend struct {
	mu          sync.Mutex
	delivered   []deliveredMsg
	allowedRcpt map[string]bool
	auth        sasl.Authenticator
}

type deliveredMsg struct {
	from string
	to   []string
	body []byte
	mode string
	prin string
}

func (b *mockBackend) HandleInbound(_ context.Context, from string, rcpt []string, body []byte, _ net.Addr, _ string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.delivered = append(b.delivered, deliveredMsg{from: from, to: rcpt, body: append([]byte(nil), body...), mode: "mx"})
	return nil
}

func (b *mockBackend) HandleSubmission(_ context.Context, principal, from string, rcpt []string, body []byte, _ net.Addr) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.delivered = append(b.delivered, deliveredMsg{from: from, to: rcpt, body: append([]byte(nil), body...), mode: "submission", prin: principal})
	return nil
}

func (b *mockBackend) LookupRecipient(_ context.Context, rcpt string) error {
	if b.allowedRcpt == nil || !b.allowedRcpt[rcpt] {
		return &wire.SMTPError{Code: 550, Message: "user unknown"}
	}
	return nil
}

func (b *mockBackend) Authenticator() sasl.Authenticator { return b.auth }

func TestMXSessionEndToEnd(t *testing.T) {
	be := &mockBackend{allowedRcpt: map[string]bool{"alice@example.com": true}}
	srv, err := New(Config{Hostname: "elvish.test", Mode: ModeMX, MaxMessageBytes: 1 << 16}, be)
	if err != nil {
		t.Fatal(err)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() { _ = srv.Serve(ctx, ln) }()
	defer func() { _ = srv.Close() }()
	time.Sleep(50 * time.Millisecond)

	addr := ln.Addr().String()
	c, err := client.Dial(ctx, addr, client.DialOptions{Hostname: "client.test"})
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer func() { _ = c.Close() }()
	if err := c.Mail("from@somewhere.com"); err != nil {
		t.Fatalf("mail: %v", err)
	}
	if _, err := c.Rcpt("alice@example.com"); err != nil {
		t.Fatalf("rcpt: %v", err)
	}
	body := []byte("Subject: hi\r\n\r\nbody\r\n")
	code, _, err := c.Data(body)
	if err != nil || code/100 != 2 {
		t.Fatalf("data: %v code=%d", err, code)
	}
	_ = c.Quit()
	time.Sleep(50 * time.Millisecond)
	be.mu.Lock()
	defer be.mu.Unlock()
	if len(be.delivered) != 1 {
		t.Fatalf("expected 1 delivered, got %d", len(be.delivered))
	}
	if be.delivered[0].from != "from@somewhere.com" {
		t.Errorf("from mismatch: %q", be.delivered[0].from)
	}
	if be.delivered[0].mode != "mx" {
		t.Errorf("expected mx mode, got %s", be.delivered[0].mode)
	}
}

func TestMXRejectsUnknownRecipient(t *testing.T) {
	be := &mockBackend{allowedRcpt: map[string]bool{"alice@example.com": true}}
	srv, err := New(Config{Hostname: "elvish.test", Mode: ModeMX}, be)
	if err != nil {
		t.Fatal(err)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() { _ = srv.Serve(ctx, ln) }()
	defer func() { _ = srv.Close() }()
	time.Sleep(50 * time.Millisecond)
	c, err := client.Dial(ctx, ln.Addr().String(), client.DialOptions{Hostname: "client.test"})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = c.Close() }()
	if err := c.Mail("from@x.com"); err != nil {
		t.Fatal(err)
	}
	res, err := c.Rcpt("nobody@example.com")
	if err == nil {
		t.Errorf("expected RCPT to fail")
	}
	if res.Code != 550 {
		t.Errorf("expected 550, got %d", res.Code)
	}
}

func TestSubmissionRequiresAuth(t *testing.T) {
	be := &mockBackend{auth: sasl.AuthenticatorFunc(func(_, u, p string) error {
		if u == "alice@example.com" && p == "hunter2hunter2" {
			return nil
		}
		return sasl.ErrAuthFailed
	})}
	srv, err := New(Config{Hostname: "elvish.test", Mode: ModeSubmission, AllowPlainAuth: true}, be)
	if err != nil {
		t.Fatal(err)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() { _ = srv.Serve(ctx, ln) }()
	defer func() { _ = srv.Close() }()
	time.Sleep(50 * time.Millisecond)
	c, err := client.Dial(ctx, ln.Addr().String(), client.DialOptions{Hostname: "client.test"})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = c.Close() }()
	// MAIL without AUTH should fail.
	if err := c.Mail("alice@example.com"); err == nil {
		t.Errorf("expected MAIL to fail without AUTH")
	}
	// Authenticate; submit succeeds.
	if err := c.Auth("alice@example.com", "hunter2hunter2"); err != nil {
		t.Fatalf("auth: %v", err)
	}
	if err := c.Mail("alice@example.com"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Rcpt("bob@somewhere.com"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := c.Data([]byte("Subject: t\r\n\r\nb\r\n")); err != nil {
		t.Fatal(err)
	}
	_ = c.Quit()
	time.Sleep(50 * time.Millisecond)
	be.mu.Lock()
	defer be.mu.Unlock()
	if len(be.delivered) != 1 || be.delivered[0].mode != "submission" || be.delivered[0].prin != "alice@example.com" {
		t.Errorf("submission delivered: %+v", be.delivered)
	}
}
