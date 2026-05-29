package keyserver

import (
	"context"
	"errors"
	"strings"
	"time"
)

// ErrNotFound indicates no key was returned by any configured source.
var ErrNotFound = errors.New("keyserver: not found")

// KeyHit is one verified key returned by the resolver.
type KeyHit struct {
	Email               string    `json:"email"`
	Fingerprint         string    `json:"fingerprint"`
	Armored             string    `json:"armored"`
	Source              string    `json:"source"`
	FetchedAt           time.Time `json:"fetched_at"`
	ExpiresAt           time.Time `json:"expires_at"`
	VerifiedUIDMatch    bool      `json:"verified_uid_match"`
	ProtonKTState       string    `json:"proton_kt_state,omitempty"`
	AddressKeysVerified bool      `json:"address_keys_verified,omitempty"`
}

// Source resolves an email to one or more candidate keys.
type Source interface {
	Name() string
	Lookup(ctx context.Context, email string) (*KeyHit, error)
}

// SplitEmail returns localPart, domain (lowercased) or empty strings if invalid.
func SplitEmail(email string) (string, string) {
	email = strings.ToLower(strings.TrimSpace(email))
	at := strings.LastIndex(email, "@")
	if at <= 0 || at == len(email)-1 {
		return "", ""
	}
	return email[:at], email[at+1:]
}
