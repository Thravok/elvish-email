package httpserver

import (
	"testing"

	"elvish/libs/go/config"
)

func TestMergeAdminHomePatch_roundTrip(t *testing.T) {
	base := []byte(`{
  "title": "OLD",
  "description": "d",
  "base_url": "https://x.test",
  "tweak_defaults": {"theme": "dark", "font": "ibm", "crosshair": false, "scanlines": true, "show_grid": true},
  "nav": [],
  "footer": {"tagline": "t", "pages": [], "protocol": [], "ascii_block": "", "ascii_scale_to_fit": false},
  "hero": {"section_index": "00", "section_title": "H", "lines": [], "lede_markdown": "", "stats": [], "load_bar_heights": [], "sys_rows": [], "keyboard_rows": [], "tools_section": {"section_index": "01", "section_title": "T", "hint": ""}},
  "terminal": {"lines": []},
  "tools": [],
  "log_page": {"section_index": "L", "section_title": "L", "headlines": [], "intro_markdown": "", "tagline_accent": "", "filters": [], "ticker": []},
  "ticker_home": [],
  "support": {"default_email": "", "contacts": []}
}`)
	admin := map[string]any{
		"site": map[string]any{
			"title":        "NEW",
			"description":  "d",
			"version":      "v1",
			"build_label":  "b",
			"license_line": "MIT",
			"hash_short":   "abc",
			"build_date":   "1",
			"base_url":     "https://x.test",
			"blog_signing": map[string]any{"public_key_url": "/signing.pub"},
		},
	}
	out, err := mergeAdminHomePatch(base, admin)
	if err != nil {
		t.Fatal(err)
	}
	h, err := config.ParseHomeJSON(out)
	if err != nil {
		t.Fatal(err)
	}
	if h.Title != "NEW" {
		t.Fatalf("title %q", h.Title)
	}
}

func TestMergeAdminHomePatch_rejectsInvalidSupportEmail(t *testing.T) {
	base := []byte(`{
  "title": "T",
  "description": "d",
  "base_url": "https://x.test",
  "tweak_defaults": {"theme": "dark", "font": "ibm", "crosshair": false, "scanlines": true, "show_grid": true},
  "nav": [],
  "footer": {"tagline": "t", "pages": [], "protocol": [], "ascii_block": "", "ascii_scale_to_fit": false},
  "hero": {"section_index": "00", "section_title": "H", "lines": [], "lede_markdown": "", "stats": [], "load_bar_heights": [], "sys_rows": [], "keyboard_rows": [], "tools_section": {"section_index": "01", "section_title": "T", "hint": ""}},
  "terminal": {"lines": []},
  "tools": [],
  "log_page": {"section_index": "L", "section_title": "L", "headlines": [], "intro_markdown": "", "tagline_accent": "", "filters": [], "ticker": []},
  "ticker_home": [],
  "support": {"default_email": "", "contacts": []}
}`)
	admin := map[string]any{
		"support": map[string]any{
			"default_email": "not-an-email",
			"contacts":      []any{},
		},
	}
	_, err := mergeAdminHomePatch(base, admin)
	if err == nil {
		t.Fatal("expected error")
	}
}
