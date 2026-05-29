package httpserver

import (
	"testing"

	"elvish/libs/go/config"
)

func TestBuildHomeHeroStats_liveRollup(t *testing.T) {
	t.Parallel()
	base := []config.StatKV{
		{Key: "TOOLS", Value: "99"},
		{Key: "CALLS · 30D", Value: "0"},
		{Key: "UPTIME", Value: "0%"},
		{Key: "LICENSE", Value: "AGPL"},
	}
	got := buildHomeHeroStats(base, 7, 3_450_000, true, "88.12%")
	if got[0].Value != "7" {
		t.Fatalf("TOOLS: got %q", got[0].Value)
	}
	if got[1].Value != "3.5M" {
		t.Fatalf("CALLS: got %q want 3.5M", got[1].Value)
	}
	if got[2].Value != "88.12%" {
		t.Fatalf("UPTIME: got %q", got[2].Value)
	}
	if got[3].Value != "AGPL" {
		t.Fatalf("LICENSE should pass through: got %q", got[3].Value)
	}
}

func TestBuildHomeHeroStats_callsUnavailable(t *testing.T) {
	t.Parallel()
	base := []config.StatKV{{Key: "CALLS · 30D", Value: "34.6M"}}
	got := buildHomeHeroStats(base, 1, 0, false, "—")
	if got[0].Value != "—" {
		t.Fatalf("got %q", got[0].Value)
	}
}

func TestBuildHomeHeroStats_emptyBase(t *testing.T) {
	t.Parallel()
	if buildHomeHeroStats(nil, 1, 0, true, "1%") != nil {
		t.Fatal("expected nil")
	}
}
