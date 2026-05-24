package httpserver

import (
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
)

// adminUISessionEnforced reports whether operator HTML and privileged JS bundles
// must be gated behind an admin Valkey session.
func (s *Server) adminUISessionEnforced() bool {
	return s.store != nil && s.sessions != nil
}

// adminUIAuthHTML uses a browser redirect to /login when there is no session.
// adminUIAuthAsset uses 403 for missing sessions so script fetches never receive an HTML redirect body.
type adminUIAuthStyle int

const (
	adminUIAuthHTML adminUIAuthStyle = iota
	adminUIAuthAsset
)

// requireAdminUIAccess gates operator UI when the database and Valkey sessions are configured.
// style controls whether a missing session is a redirect (HTML) or 403 (JS bundles).
func (s *Server) requireAdminUIAccess(w http.ResponseWriter, r *http.Request, style adminUIAuthStyle) bool {
	if !s.adminUISessionEnforced() {
		return true
	}
	u, _, _, ok := s.sessionFromRequest(r)
	if !ok || u == nil {
		if style == adminUIAuthHTML {
			next := r.URL.RequestURI()
			if next == "" {
				next = "/"
			}
			http.Redirect(w, r, "/login?next="+url.QueryEscape(next), http.StatusFound)
			return false
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.WriteHeader(http.StatusForbidden)
		_, _ = io.WriteString(w, "Forbidden\n")
		return false
	}
	if !u.IsAdmin {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.WriteHeader(http.StatusForbidden)
		_, _ = io.WriteString(w, "Operator access required.\n")
		return false
	}
	return true
}

var operatorDistBasenames = map[string]struct{}{
	"mail-admin-embed.js": {},
}

// isOperatorDistAsset reports whether rel (URL path with forward slashes, no leading slash)
// refers to a gated operator JavaScript bundle under dist/.
func isOperatorDistAsset(rel string) bool {
	if strings.Contains(rel, "..") {
		return false
	}
	if !strings.HasPrefix(rel, "dist/") {
		return false
	}
	base := filepath.Base(rel)
	if base == "." || base == "/" || strings.Contains(base, "..") {
		return false
	}
	_, ok := operatorDistBasenames[base]
	return ok
}
