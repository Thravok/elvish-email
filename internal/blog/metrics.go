package blog

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// EntryMetrics holds optional fields merged from metrics.json or a remote URL at build time.
type EntryMetrics struct {
	Bytes string `json:"bytes"`
	Reach string `json:"reach"`
	Type  string `json:"type"`
	Time  string `json:"time"`
}

type metricsFile struct {
	Posts map[string]EntryMetrics `json:"posts"`
}

// LoadMetricsJSON reads content/blog/metrics.json (or any path). Missing file returns an empty map, not an error.
func LoadMetricsJSON(path string) (map[string]EntryMetrics, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]EntryMetrics{}, nil
		}
		return nil, err
	}
	var f metricsFile
	if err := json.Unmarshal(raw, &f); err != nil {
		return nil, fmt.Errorf("metrics json: %w", err)
	}
	if f.Posts == nil {
		return map[string]EntryMetrics{}, nil
	}
	return f.Posts, nil
}

// FetchMetricsJSON GETs a URL and parses metrics. Supports either {"posts":{slug:{...}}} or a flat {slug:{...}} object.
func FetchMetricsJSON(url string, client *http.Client) (map[string]EntryMetrics, error) {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("metrics url %s: HTTP %s", url, resp.Status)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	var wrapped struct {
		Posts map[string]EntryMetrics `json:"posts"`
	}
	if err := json.Unmarshal(body, &wrapped); err == nil && len(wrapped.Posts) > 0 {
		return wrapped.Posts, nil
	}
	var flat map[string]EntryMetrics
	if err := json.Unmarshal(body, &flat); err != nil {
		return nil, fmt.Errorf("metrics json: %w", err)
	}
	return flat, nil
}

// MergeMetrics overlays b onto a. For the same slug, non-empty fields in b override a (partial API payloads are OK).
func MergeMetrics(a, b map[string]EntryMetrics) map[string]EntryMetrics {
	out := make(map[string]EntryMetrics, len(a)+len(b))
	for k, v := range a {
		out[k] = v
	}
	for k, v := range b {
		out[k] = mergeEntryMetrics(out[k], v)
	}
	return out
}

func mergeEntryMetrics(base, patch EntryMetrics) EntryMetrics {
	out := base
	if strings.TrimSpace(patch.Bytes) != "" {
		out.Bytes = strings.TrimSpace(patch.Bytes)
	}
	if strings.TrimSpace(patch.Reach) != "" {
		out.Reach = strings.TrimSpace(patch.Reach)
	}
	if strings.TrimSpace(patch.Type) != "" {
		out.Type = strings.TrimSpace(patch.Type)
	}
	if strings.TrimSpace(patch.Time) != "" {
		out.Time = strings.TrimSpace(patch.Time)
	}
	return out
}

// ApplyMetricsToMeta fills empty Bytes, Reach, and Type from m[slug]. Front-matter values always win when non-empty.
func ApplyMetricsToMeta(slug string, meta *PostMeta, m map[string]EntryMetrics) {
	if meta == nil {
		return
	}
	src, ok := m[slug]
	if !ok {
		return
	}
	if meta.Bytes == "" && src.Bytes != "" {
		meta.Bytes = src.Bytes
	}
	if meta.Reach == "" && src.Reach != "" {
		meta.Reach = src.Reach
	}
	if meta.Type == "" && src.Type != "" {
		meta.Type = src.Type
	}
	if strings.TrimSpace(meta.Time) == "" && strings.TrimSpace(src.Time) != "" {
		meta.Time = strings.TrimSpace(src.Time)
	}
}
