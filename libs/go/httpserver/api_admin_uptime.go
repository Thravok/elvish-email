package httpserver

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"elvish/libs/go/models"
)

// apiAdminUptimeGet returns uptime settings, aggregate metadata, recent run logs, and the latest snapshot.
func (s *Server) apiAdminUptimeGet(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	ctx := r.Context()
	out := map[string]any{
		"persist": s.store != nil,
	}

	if s.store == nil {
		out["settings"] = models.DefaultUptimeSettings()
		out["runs"] = []any{}
		out["aggregate"] = nil
		out["note"] = "Database not configured — settings are defaults only; logs and panel persistence require COCKROACH_DSN."
	} else {
		st, err := s.store.GetUptimeSettings(ctx)
		if err != nil || st == nil {
			st = models.DefaultUptimeSettings()
		}
		out["settings"] = st
		agg, err := s.store.GetUptimeAggDoc(ctx)
		if err != nil {
			s.writeErrAPIInternal(w, "admin uptime aggregate", err)
			return
		}
		out["aggregate"] = agg
		runs, err := s.store.ListUptimeRuns(ctx, 80)
		if err != nil {
			s.writeErrAPIInternal(w, "admin uptime list runs", err)
			return
		}
		out["runs"] = runs
	}

	if snap := s.getUptimeMem(); snap != nil {
		out["latest"] = snap
	}
	s.writeJSON(w, http.StatusOK, out)
}

type adminUptimePostBody struct {
	Enabled              bool                       `json:"enabled"`
	Interval             string                     `json:"interval"`
	BaseURL              string                     `json:"base_url"`
	IncludeToolsFromHome bool                       `json:"include_tools_from_home"`
	Endpoints            []models.UptimeEndpointCfg `json:"endpoints"`
}

// apiAdminUptimePost saves uptime worker settings (interval, endpoints, etc.).
func (s *Server) apiAdminUptimePost(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required to persist uptime settings")
		return
	}
	var body adminUptimePostBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	iv := strings.TrimSpace(body.Interval)
	if iv == "" {
		iv = models.DefaultUptimeInterval
	}
	if _, err := time.ParseDuration(iv); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid interval duration")
		return
	}
	for i, e := range body.Endpoints {
		if strings.TrimSpace(e.ID) == "" || strings.TrimSpace(e.URL) == "" {
			s.writeErr(w, http.StatusBadRequest, "each endpoint needs id and url")
			return
		}
		m := strings.ToUpper(strings.TrimSpace(e.Method))
		if m == "" {
			m = "HEAD"
		}
		if m != "HEAD" && m != "GET" {
			s.writeErr(w, http.StatusBadRequest, "endpoint method must be HEAD or GET")
			return
		}
		body.Endpoints[i].ID = strings.TrimSpace(e.ID)
		body.Endpoints[i].URL = strings.TrimSpace(e.URL)
		body.Endpoints[i].Method = m
	}
	doc := &models.UptimeSettingsDoc{
		ID:                   models.UptimeSettingsID,
		Enabled:              body.Enabled,
		Interval:             iv,
		BaseURL:              strings.TrimSpace(body.BaseURL),
		IncludeToolsFromHome: body.IncludeToolsFromHome,
		Endpoints:            body.Endpoints,
	}
	if err := s.store.SetUptimeSettings(r.Context(), doc); err != nil {
		s.writeErrAPIInternal(w, "admin uptime save settings", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "settings": doc})
}

// apiAdminUptimeDeleteRuns removes all documents from uptime_runs (admin-only).
func (s *Server) apiAdminUptimeDeleteRuns(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required to clear uptime run logs")
		return
	}
	n, err := s.store.ClearUptimeRuns(r.Context())
	if err != nil {
		s.writeErrAPIInternal(w, "admin uptime clear runs", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": n})
}
