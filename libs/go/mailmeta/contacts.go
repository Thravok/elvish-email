package mailmeta

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ContactKey is one resolver-cache row.
type ContactKey struct {
	ID               uuid.UUID
	Email            string
	Fingerprint      string
	ArmoredPublic    string
	Source           string
	FetchedAt        time.Time
	ExpiresAt        time.Time
	VerifiedUIDMatch bool
	ProtonKTState    string
}

// PutContactKey upserts a resolver cache entry.
func (s *Store) PutContactKey(ctx context.Context, k ContactKey) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	k.Email = strings.ToLower(strings.TrimSpace(k.Email))
	_, err := s.pool.Exec(ctx, `INSERT INTO contact_pgp_keys
		(email, fingerprint, armored_public, source, fetched_at, expires_at, verified_uid_match, proton_kt_state)
		VALUES ($1, $2, $3, $4, now(), $5, $6, $7)
		ON CONFLICT (email, fingerprint) DO UPDATE SET
		  armored_public = $3, source = $4, fetched_at = now(),
		  expires_at = $5, verified_uid_match = $6, proton_kt_state = $7`,
		k.Email, k.Fingerprint, k.ArmoredPublic, k.Source, k.ExpiresAt, k.VerifiedUIDMatch, k.ProtonKTState,
	)
	return err
}

// GetContactKey returns the most recent non-expired cache entry for email (any source).
func (s *Store) GetContactKey(ctx context.Context, email string) (*ContactKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	email = strings.ToLower(strings.TrimSpace(email))
	var k ContactKey
	err := s.pool.QueryRow(ctx, `SELECT id, email, fingerprint, armored_public, source, fetched_at, expires_at, verified_uid_match, proton_kt_state
		FROM contact_pgp_keys WHERE email = $1 AND expires_at > now() ORDER BY fetched_at DESC LIMIT 1`, email).Scan(
		&k.ID, &k.Email, &k.Fingerprint, &k.ArmoredPublic, &k.Source, &k.FetchedAt, &k.ExpiresAt, &k.VerifiedUIDMatch, &k.ProtonKTState,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &k, err
}

// DeleteContactKey removes any cached row(s) for email (cache bust).
func (s *Store) DeleteContactKey(ctx context.Context, email string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	email = strings.ToLower(strings.TrimSpace(email))
	_, err := s.pool.Exec(ctx, `DELETE FROM contact_pgp_keys WHERE email = $1`, email)
	return err
}

// ListContactKeys returns all cached resolver entries (most recent per email),
// suitable for the user's address-book panel. Limited to limit rows.
func (s *Store) ListContactKeys(ctx context.Context, limit int) ([]ContactKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `SELECT id, email, fingerprint, armored_public, source, fetched_at, expires_at, verified_uid_match, proton_kt_state
		FROM contact_pgp_keys ORDER BY fetched_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ContactKey
	for rows.Next() {
		var k ContactKey
		if err := rows.Scan(&k.ID, &k.Email, &k.Fingerprint, &k.ArmoredPublic, &k.Source, &k.FetchedAt, &k.ExpiresAt, &k.VerifiedUIDMatch, &k.ProtonKTState); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}
