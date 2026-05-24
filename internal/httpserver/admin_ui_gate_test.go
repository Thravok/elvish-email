package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIsOperatorDistAsset(t *testing.T) {
	t.Parallel()
	tests := []struct {
		rel  string
		want bool
	}{
		{"dist/mail-admin-embed.js", true},
		{"dist/admin-bundle.js", false},
		{"dist/mail-settings-lazy.js", false},
		{"dist/admin-blog-bundle.js", false},
		{"dist/mail-bundle.js", false},
		{"dist/auth-login-bundle.js", false},
		{"admin/foo.js", false},
		{"dist/../dist/mail-admin-embed.js", false},
	}
	for _, tc := range tests {
		if got := isOperatorDistAsset(tc.rel); got != tc.want {
			t.Errorf("isOperatorDistAsset(%q) = %v want %v", tc.rel, got, tc.want)
		}
	}
}

func TestIsHoneypotProbePath(t *testing.T) {
	t.Parallel()
	if !isHoneypotProbePath("/.env") {
		t.Fatal()
	}
	if !isHoneypotProbePath("/wp-login.php") {
		t.Fatal()
	}
	if !isHoneypotProbePath("/wp-admin/plugins") {
		t.Fatal()
	}
	if isHoneypotProbePath("/api/bootstrap.json") {
		t.Fatal("real path misclassified")
	}
	if isHoneypotProbePath("/login") {
		t.Fatal()
	}
}

func TestHoneypotProbeHTTPReturnsNotFound(t *testing.T) {
	t.Parallel()
	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/.env", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestMailUIServedWithAppHeaders(t *testing.T) {
	t.Parallel()
	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/mail", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /mail: status = %d", rec.Code)
	}
	if got := rec.Header().Get("Referrer-Policy"); got != "no-referrer" {
		t.Fatalf("Referrer-Policy = %q", got)
	}
	if got := rec.Header().Get("X-Frame-Options"); got != "DENY" {
		t.Fatalf("X-Frame-Options = %q", got)
	}
}

func TestMailTrailingSlashRedirects(t *testing.T) {
	t.Parallel()
	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/mail/", nil))
	if rec.Code != http.StatusFound {
		t.Fatalf("expected redirect, got status = %d", rec.Code)
	}
	if loc := rec.Header().Get("Location"); loc != "/mail" {
		t.Fatalf("Location = %q want /mail", loc)
	}
}

func TestAdminRedirectsToMail(t *testing.T) {
	t.Parallel()
	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/admin/", nil))
	if rec.Code != http.StatusFound {
		t.Fatalf("expected redirect, got status = %d body=%q", rec.Code, rec.Body.String())
	}
	loc := rec.Header().Get("Location")
	if loc != "/mail?view=admin" {
		t.Fatalf("expected redirect to /mail?view=admin, got Location=%q", loc)
	}
}

func TestAdminCSSServed(t *testing.T) {
	t.Parallel()
	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/admin/admin.css", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /admin/admin.css: status = %d", rec.Code)
	}
}

func TestOperatorDistPublicWhenSessionsDisabled(t *testing.T) {
	t.Parallel()
	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, nil)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/dist/mail-admin-embed.js", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
}
