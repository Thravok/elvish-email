package keyserver

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
)

func mkPubKey(t *testing.T, name, email string) (string, string) {
	t.Helper()
	cfg := &packet.Config{Algorithm: packet.PubKeyAlgoEdDSA}
	e, err := pgpcrypto.NewEntity(name, "", email, cfg)
	if err != nil {
		t.Fatalf("NewEntity: %v", err)
	}
	var buf bytes.Buffer
	w, err := armor.Encode(&buf, "PGP PUBLIC KEY BLOCK", nil)
	if err != nil {
		t.Fatalf("armor: %v", err)
	}
	if err := e.Serialize(w); err != nil {
		t.Fatalf("serialize: %v", err)
	}
	_ = w.Close()
	fp := ""
	for _, b := range e.PrimaryKey.Fingerprint {
		fp += hex(b)
	}
	return strings.ToUpper(fp), buf.String()
}

func hex(b byte) string {
	const h = "0123456789ABCDEF"
	return string([]byte{h[b>>4], h[b&0xF]})
}

func TestResolverChainPicksFirstHit(t *testing.T) {
	a := NewMockSource("a")
	b := NewMockSource("b")
	fp, armored := mkPubKey(t, "alice", "alice@example.com")
	a.Set("alice@example.com", fp, armored)
	r := &Resolver{Sources: []Source{a, b}, OpTimeout: time.Second}
	hit, err := r.Lookup(context.Background(), "alice@example.com")
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if hit.Source != "a" {
		t.Errorf("expected source a, got %s", hit.Source)
	}
	if !hit.VerifiedUIDMatch {
		t.Errorf("expected verified UID match")
	}
}

func TestResolverFallsBackToNextSource(t *testing.T) {
	a := NewMockSource("a")
	b := NewMockSource("b")
	fp, armored := mkPubKey(t, "bob", "bob@example.com")
	b.Set("bob@example.com", fp, armored)
	r := &Resolver{Sources: []Source{a, b}, OpTimeout: time.Second}
	hit, err := r.Lookup(context.Background(), "bob@example.com")
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if hit.Source != "b" {
		t.Errorf("expected source b, got %s", hit.Source)
	}
}

func TestResolverNotFound(t *testing.T) {
	a := NewMockSource("a")
	r := &Resolver{Sources: []Source{a}, OpTimeout: time.Second}
	_, err := r.Lookup(context.Background(), "missing@example.com")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("expected not found, got %v", err)
	}
}

func TestProtonAutoBoost(t *testing.T) {
	wkd := NewMockSource("wkd")
	proton := &ProtonSource{}
	chain := promoteProton([]Source{wkd, proton, NewMockSource("hkp")})
	if chain[0].Name() != "proton" {
		t.Errorf("expected proton at front, got %s", chain[0].Name())
	}
}

func TestWKDDirectAgainstHTTPTest(t *testing.T) {
	fp, armored := mkPubKey(t, "alice", "alice@example.com")
	mux := http.NewServeMux()
	mux.HandleFunc("/.well-known/openpgpkey/hu/", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(armored))
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()
	wkd := &WKDSource{HTTP: srv.Client(), UseDirect: true}
	// The server lives on an httptest URL; we need to redirect the WKD URL there.
	// Re-route by intercepting at the transport level via custom client.
	wkd.HTTP = &http.Client{Transport: rewriteTransport{base: srv.URL}, Timeout: 3 * time.Second}
	hit, err := wkd.Lookup(context.Background(), "alice@example.com")
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if hit.Fingerprint != fp {
		t.Errorf("fingerprint mismatch: got %s want %s", hit.Fingerprint, fp)
	}
	if hit.Source != "wkd_direct" {
		t.Errorf("expected wkd_direct, got %s", hit.Source)
	}
}

type rewriteTransport struct {
	base string
}

func (rt rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	target, err := http.NewRequestWithContext(req.Context(), req.Method, rt.base+req.URL.Path+"?"+req.URL.RawQuery, req.Body)
	if err != nil {
		return nil, err
	}
	for k, v := range req.Header {
		target.Header[k] = v
	}
	return http.DefaultTransport.RoundTrip(target)
}

func TestIsProtonDomain(t *testing.T) {
	cases := map[string]bool{
		"proton.me": true, "PM.ME": true, "protonmail.com": true, "protonmail.ch": true,
		"example.com": false, "": false,
	}
	for d, want := range cases {
		if IsProtonDomain(d) != want {
			t.Errorf("IsProtonDomain(%q): got %v want %v", d, !want, want)
		}
	}
}
