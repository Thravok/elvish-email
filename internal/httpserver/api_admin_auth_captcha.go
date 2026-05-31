package httpserver

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"elvish/internal/models"
)

type adminAuthCaptchaPostBody struct {
	Enabled           bool   `json:"enabled"`
	WidgetAPIEndpoint string `json:"widget_api_endpoint"`
	Secret            string `json:"secret"`
}

// apiAdminAuthCaptchaGet returns Cap captcha settings for admins (secret is never returned).
func (s *Server) apiAdminAuthCaptchaGet(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	out := map[string]any{
		"persist": s.store != nil,
	}
	if s.store == nil {
		out["settings"] = map[string]any{
			"enabled":             false,
			"widget_api_endpoint": "",
			"secret_configured":   false,
			"fully_active":        false,
		}
		s.writeJSON(w, http.StatusOK, out)
		return
	}
	doc, err := s.store.GetAuthCaptchaSettings(r.Context())
	if err != nil {
		s.writeErrAPIInternal(w, "admin auth captcha get", err)
		return
	}
	secretOK := strings.TrimSpace(doc.Secret) != ""
	endpoint := strings.TrimSpace(doc.WidgetAPIEndpoint)
	active := doc.Enabled && endpoint != "" && secretOK
	out["settings"] = map[string]any{
		"enabled":             doc.Enabled,
		"widget_api_endpoint": endpoint,
		"secret_configured":   secretOK,
		"fully_active":        active,
		"updated_at":          doc.UpdatedAt,
	}
	s.writeJSON(w, http.StatusOK, out)
}

// apiAdminAuthCaptchaPost saves Cap captcha settings (empty secret keeps the previous value).
func (s *Server) apiAdminAuthCaptchaPost(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_auth_captcha", admin.ID.String(), adminKeyMutationsPerHour, adminKeyMutationWindow) {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required to persist captcha settings")
		return
	}
	var body adminAuthCaptchaPostBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	endpoint := strings.TrimSpace(body.WidgetAPIEndpoint)
	if len(endpoint) > capMaxWidgetEndpointLen {
		s.writeErr(w, http.StatusBadRequest, "widget_api_endpoint too long")
		return
	}
	if endpoint != "" {
		verifyURL, err := capSiteVerifyURL(endpoint)
		if err != nil || verifyURL == "" {
			s.writeErr(w, http.StatusBadRequest, "widget_api_endpoint must be an https URL")
			return
		}
	}
	prev, err := s.store.GetAuthCaptchaSettings(r.Context())
	if err != nil {
		s.writeErrAPIInternal(w, "admin auth captcha load", err)
		return
	}
	secret := strings.TrimSpace(body.Secret)
	if secret == "" {
		secret = prev.Secret
	}
	if len(secret) > capMaxSecretLen {
		s.writeErr(w, http.StatusBadRequest, "secret too long")
		return
	}
	if body.Enabled && (endpoint == "" || strings.TrimSpace(secret) == "") {
		s.writeErr(w, http.StatusBadRequest, "enabled captcha requires widget_api_endpoint and secret")
		return
	}
	doc := &models.AuthCaptchaSettingsDoc{
		Enabled:           body.Enabled,
		WidgetAPIEndpoint: endpoint,
		Secret:            secret,
	}
	if err := s.store.SetAuthCaptchaSettings(r.Context(), doc); err != nil {
		s.writeErrAPIInternal(w, "admin auth captcha save", err)
		return
	}
	saved, err := s.store.GetAuthCaptchaSettings(r.Context())
	if err != nil {
		s.writeErrAPIInternal(w, "admin auth captcha reload", err)
		return
	}
	secretOK := strings.TrimSpace(saved.Secret) != ""
	active := saved.Enabled && strings.TrimSpace(saved.WidgetAPIEndpoint) != "" && secretOK
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"settings": map[string]any{
			"enabled":             saved.Enabled,
			"widget_api_endpoint": strings.TrimSpace(saved.WidgetAPIEndpoint),
			"secret_configured":   secretOK,
			"fully_active":        active,
			"updated_at":          saved.UpdatedAt,
		},
	})
}
