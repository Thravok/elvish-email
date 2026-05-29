package httpserver

import (
	"elvish/libs/go/paths"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// apiAdminSiteHomePut replaces the site_config.home_json override by merging the admin panel payload onto the current effective home JSON.
func (s *Server) apiAdminSiteHomePut(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required to persist site home (site_config.home_json)")
		return
	}
	ctx := r.Context()
	var admin map[string]any
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&admin); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	base, err := s.loadHomeJSONBytesForAdminMerge(ctx)
	if err != nil {
		s.writeErrAPIInternal(w, "admin site home read base", err)
		return
	}
	merged, err := mergeAdminHomePatch(base, admin)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.store.SetSiteHomeJSON(ctx, string(merged)); err != nil {
		s.writeErrAPIInternal(w, "admin site home save", err)
		return
	}
	s.invalidateContentCache()
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) loadHomeJSONBytesForAdminMerge(ctx context.Context) ([]byte, error) {
	if s.store != nil {
		raw, err := s.store.GetSiteHomeJSON(ctx)
		if err != nil {
			return nil, err
		}
		if strings.TrimSpace(raw) != "" {
			return []byte(raw), nil
		}
	}
	path := filepath.Join(paths.RepoRoot(s.root).APIContent(), "home.json")
	return os.ReadFile(path)
}
