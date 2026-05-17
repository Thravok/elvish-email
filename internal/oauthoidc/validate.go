package oauthoidc

import (
	"crypto/subtle"
	"strings"
)

// RedirectAllowed returns true if redirectURI exactly matches a configured allowlist entry.
func (i *Issuer) RedirectAllowed(redirectURI string) bool {
	if i == nil {
		return false
	}
	redirectURI = strings.TrimSpace(redirectURI)
	for _, u := range i.RedirectURIs {
		if redirectURI == strings.TrimSpace(u) {
			return true
		}
	}
	return false
}

// ClientSecretMatches compares the presented client secret in constant time.
func (i *Issuer) ClientSecretMatches(secret string) bool {
	if i == nil {
		return false
	}
	a := i.clientSecret
	b := []byte(strings.TrimSpace(secret))
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare(a, b) == 1
}

// ScopesIncludeOIDCRequired reports whether scope contains openid, email, and profile.
func ScopesIncludeOIDCRequired(scope string) bool {
	m := make(map[string]struct{})
	for _, p := range strings.Fields(scope) {
		p = strings.TrimSpace(p)
		if p != "" {
			m[p] = struct{}{}
		}
	}
	_, okOpenID := m["openid"]
	_, okEmail := m["email"]
	_, okProfile := m["profile"]
	return okOpenID && okEmail && okProfile
}
