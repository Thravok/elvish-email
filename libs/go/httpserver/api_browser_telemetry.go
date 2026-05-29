package httpserver

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

type browserTelemetryBatch struct {
	Events []browserTelemetryEvent `json:"events"`
}

type browserTelemetryEvent struct {
	Surface    string `json:"surface"`
	Operation  string `json:"operation"`
	Result     string `json:"result"`
	DurationMS int64  `json:"duration_ms"`
}

// apiBrowserTelemetry accepts anonymous, bounded browser-side performance beacons.
func (s *Server) apiBrowserTelemetry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.telemetry == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	var body browserTelemetryBatch
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if len(body.Events) > 128 {
		body.Events = body.Events[:128]
	}
	for _, ev := range body.Events {
		d := time.Duration(ev.DurationMS) * time.Millisecond
		if d < 0 {
			d = 0
		}
		success := strings.TrimSpace(strings.ToLower(ev.Result)) != "failure"
		if err := s.telemetry.RecordFrontendPerf(r.Context(), ev.Surface, ev.Operation, success, d); err != nil && s.log != nil {
			s.log.Warn("browser telemetry", "err", err, "surface", ev.Surface, "operation", ev.Operation)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}
