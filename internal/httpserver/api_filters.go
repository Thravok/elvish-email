package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"elvish/internal/mailmeta"
)

// handleFiltersAPI dispatches /api/v1/filters.
func (s *Server) handleFiltersAPI(w http.ResponseWriter, r *http.Request, p string) {
	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem not configured")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if !s.rateLimitMailUser(w, r, u.ID.String()) {
		return
	}
	rest := strings.TrimPrefix(p, "v1/filters")
	rest = strings.TrimPrefix(rest, "/")
	parts := strings.FieldsFunc(rest, func(c rune) bool { return c == '/' })
	switch len(parts) {
	case 0:
		switch r.Method {
		case http.MethodGet:
			s.apiFiltersList(w, r, u.ID)
		case http.MethodPost:
			s.apiFiltersCreate(w, r, u.ID)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case 1:
		id, err := uuid.Parse(parts[0])
		if err != nil {
			http.NotFound(w, r)
			return
		}
		switch r.Method {
		case http.MethodPut:
			s.apiFiltersUpdate(w, r, u.ID, id)
		case http.MethodDelete:
			s.apiFiltersDelete(w, r, u.ID, id)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) apiFiltersList(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	rows, err := s.mailmeta.ListMailFilters(r.Context(), userID)
	if err != nil {
		s.writeErrAPIInternal(w, "filters list", err)
		return
	}
	out := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		var conds, acts any
		_ = json.Unmarshal(row.Conditions, &conds)
		_ = json.Unmarshal(row.Actions, &acts)
		if conds == nil {
			conds = []any{}
		}
		if acts == nil {
			acts = []any{}
		}
		out = append(out, map[string]any{
			"id":         row.ID.String(),
			"name":       row.Name,
			"enabled":    row.Enabled,
			"priority":   row.Priority,
			"conditions": conds,
			"actions":    acts,
			"created_at": row.CreatedAt,
			"updated_at": row.UpdatedAt,
		})
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"filters": out})
}

type filterBody struct {
	Name       string          `json:"name"`
	Enabled    *bool           `json:"enabled,omitempty"`
	Priority   *int            `json:"priority,omitempty"`
	Conditions json.RawMessage `json:"conditions"`
	Actions    json.RawMessage `json:"actions"`
}

func (s *Server) apiFiltersCreate(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var body filterBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		s.writeErr(w, http.StatusBadRequest, "name required")
		return
	}
	if len(body.Conditions) == 0 {
		body.Conditions = json.RawMessage(`[]`)
	}
	if len(body.Actions) == 0 {
		body.Actions = json.RawMessage(`[]`)
	}
	enabled := true
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	priority := 100
	if body.Priority != nil {
		priority = *body.Priority
	}
	id, err := s.mailmeta.InsertMailFilter(r.Context(), userID, body.Name, enabled, priority, body.Conditions, body.Actions)
	if err != nil {
		s.writeErrAPIInternal(w, "filter create", err)
		return
	}
	s.writeJSON(w, http.StatusCreated, map[string]any{"filter": map[string]any{"id": id.String(), "name": body.Name}})
}

func (s *Server) apiFiltersUpdate(w http.ResponseWriter, r *http.Request, userID, filterID uuid.UUID) {
	var body filterBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		s.writeErr(w, http.StatusBadRequest, "name required")
		return
	}
	if len(body.Conditions) == 0 {
		body.Conditions = json.RawMessage(`[]`)
	}
	if len(body.Actions) == 0 {
		body.Actions = json.RawMessage(`[]`)
	}
	enabled := true
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	priority := 100
	if body.Priority != nil {
		priority = *body.Priority
	}
	if err := s.mailmeta.UpdateMailFilter(r.Context(), userID, filterID, body.Name, enabled, priority, body.Conditions, body.Actions); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "filter not found")
			return
		}
		s.writeErrAPIInternal(w, "filter update", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) apiFiltersDelete(w http.ResponseWriter, r *http.Request, userID, filterID uuid.UUID) {
	if err := s.mailmeta.DeleteMailFilter(r.Context(), userID, filterID); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "filter not found")
			return
		}
		s.writeErrAPIInternal(w, "filter delete", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
