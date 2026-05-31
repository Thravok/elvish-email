package httpserver

import (
	"testing"
	"time"

	"elvish/internal/config"
	"elvish/internal/uptime"
)

func TestCountToolsOnline(t *testing.T) {
	t.Parallel()
	snap := &uptime.Snapshot{
		Targets: []uptime.ProbeResult{
			{ID: "home", OK: true},
			{ID: "tool_alpha", OK: true},
			{ID: "tool_beta", OK: false},
		},
	}
	vis := []config.Tool{{Slug: "alpha"}, {Slug: "beta"}}
	n := countToolsOnline(snap, vis)
	if n != 1 {
		t.Fatalf("got %d want 1 (only alpha OK)", n)
	}
}

func TestCountToolsOnline_CustomMonitorID(t *testing.T) {
	t.Parallel()
	slug := "alpha"
	sub := "edge"
	rid := uptime.ToolMonitorProbeID(slug, sub)
	snap := &uptime.Snapshot{
		Targets: []uptime.ProbeResult{{ID: rid, OK: true}},
	}
	mon := &config.ToolMonitor{ID: sub, Enabled: true}
	vis := []config.Tool{{Slug: slug, Monitor: mon}}
	if n := countToolsOnline(snap, vis); n != 1 {
		t.Fatalf("mon_ probe: got %d want 1", n)
	}
}

func TestVisibleHomeTools(t *testing.T) {
	t.Parallel()
	in := []config.Tool{
		{Slug: "a"},
		{Slug: "b", Hidden: true},
		{Slug: "c"},
	}
	out := visibleHomeTools(in)
	if len(out) != 2 || out[0].Slug != "a" || out[1].Slug != "c" {
		t.Fatalf("got %+v", out)
	}
}

func TestAggregateVisibleToolsProbeStats(t *testing.T) {
	t.Parallel()
	snap := &uptime.Snapshot{
		Stats: map[string]uptime.StatsRollup{
			"tool_alpha": {OK: 99, Fail: 1, UptimePct: 99},
			"tool_beta":  {OK: 100, Fail: 0, UptimePct: 100},
		},
	}
	vis := []config.Tool{{Slug: "alpha"}, {Slug: "beta"}, {Slug: "gamma"}}
	pct, ok, fail, has := aggregateVisibleToolsProbeStats(snap, vis)
	if !has {
		t.Fatal("expected rollup")
	}
	if ok != 199 || fail != 1 {
		t.Fatalf("ok/fail got %d/%d want 199/1", ok, fail)
	}
	want := 199.0 * 100.0 / 200.0
	if pct != want {
		t.Fatalf("pct got %v want %v", pct, want)
	}
}

func TestHeroUptimeBars(t *testing.T) {
	t.Parallel()
	snap := &uptime.Snapshot{
		Targets: []uptime.ProbeResult{
			{ID: "tool_a", OK: true},
			{ID: "tool_b", OK: false},
		},
		Stats: map[string]uptime.StatsRollup{
			"tool_a": {OK: 100, Fail: 0, UptimePct: 100},
			"tool_b": {OK: 50, Fail: 50, UptimePct: 50},
		},
	}
	vis := []config.Tool{{Slug: "a"}, {Slug: "b"}}
	bars, pulse := heroUptimeBars(vis, snap)
	if pulse {
		t.Fatal("expected probe-driven bars")
	}
	if len(bars) != 2 {
		t.Fatalf("len %d", len(bars))
	}
	if bars[0].LatestDown || bars[0].HeightPx < 40 {
		t.Fatalf("a: %+v", bars[0])
	}
	if !bars[1].LatestDown {
		t.Fatalf("b should be down: %+v", bars[1])
	}
	_, pulseNil := heroUptimeBars(vis, nil)
	if !pulseNil {
		t.Fatal("nil snap => pulse fallback")
	}
}

func TestFormatProbeAgeShort(t *testing.T) {
	t.Parallel()
	base := time.Date(2026, 5, 4, 12, 0, 0, 0, time.UTC)
	if g := formatProbeAgeShort(base, base); g != "NOW" {
		t.Fatalf("same instant: %q", g)
	}
	if g := formatProbeAgeShort(base, base.Add(20*time.Second)); g != "NOW" {
		t.Fatalf("20s: %q", g)
	}
	if g := formatProbeAgeShort(base, base.Add(3*time.Minute+1*time.Second)); g != "3m ago" {
		t.Fatalf("3m: %q", g)
	}
	if g := formatProbeAgeShort(base, base.Add(2*time.Hour)); g != "2h ago" {
		t.Fatalf("2h: %q", g)
	}
}
