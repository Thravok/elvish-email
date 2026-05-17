package httpserver

import (
	"context"
	"net/http"
	"strings"
	"time"

	"elvish/internal/models"
)

// authCaptchaActive reports whether Cap verification is required for public auth endpoints.
func (s *Server) authCaptchaActive(ctx context.Context) (bool, *models.AuthCaptchaSettingsDoc, error) {
	if s == nil || s.store == nil {
		return false, nil, nil
	}
	doc, err := s.store.GetAuthCaptchaSettings(ctx)
	if err != nil {
		return false, nil, err
	}
	active := doc.Enabled &&
		strings.TrimSpace(doc.WidgetAPIEndpoint) != "" &&
		strings.TrimSpace(doc.Secret) != ""
	return active, doc, nil
}

// requireCapToken verifies a Cap token when captcha is enabled; returns false if the handler already wrote a response.
func (s *Server) requireCapToken(w http.ResponseWriter, r *http.Request, token string) bool {
	ctx := r.Context()
	active, doc, err := s.authCaptchaActive(ctx)
	if err != nil {
		s.writeErrAPIInternal(w, "auth captcha settings", err)
		return false
	}
	if !active {
		return true
	}
	if strings.TrimSpace(token) == "" {
		s.writeErr(w, http.StatusForbidden, "captcha required")
		return false
	}
	verifyURL, err := capSiteVerifyURL(doc.WidgetAPIEndpoint)
	if err != nil {
		s.writeErrAPIInternal(w, "auth captcha endpoint", err)
		return false
	}
	client := &http.Client{Timeout: capVerifyTimeout + 2*time.Second}
	if err := verifyCapTokenPOST(ctx, client, verifyURL, doc.Secret, token); err != nil {
		s.writeErr(w, http.StatusForbidden, "invalid captcha")
		return false
	}
	return true
}
