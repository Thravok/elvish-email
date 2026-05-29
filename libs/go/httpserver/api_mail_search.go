package httpserver

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"elvish/libs/go/mailmeta"
)

// routeMailSearch dispatches /api/v1/mail/search/metadata.
//
// IMPORTANT: Full-message body search is intentionally not implemented as an HTTP API.
// Body search is local-only (IndexedDB + Web Worker, see static/mail/search/).
// CI enforces absence of a server body-search route with a grep guard in `make lint`.
func (s *Server) routeMailSearch(w http.ResponseWriter, r *http.Request, userID uuid.UUID, parts []string) {
	if len(parts) != 1 || parts[0] != "metadata" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.apiMailSearchMetadata(w, r, userID)
}

func (s *Server) apiMailSearchMetadata(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		s.writeJSON(w, http.StatusOK, map[string]any{"hits": []any{}})
		return
	}
	rawFields := strings.TrimSpace(r.URL.Query().Get("fields"))
	if rawFields == "" {
		s.writeErr(w, http.StatusBadRequest, "fields required")
		return
	}
	requested := splitCSV(rawFields)
	for _, f := range requested {
		if !mailmeta.IsValidConsentField(f) {
			s.writeErr(w, http.StatusBadRequest, "unknown consent field: "+f)
			return
		}
	}
	limit := 50
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	ids, err := s.scylla.SearchOptInMetadata(r.Context(), userID, requested, q, limit)
	if err != nil {
		s.writeErrAPIInternal(w, "mail search metadata", err)
		return
	}
	out := make([]manifestJSON, 0, len(ids))
	for _, id := range ids {
		mf, err := s.scylla.GetManifest(r.Context(), userID, id)
		if err != nil {
			continue
		}
		out = append(out, s.buildManifestJSON(r.Context(), userID, nil, mf))
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"hits": out})
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
