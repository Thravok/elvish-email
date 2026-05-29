// Package adminbootstrap emits JSON for the mail-embedded operator panel (GET /api/bootstrap.json).
package adminbootstrap

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"elvish/libs/go/blog"
)

// BuildJSONFromHomePath reads home.json into a generic map (preserves snake_case keys for the admin UI),
// reshapes the `site` bundle, appends live posts and metrics, and returns indented JSON.
func BuildJSONFromHomePath(homePath string, posts []blog.Post, metrics map[string]blog.EntryMetrics) ([]byte, error) {
	raw, err := os.ReadFile(homePath)
	if err != nil {
		return nil, err
	}
	return BuildJSONFromHomeBytes(raw, posts, metrics)
}

// BuildJSONFromHomeBytes accepts raw home.json bytes.
func BuildJSONFromHomeBytes(raw []byte, posts []blog.Post, metrics map[string]blog.EntryMetrics) ([]byte, error) {
	var root map[string]any
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, fmt.Errorf("bootstrap home json: %w", err)
	}

	siteKeys := []string{
		"title", "description", "version", "build_label", "license_line",
		"hash_short", "build_date", "base_url", "blog_signing",
	}
	site := map[string]any{}
	for _, k := range siteKeys {
		if v, ok := root[k]; ok {
			site[k] = v
		}
	}

	postRows, err := postRows(posts)
	if err != nil {
		return nil, err
	}
	metricsOut := map[string]any{}
	for slug, m := range metrics {
		row := map[string]any{}
		if strings.TrimSpace(m.Bytes) != "" {
			row["bytes"] = m.Bytes
		}
		if strings.TrimSpace(m.Reach) != "" {
			row["reach"] = m.Reach
		}
		if len(row) > 0 {
			metricsOut[slug] = row
		}
	}

	payload := map[string]any{
		"site":           site,
		"tweak_defaults": root["tweak_defaults"],
		"nav":            root["nav"],
		"footer":         root["footer"],
		"hero":           root["hero"],
		"terminal":       root["terminal"],
		"tools":          root["tools"],
		"log_page":       root["log_page"],
		"ticker_home":    root["ticker_home"],
		"support":        root["support"],
		"posts":          postRows,
		"metrics":        metricsOut,
	}
	return json.MarshalIndent(payload, "", "  ")
}

func postRows(posts []blog.Post) ([]map[string]any, error) {
	out := make([]map[string]any, 0, len(posts))
	for _, p := range posts {
		body := ""
		if p.BootstrapBody != "" {
			body = string(stripFrontMatter([]byte(p.BootstrapBody)))
		} else if p.SourcePath != "" {
			raw, err := os.ReadFile(p.SourcePath)
			if err != nil {
				return nil, fmt.Errorf("bootstrap read %s: %w", p.SourcePath, err)
			}
			body = string(stripFrontMatter(raw))
		}
		sigKind := ""
		if p.OpenPGP.HasSignature {
			sigKind = "openpgp"
		}
		if p.Signing.HasSignature {
			if sigKind == "" {
				sigKind = "minisign"
			} else {
				sigKind = "both"
			}
		}
		row := map[string]any{
			"date":           p.DisplayDate,
			"time":           p.Time,
			"title":          p.Title,
			"slug":           p.Slug,
			"type":           p.Type,
			"tags":           p.Tags,
			"draft":          p.Draft,
			"signed":         p.Signing.HasSignature || p.OpenPGP.HasSignature,
			"openpgp_signed": p.OpenPGP.HasSignature,
			"signature_kind": sigKind,
			"openpgp_sig":    p.DetachedOpenPGPArmored,
			"minisig":        p.DetachedMinisigASCII,
			"body":           body,
		}
		out = append(out, row)
	}
	return out, nil
}

func stripFrontMatter(raw []byte) []byte {
	parts := bytes.SplitN(raw, []byte("---"), 3)
	if len(parts) < 3 {
		return bytes.TrimSpace(raw)
	}
	return bytes.TrimSpace(parts[2])
}
