package httpserver

import (
	"encoding/json"
	"fmt"

	"elvish/libs/go/config"
)

var adminHomeSiteRootKeys = []string{
	"title", "description", "version", "build_label", "license_line",
	"hash_short", "build_date", "base_url", "blog_signing",
}

var adminHomeSectionKeys = []string{
	"tweak_defaults", "nav", "footer", "hero", "terminal", "tools",
	"log_page", "ticker_home", "support",
}

// mergeAdminHomePatch merges admin panel JSON (site bundle + sections) onto base home.json bytes and validates the result.
func mergeAdminHomePatch(base []byte, admin map[string]any) ([]byte, error) {
	var root map[string]any
	if err := json.Unmarshal(base, &root); err != nil {
		return nil, fmt.Errorf("merge home: parse base: %w", err)
	}
	if site, ok := admin["site"].(map[string]any); ok {
		for _, k := range adminHomeSiteRootKeys {
			if v, has := site[k]; has {
				root[k] = v
			}
		}
	}
	for _, k := range adminHomeSectionKeys {
		if v, ok := admin[k]; ok {
			root[k] = v
		}
	}
	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("merge home: marshal: %w", err)
	}
	h, err := config.ParseHomeJSON(out)
	if err != nil {
		return nil, fmt.Errorf("merge home: invalid result: %w", err)
	}
	if err := h.ValidateSupport(); err != nil {
		return nil, fmt.Errorf("merge home: %w", err)
	}
	return out, nil
}
