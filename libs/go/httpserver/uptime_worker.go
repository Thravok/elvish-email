package httpserver

import (
	"elvish/libs/go/paths"
	"context"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"elvish/libs/go/config"
	"elvish/libs/go/models"
	"elvish/libs/go/uptime"
)

// appendToolMonitorProbeResults runs per-tool Kuma-style monitors from home config and appends to results.
func appendToolMonitorProbeResults(pctx context.Context, home *config.Home, results []uptime.ProbeResult) []uptime.ProbeResult {
	rows := uptime.FlattenToolMonitorsToMonitorRows(home)
	if len(rows) == 0 {
		return results
	}
	mr := uptime.RunMonitorRows(pctx, uptimeHTTP, rows, 12*time.Second)
	return append(results, mr...)
}

// RunUptimeLoop probes on a schedule until ctx is cancelled. Interval and on/off come from
// SQL-backed uptime_settings when the store is configured; otherwise defaults (on, 5m).
// Probe base URL: settings.BaseURL, else fallbackBase (env / listen addr).
func (s *Server) RunUptimeLoop(ctx context.Context, fallbackBase string) {
	immediate := true
	for {
		if err := ctx.Err(); err != nil {
			return
		}
		settings := s.loadUptimeSettingsForWorker(ctx)
		if !settings.Enabled {
			if !uptimeSleep(ctx, 60*time.Second) {
				return
			}
			immediate = true
			continue
		}
		iv := parseUptimeInterval(settings.Interval)
		if !immediate {
			if !uptimeSleep(ctx, iv) {
				return
			}
		}
		immediate = false

		base := strings.TrimSpace(settings.BaseURL)
		base = strings.TrimRight(base, "/")
		if base == "" {
			base = strings.TrimRight(strings.TrimSpace(fallbackBase), "/")
		}
		if base == "" {
			if !uptimeSleep(ctx, iv) {
				return
			}
			continue
		}
		s.runUptimeProbeWithSettings(ctx, base, settings)
	}
}

func uptimeSleep(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

func parseUptimeInterval(raw string) time.Duration {
	d, err := time.ParseDuration(strings.TrimSpace(raw))
	if err != nil || d < 10*time.Second {
		return 5 * time.Minute
	}
	return d
}

func (s *Server) loadUptimeSettingsForWorker(ctx context.Context) *models.UptimeSettingsDoc {
	if s.store == nil {
		return models.DefaultUptimeSettings()
	}
	doc, err := s.store.GetUptimeSettings(ctx)
	if err != nil || doc == nil {
		return models.DefaultUptimeSettings()
	}
	return doc
}

var uptimeHTTP = &http.Client{Timeout: 15 * time.Second}

func (s *Server) runUptimeProbeWithSettings(ctx context.Context, base string, settings *models.UptimeSettingsDoc) {
	startedAt := time.Now()
	var runErr error
	defer func() {
		if s.telemetry == nil {
			return
		}
		if err := s.telemetry.RecordJobRun(ctx, "uptime", runErr, time.Since(startedAt)); err != nil && s.log != nil {
			s.log.Warn("uptime telemetry", "err", err)
		}
	}()
	pctx, cancel := context.WithTimeout(ctx, 55*time.Second)
	defer cancel()

	path := filepath.Join(paths.RepoRoot(s.root).APIContent(), "uptime.json")
	f, err := uptime.LoadFile(path)
	if err != nil {
		runErr = err
		s.log.Warn("uptime load json", "path", path, "err", err)
		return
	}
	h, err := s.loadHome(pctx)
	if err != nil {
		runErr = err
		s.log.Warn("uptime load home", "err", err)
		return
	}
	extra := make([]uptime.ExtraEndpoint, 0, len(settings.Endpoints))
	for _, e := range settings.Endpoints {
		extra = append(extra, uptime.ExtraEndpoint{ID: e.ID, URL: e.URL, Method: e.Method})
	}
	targets, err := uptime.BuildResolvedList(f, h, base, settings.IncludeToolsFromHome, extra)
	if err != nil {
		runErr = err
		s.log.Warn("uptime resolve targets", "err", err)
		return
	}
	results := uptime.RunProbes(pctx, uptimeHTTP, targets, 12*time.Second)
	results = appendToolMonitorProbeResults(pctx, h, results)
	at := time.Now().UTC()

	var stats map[string]uptime.StatsRollup
	var overall float64
	var oOK, oFail int64

	statsPeriod := ""
	if s.store != nil {
		if err := s.store.InsertUptimeRun(pctx, at, results); err != nil {
			s.log.Warn("uptime log run", "err", err)
		}
		if err := s.store.IncUptimeAggregate(pctx, at, results); err != nil {
			s.log.Warn("uptime aggregate", "err", err)
		}
		st, ov, ym, err := s.store.GetUptimeStatsRollup(pctx)
		if err != nil {
			s.log.Warn("uptime read stats", "err", err)
		} else {
			stats, overall, oOK, oFail = st, ov, sumRollupOK(st), sumRollupFail(st)
			statsPeriod = ym
		}
	} else {
		s.bumpLocalUptimeAgg(at, results)
		var ym string
		stats, overall, oOK, oFail, ym = s.localUptimeStats()
		statsPeriod = ym
	}

	snap := &uptime.Snapshot{
		CheckedAt:        uptime.RFC3339Time{Time: at},
		Targets:          results,
		Stats:            stats,
		StatsPeriodUTC:   statsPeriod,
		OverallOK:        oOK,
		OverallFail:      oFail,
		OverallUptimePct: overall,
	}

	if s.uptimeSnap != nil {
		if err := s.uptimeSnap.SaveSnapshotJSON(pctx, snap); err != nil {
			s.log.Warn("uptime valkey snapshot", "err", err)
		}
	}

	s.setUptimeMem(snap)
}

func sumRollupOK(m map[string]uptime.StatsRollup) int64 {
	var n int64
	for _, v := range m {
		n += v.OK
	}
	return n
}

func sumRollupFail(m map[string]uptime.StatsRollup) int64 {
	var n int64
	for _, v := range m {
		n += v.Fail
	}
	return n
}

func (s *Server) bumpLocalUptimeAgg(at time.Time, results []uptime.ProbeResult) {
	ym := at.UTC().Format("2006-01")
	s.uptimeAggMu.Lock()
	defer s.uptimeAggMu.Unlock()
	if s.uptimeLocalYM != ym {
		s.uptimeLocal = nil
		s.uptimeLocalYM = ym
	}
	if s.uptimeLocal == nil {
		s.uptimeLocal = make(map[string]struct{ OK, Fail int64 })
	}
	for _, r := range results {
		cur := s.uptimeLocal[r.ID]
		if r.OK {
			cur.OK++
		} else {
			cur.Fail++
		}
		s.uptimeLocal[r.ID] = cur
	}
}

func (s *Server) localUptimeStats() (map[string]uptime.StatsRollup, float64, int64, int64, string) {
	s.uptimeAggMu.Lock()
	defer s.uptimeAggMu.Unlock()
	out := make(map[string]uptime.StatsRollup, len(s.uptimeLocal))
	var totOK, totFail int64
	for id, v := range s.uptimeLocal {
		n := v.OK + v.Fail
		pct := 0.0
		if n > 0 {
			pct = float64(v.OK) * 100.0 / float64(n)
		}
		out[id] = uptime.StatsRollup{OK: v.OK, Fail: v.Fail, UptimePct: pct}
		totOK += v.OK
		totFail += v.Fail
	}
	overall := 0.0
	if t := totOK + totFail; t > 0 {
		overall = float64(totOK) * 100.0 / float64(t)
	}
	return out, overall, totOK, totFail, s.uptimeLocalYM
}

func (s *Server) setUptimeMem(snap *uptime.Snapshot) {
	s.uptimeMu.Lock()
	defer s.uptimeMu.Unlock()
	s.uptimeMem = snap
}

func (s *Server) getUptimeMem() *uptime.Snapshot {
	s.uptimeMu.Lock()
	defer s.uptimeMu.Unlock()
	return s.uptimeMem
}
