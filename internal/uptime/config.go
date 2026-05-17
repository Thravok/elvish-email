// Package uptime loads probe configuration and runs HTTP checks against the public site and tools.
package uptime

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"elvish/internal/config"
)

// File is the shape of content/uptime.json.
type File struct {
	BaseURL              string       `json:"base_url"`
	IncludeToolsFromHome bool         `json:"include_tools_from_home"`
	Targets              []TargetSpec `json:"targets"`
}

// TargetSpec is one row in uptime.json before URL resolution.
type TargetSpec struct {
	ID           string `json:"id"`
	Path         string `json:"path"`
	URL          string `json:"url"`
	ExpectStatus []int  `json:"expect_status"`
	Method       string `json:"method"`
}

// LoadFile reads and parses path (typically content/uptime.json).
func LoadFile(path string) (*File, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("uptime: read %s: %w", path, err)
	}
	var f File
	if err := json.Unmarshal(raw, &f); err != nil {
		return nil, fmt.Errorf("uptime: parse json: %w", err)
	}
	return &f, nil
}

// ResolvedTarget is a concrete URL to probe.
type ResolvedTarget struct {
	ID           string
	URL          string
	ExpectStatus []int
	Method       string
}

// ExtraEndpoint is an admin-configured check (full URL or path under the probe base).
type ExtraEndpoint struct {
	ID     string
	URL    string
	Method string
}

// resolveToolProbeURL picks the HTTP(S) URL for the default tool_<slug> uptime check (same rules as /go/ redirects).
func resolveToolProbeURL(base, slug, openHref string) (string, error) {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	slug = strings.TrimSpace(slug)
	open := strings.TrimSpace(openHref)
	if open != "" && (strings.HasPrefix(open, "http://") || strings.HasPrefix(open, "https://")) {
		return open, nil
	}
	if open != "" && strings.HasPrefix(open, "/") {
		return base + open, nil
	}
	return base + "/" + slug + "/", nil
}

// ResolveTargets builds probe targets from uptime.json, optional home.json tools, and base URL.
func ResolveTargets(f *File, home *config.Home, baseURLOverride string) ([]ResolvedTarget, error) {
	return BuildResolvedList(f, home, baseURLOverride, f.IncludeToolsFromHome, nil)
}

// BuildResolvedList merges file targets, optional tool URLs, and extra admin endpoints.
func BuildResolvedList(f *File, home *config.Home, baseURLOverride string, includeTools bool, extra []ExtraEndpoint) ([]ResolvedTarget, error) {
	base := strings.TrimSpace(baseURLOverride)
	if base == "" {
		base = strings.TrimSpace(f.BaseURL)
	}
	if base == "" && home != nil {
		base = strings.TrimSpace(home.BaseURL)
	}
	if base == "" {
		return nil, fmt.Errorf("uptime: no base_url (set in uptime.json, home.json, admin panel, or ELVISH_UPTIME_BASE_URL)")
	}
	base = strings.TrimRight(base, "/")

	var out []ResolvedTarget
	for _, t := range f.Targets {
		rt, err := resolveOne(base, t)
		if err != nil {
			return nil, err
		}
		out = append(out, rt)
	}
	if includeTools && home != nil {
		for _, tool := range home.Tools {
			if tool.Hidden {
				continue
			}
			slug := strings.TrimSpace(tool.Slug)
			if slug == "" {
				continue
			}
			if tool.ActiveUptimeMonitor() != nil {
				continue
			}
			id := "tool_" + slug
			u, err := resolveToolProbeURL(base, slug, tool.OpenHref)
			if err != nil {
				return nil, err
			}
			out = append(out, ResolvedTarget{
				ID:           id,
				URL:          u,
				ExpectStatus: nil,
				Method:       "",
			})
		}
	}
	for _, e := range extra {
		rt, err := resolveExtra(base, e)
		if err != nil {
			return nil, err
		}
		out = append(out, rt)
	}
	return dedupeTargets(out), nil
}

func resolveExtra(base string, e ExtraEndpoint) (ResolvedTarget, error) {
	id := strings.TrimSpace(e.ID)
	if id == "" {
		return ResolvedTarget{}, fmt.Errorf("uptime: extra endpoint missing id")
	}
	u := strings.TrimSpace(e.URL)
	if u == "" {
		return ResolvedTarget{}, fmt.Errorf("uptime: extra endpoint %q missing url", id)
	}
	method := strings.ToUpper(strings.TrimSpace(e.Method))
	if method == "" {
		method = "HEAD"
	}
	if method != "HEAD" && method != "GET" {
		return ResolvedTarget{}, fmt.Errorf("uptime: extra %q: method must be HEAD or GET", id)
	}
	var full string
	if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
		full = u
	} else {
		if !strings.HasPrefix(u, "/") {
			u = "/" + u
		}
		full = base + u
	}
	return ResolvedTarget{ID: id, URL: full, ExpectStatus: nil, Method: method}, nil
}

func resolveOne(base string, t TargetSpec) (ResolvedTarget, error) {
	id := strings.TrimSpace(t.ID)
	if id == "" {
		return ResolvedTarget{}, fmt.Errorf("uptime: target missing id")
	}
	u := strings.TrimSpace(t.URL)
	if u == "" {
		p := strings.TrimSpace(t.Path)
		if p == "" {
			return ResolvedTarget{}, fmt.Errorf("uptime: target %q needs path or url", id)
		}
		if !strings.HasPrefix(p, "/") {
			p = "/" + p
		}
		u = base + p
	}
	method := strings.ToUpper(strings.TrimSpace(t.Method))
	if method == "" {
		method = "HEAD"
	}
	if method != "HEAD" && method != "GET" {
		return ResolvedTarget{}, fmt.Errorf("uptime: target %q: method must be HEAD or GET", id)
	}
	var expect []int
	for _, c := range t.ExpectStatus {
		if c > 0 {
			expect = append(expect, c)
		}
	}
	return ResolvedTarget{
		ID:           id,
		URL:          u,
		ExpectStatus: expect,
		Method:       method,
	}, nil
}

func dedupeTargets(in []ResolvedTarget) []ResolvedTarget {
	seen := make(map[string]struct{}, len(in))
	var out []ResolvedTarget
	for _, t := range in {
		key := t.ID + "\x00" + t.URL
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, t)
	}
	return out
}
