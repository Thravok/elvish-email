package config

import (
	"testing"
)

func TestParseHomeJSON_legacyStackMergesIntoSignals(t *testing.T) {
	raw := []byte(`{
  "title": "t",
  "description": "d",
  "base_url": "https://example.test",
  "tools": [
    {
      "id": "01",
      "slug": "shroud",
      "name": "SHROUD",
      "tag": "live",
      "desc": "x",
      "stack": ["WASM", "TS"],
      "glyph": "shroud",
      "calls": "—",
      "since": "23.04"
    }
  ]
}`)
	h, err := ParseHomeJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(h.Tools) != 1 {
		t.Fatalf("tools: got %d want 1", len(h.Tools))
	}
	got := h.Tools[0].Signals
	if len(got) != 2 || got[0] != "WASM" || got[1] != "TS" {
		t.Fatalf("Signals %#v want [WASM TS]", got)
	}
}

func TestParseHomeJSON_migratesHealthHrefToMonitor(t *testing.T) {
	raw := []byte(`{
  "title": "t",
  "description": "d",
  "base_url": "https://example.test",
  "tools": [
    {
      "id": "01",
      "slug": "alpha",
      "name": "A",
      "tag": "live",
      "desc": "x",
      "signals": [],
      "glyph": "shroud",
      "calls": "—",
      "since": "1",
      "health_href": "https://other.example/h"
    }
  ]
}`)
	h, err := ParseHomeJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	m := h.Tools[0].Monitor
	if m == nil || m.URL != "https://other.example/h" || m.Type != "http" {
		t.Fatalf("monitor %#v", m)
	}
	if h.Tools[0].HealthHref != "" {
		t.Fatalf("expected health_href cleared, got %q", h.Tools[0].HealthHref)
	}
}

func TestParseHomeJSON_signalsPreferredOverLegacyStack(t *testing.T) {
	raw := []byte(`{
  "title": "t",
  "description": "d",
  "base_url": "https://example.test",
  "tools": [
    {
      "id": "01",
      "slug": "a",
      "name": "A",
      "tag": "live",
      "desc": "x",
      "signals": ["NO-UPLOAD"],
      "stack": ["WASM"],
      "glyph": "shroud",
      "calls": "—",
      "since": "1"
    }
  ]
}`)
	h, err := ParseHomeJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	got := h.Tools[0].Signals
	if len(got) != 1 || got[0] != "NO-UPLOAD" {
		t.Fatalf("Signals %#v want [NO-UPLOAD]", got)
	}
}

func TestValidateSupport_ok(t *testing.T) {
	h := &Home{
		Support: SupportConfig{
			DefaultEmail: "support@example.com",
			Contacts: []SupportContact{
				{Label: "Security", Email: "security@example.com"},
			},
		},
	}
	if err := h.ValidateSupport(); err != nil {
		t.Fatal(err)
	}
	rows := h.Support.PublicSupportRows()
	if len(rows) != 2 {
		t.Fatalf("rows len %d", len(rows))
	}
	if rows[0].Label != "Support" || rows[0].Email != "support@example.com" {
		t.Fatalf("row0 %#v", rows[0])
	}
}

func TestValidateSupport_badDefault(t *testing.T) {
	h := &Home{Support: SupportConfig{DefaultEmail: "@@@", Contacts: nil}}
	if err := h.ValidateSupport(); err == nil {
		t.Fatal("expected error")
	}
}

func TestValidateSupport_contactLabelWithoutEmail(t *testing.T) {
	h := &Home{Support: SupportConfig{Contacts: []SupportContact{{Label: "x", Email: ""}}}}
	if err := h.ValidateSupport(); err == nil {
		t.Fatal("expected error")
	}
}
