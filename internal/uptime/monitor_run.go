package uptime

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"elvish/internal/models"
)

// RunMonitorRows executes configured monitors (Kuma-style) and returns probe results.
func RunMonitorRows(ctx context.Context, hc *http.Client, rows []models.MonitorRow, timeout time.Duration) []ProbeResult {
	if hc == nil {
		hc = http.DefaultClient
	}
	out := make([]ProbeResult, 0, len(rows))
	for _, row := range rows {
		if !row.Enabled || strings.TrimSpace(row.ID) == "" {
			continue
		}
		id := monitorProbeID(row.ID)
		out = append(out, runOneMonitor(ctx, hc, id, row, timeout))
	}
	return out
}

func monitorProbeID(rowID string) string {
	s := strings.ReplaceAll(strings.TrimSpace(rowID), "-", "_")
	return "mon_" + s
}

func runOneMonitor(ctx context.Context, hc *http.Client, id string, row models.MonitorRow, timeout time.Duration) ProbeResult {
	typ := strings.ToLower(strings.TrimSpace(row.Type))
	switch typ {
	case "http":
		return runMonitorHTTP(ctx, hc, id, row, timeout, false, false)
	case "http_keyword":
		return runMonitorHTTP(ctx, hc, id, row, timeout, true, false)
	case "http_json":
		return runMonitorHTTP(ctx, hc, id, row, timeout, false, true)
	case "tcp", "ping":
		return runMonitorTCPPing(ctx, id, row, timeout, typ == "ping")
	case "dns":
		return runMonitorDNS(ctx, id, row, timeout)
	case "websocket", "push":
		return ProbeResult{
			ID: id, URL: row.WSURL, Method: typ, OK: false,
			Error: typ + " checks are not implemented yet — use HTTP or TCP for now",
		}
	default:
		return ProbeResult{ID: id, URL: "", Method: typ, OK: false, Error: "unknown monitor type " + typ}
	}
}

func runMonitorHTTP(ctx context.Context, hc *http.Client, id string, row models.MonitorRow, timeout time.Duration, keyword, jsonCheck bool) ProbeResult {
	u := strings.TrimSpace(row.URL)
	if u == "" {
		return ProbeResult{ID: id, URL: "", Method: "GET", OK: false, Error: "url required"}
	}
	if err := ValidateProbeHTTPURL(u); err != nil {
		return ProbeResult{ID: id, URL: u, Method: "GET", OK: false, Error: err.Error()}
	}
	method := strings.ToUpper(strings.TrimSpace(row.Method))
	if method == "" {
		method = "GET"
	}
	if keyword && method != "GET" {
		method = "GET"
	}
	if jsonCheck && method != "GET" {
		method = "GET"
	}
	pctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	start := time.Now()
	req, err := http.NewRequestWithContext(pctx, method, u, nil)
	if err != nil {
		return ProbeResult{ID: id, URL: u, Method: method, OK: false, Error: err.Error()}
	}
	req.Header.Set("User-Agent", defaultUserAgent)
	res, err := hc.Do(req)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return ProbeResult{ID: id, URL: u, Method: method, OK: false, LatencyMS: lat, Error: err.Error()}
	}
	defer func() { _ = res.Body.Close() }()

	body, readErr := io.ReadAll(io.LimitReader(res.Body, 512<<10))
	if readErr != nil {
		return ProbeResult{ID: id, URL: u, Method: method, OK: false, LatencyMS: lat, Error: readErr.Error()}
	}
	ok := statusOK(res.StatusCode, row.ExpectStatus)
	pr := ProbeResult{ID: id, URL: u, Method: method, OK: ok, StatusCode: res.StatusCode, LatencyMS: lat}
	if !ok {
		pr.Error = fmt.Sprintf("unexpected status %d", res.StatusCode)
		return pr
	}
	if keyword {
		kw := strings.TrimSpace(row.Keyword)
		if kw == "" {
			pr.OK = false
			pr.Error = "keyword required for http_keyword"
			return pr
		}
		if !strings.Contains(string(body), kw) {
			pr.OK = false
			pr.Error = "response body does not contain keyword"
			return pr
		}
	}
	if jsonCheck {
		path := strings.TrimSpace(row.JSONPath)
		want := strings.TrimSpace(row.JSONValue)
		if path == "" {
			pr.OK = false
			pr.Error = "json_path required for http_json"
			return pr
		}
		var root any
		if err := json.Unmarshal(body, &root); err != nil {
			pr.OK = false
			pr.Error = "json parse: " + err.Error()
			return pr
		}
		got, err := jsonPathLookup(root, path)
		if err != nil {
			pr.OK = false
			pr.Error = err.Error()
			return pr
		}
		if got != want {
			pr.OK = false
			pr.Error = fmt.Sprintf("json_path value %q != expected %q", got, want)
			return pr
		}
	}
	return pr
}

func jsonPathLookup(root any, path string) (string, error) {
	parts := strings.Split(path, ".")
	cur := root
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		m, ok := cur.(map[string]any)
		if !ok {
			return "", fmt.Errorf("json_path: not an object at %q", p)
		}
		v, ok := m[p]
		if !ok {
			return "", fmt.Errorf("json_path: missing key %q", p)
		}
		cur = v
	}
	switch v := cur.(type) {
	case string:
		return v, nil
	case float64:
		return fmt.Sprint(v), nil
	case bool:
		return fmt.Sprint(v), nil
	case nil:
		return "", nil
	default:
		return fmt.Sprint(v), nil
	}
}

func runMonitorTCPPing(ctx context.Context, id string, row models.MonitorRow, timeout time.Duration, isPing bool) ProbeResult {
	host := strings.TrimSpace(row.Hostname)
	if host == "" {
		return ProbeResult{ID: id, URL: "", Method: "tcp", OK: false, Error: "hostname required"}
	}
	port := row.Port
	if port <= 0 {
		if isPing {
			port = 443
		} else {
			return ProbeResult{ID: id, URL: "", Method: "tcp", OK: false, Error: "port required for tcp"}
		}
	}
	addr := net.JoinHostPort(host, fmt.Sprintf("%d", port))
	target := "tcp://" + addr
	pctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	start := time.Now()
	var d net.Dialer
	conn, err := d.DialContext(pctx, "tcp", addr)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return ProbeResult{ID: id, URL: target, Method: "tcp", OK: false, LatencyMS: lat, Error: err.Error()}
	}
	_ = conn.Close()
	return ProbeResult{ID: id, URL: target, Method: "tcp", OK: true, StatusCode: 0, LatencyMS: lat}
}

func runMonitorDNS(ctx context.Context, id string, row models.MonitorRow, timeout time.Duration) ProbeResult {
	name := strings.TrimSpace(row.DNSName)
	if name == "" {
		return ProbeResult{ID: id, URL: "", Method: "dns", OK: false, Error: "dns_name required"}
	}
	rtype := strings.ToUpper(strings.TrimSpace(row.DNSRecordType))
	if rtype == "" {
		rtype = "A"
	}
	want := strings.TrimSpace(row.DNSExpected)
	pctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	resolver := &net.Resolver{}
	start := time.Now()
	var out string
	switch rtype {
	case "A", "AAAA":
		addrs, err := resolver.LookupIPAddr(pctx, name)
		lat := time.Since(start).Milliseconds()
		if err != nil {
			return ProbeResult{ID: id, URL: "dns:" + name, Method: "dns", OK: false, LatencyMS: lat, Error: err.Error()}
		}
		parts := make([]string, 0, len(addrs))
		for _, ia := range addrs {
			parts = append(parts, ia.String())
		}
		out = strings.Join(parts, " ")
		ok := want == "" || strings.Contains(out, want)
		pr := ProbeResult{ID: id, URL: "dns:" + name + "/" + rtype, Method: "dns", OK: ok, LatencyMS: lat}
		if !ok {
			pr.Error = fmt.Sprintf("got %q, expected contains %q", out, want)
		}
		return pr
	case "TXT":
		txts, err := resolver.LookupTXT(pctx, name)
		lat := time.Since(start).Milliseconds()
		if err != nil {
			return ProbeResult{ID: id, URL: "dns:" + name, Method: "dns", OK: false, LatencyMS: lat, Error: err.Error()}
		}
		out = strings.Join(txts, " | ")
		ok := want == "" || strings.Contains(out, want)
		pr := ProbeResult{ID: id, URL: "dns:" + name + "/TXT", Method: "dns", OK: ok, LatencyMS: lat}
		if !ok {
			pr.Error = fmt.Sprintf("got %q, expected contains %q", out, want)
		}
		return pr
	case "CNAME":
		cname, err := resolver.LookupCNAME(pctx, name)
		lat := time.Since(start).Milliseconds()
		if err != nil {
			return ProbeResult{ID: id, URL: "dns:" + name, Method: "dns", OK: false, LatencyMS: lat, Error: err.Error()}
		}
		cname = strings.TrimSuffix(cname, ".")
		ok := want == "" || strings.Contains(strings.TrimSuffix(cname, "."), want)
		pr := ProbeResult{ID: id, URL: "dns:" + name + "/CNAME", Method: "dns", OK: ok, LatencyMS: lat}
		if !ok {
			pr.Error = fmt.Sprintf("got %q, expected contains %q", cname, want)
		}
		return pr
	default:
		return ProbeResult{ID: id, URL: "dns:" + name, Method: "dns", OK: false, Error: "unsupported dns_record_type " + rtype}
	}
}
