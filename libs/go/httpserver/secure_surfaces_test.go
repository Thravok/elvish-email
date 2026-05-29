package httpserver

import (
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestSecureAppPageHeaders(t *testing.T) {
	rec := httptest.NewRecorder()
	setSecureAppPageHeaders(rec)
	h := rec.Header()
	if got := h.Get("Referrer-Policy"); got != "no-referrer" {
		t.Fatalf("Referrer-Policy = %q", got)
	}
	if got := h.Get("X-Frame-Options"); got != "DENY" {
		t.Fatalf("X-Frame-Options = %q", got)
	}
	csp := h.Get("Content-Security-Policy")
	for _, want := range []string{"default-src 'self'", "frame-ancestors 'none'", "connect-src 'self'"} {
		if !strings.Contains(csp, want) {
			t.Fatalf("CSP missing %q: %s", want, csp)
		}
	}
	if strings.Contains(csp, "connect-src 'self' https:") {
		t.Fatalf("mail CSP should not widen connect-src to https: %s", csp)
	}
}

func TestSecureAuthHTMLPageHeaders(t *testing.T) {
	rec := httptest.NewRecorder()
	setSecureAuthHTMLPageHeaders(rec)
	csp := rec.Header().Get("Content-Security-Policy")
	for _, want := range []string{
		"connect-src 'self' https:",
		"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
	} {
		if !strings.Contains(csp, want) {
			t.Fatalf("auth CSP missing %q: %s", want, csp)
		}
	}
}

func TestSecureSurfaceHTMLHasNoThirdPartyOrigins(t *testing.T) {
	files := []string{
		"../../../apps/web/auth/login.html",
		"../../../apps/web/auth/register.html",
		"../../../apps/web/auth/cap-embed.html",
		"../../../apps/web/mail/index.html",
		"../../../apps/web/protected/index.html",
	}
	for _, path := range files {
		b, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		s := string(b)
		for _, forbidden := range []string{
			"https://cdn.jsdelivr.net",
			"https://unpkg.com",
			"https://fonts.googleapis.com",
			"https://fonts.gstatic.com",
		} {
			if strings.Contains(s, forbidden) {
				t.Fatalf("%s contains forbidden origin %q", path, forbidden)
			}
		}
	}
}

func TestUnlockVaultDoesNotPersistAccountKeyToSessionStorage(t *testing.T) {
	b, err := os.ReadFile("../../../apps/web/auth/unlock.js")
	if err != nil {
		t.Fatalf("read unlock.js: %v", err)
	}
	s := string(b)
	for _, forbidden := range []string{"sessionStorage.setItem", "sessionStorage.getItem"} {
		if strings.Contains(s, forbidden) {
			t.Fatalf("unlock.js still persists account keys via %s", forbidden)
		}
	}
}

func TestLegacySensitivePlaintextAuthRoutesDisabled(t *testing.T) {
	s := &Server{}
	tests := []struct {
		name string
		call func(*httptest.ResponseRecorder)
	}{
		{
			name: "password-change",
			call: func(rec *httptest.ResponseRecorder) {
				req := httptest.NewRequest("POST", "/api/auth/password", strings.NewReader(`{}`))
				s.apiAuthPasswordChange(rec, req)
			},
		},
		{
			name: "account-delete",
			call: func(rec *httptest.ResponseRecorder) {
				req := httptest.NewRequest("DELETE", "/api/v1/account", strings.NewReader(`{"confirmation":"DELETE"}`))
				s.apiAccountDelete(rec, req)
			},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			tc.call(rec)
			if rec.Code != 410 {
				t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
			}
			if !strings.Contains(strings.ToLower(rec.Body.String()), "disabled") {
				t.Fatalf("body missing disabled message: %s", rec.Body.String())
			}
		})
	}
}
