// Package netaddr provides helpers for extracting peer identifiers from net.Addr values.
package netaddr

import (
	"net"
	"strings"
)

// HostFromAddr returns the host portion of a net.Addr for rate-limit keys.
func HostFromAddr(a net.Addr) string {
	if a == nil {
		return "unknown"
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(a.String()))
	if err != nil {
		return sanitizeKeyPart(a.String())
	}
	return sanitizeKeyPart(host)
}

func sanitizeKeyPart(s string) string {
	s = strings.ReplaceAll(s, ":", "_")
	s = strings.ReplaceAll(s, " ", "_")
	if len(s) > 120 {
		return s[:120]
	}
	if s == "" {
		return "unknown"
	}
	return s
}
