package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"elvish/internal/models"
)

// InsertPGPKey stores an armored public key (upsert by fingerprint16).
func (s *Store) InsertPGPKey(ctx context.Context, k *models.PGPPublicKey) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	k.Fingerprint16 = strings.TrimSpace(strings.ToUpper(k.Fingerprint16))
	if k.Fingerprint16 == "" || strings.TrimSpace(k.Armored) == "" {
		return errors.New("store: invalid pgp key")
	}
	k.CreatedAt = time.Now().UTC()
	const q = `INSERT INTO pgp_public_keys (fingerprint16, full_key_id, armored, label, created_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (fingerprint16) DO UPDATE SET
			full_key_id = EXCLUDED.full_key_id,
			armored = EXCLUDED.armored,
			label = EXCLUDED.label,
			created_at = EXCLUDED.created_at
		RETURNING id`
	return s.pool.QueryRow(ctx, q, k.Fingerprint16, k.FullKeyID, k.Armored, strings.TrimSpace(k.Label), k.CreatedAt).Scan(&k.ID)
}

// ListPGPKeys returns all stored public keys, newest first.
func (s *Store) ListPGPKeys(ctx context.Context) ([]models.PGPPublicKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, fingerprint16, full_key_id, armored, label, created_at FROM pgp_public_keys ORDER BY created_at DESC`
	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.PGPPublicKey
	for rows.Next() {
		var k models.PGPPublicKey
		if err := rows.Scan(&k.ID, &k.Fingerprint16, &k.FullKeyID, &k.Armored, &k.Label, &k.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// PGPPublicKeyArmoredByFingerprint16 returns armored key text for a stored fingerprint (16 hex).
func (s *Store) PGPPublicKeyArmoredByFingerprint16(ctx context.Context, fp16 string) (string, error) {
	if s == nil || s.pool == nil {
		return "", errors.New("store: nil")
	}
	fp16 = strings.TrimSpace(strings.ToUpper(fp16))
	const q = `SELECT armored FROM pgp_public_keys WHERE fingerprint16 = $1`
	var arm string
	err := s.pool.QueryRow(ctx, q, fp16).Scan(&arm)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	return arm, err
}
