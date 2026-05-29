package httpserver

import (
	"net/http"
	"strings"

	"elvish/libs/go/config"
)

func toolOpenRedirectURL(t config.Tool) string {
	d := strings.TrimSpace(t.OpenHref)
	if d != "" {
		if strings.ContainsAny(d, "\r\n\x00") || strings.Contains(d, `\`) {
			return "/"
		}
		if strings.HasPrefix(d, "http://") || strings.HasPrefix(d, "https://") {
			return d
		}
		if strings.HasPrefix(d, "//") {
			return "/"
		}
		return safeRedirectPath(d)
	}
	slug := strings.TrimSpace(t.Slug)
	if slug == "" {
		return "/"
	}
	return "/" + strings.Trim(strings.ToLower(slug), "/") + "/"
}

func (s *Server) handleToolGo(w http.ResponseWriter, r *http.Request, slug string) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	slug = strings.TrimSpace(strings.Trim(slug, "/"))
	if slug == "" {
		http.NotFound(w, r)
		return
	}
	ctx := r.Context()
	h, err := s.loadHome(ctx)
	if err != nil {
		s.httpErrorInternal500(w, err)
		return
	}
	var found *config.Tool
	for i := range h.Tools {
		if strings.EqualFold(strings.TrimSpace(h.Tools[i].Slug), slug) {
			found = &h.Tools[i]
			break
		}
	}
	if found == nil {
		http.NotFound(w, r)
		return
	}
	dest := toolOpenRedirectURL(*found)
	// Count one GET /go/<slug>/ navigation (Valkey); HEAD does not increment.
	if r.Method == http.MethodGet && s.toolCalls != nil {
		if _, err := s.toolCalls.Incr(ctx, found.Slug); err != nil {
			s.log.Warn("tool open incr", "slug", found.Slug, "err", err)
		}
	}
	setCacheToolRedirect(w)
	http.Redirect(w, r, dest, http.StatusFound)
}
