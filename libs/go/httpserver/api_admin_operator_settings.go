package httpserver

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"elvish/libs/go/models"
)

type adminOperatorSettingsPostBody struct {
	PublicBaseURL        string `json:"public_base_url"`
	PlatformMailDomain   string `json:"platform_mail_domain"`
	WebOrigins           string `json:"web_origins"`
	CookieDomain         string `json:"cookie_domain"`
	RegistrationClosed   bool   `json:"registration_closed"`
	PaidFeaturesEnabled  bool   `json:"paid_features_enabled"`
	TrustForwardedFor    bool   `json:"trust_forwarded_for"`
	ContentCacheSec      int    `json:"content_cache_sec"`
	SMTPRateLimitPerHour int    `json:"smtp_rate_limit_per_hour"`
}

func operatorSettingsAPIResponse(doc *models.OperatorSettingsDoc) map[string]any {
	if doc == nil {
		doc = models.DefaultOperatorSettings()
	}
	return map[string]any{
		"id":                       doc.ID,
		"public_base_url":          doc.PublicBaseURL,
		"platform_mail_domain":     doc.PlatformMailDomain,
		"registration_closed":      doc.RegistrationClosed,
		"paid_features_enabled":    doc.PaidFeaturesEnabled,
		"trust_forwarded_for":      doc.TrustForwardedFor,
		"content_cache_sec":        doc.ContentCacheSec,
		"smtp_rate_limit_per_hour": doc.SMTPRateLimitPerHour,
		"web_origins":              doc.WebOrigins,
		"cookie_domain":            doc.CookieDomain,
		"updated_at":               doc.UpdatedAt,
	}
}

// apiAdminOperatorSettingsGet returns platform operator settings.
func (s *Server) apiAdminOperatorSettingsGet(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	out := map[string]any{"persist": s.store != nil}
	if s.store == nil {
		out["settings"] = operatorSettingsAPIResponse(models.DefaultOperatorSettings())
		out["note"] = "Database not configured — settings are defaults only."
		s.writeJSON(w, http.StatusOK, out)
		return
	}
	doc, err := s.store.GetOperatorSettings(r.Context())
	if err != nil {
		s.writeErrAPIInternal(w, "admin operator settings get", err)
		return
	}
	out["settings"] = operatorSettingsAPIResponse(doc)
	s.writeJSON(w, http.StatusOK, out)
}

// apiAdminOperatorSettingsPost saves platform operator settings.
func (s *Server) apiAdminOperatorSettingsPost(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required to persist operator settings")
		return
	}
	var body adminOperatorSettingsPostBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	cacheSec := body.ContentCacheSec
	if cacheSec <= 0 {
		cacheSec = models.DefaultContentCacheSec
	}
	rateLimit := body.SMTPRateLimitPerHour
	if rateLimit <= 0 {
		rateLimit = models.DefaultSMTPRateLimitPerHour
	}
	doc := &models.OperatorSettingsDoc{
		ID:                   models.OperatorSettingsID,
		PublicBaseURL:        strings.TrimRight(strings.TrimSpace(body.PublicBaseURL), "/"),
		PlatformMailDomain:   strings.TrimSpace(strings.ToLower(body.PlatformMailDomain)),
		WebOrigins:           strings.TrimSpace(body.WebOrigins),
		CookieDomain:         strings.TrimSpace(body.CookieDomain),
		RegistrationClosed:   body.RegistrationClosed,
		PaidFeaturesEnabled:  body.PaidFeaturesEnabled,
		TrustForwardedFor:    body.TrustForwardedFor,
		ContentCacheSec:      cacheSec,
		SMTPRateLimitPerHour: rateLimit,
	}
	if s.operator == nil {
		if err := s.store.SetOperatorSettings(r.Context(), doc); err != nil {
			s.writeErrAPIInternal(w, "admin operator settings save", err)
			return
		}
	} else if err := s.operator.Save(r.Context(), doc); err != nil {
		s.writeErrAPIInternal(w, "admin operator settings save", err)
		return
	}
	s.invalidateContentCache()
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "settings": operatorSettingsAPIResponse(doc)})
}
