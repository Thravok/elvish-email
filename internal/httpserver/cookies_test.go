package httpserver

import (
	"testing"
)

func TestNewSessionCookieDomain(t *testing.T) {
	t.Setenv("ELVISH_COOKIE_DOMAIN", ".example.com")
	s := &Server{cookieSecure: true, cookieDomain: loadCookieDomain()}
	c := s.newSessionCookie("elvish_session", "tok", 3600)
	if c.Domain != ".example.com" {
		t.Fatalf("domain: %q", c.Domain)
	}
	if c.Secure != true {
		t.Fatal("expected secure cookie")
	}
}
