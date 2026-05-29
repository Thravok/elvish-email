package store

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"elvish/libs/go/models"
)

// GetAuthCaptchaSettings returns persisted Cap captcha settings or defaults when missing.
func (s *Store) GetAuthCaptchaSettings(ctx context.Context) (*models.AuthCaptchaSettingsDoc, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, enabled, widget_api_endpoint, secret, updated_at FROM auth_captcha_settings WHERE id = $1`
	doc := models.DefaultAuthCaptchaSettings()
	err := s.pool.QueryRow(ctx, q, models.AuthCaptchaSettingsID).Scan(
		&doc.ID, &doc.Enabled, &doc.WidgetAPIEndpoint, &doc.Secret, &doc.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return doc, nil
	}
	if err != nil {
		return nil, err
	}
	doc.WidgetAPIEndpoint = strings.TrimSpace(doc.WidgetAPIEndpoint)
	return doc, nil
}

// SetAuthCaptchaSettings replaces the singleton Cap captcha configuration.
func (s *Store) SetAuthCaptchaSettings(ctx context.Context, doc *models.AuthCaptchaSettingsDoc) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if doc == nil {
		return errors.New("store: nil auth captcha settings")
	}
	doc.ID = models.AuthCaptchaSettingsID
	doc.WidgetAPIEndpoint = strings.TrimSpace(doc.WidgetAPIEndpoint)
	const q = `INSERT INTO auth_captcha_settings (id, enabled, widget_api_endpoint, secret, updated_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (id) DO UPDATE SET
			enabled = EXCLUDED.enabled,
			widget_api_endpoint = EXCLUDED.widget_api_endpoint,
			secret = EXCLUDED.secret,
			updated_at = now()`
	_, err := s.pool.Exec(ctx, q, doc.ID, doc.Enabled, doc.WidgetAPIEndpoint, doc.Secret)
	return err
}
