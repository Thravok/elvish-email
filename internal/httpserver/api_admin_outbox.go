package httpserver

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

func (s *Server) apiAdminOutboxStats(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}

	if s.mailmeta == nil {
		s.writeJSON(w, http.StatusOK, map[string]any{
			"pending":  0,
			"sending":  0,
			"sent":     0,
			"failed":   0,
			"no_store": true,
		})
		return
	}

	stats, err := s.mailmeta.OutboxStats(r.Context())
	if err != nil {
		s.writeErrAPIInternal(w, "outbox stats", err)
		return
	}

	s.writeJSON(w, http.StatusOK, stats)
}

func (s *Server) apiAdminOutboxList(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}

	if s.mailmeta == nil {
		s.writeJSON(w, http.StatusOK, map[string]any{
			"items":    []any{},
			"total":    0,
			"no_store": true,
		})
		return
	}

	status := r.URL.Query().Get("status")
	source := r.URL.Query().Get("source")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	items, total, err := s.mailmeta.ListOutboxAdmin(r.Context(), status, source, offset, limit)
	if err != nil {
		s.writeErrAPIInternal(w, "list outbox", err)
		return
	}

	s.writeJSON(w, http.StatusOK, map[string]any{
		"items":  items,
		"total":  total,
		"page":   page,
		"limit":  limit,
		"source": source,
	})
}

func (s *Server) apiAdminOutboxGet(w http.ResponseWriter, r *http.Request, idStr string) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}

	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail store required")
		return
	}

	outboxID, err := uuid.Parse(idStr)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid outbox id")
		return
	}

	item, err := s.mailmeta.GetOutboxByID(r.Context(), outboxID)
	if err != nil {
		s.writeErr(w, http.StatusNotFound, "outbox entry not found")
		return
	}

	s.writeJSON(w, http.StatusOK, item)
}

func (s *Server) apiAdminOutboxRetry(w http.ResponseWriter, r *http.Request, idStr string) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}

	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail store required")
		return
	}

	outboxID, err := uuid.Parse(idStr)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid outbox id")
		return
	}

	if err := s.mailmeta.RetryOutboxEntry(r.Context(), outboxID); err != nil {
		s.writeErrAPIInternal(w, "retry outbox", err)
		return
	}

	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminOutboxAPI(w http.ResponseWriter, r *http.Request, p string) {
	switch {
	case p == "/stats" && r.Method == http.MethodGet:
		s.apiAdminOutboxStats(w, r)
	case p == "" && r.Method == http.MethodGet:
		s.apiAdminOutboxList(w, r)
	case strings.HasSuffix(p, "/retry") && r.Method == http.MethodPost:
		idStr := strings.TrimPrefix(p, "/")
		idStr = strings.TrimSuffix(idStr, "/retry")
		s.apiAdminOutboxRetry(w, r, idStr)
	case strings.HasPrefix(p, "/") && r.Method == http.MethodGet:
		idStr := strings.TrimPrefix(p, "/")
		s.apiAdminOutboxGet(w, r, idStr)
	default:
		http.NotFound(w, r)
	}
}
