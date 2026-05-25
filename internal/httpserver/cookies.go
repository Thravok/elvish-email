package httpserver

import (
	"context"
	"net/http"
	"strings"
)

func (s *Server) cookieDomainForRequest(ctx context.Context) string {
	if s.operator != nil {
		if st, err := s.loadPlatformSettings(ctx); err == nil && st != nil {
			if dom := strings.TrimSpace(st.CookieDomain); dom != "" {
				return dom
			}
		}
	}
	return strings.TrimSpace(s.cookieDomain)
}

func (s *Server) newSessionCookie(ctx context.Context, name, value string, maxAge int) *http.Cookie {
	c := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cookieSecure,
	}
	if dom := s.cookieDomainForRequest(ctx); dom != "" {
		c.Domain = dom
	}
	return c
}
