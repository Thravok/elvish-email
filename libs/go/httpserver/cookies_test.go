package httpserver

import (
	"context"
	"testing"
)

func TestNewSessionCookieDomain(t *testing.T) {
	s := &Server{cookieSecure: true, cookieDomain: ".example.com"}
	c := s.newSessionCookie(context.Background(), "elvish_session", "tok", 3600)
	if c.Domain != ".example.com" {
		t.Fatalf("domain: %q", c.Domain)
	}
	if !c.Secure {
		t.Fatal("expected secure cookie")
	}
}
