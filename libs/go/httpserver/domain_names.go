package httpserver

import (
	"errors"
	"strings"
)

func normalizeDNSDomain(raw string) (string, error) {
	raw = strings.Trim(strings.TrimSpace(strings.ToLower(raw)), ".")
	if raw == "" {
		return "", errors.New("domain required")
	}
	if !validDNSName(raw) || !strings.Contains(raw, ".") {
		return "", errors.New("domain must be a valid DNS name")
	}
	return raw, nil
}

func normalizeOptionalDNSDomain(raw string) (string, error) {
	raw = strings.Trim(strings.TrimSpace(strings.ToLower(raw)), ".")
	if raw == "" {
		return "", nil
	}
	if !validDNSName(raw) || !strings.Contains(raw, ".") {
		return "", errors.New("domain must be a valid DNS name")
	}
	return raw, nil
}

func validDNSName(raw string) bool {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" || len(raw) > 253 {
		return false
	}
	parts := strings.Split(raw, ".")
	for _, part := range parts {
		if part == "" || len(part) > 63 {
			return false
		}
		if part[0] == '-' || part[len(part)-1] == '-' {
			return false
		}
		for _, r := range part {
			switch {
			case r >= 'a' && r <= 'z':
			case r >= '0' && r <= '9':
			case r == '-':
			default:
				return false
			}
		}
	}
	return true
}
