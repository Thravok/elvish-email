// Package oauthoidc implements a minimal OIDC/OAuth2 authorization-server subset
// for "Login with Elvish" (issuer only — no relying-party / social login).
package oauthoidc

import (
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/go-jose/go-jose/v4"
)

const defaultTailscaleRedirect = "https://login.tailscale.com/a/oauth_response"

// Issuer holds runtime OIDC issuer configuration and a JWS signer.
type Issuer struct {
	IssuerURL    string
	ClientID     string
	clientSecret []byte
	RedirectURIs []string
	Signer       jose.Signer
	KeyID        string
	rsaKey       *rsa.PrivateKey
}

// LoadIssuerFromEnv loads OIDC issuer settings. Returns (nil, nil) when OIDC is not configured
// (missing client id, secret, key path, or issuer URL source).
func LoadIssuerFromEnv(publicBaseURL string) (*Issuer, error) {
	clientID := strings.TrimSpace(os.Getenv("ELVISH_OIDC_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("ELVISH_OIDC_CLIENT_SECRET"))
	pemPath := strings.TrimSpace(os.Getenv("ELVISH_OIDC_RSA_PRIVATE_KEY_PEM_PATH"))
	if clientID == "" || clientSecret == "" || pemPath == "" {
		return nil, nil
	}
	issuer := strings.TrimRight(strings.TrimSpace(os.Getenv("ELVISH_OIDC_ISSUER")), "/")
	if issuer == "" {
		issuer = strings.TrimRight(strings.TrimSpace(publicBaseURL), "/")
	}
	if issuer == "" {
		return nil, nil
	}
	pemBytes, err := os.ReadFile(pemPath)
	if err != nil {
		return nil, fmt.Errorf("oauthoidc: read rsa pem: %w", err)
	}
	priv, err := parseRSAPrivateKey(pemBytes)
	if err != nil {
		return nil, err
	}
	if priv.N.BitLen() < 2048 {
		return nil, errors.New("oauthoidc: rsa key must be at least 2048 bits")
	}
	redirects := []string{defaultTailscaleRedirect}
	if v := strings.TrimSpace(os.Getenv("ELVISH_OIDC_REDIRECT_URI")); v != "" {
		redirects = []string{v}
	}
	signer, kid, err := newRS256Signer(priv)
	if err != nil {
		return nil, err
	}
	return &Issuer{
		IssuerURL:    issuer,
		ClientID:     clientID,
		clientSecret: []byte(clientSecret),
		RedirectURIs: redirects,
		Signer:       signer,
		KeyID:        kid,
		rsaKey:       priv,
	}, nil
}

func parseRSAPrivateKey(pemBytes []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("oauthoidc: pem decode failed")
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	k, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("oauthoidc: parse private key: %w", err)
	}
	rk, ok := k.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("oauthoidc: private key must be rsa")
	}
	return rk, nil
}

// KeyIDFromPublicKey returns a short stable kid from the PKIX-encoded public key.
func KeyIDFromPublicKey(pubDER []byte) string {
	sum := sha256.Sum256(pubDER)
	return base64.RawURLEncoding.EncodeToString(sum[:12])
}
