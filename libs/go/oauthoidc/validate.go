package oauthoidc

import (
	"crypto/subtle"
	"errors"
	"net/url"
	"strings"
)

// ErrRedirectNotAllowed means redirect_uri was missing, malformed, or not on the allowlist.
var ErrRedirectNotAllowed = errors.New("oauthoidc: redirect_uri not allowed")

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

// RedirectTarget returns a parsed URL for use with http.Redirect only when redirectURI
// is on the issuer allowlist (exact string match).
func (i *Issuer) RedirectTarget(redirectURI string) (*url.URL, error) {
	if i == nil || !i.RedirectAllowed(redirectURI) {
		return nil, ErrRedirectNotAllowed
	}
	u, err := url.Parse(redirectURI)
	if err != nil || u == nil {
		return nil, ErrRedirectNotAllowed
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https":
	default:
		return nil, ErrRedirectNotAllowed
	}
	if u.Host == "" {
		return nil, ErrRedirectNotAllowed
	}
	return u, nil
}

// RedirectURLWithAuthCode returns the allowlisted redirect URL with OAuth code and state query
// parameters. target must come from Issuer.RedirectTarget.
func RedirectURLWithAuthCode(target *url.URL, code, state string) string {
	if target == nil {
		return ""
	}
	redir := *target
	qq := redir.Query()
	qq.Set("code", code)
	qq.Set("state", state)
	redir.RawQuery = qq.Encode()
	return redir.String()
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
