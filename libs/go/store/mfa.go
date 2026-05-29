package store

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"elvish/libs/go/models"
)

// GetMFASettings returns a user's MFA settings row or a disabled default when absent.
func (s *Store) GetMFASettings(ctx context.Context, userID uuid.UUID) (*models.MFASettings, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT user_id, enabled, preferred_method, created_at, updated_at
		FROM user_mfa_settings WHERE user_id = $1`
	var out models.MFASettings
	err := s.pool.QueryRow(ctx, q, userID).Scan(
		&out.UserID, &out.Enabled, &out.PreferredMethod, &out.CreatedAt, &out.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return &models.MFASettings{UserID: userID, Enabled: false}, nil
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// PutMFASettings creates or updates a user's MFA settings row.
func (s *Store) PutMFASettings(ctx context.Context, userID uuid.UUID, enabled bool, preferredMethod string) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO user_mfa_settings (user_id, enabled, preferred_method, created_at, updated_at)
		VALUES ($1, $2, $3, now(), now())
		ON CONFLICT (user_id) DO UPDATE
		SET enabled = EXCLUDED.enabled,
		    preferred_method = EXCLUDED.preferred_method,
		    updated_at = now()`,
		userID, enabled, strings.TrimSpace(preferredMethod),
	)
	return err
}

// ListTOTPFactors returns active authenticator-app factors for a user.
func (s *Store) ListTOTPFactors(ctx context.Context, userID uuid.UUID) ([]models.TOTPFactor, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT id, user_id, label, secret_encrypted, secret_version, issuer, account_name,
		algorithm, digits, period_seconds, verified_at, last_used_at, created_at, updated_at, revoked_at
		FROM user_totp_factors
		WHERE user_id = $1 AND revoked_at IS NULL
		ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.TOTPFactor, 0)
	for rows.Next() {
		var factor models.TOTPFactor
		if err := rows.Scan(
			&factor.ID, &factor.UserID, &factor.Label, &factor.SecretEncrypted, &factor.SecretVersion, &factor.Issuer,
			&factor.AccountName, &factor.Algorithm, &factor.Digits, &factor.PeriodSeconds, &factor.VerifiedAt,
			&factor.LastUsedAt, &factor.CreatedAt, &factor.UpdatedAt, &factor.RevokedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, factor)
	}
	return out, rows.Err()
}

// GetTOTPFactor loads a specific active authenticator-app factor for a user.
func (s *Store) GetTOTPFactor(ctx context.Context, userID, factorID uuid.UUID) (*models.TOTPFactor, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, user_id, label, secret_encrypted, secret_version, issuer, account_name,
		algorithm, digits, period_seconds, verified_at, last_used_at, created_at, updated_at, revoked_at
		FROM user_totp_factors
		WHERE user_id = $1 AND id = $2 AND revoked_at IS NULL`
	var factor models.TOTPFactor
	err := s.pool.QueryRow(ctx, q, userID, factorID).Scan(
		&factor.ID, &factor.UserID, &factor.Label, &factor.SecretEncrypted, &factor.SecretVersion, &factor.Issuer,
		&factor.AccountName, &factor.Algorithm, &factor.Digits, &factor.PeriodSeconds, &factor.VerifiedAt,
		&factor.LastUsedAt, &factor.CreatedAt, &factor.UpdatedAt, &factor.RevokedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &factor, nil
}

// CreateTOTPFactor inserts a new verified TOTP factor.
func (s *Store) CreateTOTPFactor(ctx context.Context, factor models.TOTPFactor) (*models.TOTPFactor, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `INSERT INTO user_totp_factors
		(user_id, label, secret_encrypted, secret_version, issuer, account_name, algorithm, digits, period_seconds,
		 verified_at, last_used_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, now(), now())
		RETURNING id, user_id, label, secret_encrypted, secret_version, issuer, account_name, algorithm, digits,
		          period_seconds, verified_at, last_used_at, created_at, updated_at, revoked_at`
	var out models.TOTPFactor
	err := s.pool.QueryRow(ctx, q,
		factor.UserID,
		strings.TrimSpace(factor.Label),
		factor.SecretEncrypted,
		factor.SecretVersion,
		strings.TrimSpace(factor.Issuer),
		strings.TrimSpace(factor.AccountName),
		strings.TrimSpace(factor.Algorithm),
		factor.Digits,
		factor.PeriodSeconds,
		factor.VerifiedAt,
	).Scan(
		&out.ID, &out.UserID, &out.Label, &out.SecretEncrypted, &out.SecretVersion, &out.Issuer, &out.AccountName,
		&out.Algorithm, &out.Digits, &out.PeriodSeconds, &out.VerifiedAt, &out.LastUsedAt, &out.CreatedAt,
		&out.UpdatedAt, &out.RevokedAt,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// TouchTOTPFactor stores the last-used timestamp for a factor.
func (s *Store) TouchTOTPFactor(ctx context.Context, userID, factorID uuid.UUID, usedAt time.Time) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE user_totp_factors
		SET last_used_at = $3, updated_at = now()
		WHERE user_id = $1 AND id = $2 AND revoked_at IS NULL`, userID, factorID, usedAt.UTC())
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// RevokeTOTPFactor marks a factor inactive.
func (s *Store) RevokeTOTPFactor(ctx context.Context, userID, factorID uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE user_totp_factors
		SET revoked_at = now(), updated_at = now()
		WHERE user_id = $1 AND id = $2 AND revoked_at IS NULL`, userID, factorID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ActiveTOTPFactorCount returns how many active authenticator-app factors a user has.
func (s *Store) ActiveTOTPFactorCount(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.countFactors(ctx, `SELECT count(*) FROM user_totp_factors WHERE user_id = $1 AND revoked_at IS NULL`, userID)
}

// ListWebAuthnCredentials returns active security-key credentials for a user.
func (s *Store) ListWebAuthnCredentials(ctx context.Context, userID uuid.UUID) ([]models.WebAuthnCredential, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT id, user_id, label, credential_id, credential_json, aaguid, sign_count,
		transports, attachment, discoverable, user_verified, backup_eligible, backup_state, created_at, last_used_at, revoked_at
		FROM user_webauthn_credentials
		WHERE user_id = $1 AND revoked_at IS NULL
		ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.WebAuthnCredential, 0)
	for rows.Next() {
		var cred models.WebAuthnCredential
		if err := rows.Scan(
			&cred.ID, &cred.UserID, &cred.Label, &cred.CredentialID, &cred.CredentialJSON, &cred.AAGUID, &cred.SignCount,
			&cred.Transports, &cred.Attachment, &cred.Discoverable, &cred.UserVerified, &cred.BackupEligible,
			&cred.BackupState, &cred.CreatedAt, &cred.LastUsedAt, &cred.RevokedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, cred)
	}
	return out, rows.Err()
}

// CreateWebAuthnCredential inserts a new security-key credential.
func (s *Store) CreateWebAuthnCredential(ctx context.Context, cred models.WebAuthnCredential) (*models.WebAuthnCredential, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `INSERT INTO user_webauthn_credentials
		(user_id, label, credential_id, credential_json, aaguid, sign_count, transports, attachment, discoverable,
		 user_verified, backup_eligible, backup_state, created_at)
		VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, now())
		RETURNING id, user_id, label, credential_id, credential_json, aaguid, sign_count, transports, attachment,
		          discoverable, user_verified, backup_eligible, backup_state, created_at, last_used_at, revoked_at`
	var out models.WebAuthnCredential
	err := s.pool.QueryRow(ctx, q,
		cred.UserID,
		strings.TrimSpace(cred.Label),
		cred.CredentialID,
		string(cred.CredentialJSON),
		strings.TrimSpace(cred.AAGUID),
		cred.SignCount,
		cred.Transports,
		strings.TrimSpace(cred.Attachment),
		cred.Discoverable,
		cred.UserVerified,
		cred.BackupEligible,
		cred.BackupState,
	).Scan(
		&out.ID, &out.UserID, &out.Label, &out.CredentialID, &out.CredentialJSON, &out.AAGUID, &out.SignCount,
		&out.Transports, &out.Attachment, &out.Discoverable, &out.UserVerified, &out.BackupEligible, &out.BackupState,
		&out.CreatedAt, &out.LastUsedAt, &out.RevokedAt,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// UpdateWebAuthnCredentialUsage persists a credential's updated counter and stored record after successful assertions.
func (s *Store) UpdateWebAuthnCredentialUsage(ctx context.Context, userID uuid.UUID, credentialID []byte, record webauthn.Credential, usedAt time.Time) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	raw, err := json.Marshal(record)
	if err != nil {
		return err
	}
	tag, err := s.pool.Exec(ctx, `UPDATE user_webauthn_credentials
		SET credential_json = $3::jsonb,
		    sign_count = $4,
		    aaguid = $5,
		    transports = $6,
		    attachment = $7,
		    discoverable = $8,
		    user_verified = $9,
		    backup_eligible = $10,
		    backup_state = $11,
		    last_used_at = $12
		WHERE user_id = $1 AND credential_id = $2 AND revoked_at IS NULL`,
		userID,
		credentialID,
		string(raw),
		int64(record.Authenticator.SignCount),
		hex.EncodeToString(record.Authenticator.AAGUID),
		transportsToStrings(record.Transport),
		string(record.Authenticator.Attachment),
		false,
		record.Flags.UserVerified,
		record.Flags.BackupEligible,
		record.Flags.BackupState,
		usedAt.UTC(),
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// RevokeWebAuthnCredential marks a security-key credential inactive.
func (s *Store) RevokeWebAuthnCredential(ctx context.Context, userID, id uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE user_webauthn_credentials
		SET revoked_at = now()
		WHERE user_id = $1 AND id = $2 AND revoked_at IS NULL`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ActiveWebAuthnCredentialCount returns how many active security-key credentials a user has.
func (s *Store) ActiveWebAuthnCredentialCount(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.countFactors(ctx, `SELECT count(*) FROM user_webauthn_credentials WHERE user_id = $1 AND revoked_at IS NULL`, userID)
}

// ReplaceRecoveryCodes invalidates the current recovery set and stores a fresh one.
func (s *Store) ReplaceRecoveryCodes(ctx context.Context, userID uuid.UUID, hashes []string) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `DELETE FROM user_mfa_recovery_codes WHERE user_id = $1`, userID); err != nil {
		return err
	}
	for _, hash := range hashes {
		if strings.TrimSpace(hash) == "" {
			continue
		}
		if _, err := tx.Exec(ctx, `INSERT INTO user_mfa_recovery_codes (user_id, code_hash, created_at) VALUES ($1, $2, now())`,
			userID, strings.TrimSpace(hash)); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// CountUnusedRecoveryCodes returns how many one-time recovery codes remain.
func (s *Store) CountUnusedRecoveryCodes(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.countFactors(ctx, `SELECT count(*) FROM user_mfa_recovery_codes WHERE user_id = $1 AND used_at IS NULL`, userID)
}

// ConsumeRecoveryCode marks a recovery code used when the hash matches an unused record.
func (s *Store) ConsumeRecoveryCode(ctx context.Context, userID uuid.UUID, codeHash string, usedAt time.Time) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE user_mfa_recovery_codes
		SET used_at = $3
		WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`, userID, strings.TrimSpace(codeHash), usedAt.UTC())
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) countFactors(ctx context.Context, q string, userID uuid.UUID) (int, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("store: nil")
	}
	var n int
	if err := s.pool.QueryRow(ctx, q, userID).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

// DecodeWebAuthnCredentials decodes stored JSON records into the library shape expected by verification.
func DecodeWebAuthnCredentials(records []models.WebAuthnCredential) ([]webauthn.Credential, error) {
	out := make([]webauthn.Credential, 0, len(records))
	for _, rec := range records {
		var cred webauthn.Credential
		if err := json.Unmarshal(rec.CredentialJSON, &cred); err != nil {
			return nil, err
		}
		out = append(out, cred)
	}
	return out, nil
}

func transportsToStrings(transports []protocol.AuthenticatorTransport) []string {
	out := make([]string, 0, len(transports))
	for _, transport := range transports {
		out = append(out, string(transport))
	}
	return out
}
