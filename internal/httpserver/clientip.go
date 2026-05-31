package httpserver

import (
	"net"
	"net/http"
	"strings"
)

// clientIPForRateLimit picks an identifier for per-IP rate limits.
// When trustForwarded is false, only the TCP remote address is used.
// Set ELVISH_TRUST_FORWARDED_FOR=1 only when a trusted reverse proxy strips spoofed X-Forwarded-For.
func clientIPForRateLimit(r *http.Request, trustForwarded bool) string {
	if trustForwarded {
		if xr := strings.TrimSpace(r.Header.Get("X-Real-IP")); xr != "" {
			return sanitizeRateLimitKeyPart(xr)
		}
		if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
			if i := strings.IndexByte(xff, ','); i >= 0 {
				xff = strings.TrimSpace(xff[:i])
			}
			if xff != "" {
				return sanitizeRateLimitKeyPart(xff)
			}
		}
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		return sanitizeRateLimitKeyPart(r.RemoteAddr)
	}
	return sanitizeRateLimitKeyPart(host)
}

func sanitizeRateLimitKeyPart(s string) string {
	s = strings.ReplaceAll(s, ":", "_")
	s = strings.ReplaceAll(s, " ", "_")
	if len(s) > 120 {
		return s[:120]
	}
	return s
}
