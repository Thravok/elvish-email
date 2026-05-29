package uptime

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultUserAgent = "elvish-server-uptime/1.0"

// ProbeResult is the outcome of one HTTP check.
type ProbeResult struct {
	ID         string `json:"id"`
	URL        string `json:"url"`
	Method     string `json:"method"`
	OK         bool   `json:"ok"`
	StatusCode int    `json:"status_code"`
	LatencyMS  int64  `json:"latency_ms"`
	Error      string `json:"error,omitempty"`
}

// RunProbes executes HTTP checks for all targets. Each probe uses timeout per target.
func RunProbes(ctx context.Context, hc *http.Client, targets []ResolvedTarget, timeout time.Duration) []ProbeResult {
	if hc == nil {
		hc = http.DefaultClient
	}
	out := make([]ProbeResult, 0, len(targets))
	for _, t := range targets {
		out = append(out, probeOne(ctx, hc, t, timeout))
	}
	return out
}

func probeOne(ctx context.Context, hc *http.Client, t ResolvedTarget, timeout time.Duration) ProbeResult {
	method := strings.ToUpper(strings.TrimSpace(t.Method))
	if method == "" {
		method = "HEAD"
	}
	safeURL, err := NewValidatedProbeURL(t.URL)
	if err != nil {
		return ProbeResult{ID: t.ID, URL: t.URL, Method: method, OK: false, Error: err.Error()}
	}
	pctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	start := time.Now()
	reqURL := safeURL.String()
	req, err := http.NewRequestWithContext(pctx, method, reqURL, nil)
	if err != nil {
		return ProbeResult{ID: t.ID, URL: t.URL, Method: method, OK: false, Error: err.Error()}
	}
	req.Header.Set("User-Agent", defaultUserAgent)

	res, err := doValidatedProbeRequest(hc, req, safeURL)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return ProbeResult{ID: t.ID, URL: t.URL, Method: method, OK: false, LatencyMS: lat, Error: err.Error()}
	}
	defer func() { _ = res.Body.Close() }()
	if method == "GET" {
		// Drain a bounded prefix so the connection can be reused; read errors are irrelevant to OK/fail.
		_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 2048))
	}

	ok := statusOK(res.StatusCode, t.ExpectStatus)
	pr := ProbeResult{
		ID: t.ID, URL: t.URL, Method: method, OK: ok,
		StatusCode: res.StatusCode, LatencyMS: lat,
	}
	if !ok {
		pr.Error = fmt.Sprintf("unexpected status %d", res.StatusCode)
	}
	if method == "HEAD" && (res.StatusCode == http.StatusMethodNotAllowed || res.StatusCode == http.StatusNotImplemented) {
		return probeGETFallback(ctx, hc, t, timeout, lat)
	}
	return pr
}

func probeGETFallback(ctx context.Context, hc *http.Client, t ResolvedTarget, timeout time.Duration, headLatency int64) ProbeResult {
	safeURL, err := NewValidatedProbeURL(t.URL)
	if err != nil {
		return ProbeResult{ID: t.ID, URL: t.URL, Method: "GET", OK: false, LatencyMS: headLatency, Error: err.Error()}
	}
	pctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	start := time.Now()
	reqURL := safeURL.String()
	req, err := http.NewRequestWithContext(pctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return ProbeResult{ID: t.ID, URL: t.URL, Method: "GET", OK: false, LatencyMS: headLatency, Error: err.Error()}
	}
	req.Header.Set("User-Agent", defaultUserAgent)
	res, err := doValidatedProbeRequest(hc, req, safeURL)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return ProbeResult{ID: t.ID, URL: t.URL, Method: "GET", OK: false, LatencyMS: lat, Error: err.Error()}
	}
	defer func() { _ = res.Body.Close() }()
	// Drain response body (bounded); outcome already determined from status.
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 8192))
	ok := statusOK(res.StatusCode, t.ExpectStatus)
	pr := ProbeResult{
		ID: t.ID, URL: t.URL, Method: "GET", OK: ok,
		StatusCode: res.StatusCode, LatencyMS: lat,
	}
	if !ok {
		pr.Error = fmt.Sprintf("unexpected status %d", res.StatusCode)
	}
	return pr
}

func statusOK(code int, expect []int) bool {
	if len(expect) == 0 {
		return code >= 200 && code < 400
	}
	for _, e := range expect {
		if e == code {
			return true
		}
	}
	return false
}
