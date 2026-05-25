package store

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"elvish/internal/models"
)

// GetOperatorSettings returns persisted platform settings or defaults when missing.
func (s *Store) GetOperatorSettings(ctx context.Context) (*models.OperatorSettingsDoc, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, public_base_url, platform_mail_domain, web_origins, cookie_domain,
		registration_closed, paid_features_enabled, trust_forwarded_for,
		content_cache_sec, smtp_rate_limit_per_hour, updated_at
		FROM operator_settings WHERE id = $1`
	doc := models.DefaultOperatorSettings()
	err := s.pool.QueryRow(ctx, q, models.OperatorSettingsID).Scan(
		&doc.ID, &doc.PublicBaseURL, &doc.PlatformMailDomain, &doc.WebOrigins, &doc.CookieDomain,
		&doc.RegistrationClosed, &doc.PaidFeaturesEnabled, &doc.TrustForwardedFor,
		&doc.ContentCacheSec, &doc.SMTPRateLimitPerHour, &doc.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return doc, nil
	}
	if err != nil {
		return nil, err
	}
	normalizeOperatorSettingsDoc(doc)
	return doc, nil
}

// SetOperatorSettings replaces the singleton platform configuration.
func (s *Store) SetOperatorSettings(ctx context.Context, doc *models.OperatorSettingsDoc) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if doc == nil {
		return errors.New("store: nil operator settings")
	}
	doc.ID = models.OperatorSettingsID
	normalizeOperatorSettingsDoc(doc)
	const q = `INSERT INTO operator_settings (
			id, public_base_url, platform_mail_domain, web_origins, cookie_domain,
			registration_closed, paid_features_enabled, trust_forwarded_for,
			content_cache_sec, smtp_rate_limit_per_hour, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
		ON CONFLICT (id) DO UPDATE SET
			public_base_url = EXCLUDED.public_base_url,
			platform_mail_domain = EXCLUDED.platform_mail_domain,
			web_origins = EXCLUDED.web_origins,
			cookie_domain = EXCLUDED.cookie_domain,
			registration_closed = EXCLUDED.registration_closed,
			paid_features_enabled = EXCLUDED.paid_features_enabled,
			trust_forwarded_for = EXCLUDED.trust_forwarded_for,
			content_cache_sec = EXCLUDED.content_cache_sec,
			smtp_rate_limit_per_hour = EXCLUDED.smtp_rate_limit_per_hour,
			updated_at = now()`
	_, err := s.pool.Exec(ctx, q,
		doc.ID, doc.PublicBaseURL, doc.PlatformMailDomain, doc.WebOrigins, doc.CookieDomain,
		doc.RegistrationClosed, doc.PaidFeaturesEnabled, doc.TrustForwardedFor,
		doc.ContentCacheSec, doc.SMTPRateLimitPerHour,
	)
	return err
}

func normalizeOperatorSettingsDoc(doc *models.OperatorSettingsDoc) {
	doc.PublicBaseURL = strings.TrimRight(strings.TrimSpace(doc.PublicBaseURL), "/")
	doc.PlatformMailDomain = strings.TrimSpace(strings.ToLower(doc.PlatformMailDomain))
	doc.WebOrigins = strings.TrimSpace(doc.WebOrigins)
	doc.CookieDomain = strings.TrimSpace(doc.CookieDomain)
	if doc.ContentCacheSec <= 0 {
		doc.ContentCacheSec = models.DefaultContentCacheSec
	}
	if doc.SMTPRateLimitPerHour <= 0 {
		doc.SMTPRateLimitPerHour = models.DefaultSMTPRateLimitPerHour
	}
}
