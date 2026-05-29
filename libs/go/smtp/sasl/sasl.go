// Package sasl is a tiny PLAIN/LOGIN AUTH implementation for SMTP.
package sasl

import (
	"encoding/base64"
	"errors"
	"strings"
)

// ErrAuthFailed is returned when credentials do not match.
var ErrAuthFailed = errors.New("sasl: authentication failed")

// Authenticator validates (identity, username, password) and returns a session-attached principal.
type Authenticator interface {
	Authenticate(identity, username, password string) error
}

// AuthenticatorFunc adapts a function into the interface.
type AuthenticatorFunc func(identity, username, password string) error

// Authenticate implements Authenticator.
func (f AuthenticatorFunc) Authenticate(identity, username, password string) error {
	return f(identity, username, password)
}

// DecodePlain parses an RFC 4616 PLAIN response: base64("\0" username "\0" password).
func DecodePlain(b64 string) (identity, username, password string, err error) {
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(b64))
	if err != nil {
		return "", "", "", err
	}
	parts := strings.SplitN(string(raw), "\x00", 3)
	if len(parts) != 3 {
		return "", "", "", errors.New("sasl plain: malformed response")
	}
	return parts[0], parts[1], parts[2], nil
}

// EncodePlain produces a base64 PLAIN response for client use.
func EncodePlain(identity, username, password string) string {
	return base64.StdEncoding.EncodeToString([]byte(identity + "\x00" + username + "\x00" + password))
}

// DecodeLogin returns the decoded base64 string for AUTH LOGIN exchanges.
func DecodeLogin(b64 string) (string, error) {
	b, err := base64.StdEncoding.DecodeString(strings.TrimSpace(b64))
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// EncodeLogin returns the base64 encoding for client AUTH LOGIN responses.
func EncodeLogin(s string) string {
	return base64.StdEncoding.EncodeToString([]byte(s))
}
