package httpserver

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"elvish/internal/config"
	"elvish/internal/uptime"
)

type adminUptimeProbeTestBody struct {
	BaseURL  string              `json:"base_url"`
	Slug     string              `json:"slug"`
	OpenHref string              `json:"open_href"`
	Monitor  *config.ToolMonitor `json:"monitor"`
}

func (s *Server) adminProbeBaseURL(ctx context.Context) string {
	if s.store != nil {
		doc, err := s.store.GetUptimeSettings(ctx)
		if err == nil && doc != nil {
			if b := strings.TrimSpace(doc.BaseURL); b != "" {
				return strings.TrimRight(b, "/")
			}
		}
	}
	if h, err := s.loadHome(ctx); err == nil && h != nil {
		if b := strings.TrimSpace(h.BaseURL); b != "" {
			return strings.TrimRight(b, "/")
		}
	}
	for _, k := range []string{"ELVISH_UPTIME_BASE_URL", "ELVISH_PUBLIC_BASE_URL"} {
		if b := strings.TrimSpace(os.Getenv(k)); b != "" {
			return strings.TrimRight(b, "/")
		}
	}
	return ""
}

// apiAdminUptimeTestProbe runs a single uptime check for one tool (draft monitor from body or default HTTP slot).
func (s *Server) apiAdminUptimeTestProbe(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if r.Method != http.MethodPost {
		s.writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	ctx := r.Context()
	var body adminUptimeProbeTestBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	slug := strings.TrimSpace(body.Slug)
	if slug == "" {
		s.writeErr(w, http.StatusBadRequest, "slug required")
		return
	}
	base := strings.TrimSpace(body.BaseURL)
	if base == "" {
		base = s.adminProbeBaseURL(ctx)
	}
	if base == "" {
		s.writeErr(w, http.StatusBadRequest, "probe base URL missing — set Uptime base URL, home base_url, or pass base_url in the request")
		return
	}
	hc := &http.Client{Timeout: 18 * time.Second}
	res, err := uptime.TestToolUptimeOnce(ctx, hc, base, slug, body.OpenHref, body.Monitor, 15*time.Second)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"base_url": base,
		"result":   res,
	})
}
