package httpserver

import (
	"context"
	"errors"
	"strings"
)

// Default domain when ELVISH_MAIL_DOMAIN / Server.mailDomain is unset (signup + login compose).
const defaultSignupMailDomain = "elvish.local"

// ErrInvalidUsername indicates the local-part rules failed for signup or login.
var ErrInvalidUsername = errors.New("invalid username")

func effectiveMailDomainString(configured string) string {
	configured = strings.TrimSpace(strings.ToLower(configured))
	if configured != "" {
		return configured
	}
	return defaultSignupMailDomain
}

// EffectiveMailDomain returns the platform mail domain from operator settings, server wiring, or defaultSignupMailDomain.
func (s *Server) EffectiveMailDomain() string {
	if s == nil {
		return defaultSignupMailDomain
	}
	if s.operator != nil {
		st, err := s.operator.Settings(context.Background())
		if err == nil && st != nil && strings.TrimSpace(st.PlatformMailDomain) != "" {
			return effectiveMailDomainString(st.PlatformMailDomain)
		}
	}
	return effectiveMailDomainString(s.mailDomain)
}

// NormalizeAndValidateUsername returns a normalized lowercase username or ErrInvalidUsername.
// Rules: 3–64 chars, [a-z0-9._-] only, no leading/trailing dot, no "..", no "@".
func NormalizeAndValidateUsername(raw string) (string, error) {
	s := strings.TrimSpace(strings.ToLower(raw))
	if s == "" {
		return "", ErrInvalidUsername
	}
	if strings.Contains(s, "@") {
		return "", ErrInvalidUsername
	}
	n := len(s)
	if n < 3 || n > 64 {
		return "", ErrInvalidUsername
	}
	if strings.Contains(s, "..") {
		return "", ErrInvalidUsername
	}
	for i, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '_' || r == '-':
		case r == '.':
			if i == 0 || i == n-1 {
				return "", ErrInvalidUsername
			}
		default:
			return "", ErrInvalidUsername
		}
	}
	return s, nil
}

// ComposeCanonicalEmail builds username@domain (caller supplies normalized parts).
func ComposeCanonicalEmail(username, domain string) string {
	d := strings.TrimSpace(strings.ToLower(domain))
	return username + "@" + d
}

// UsernameFromCanonicalEmail returns the local part of a single-@ address, or "".
func UsernameFromCanonicalEmail(email string) string {
	email = strings.TrimSpace(strings.ToLower(email))
	i := strings.LastIndex(email, "@")
	if i <= 0 || i == len(email)-1 {
		return ""
	}
	return email[:i]
}
