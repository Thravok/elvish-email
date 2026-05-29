package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"elvish/libs/go/models"
)

// GetSiteHomeJSON returns stored home.json override text, or empty if none.
func (s *Store) GetSiteHomeJSON(ctx context.Context) (string, error) {
	if s == nil || s.pool == nil {
		return "", errors.New("store: nil")
	}
	const q = `SELECT home_json FROM site_config WHERE id = $1`
	var home string
	err := s.pool.QueryRow(ctx, q, models.SiteConfigID).Scan(&home)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return home, nil
}

// SetSiteHomeJSON upserts the site home JSON override.
func (s *Store) SetSiteHomeJSON(ctx context.Context, json string) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	const q = `INSERT INTO site_config (id, home_json) VALUES ($1, $2)
		ON CONFLICT (id) DO UPDATE SET home_json = EXCLUDED.home_json`
	_, err := s.pool.Exec(ctx, q, models.SiteConfigID, json)
	return err
}
