// Package apidoc holds the merged OpenAPI document for the JSON /api surface.
//
// Regenerate internal/apidoc/openapi.yaml with: go run ./cmd/apiroutes -write
// (or make openapi). Top-level routes are parsed from internal/httpserver/api.go;
// nested dispatchers are listed in docs/openapi/supplemental.yaml.
package apidoc

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// Route is one HTTP operation on the JSON API (method + path + optional summary).
type Route struct {
	Method  string `yaml:"method"`
	Path    string `yaml:"path"`
	Summary string `yaml:"summary,omitempty"`
}

type supplementalFile struct {
	Routes []Route `yaml:"routes"`
}

var (
	reCaseSimple = regexp.MustCompile(`^\s*case p == "([^"]+)" && r.Method == http.Method(\w+):`)
	reCaseDual   = regexp.MustCompile(`^\s*case p == "([^"]+)" && \(r.Method == http.MethodPatch \|\| r.Method == http.MethodPut\):`)
)

// ParseAPIGo extracts explicit /api routes from handleAPI in api.go (p == "…" && Method).
func ParseAPIGo(apiGo string) ([]Route, error) {
	data, err := os.ReadFile(apiGo)
	if err != nil {
		return nil, err
	}
	var out []Route
	for _, line := range strings.Split(string(data), "\n") {
		if m := reCaseDual.FindStringSubmatch(line); m != nil {
			out = append(out,
				Route{Method: "PATCH", Path: apiPath(m[1]), Summary: ""},
				Route{Method: "PUT", Path: apiPath(m[1]), Summary: ""},
			)
			continue
		}
		if m := reCaseSimple.FindStringSubmatch(line); m != nil {
			method, ok := httpMethodConst(m[2])
			if !ok {
				continue
			}
			out = append(out, Route{Method: method, Path: apiPath(m[1]), Summary: ""})
		}
	}
	return out, nil
}

func apiPath(p string) string {
	p = strings.TrimPrefix(p, "/")
	return "/api/" + p
}

func httpMethodConst(name string) (string, bool) {
	switch name {
	case "Get":
		return "GET", true
	case "Post":
		return "POST", true
	case "Put":
		return "PUT", true
	case "Patch":
		return "PATCH", true
	case "Delete":
		return "DELETE", true
	case "Head":
		return "HEAD", true
	case "Options":
		return "OPTIONS", true
	default:
		return "", false
	}
}

// ReadSupplemental loads nested / prefix-dispatched routes.
func ReadSupplemental(path string) ([]Route, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var sf supplementalFile
	if err := yaml.Unmarshal(data, &sf); err != nil {
		return nil, err
	}
	for i := range sf.Routes {
		sf.Routes[i].Method = strings.ToUpper(strings.TrimSpace(sf.Routes[i].Method))
		sf.Routes[i].Path = strings.TrimSpace(sf.Routes[i].Path)
	}
	return sf.Routes, nil
}

// MergeRoutes combines auto + supplemental; supplemental wins on duplicate method+path for summaries.
func MergeRoutes(auto, extra []Route) []Route {
	key := func(r Route) string { return r.Method + "\x00" + r.Path }
	m := make(map[string]Route)
	for _, r := range auto {
		k := key(r)
		m[k] = r
	}
	for _, r := range extra {
		k := key(r)
		if prev, ok := m[k]; ok {
			if strings.TrimSpace(r.Summary) != "" {
				prev.Summary = r.Summary
			}
			m[k] = prev
			continue
		}
		m[k] = r
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	out := make([]Route, 0, len(keys))
	for _, k := range keys {
		out = append(out, m[k])
	}
	return out
}

// BuildOpenAPIDocument returns a Kin-compatible OpenAPI 3.0.3 map.
func BuildOpenAPIDocument(routes []Route) map[string]any {
	paths := make(map[string]any)
	for _, r := range routes {
		op := buildOperation(r)
		method := strings.ToLower(r.Method)
		if paths[r.Path] == nil {
			paths[r.Path] = make(map[string]any)
		}
		pItem := paths[r.Path].(map[string]any)
		pItem[method] = op
	}
	return map[string]any{
		"openapi": "3.0.3",
		"info": map[string]any{
			"title":       "ELVish HTTP API",
			"description": "JSON API under /api. Regenerate this file with `make openapi` (see docs/openapi/supplemental.yaml for routes not expressed as literal `p ==` cases in api.go).",
			"version":     "0.0.0",
		},
		"servers": []any{
			map[string]any{"url": "/"},
		},
		"paths": paths,
		"components": map[string]any{
			"securitySchemes": map[string]any{
				"elvish_session": map[string]any{
					"type": "apiKey",
					"in":   "cookie",
					"name": "elvish_session",
				},
			},
		},
	}
}

func buildOperation(r Route) map[string]any {
	opID := operationID(r.Method, r.Path)
	summary := strings.TrimSpace(r.Summary)
	if summary == "" {
		summary = r.Method + " " + r.Path
	}
	op := map[string]any{
		"summary":     summary,
		"operationId": opID,
		"responses": map[string]any{
			"default": map[string]any{
				"description": "Response (JSON or error body; see handler and docs/e2ee-mail-spec.md for mail).",
				"content": map[string]any{
					"application/json": map[string]any{
						"schema": map[string]any{"type": "object"},
					},
				},
			},
		},
	}
	if params := pathParameters(r.Path); len(params) > 0 {
		op["parameters"] = params
	}
	return op
}

func operationID(method, p string) string {
	s := strings.ToLower(method) + "_" + strings.TrimPrefix(p, "/")
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "{", "")
	s = strings.ReplaceAll(s, "}", "")
	for strings.Contains(s, "__") {
		s = strings.ReplaceAll(s, "__", "_")
	}
	return s
}

func pathParameters(path string) []any {
	var out []any
	start := 0
	for {
		i := strings.Index(path[start:], "{")
		if i < 0 {
			break
		}
		i += start
		j := strings.Index(path[i:], "}")
		if j < 0 {
			break
		}
		j += i
		name := path[i+1 : j]
		if name != "" {
			out = append(out, map[string]any{
				"name":     name,
				"in":       "path",
				"required": true,
				"schema":   map[string]any{"type": "string"},
			})
		}
		start = j + 1
	}
	return out
}

// MarshalYAML renders doc as canonical YAML bytes.
func MarshalYAML(doc map[string]any) ([]byte, error) {
	var buf bytes.Buffer
	enc := yaml.NewEncoder(&buf)
	enc.SetIndent(2)
	if err := enc.Encode(doc); err != nil {
		return nil, err
	}
	if err := enc.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// ModuleRoot returns dir containing go.mod by walking up from wd.
func ModuleRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("go.mod not found from cwd")
		}
		dir = parent
	}
}

// DefaultOutputPath is the committed OpenAPI file embedded by this package.
func DefaultOutputPath(root string) string {
	return filepath.Join(root, "internal", "apidoc", "openapi.yaml")
}

func DefaultSupplementalPath(root string) string {
	return filepath.Join(root, "docs", "openapi", "supplemental.yaml")
}

func DefaultAPIGoPath(root string) string {
	return filepath.Join(root, "internal", "httpserver", "api.go")
}

// Regenerate writes openapi.yaml from api.go + supplemental.yaml.
func Regenerate(root string) ([]byte, error) {
	auto, err := ParseAPIGo(DefaultAPIGoPath(root))
	if err != nil {
		return nil, fmt.Errorf("parse api.go: %w", err)
	}
	extra, err := ReadSupplemental(DefaultSupplementalPath(root))
	if err != nil {
		return nil, fmt.Errorf("read supplemental: %w", err)
	}
	merged := MergeRoutes(auto, extra)
	doc := BuildOpenAPIDocument(merged)
	return MarshalYAML(doc)
}
