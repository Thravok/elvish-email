package httpserver

import (
	"net/http"
	"os"
	"strings"
)

func loadCookieDomain() string {
	return strings.TrimSpace(os.Getenv("ELVISH_COOKIE_DOMAIN"))
}

func (s *Server) newSessionCookie(name, value string, maxAge int) *http.Cookie {
	c := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cookieSecure,
	}
	if dom := strings.TrimSpace(s.cookieDomain); dom != "" {
		c.Domain = dom
	}
	return c
}
