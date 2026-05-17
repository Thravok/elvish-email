package httpserver

import "strings"

// isHoneypotProbePath reports common scanner paths that should never exist on this site.
func isHoneypotProbePath(path string) bool {
	lower := strings.ToLower(strings.TrimSpace(path))
	if lower == "" {
		return false
	}
	switch lower {
	case "/.env", "/.env.local", "/.env.production", "/.git/config":
		return true
	case "/wp-login.php", "/xmlrpc.php", "/wp-admin", "/wp-admin/", "/administrator", "/administrator/":
		return true
	}
	if strings.HasPrefix(lower, "/wp-admin/") {
		return true
	}
	if strings.HasPrefix(lower, "/phpmyadmin") || strings.HasPrefix(lower, "/pma/") {
		return true
	}
	return false
}
