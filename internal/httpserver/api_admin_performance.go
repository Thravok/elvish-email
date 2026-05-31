package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"elvish/internal/models"
)

type adminPerformanceExportBody struct {
	Days int `json:"days"`
}

// apiAdminPerformanceGet returns the privacy-safe performance dashboard payload.
func (s *Server) apiAdminPerformanceGet(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	ctx := r.Context()
	days := performanceWindowDays(r.URL.Query().Get("days"))
	out := map[string]any{
		"persist": s.store != nil,
		"days":    days,
		"queue":   s.performanceQueueSnapshot(ctx),
		"uptime":  s.performanceUptimeSummary(ctx),
		"runtime": s.performanceRuntimeContext(ctx),
	}
	if s.telemetry == nil {
		out["settings"] = models.DefaultTelemetrySettings()
		out["overview"] = models.PerformanceOverview{}
		out["hotspots"] = []models.PerformanceHotspot{}
		out["summary"] = []models.TelemetrySummaryRow{}
		out["recent"] = []models.TelemetryRollupRow{}
		out["latency_summary"] = []models.TelemetryLatencyBucketSummaryRow{}
		out["latency_recent"] = []models.TelemetryLatencyBucketRow{}
		s.writeJSON(w, http.StatusOK, out)
		return
	}
	snap, err := s.telemetry.PerformanceSnapshot(ctx, days, days*24, 2000, 4000)
	if err != nil {
		s.writeErrAPIInternal(w, "admin performance get", err)
		return
	}
	out["settings"] = snap.Settings
	out["overview"] = snap.Overview
	out["hotspots"] = snap.Hotspots
	out["summary"] = snap.Summary
	out["recent"] = snap.Recent
	out["latency_summary"] = snap.LatencySummary
	out["latency_recent"] = snap.LatencyRecent
	if s.store == nil {
		out["note"] = "Database not configured — telemetry remains disabled and performance dashboards stay empty until COCKROACH_DSN is available."
	}
	s.writeJSON(w, http.StatusOK, out)
}

// apiAdminPerformanceExport returns a bounded manual performance export bundle.
func (s *Server) apiAdminPerformanceExport(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required to export performance data")
		return
	}
	var body adminPerformanceExportBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil && err != io.EOF {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	st, err := s.telemetry.Settings(r.Context())
	if err != nil {
		s.writeErrAPIInternal(w, "admin performance export settings", err)
		return
	}
	if !st.ExportEnabled {
		s.writeErr(w, http.StatusForbidden, "manual export is disabled")
		return
	}
	days := performanceWindowDays(strconv.Itoa(body.Days))
	snap, err := s.telemetry.PerformanceSnapshot(r.Context(), days, days*24, 4000, 8000)
	if err != nil {
		s.writeErrAPIInternal(w, "admin performance export snapshot", err)
		return
	}
	doc := models.PerformanceExportDoc{
		SchemaVersion:  models.PerformanceExportSchemaV1,
		GeneratedAt:    time.Now().UTC(),
		Days:           days,
		Privacy:        performancePrivacyContract(),
		Settings:       snap.Settings,
		Overview:       snap.Overview,
		Runtime:        s.performanceRuntimeContext(r.Context()),
		Queue:          s.performanceQueueSnapshot(r.Context()),
		Uptime:         s.performanceUptimeSummary(r.Context()),
		Hotspots:       snap.Hotspots,
		Summary:        snap.Summary,
		Rollups:        snap.Recent,
		LatencySummary: snap.LatencySummary,
		LatencyRollups: snap.LatencyRecent,
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", performanceExportFilename()))
	s.writeJSON(w, http.StatusOK, doc)
}

func performanceWindowDays(raw string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(raw))
	switch {
	case n <= 1:
		return 1
	case n <= 7:
		return 7
	case n <= 30:
		return 30
	default:
		return 30
	}
}

func performanceExportFilename() string {
	return "elvish-performance-export-" + time.Now().UTC().Format("20060102-150405") + ".json"
}

func performancePrivacyContract() models.PerformancePrivacyContract {
	return models.PerformancePrivacyContract{
		Anonymous:   true,
		SelfHosted:  true,
		ManualOnly:  true,
		NoUniqueIDs: true,
		ExcludedDimensions: []string{
			"user_id", "session_id", "email", "username", "ip", "user_agent",
			"raw_url", "domain", "message_id", "blob_ref", "token", "free_form_labels",
		},
	}
}

func (s *Server) performanceRuntimeContext(ctx context.Context) models.PerformanceRuntimeContext {
	rt := models.PerformanceRuntimeContext{
		HasDatabase:  s.store != nil,
		HasMailMeta:  s.mailmeta != nil,
		HasScylla:    s.scylla != nil,
		HasBlobStore: s.blob != nil,
		HasUptime:    s.latestUptimeSnapshot(ctx) != nil,
	}
	if home, err := s.loadHome(ctx); err == nil && home != nil {
		rt.Version = strings.TrimSpace(home.Version)
		rt.BuildLabel = strings.TrimSpace(home.BuildLabel)
	}
	return rt
}

func (s *Server) performanceQueueSnapshot(ctx context.Context) models.PerformanceQueueSnapshot {
	if s.mailmeta == nil {
		return models.PerformanceQueueSnapshot{}
	}
	stats, err := s.mailmeta.OutboxStats(ctx)
	if err != nil {
		return models.PerformanceQueueSnapshot{}
	}
	return models.PerformanceQueueSnapshot{
		Pending: stats["pending"],
		Sending: stats["sending"],
		Sent:    stats["sent"],
		Failed:  stats["failed"],
	}
}

func (s *Server) performanceUptimeSummary(ctx context.Context) models.PerformanceUptimeSummary {
	snap := s.latestUptimeSnapshot(ctx)
	if snap == nil {
		return models.PerformanceUptimeSummary{}
	}
	return models.PerformanceUptimeSummary{
		Live:             true,
		CheckedAt:        snap.CheckedAt.Time.UTC(),
		StatsPeriodUTC:   strings.TrimSpace(snap.StatsPeriodUTC),
		OverallOK:        snap.OverallOK,
		OverallFail:      snap.OverallFail,
		OverallUptimePct: snap.OverallUptimePct,
	}
}
