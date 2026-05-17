package httpserver

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestNoSearchBodyEndpoint enforces the project invariant: there is NO server
// route for body search. CI also enforces this with a grep guard in `make lint`,
// but we double-check at build time so the invariant cannot regress quietly.
func TestNoSearchBodyEndpoint(t *testing.T) {
	dir := "."
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("readdir: %v", err)
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".go") {
			continue
		}
		if strings.HasSuffix(e.Name(), "_test.go") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			t.Fatalf("read %s: %v", e.Name(), err)
		}
		s := string(b)
		// We allow comments to mention the forbidden path; check against route declarations only.
		forbidden := "search" + "/" + "body"
		if strings.Contains(s, "\"v1/mail/"+forbidden+"\"") || strings.Contains(s, forbidden+"\"") {
			t.Errorf("%s declares a body-search endpoint (forbidden)", e.Name())
		}
	}
}

// TestProtectedLinkPasswordNeverServerSide enforces that the Mode-B password is
// never named, decoded, derived, or compared inside the protected-link
// handler files or the maillinks store. The recipient browser does the KDF +
// AES-GCM unwrap locally; the server only ever holds the wrapped message key.
// Any field name like "password" or "kek_b64" leaking into a protected-link
// handler would break the threat model.
//
// Auth handlers (login/register) legitimately accept a password and are
// excluded by the file allow-list below.
func TestProtectedLinkPasswordNeverServerSide(t *testing.T) {
	forbidden := []string{
		`"password"`,
		`"recipient_password"`,
		`"sender_password"`,
		`"kek"`,
		`"kek_b64"`,
		`"derived_kek_b64"`,
		`Argon2id(`,
		`pbkdf2.Key(`,
	}
	scanFiles := []string{
		"./api_protected_links.go",
		"./api_outbox_plain.go",
		"../maillinks/links.go",
		"../maillinks/doc.go",
		"../relaykey/keypair.go",
	}
	for _, fp := range scanFiles {
		b, err := os.ReadFile(filepath.Clean(fp))
		if err != nil {
			t.Fatalf("read %s: %v", fp, err)
		}
		s := string(b)
		for _, needle := range forbidden {
			if strings.Contains(s, needle) {
				t.Errorf("%s references %q — protected-link password must stay client-side", fp, needle)
			}
		}
	}
}
