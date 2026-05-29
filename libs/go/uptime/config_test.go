package uptime

import (
	"testing"

	"elvish/libs/go/config"
)

func TestResolveTargets_ToolsFromHome_MergesToolURLs(t *testing.T) {
	t.Parallel()
	f := &File{
		IncludeToolsFromHome: true,
		Targets: []TargetSpec{
			{ID: "home", Path: "/"},
		},
	}
	home := &config.Home{
		BaseURL: "https://example.org",
		Tools: []config.Tool{
			{Slug: "alpha", OpenHref: ""},
			{Slug: "beta", OpenHref: "https://cdn.example/tool"},
		},
	}
	out, err := ResolveTargets(f, home, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 3 {
		t.Fatalf("got %d targets, want 3", len(out))
	}
	if out[1].URL != "https://example.org/alpha/" {
		t.Errorf("tool path: %q", out[1].URL)
	}
	if out[2].URL != "https://cdn.example/tool" {
		t.Errorf("open href: %q", out[2].URL)
	}
}

func TestResolveTargets_ActiveMonitorOmitsDefaultToolHTTPRow(t *testing.T) {
	t.Parallel()
	f := &File{
		IncludeToolsFromHome: true,
		Targets: []TargetSpec{
			{ID: "home", Path: "/"},
		},
	}
	m := &config.ToolMonitor{
		ID:      "p1",
		Enabled: true,
		Name:    "ext",
		Type:    "http",
		URL:     "https://status.example/healthz",
		Method:  "GET",
	}
	home := &config.Home{
		BaseURL: "https://example.org",
		Tools: []config.Tool{
			{Slug: "alpha", OpenHref: "https://cdn.example/app", Monitor: m},
		},
	}
	out, err := ResolveTargets(f, home, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 1 {
		t.Fatalf("got %d targets, want 1 (home only; tool row handled by RunMonitorRows)", len(out))
	}
}

func TestFlattenToolMonitors_IncludesActiveMonitorURL(t *testing.T) {
	t.Parallel()
	m := &config.ToolMonitor{
		ID:      "p1",
		Enabled: true,
		Name:    "ext",
		Type:    "http",
		URL:     "https://example.org/api/health",
		Method:  "GET",
	}
	home := &config.Home{
		Tools: []config.Tool{{Slug: "alpha", Monitor: m}},
	}
	rows := FlattenToolMonitorsToMonitorRows(home)
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want 1", len(rows))
	}
	if rows[0].URL != "https://example.org/api/health" {
		t.Errorf("url %q", rows[0].URL)
	}
}

func TestBuildResolvedList_SkipsHiddenTools(t *testing.T) {
	t.Parallel()
	f := &File{
		IncludeToolsFromHome: true,
		Targets: []TargetSpec{
			{ID: "home", Path: "/"},
		},
	}
	home := &config.Home{
		BaseURL: "https://example.org",
		Tools: []config.Tool{
			{Slug: "alpha", OpenHref: ""},
			{Slug: "gone", Hidden: true},
			{Slug: "beta", OpenHref: "https://cdn.example/tool"},
		},
	}
	out, err := BuildResolvedList(f, home, "", true, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 3 {
		t.Fatalf("got %d targets, want 3 (home + alpha + beta; hidden omitted)", len(out))
	}
}

func TestDedupeTargets_DuplicateIDs_KeepsUnique(t *testing.T) {
	t.Parallel()
	in := []ResolvedTarget{
		{ID: "a", URL: "https://x/1"},
		{ID: "a", URL: "https://x/1"},
		{ID: "b", URL: "https://x/2"},
	}
	out := dedupeTargets(in)
	if len(out) != 2 {
		t.Fatalf("got %d", len(out))
	}
}
