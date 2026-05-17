package httpserver

import (
	"net/http"
	"time"
)

const (
	rateLimitAuthPerHour = int64(20)
	rateLimitAuthWindow  = time.Hour

	rateLimitMailPerHour = int64(500)
	rateLimitMailWindow  = time.Hour

	rateLimitProbePerHour = int64(120)
	rateLimitProbeWindow  = time.Hour
)

// rateLimitOK enforces a Valkey-backed fixed window when configured. On Valkey errors it fails open and logs.
func (s *Server) rateLimitOK(w http.ResponseWriter, r *http.Request, name string, max int64, window time.Duration) bool {
	if s.rateLimit == nil {
		return true
	}
	id := clientIPForRateLimit(r, s.trustForwardedFor)
	ok, err := s.rateLimit.Allow(r.Context(), name, id, max, window)
	if err != nil {
		s.log.Warn("ratelimit", "name", name, "err", err)
		return true
	}
	if !ok {
		s.writeErr(w, http.StatusTooManyRequests, "too many requests")
		return false
	}
	return true
}

// rateLimitMailUser applies a per-user fixed window for mail JSON APIs (keyed by user id string).
func (s *Server) rateLimitMailUser(w http.ResponseWriter, r *http.Request, userID string) bool {
	if s.rateLimit == nil {
		return true
	}
	ok, err := s.rateLimit.Allow(r.Context(), "mail_api", userID, rateLimitMailPerHour, rateLimitMailWindow)
	if err != nil {
		s.log.Warn("ratelimit mail", "err", err)
		return true
	}
	if !ok {
		s.writeErr(w, http.StatusTooManyRequests, "too many requests")
		return false
	}
	return true
}

// rateLimitKey applies a fixed window keyed by an explicit identifier.
func (s *Server) rateLimitKey(w http.ResponseWriter, r *http.Request, name, key string, max int64, window time.Duration) bool {
	if s.rateLimit == nil {
		return true
	}
	ok, err := s.rateLimit.Allow(r.Context(), name, key, max, window)
	if err != nil {
		s.log.Warn("ratelimit key", "name", name, "err", err)
		return true
	}
	if !ok {
		s.writeErr(w, http.StatusTooManyRequests, "too many requests")
		return false
	}
	return true
}
