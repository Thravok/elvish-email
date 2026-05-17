package httpserver

import (
	"net/http"
	"strings"
)

// setSecureAppPageHeaders tightens the security posture for mail/protected
// HTML shells. It intentionally allows the minimum needed by the current
// self-hosted React + OpenPGP runtime (JSX is precompiled; no Babel eval).
func setSecureAppPageHeaders(w http.ResponseWriter) {
	hdr := w.Header()
	hdr.Set("Referrer-Policy", "no-referrer")
	hdr.Set("X-Frame-Options", "DENY")
	hdr.Set("X-Content-Type-Options", "nosniff")
	hdr.Set("Permissions-Policy", strings.Join([]string{
		"accelerometer=()",
		"camera=()",
		"display-capture=()",
		"fullscreen=()",
		"geolocation=()",
		"gyroscope=()",
		"magnetometer=()",
		"microphone=()",
		"payment=()",
		"usb=()",
		"web-share=()",
	}, ", "))
	hdr.Set("Cross-Origin-Opener-Policy", "same-origin")
	hdr.Set("Cross-Origin-Resource-Policy", "same-origin")
	hdr.Set("Origin-Agent-Cluster", "?1")
	hdr.Set("Content-Security-Policy", strings.Join([]string{
		"default-src 'self'",
		"base-uri 'self'",
		"connect-src 'self'",
		"font-src 'self' data:",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"img-src 'self' data: blob:",
		"manifest-src 'self'",
		"media-src 'self' blob:",
		"object-src 'none'",
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline'",
		"worker-src 'self' blob:",
	}, "; "))
}

// setSecureAuthHTMLPageHeaders is like setSecureAppPageHeaders but relaxes CSP for
// /login and /register so the Cap widget can fetch challenges over HTTPS and run WASM.
func setSecureAuthHTMLPageHeaders(w http.ResponseWriter) {
	hdr := w.Header()
	hdr.Set("Referrer-Policy", "no-referrer")
	hdr.Set("X-Frame-Options", "DENY")
	hdr.Set("X-Content-Type-Options", "nosniff")
	hdr.Set("Permissions-Policy", strings.Join([]string{
		"accelerometer=()",
		"camera=()",
		"display-capture=()",
		"fullscreen=()",
		"geolocation=()",
		"gyroscope=()",
		"magnetometer=()",
		"microphone=()",
		"payment=()",
		"usb=()",
		"web-share=()",
	}, ", "))
	hdr.Set("Cross-Origin-Opener-Policy", "same-origin")
	hdr.Set("Cross-Origin-Resource-Policy", "same-origin")
	hdr.Set("Origin-Agent-Cluster", "?1")
	hdr.Set("Content-Security-Policy", strings.Join([]string{
		"default-src 'self'",
		"base-uri 'self'",
		"connect-src 'self' https:",
		"font-src 'self' data:",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"img-src 'self' data: blob:",
		"manifest-src 'self'",
		"media-src 'self' blob:",
		"object-src 'none'",
		"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
		"style-src 'self' 'unsafe-inline'",
		"worker-src 'self' blob:",
	}, "; "))
}
