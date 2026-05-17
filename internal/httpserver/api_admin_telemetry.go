package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"elvish/internal/models"
	"elvish/internal/telemetry"
)

type adminTelemetryPostBody struct {
	Enabled       bool `json:"enabled"`
	RetentionDays int  `json:"retention_days"`
	ExportEnabled bool `json:"export_enabled"`
}

type adminTelemetryExportBody struct {
	Days int `json:"days"`
}

// apiAdminTelemetryGet returns telemetry settings plus recent aggregate rollups.
func (s *Server) apiAdminTelemetryGet(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	out := map[string]any{
		"persist": s.store != nil,
	}
	if s.telemetry == nil {
		out["settings"] = models.DefaultTelemetrySettings()
		out["summary"] = []any{}
		out["recent"] = []any{}
		s.writeJSON(w, http.StatusOK, out)
		return
	}
	snap, err := s.telemetry.Snapshot(r.Context(), 7, 72, 200)
	if err != nil {
		s.writeErrAPIInternal(w, "admin telemetry get", err)
		return
	}
	out["settings"] = snap.Settings
	out["summary"] = snap.Summary
	out["recent"] = snap.Recent
	if s.store == nil {
		out["note"] = "Database not configured — telemetry remains disabled and dashboards are empty until COCKROACH_DSN is available."
	}
	s.writeJSON(w, http.StatusOK, out)
}

// apiAdminTelemetryPost saves the singleton telemetry settings.
func (s *Server) apiAdminTelemetryPost(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required to persist telemetry settings")
		return
	}
	var body adminTelemetryPostBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	doc, err := s.telemetry.SaveSettings(r.Context(), &models.TelemetrySettingsDoc{
		ID:            models.TelemetrySettingsID,
		Enabled:       body.Enabled,
		RetentionDays: body.RetentionDays,
		ExportEnabled: body.ExportEnabled,
	})
	if err != nil {
		s.writeErrAPIInternal(w, "admin telemetry save", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "settings": doc})
}

// apiAdminTelemetryExport returns a bounded aggregate JSON export.
func (s *Server) apiAdminTelemetryExport(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required to export telemetry")
		return
	}
	var body adminTelemetryExportBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	doc, err := s.telemetry.Export(r.Context(), body.Days)
	if errors.Is(err, telemetry.ErrExportDisabled) {
		s.writeErr(w, http.StatusForbidden, "manual export is disabled")
		return
	}
	if err != nil {
		s.writeErrAPIInternal(w, "admin telemetry export", err)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", telemetryExportFilename()))
	s.writeJSON(w, http.StatusOK, doc)
}

func telemetryExportFilename() string {
	return "elvish-telemetry-export-" + time.Now().UTC().Format("20060102-150405") + ".json"
}
