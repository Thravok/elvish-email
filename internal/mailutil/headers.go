// Package mailutil provides shared RFC5322 header and attachment sanitization helpers.
package mailutil

import (
	"errors"
	"fmt"
	"net/mail"
	"strings"
)

// ErrHeaderInjection is returned when a header value contains forbidden characters.
var ErrHeaderInjection = errors.New("mailutil: header value contains forbidden characters")

const maxAttachmentNameLen = 255

// RejectHeaderInjection rejects CRLF and NUL bytes that would enable header injection.
func RejectHeaderInjection(s string) error {
	if strings.ContainsAny(s, "\r\n\x00") {
		return ErrHeaderInjection
	}
	return nil
}

// ParseMailbox parses and normalizes a single mailbox address.
func ParseMailbox(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("mailutil: empty address")
	}
	if err := RejectHeaderInjection(raw); err != nil {
		return "", err
	}
	pa, err := mail.ParseAddress(raw)
	if err != nil {
		return "", fmt.Errorf("mailutil: invalid address: %w", err)
	}
	if err := RejectHeaderInjection(pa.Address); err != nil {
		return "", err
	}
	addr := strings.ToLower(strings.TrimSpace(pa.Address))
	if addr == "" {
		return "", errors.New("mailutil: empty address")
	}
	return addr, nil
}

// ParseMailboxList validates, deduplicates, and normalizes mailbox addresses.
func ParseMailboxList(addrs []string) ([]string, error) {
	if len(addrs) == 0 {
		return nil, errors.New("mailutil: at least one address required")
	}
	out := make([]string, 0, len(addrs))
	seen := make(map[string]struct{}, len(addrs))
	for _, raw := range addrs {
		addr, err := ParseMailbox(raw)
		if err != nil {
			return nil, err
		}
		if _, ok := seen[addr]; ok {
			continue
		}
		seen[addr] = struct{}{}
		out = append(out, addr)
	}
	if len(out) == 0 {
		return nil, errors.New("mailutil: at least one valid address required")
	}
	return out, nil
}

// SanitizeAttachmentName strips control characters and path segments from attachment filenames.
func SanitizeAttachmentName(name string) string {
	name = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(name, "\r", ""), "\n", ""))
	name = strings.Map(func(r rune) rune {
		if r == '\x00' || r == '/' || r == '\\' {
			return -1
		}
		return r
	}, name)
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.ReplaceAll(name, "\\", "_")
	if len(name) > maxAttachmentNameLen {
		name = name[:maxAttachmentNameLen]
	}
	if strings.TrimSpace(name) == "" {
		return "attachment.bin"
	}
	return name
}
