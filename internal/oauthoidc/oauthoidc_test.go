package oauthoidc

import (
	"crypto/rand"
	"crypto/rsa"
	"strings"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

func TestScopesIncludeOIDCRequired(t *testing.T) {
	t.Parallel()
	if !ScopesIncludeOIDCRequired("openid email profile") {
		t.Fatal("expected true")
	}
	if ScopesIncludeOIDCRequired("openid email") {
		t.Fatal("expected false without profile")
	}
}

func TestSignIDTokenRoundTrip(t *testing.T) {
	t.Parallel()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	signer, kid, err := newRS256Signer(priv)
	if err != nil {
		t.Fatal(err)
	}
	if kid == "" {
		t.Fatal("empty kid")
	}
	tok, err := SignIDToken(signer, "https://issuer.example", "client-id", "user-sub-1", "nonce-xyz", "u@example.com", "User Name", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := jwt.ParseSigned(tok, []jose.SignatureAlgorithm{jose.RS256})
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]any{}
	if err := parsed.UnsafeClaimsWithoutVerification(&out); err != nil {
		t.Fatal(err)
	}
	if out["iss"] != "https://issuer.example" || out["sub"] != "user-sub-1" {
		t.Fatalf("claims: %#v", out)
	}
	if out["nonce"] != "nonce-xyz" {
		t.Fatalf("nonce: %#v", out)
	}
}

func TestIssuerRedirectAllowed(t *testing.T) {
	t.Parallel()
	iss := &Issuer{RedirectURIs: []string{"https://login.tailscale.com/a/oauth_response", "https://other/cb"}}
	if !iss.RedirectAllowed("https://login.tailscale.com/a/oauth_response") {
		t.Fatal()
	}
	if iss.RedirectAllowed("https://login.tailscale.com/a/oauth_response/") {
		t.Fatal("prefix match must not count")
	}
}

func TestIssuerRedirectTarget(t *testing.T) {
	t.Parallel()
	iss := &Issuer{RedirectURIs: []string{"https://client.example/callback"}}
	u, err := iss.RedirectTarget("https://client.example/callback")
	if err != nil || u == nil || u.String() == "" {
		t.Fatalf("got %v err %v", u, err)
	}
	if _, err := iss.RedirectTarget("https://evil.example/callback"); err == nil {
		t.Fatal("expected error for non-allowlisted redirect")
	}
}

func TestMarshalJWKSJSON(t *testing.T) {
	t.Parallel()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	signer, kid, err := newRS256Signer(priv)
	if err != nil {
		t.Fatal(err)
	}
	iss := &Issuer{
		IssuerURL:    "https://issuer.example",
		ClientID:     "cid",
		clientSecret: []byte("s"),
		RedirectURIs: []string{"https://cb"},
		Signer:       signer,
		KeyID:        kid,
		rsaKey:       priv,
	}
	raw, err := iss.MarshalJWKSJSON()
	if err != nil {
		t.Fatal(err)
	}
	if len(raw) < 50 || !strings.Contains(string(raw), kid) {
		t.Fatalf("unexpected jwks: %s", raw)
	}
}

func TestClientSecretMatches(t *testing.T) {
	t.Parallel()
	iss := &Issuer{clientSecret: []byte("s3cret")}
	if !iss.ClientSecretMatches("s3cret") {
		t.Fatal()
	}
	if iss.ClientSecretMatches("wrong") {
		t.Fatal()
	}
	if iss.ClientSecretMatches("s3cret!") {
		t.Fatal()
	}
}
