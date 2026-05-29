package uptime

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"elvish/libs/go/config"
	"elvish/libs/go/models"
)

// ToolMonitorProbeID returns the probe result id for a tool-attached monitor (prefix mon_).
func ToolMonitorProbeID(toolSlug, monitorSubID string) string {
	composite := strings.TrimSpace(toolSlug) + "__" + strings.TrimSpace(monitorSubID)
	return monitorProbeID(composite)
}

// PrimaryProbeIDForTool returns the probe id used for home-card uptime lines and stats (tool_<slug> or mon_…).
func PrimaryProbeIDForTool(slug string, mon *config.ToolMonitor) string {
	slug = strings.TrimSpace(slug)
	if mon != nil && mon.Enabled && strings.TrimSpace(mon.ID) != "" {
		return ToolMonitorProbeID(slug, strings.TrimSpace(mon.ID))
	}
	return "tool_" + slug
}

// monitorRowFromActiveToolMonitor builds a row for RunMonitorRows when the monitor is enabled and has an id.
func monitorRowFromActiveToolMonitor(slug string, m *config.ToolMonitor) (models.MonitorRow, bool) {
	if m == nil || !m.Enabled {
		return models.MonitorRow{}, false
	}
	sub := strings.TrimSpace(m.ID)
	if sub == "" {
		return models.MonitorRow{}, false
	}
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return models.MonitorRow{}, false
	}
	composite := slug + "__" + sub
	return models.MonitorRow{
		ID:            composite,
		Enabled:       true,
		Name:          m.Name,
		Type:          m.Type,
		Interval:      m.Interval,
		GroupSlug:     slug,
		URL:           m.URL,
		Method:        m.Method,
		ExpectStatus:  append([]int(nil), m.ExpectStatus...),
		Keyword:       m.Keyword,
		JSONPath:      m.JSONPath,
		JSONValue:     m.JSONValue,
		Hostname:      m.Hostname,
		Port:          m.Port,
		DNSName:       m.DNSName,
		DNSRecordType: m.DNSRecordType,
		DNSExpected:   m.DNSExpected,
		WSURL:         m.WSURL,
	}, true
}

// FlattenToolMonitorsToMonitorRows converts enabled per-tool monitors into rows for RunMonitorRows.
func FlattenToolMonitorsToMonitorRows(h *config.Home) []models.MonitorRow {
	if h == nil {
		return nil
	}
	var out []models.MonitorRow
	for _, t := range h.Tools {
		if t.Hidden {
			continue
		}
		slug := strings.TrimSpace(t.Slug)
		if slug == "" {
			continue
		}
		m := t.ActiveUptimeMonitor()
		if m == nil {
			continue
		}
		row, ok := monitorRowFromActiveToolMonitor(slug, m)
		if !ok {
			continue
		}
		out = append(out, row)
	}
	return out
}

// TestToolUptimeOnce runs the custom monitor when enabled with an id; otherwise the default tool_<slug> HTTP probe.
func TestToolUptimeOnce(ctx context.Context, hc *http.Client, base, slug, openHref string, mon *config.ToolMonitor, timeout time.Duration) (ProbeResult, error) {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return ProbeResult{}, fmt.Errorf("uptime: slug required")
	}
	if base == "" {
		return ProbeResult{}, fmt.Errorf("uptime: probe base URL required")
	}
	if timeout <= 0 {
		timeout = 12 * time.Second
	}
	if row, ok := monitorRowFromActiveToolMonitor(slug, mon); ok {
		res := RunMonitorRows(ctx, hc, []models.MonitorRow{row}, timeout)
		if len(res) == 0 {
			return ProbeResult{}, fmt.Errorf("uptime: probe produced no result")
		}
		return res[0], nil
	}
	u, err := resolveToolProbeURL(base, slug, openHref)
	if err != nil {
		return ProbeResult{}, err
	}
	id := "tool_" + slug
	out := RunProbes(ctx, hc, []ResolvedTarget{{ID: id, URL: u, ExpectStatus: nil, Method: ""}}, timeout)
	if len(out) == 0 {
		return ProbeResult{}, fmt.Errorf("uptime: probe produced no result")
	}
	return out[0], nil
}
