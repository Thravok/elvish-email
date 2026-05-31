package httpserver

import (
	"net"
	"strings"
)

// ProbeBaseFromAddr builds an http(s) origin for self-probes from the listen address
// (e.g. ":8765" → "http://127.0.0.1:8765"). Empty or invalid addr returns "".
func ProbeBaseFromAddr(addr string) string {
	addr = strings.TrimSpace(addr)
	if addr == "" {
		return ""
	}
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return ""
	}
	if host == "" || host == "0.0.0.0" || host == "::" || host == "[::]" {
		host = "127.0.0.1"
	}
	scheme := "http"
	if port == "443" {
		scheme = "https"
	}
	return scheme + "://" + net.JoinHostPort(host, port)
}
