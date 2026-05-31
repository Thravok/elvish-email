package store

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"elvish/internal/models"
)

// GetAdminMailSettings returns persisted admin mail delivery settings or defaults when missing.
func (s *Store) GetAdminMailSettings(ctx context.Context) (*models.AdminMailSettingsDoc, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, dkim_selector, dkim_domain, updated_at FROM admin_mail_settings WHERE id = $1`
	doc := models.DefaultAdminMailSettings()
	err := s.pool.QueryRow(ctx, q, models.AdminMailSettingsID).Scan(
		&doc.ID, &doc.DKIMSelector, &doc.DKIMDomain, &doc.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return doc, nil
	}
	if err != nil {
		return doc, nil
	}
	doc.DKIMSelector = strings.TrimSpace(strings.ToLower(doc.DKIMSelector))
	doc.DKIMDomain = strings.TrimSpace(strings.ToLower(doc.DKIMDomain))
	if doc.DKIMSelector == "" {
		doc.DKIMSelector = models.DefaultAdminDKIMSelector
	}
	return doc, nil
}

// SetAdminMailSettings replaces the singleton admin mail delivery configuration.
func (s *Store) SetAdminMailSettings(ctx context.Context, doc *models.AdminMailSettingsDoc) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if doc == nil {
		return errors.New("store: nil admin mail settings")
	}
	doc.ID = models.AdminMailSettingsID
	doc.DKIMSelector = strings.TrimSpace(strings.ToLower(doc.DKIMSelector))
	doc.DKIMDomain = strings.TrimSpace(strings.ToLower(doc.DKIMDomain))
	if doc.DKIMSelector == "" {
		doc.DKIMSelector = models.DefaultAdminDKIMSelector
	}
	const q = `INSERT INTO admin_mail_settings (id, dkim_selector, dkim_domain, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (id) DO UPDATE SET
			dkim_selector = EXCLUDED.dkim_selector,
			dkim_domain = EXCLUDED.dkim_domain,
			updated_at = now()`
	_, err := s.pool.Exec(ctx, q, doc.ID, doc.DKIMSelector, doc.DKIMDomain)
	return err
}
