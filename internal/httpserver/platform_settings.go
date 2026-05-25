package httpserver

import (
	"context"
	"net/http"
	"strings"

	"elvish/internal/operatorconfig"
)

// WithOperatorConfig attaches the SQL-backed platform settings service.
func (s *Server) WithOperatorConfig(op *operatorconfig.Service) {
	if s == nil {
		return
	}
	s.operator = op
}

func (s *Server) loadPlatformSettings(ctx context.Context) (*operatorconfig.Settings, error) {
	if s == nil || s.operator == nil {
		return operatorconfig.New(nil, s.log).Settings(ctx)
	}
	return s.operator.Settings(ctx)
}

func (s *Server) trustForwardedForRequest(r *http.Request) bool {
	if s == nil || r == nil {
		return false
	}
	st, err := s.loadPlatformSettings(r.Context())
	if err != nil || st == nil {
		return false
	}
	return st.TrustForwardedFor
}

func (s *Server) resolvedPublicBaseURL(ctx context.Context) string {
	if s == nil {
		return ""
	}
	if st, err := s.loadPlatformSettings(ctx); err == nil && st != nil {
		if b := strings.TrimSpace(st.PublicBaseURL); b != "" {
			return strings.TrimRight(b, "/")
		}
	}
	return strings.TrimRight(strings.TrimSpace(s.publicBaseURL), "/")
}
