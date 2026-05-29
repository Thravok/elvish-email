package httpserver

import (
	"context"
	"fmt"
	"strings"
	"time"

	"elvish/libs/go/config"
	"elvish/libs/go/render"
	"elvish/libs/go/uptime"
)

// monitorNameLookup maps probe id (mon_…) to configured monitor display name (from each tool's monitor).
func (s *Server) monitorNameLookup(ctx context.Context) map[string]string {
	out := make(map[string]string)
	h, err := s.loadHome(ctx)
	if err != nil || h == nil {
		return out
	}
	for _, t := range h.Tools {
		slug := strings.TrimSpace(t.Slug)
		if m := t.ActiveUptimeMonitor(); m != nil {
			sub := strings.TrimSpace(m.ID)
			if sub == "" {
				continue
			}
			key := uptime.ToolMonitorProbeID(slug, sub)
			if n := strings.TrimSpace(m.Name); n != "" {
				out[key] = n
			}
		}
	}
	return out
}

// publicProbeResultsJSON returns probe rows for public JSON without request URLs.
func publicProbeResultsJSON(targets []uptime.ProbeResult) []map[string]any {
	out := make([]map[string]any, 0, len(targets))
	for _, r := range targets {
		m := map[string]any{
			"id":          r.ID,
			"method":      r.Method,
			"ok":          r.OK,
			"status_code": r.StatusCode,
			"latency_ms":  r.LatencyMS,
		}
		if strings.TrimSpace(r.Error) != "" {
			m["error"] = r.Error
		}
		out = append(out, m)
	}
	return out
}

// uptimeAPIPayload builds the public /api/uptime.json body (URLs redacted).
func (s *Server) uptimeAPIPayload(ctx context.Context) map[string]any {
	snap := s.latestUptimeSnapshot(ctx)
	if snap != nil {
		m := map[string]any{
			"live":               true,
			"checked_at":         snap.CheckedAt,
			"targets":            publicProbeResultsJSON(snap.Targets),
			"stats":              snap.Stats,
			"overall_ok":         snap.OverallOK,
			"overall_fail":       snap.OverallFail,
			"overall_uptime_pct": snap.OverallUptimePct,
		}
		if ym := strings.TrimSpace(snap.StatsPeriodUTC); ym != "" {
			m["stats_period_utc"] = ym
		}
		return m
	}
	return map[string]any{
		"live":    false,
		"message": "No uptime snapshot yet (first probe pending or uptime loop disabled).",
	}
}

func uptimeLineForTool(snap *uptime.Snapshot, slug string, mon *config.ToolMonitor) string {
	if snap == nil || strings.TrimSpace(slug) == "" {
		return "—"
	}
	rid := uptime.PrimaryProbeIDForTool(slug, mon)
	var last *uptime.ProbeResult
	for i := len(snap.Targets) - 1; i >= 0; i-- {
		if snap.Targets[i].ID == rid {
			t := snap.Targets[i]
			last = &t
			break
		}
	}
	if st, ok := snap.Stats[rid]; ok && st.OK+st.Fail > 0 {
		s := fmt.Sprintf("%.1f%%", st.UptimePct)
		if last != nil && !last.OK {
			return s + " · DOWN"
		}
		return s
	}
	if last != nil {
		if last.OK {
			return "UP"
		}
		return "DOWN"
	}
	return "—"
}

func displayNameForUptimeTarget(h *config.Home, id string, monitorNames map[string]string) string {
	id = strings.TrimSpace(id)
	if id == "" {
		return "—"
	}
	if strings.HasPrefix(id, "mon_") {
		if monitorNames != nil {
			if n, ok := monitorNames[id]; ok && strings.TrimSpace(n) != "" {
				return n
			}
		}
		return "MON · " + strings.TrimPrefix(id, "mon_")
	}
	if strings.HasPrefix(id, "tool_") && h != nil {
		slug := strings.TrimPrefix(id, "tool_")
		for _, t := range h.Tools {
			if strings.EqualFold(strings.TrimSpace(t.Slug), slug) {
				return t.Name
			}
		}
		return slug
	}
	return id
}

func formatOverallUptimePct(pct float64, ok, fail int64) string {
	if ok+fail == 0 {
		return "—"
	}
	return fmt.Sprintf("%.2f%%", pct)
}

func formatCheckedAt(t time.Time) string {
	if t.IsZero() {
		return "—"
	}
	return t.UTC().Format(time.RFC3339)
}

// formatProbeAgeShort renders how long ago the uptime snapshot was taken (hero panels, compact).
func formatProbeAgeShort(t, now time.Time) string {
	if t.IsZero() {
		return "—"
	}
	tu := t.UTC()
	nu := now.UTC()
	if !nu.After(tu) {
		return "NOW"
	}
	d := nu.Sub(tu)
	if d < 45*time.Second {
		return "NOW"
	}
	if d < time.Hour {
		m := int(d / time.Minute)
		if m < 1 {
			m = 1
		}
		return fmt.Sprintf("%dm ago", m)
	}
	if d < 48*time.Hour {
		h := int(d / time.Hour)
		if h < 1 {
			h = 1
		}
		return fmt.Sprintf("%dh ago", h)
	}
	days := int(d / (24 * time.Hour))
	if days < 1 {
		days = 1
	}
	return fmt.Sprintf("%dd ago", days)
}

func buildStatusRows(h *config.Home, snap *uptime.Snapshot, monitorNames map[string]string) []render.StatusRow {
	if snap == nil {
		return nil
	}
	rows := make([]render.StatusRow, 0, len(snap.Targets))
	for _, r := range snap.Targets {
		pctStr := "—"
		if st, ok := snap.Stats[r.ID]; ok && st.OK+st.Fail > 0 {
			pctStr = fmt.Sprintf("%.2f%%", st.UptimePct)
		}
		errShort := r.Error
		if len(errShort) > 120 {
			errShort = errShort[:117] + "..."
		}
		rows = append(rows, render.StatusRow{
			ID:          r.ID,
			DisplayName: displayNameForUptimeTarget(h, r.ID, monitorNames),
			OK:          r.OK,
			StatusCode:  r.StatusCode,
			LatencyMS:   r.LatencyMS,
			Error:       errShort,
			UptimePct:   pctStr,
		})
	}
	return rows
}
