package mailmeta

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// UserContactKey is a per-user saved OpenPGP public key for a contact address.
type UserContactKey struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	Email         string
	Fingerprint   string
	ArmoredPublic string
	Source        string
	TrustedAt     *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func normalizeFingerprintHex(s string) string {
	var b strings.Builder
	for _, r := range strings.ToUpper(strings.TrimSpace(s)) {
		if (r >= '0' && r <= '9') || (r >= 'A' && r <= 'F') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// UpsertUserContactKey inserts or updates a row keyed by (user_id, email, fingerprint).
// When markTrusted is true, trusted_at is set to now(); when false on insert trusted_at is null,
// and on conflict existing trusted_at is preserved unless markTrusted is true.
func (s *Store) UpsertUserContactKey(ctx context.Context, userID uuid.UUID, email, fingerprint, armoredPublic, source string, markTrusted bool) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	if userID == uuid.Nil {
		return errors.New("mailmeta: user id required")
	}
	email = strings.ToLower(strings.TrimSpace(email))
	fingerprint = strings.TrimSpace(fingerprint)
	_, err := s.pool.Exec(ctx, `INSERT INTO mail_user_contact_keys
		(user_id, email, fingerprint, armored_public, source, trusted_at)
		VALUES ($1, $2, $3, $4, $5, CASE WHEN $6 THEN now() ELSE NULL END)
		ON CONFLICT (user_id, email, fingerprint) DO UPDATE SET
		  armored_public = EXCLUDED.armored_public,
		  source = EXCLUDED.source,
		  trusted_at = CASE WHEN $6 THEN now() ELSE mail_user_contact_keys.trusted_at END,
		  updated_at = now()`,
		userID, email, fingerprint, armoredPublic, source, markTrusted)
	return err
}

// GetUserContactKey returns the preferred single row for an email: latest trusted, else latest updated.
func (s *Store) GetUserContactKey(ctx context.Context, userID uuid.UUID, email string) (*UserContactKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	email = strings.ToLower(strings.TrimSpace(email))
	var k UserContactKey
	err := s.pool.QueryRow(ctx, `SELECT id, user_id, email, fingerprint, armored_public, source, trusted_at, created_at, updated_at
		FROM mail_user_contact_keys
		WHERE user_id = $1 AND email = $2
		ORDER BY (trusted_at IS NOT NULL) DESC, trusted_at DESC NULLS LAST, updated_at DESC
		LIMIT 1`,
		userID, email,
	).Scan(&k.ID, &k.UserID, &k.Email, &k.Fingerprint, &k.ArmoredPublic, &k.Source, &k.TrustedAt, &k.CreatedAt, &k.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &k, err
}

// ListUserContactKeys lists contacts for a user (most recently updated first).
func (s *Store) ListUserContactKeys(ctx context.Context, userID uuid.UUID, limit int) ([]UserContactKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `SELECT id, user_id, email, fingerprint, armored_public, source, trusted_at, created_at, updated_at
		FROM mail_user_contact_keys WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []UserContactKey
	for rows.Next() {
		var k UserContactKey
		if err := rows.Scan(&k.ID, &k.UserID, &k.Email, &k.Fingerprint, &k.ArmoredPublic, &k.Source, &k.TrustedAt, &k.CreatedAt, &k.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// DeleteUserContactKeysByEmail removes all stored keys for one contact email.
func (s *Store) DeleteUserContactKeysByEmail(ctx context.Context, userID uuid.UUID, email string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	email = strings.ToLower(strings.TrimSpace(email))
	_, err := s.pool.Exec(ctx, `DELETE FROM mail_user_contact_keys WHERE user_id = $1 AND email = $2`, userID, email)
	return err
}

// DeleteUserContactKey removes one row when fingerprint matches (exact stored value or hex-normalized).
func (s *Store) DeleteUserContactKey(ctx context.Context, userID uuid.UUID, email, fingerprint string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	email = strings.ToLower(strings.TrimSpace(email))
	fingerprint = strings.TrimSpace(fingerprint)
	want := normalizeFingerprintHex(fingerprint)
	if want == "" {
		return errors.New("mailmeta: fingerprint required")
	}
	rows, err := s.pool.Query(ctx, `SELECT fingerprint FROM mail_user_contact_keys WHERE user_id = $1 AND email = $2`, userID, email)
	if err != nil {
		return err
	}
	defer rows.Close()
	var toDelete []string
	for rows.Next() {
		var fp string
		if err := rows.Scan(&fp); err != nil {
			return err
		}
		if normalizeFingerprintHex(fp) == want || (len(want) == 16 && len(normalizeFingerprintHex(fp)) >= 16 && strings.HasSuffix(normalizeFingerprintHex(fp), want)) {
			toDelete = append(toDelete, fp)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(toDelete) == 0 {
		return ErrNotFound
	}
	for _, fp := range toDelete {
		if _, err := s.pool.Exec(ctx, `DELETE FROM mail_user_contact_keys WHERE user_id = $1 AND email = $2 AND fingerprint = $3`, userID, email, fp); err != nil {
			return err
		}
	}
	return nil
}
