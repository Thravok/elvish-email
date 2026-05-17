package mailmeta

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// identitySelectColumns must qualify columns as ik.* — queries join mail_aliases a
// and both tables expose id, so bare "id" is ambiguous in PostgreSQL.
const identitySelectColumns = `SELECT ik.id, ik.user_id, ik.email, ik.fingerprint, ik.key_id_long, ik.armored_public, ik.primary_uid, ik.algorithm, ik.bits,
		ik.is_default, ik.is_active, ik.expires_at, ik.revoked_at, ik.revocation_certificate, ik.created_at, ik.avatar_data_url, ik.avatar_color, ik.status_badge_enabled`

var identityAvatarColors = []string{"pink", "yellow", "red", "orange", "green", "blue", "dark-blue"}

// AccountKey is the user's KDF-wrapped account private key + public key (Skiff layer 1).
type AccountKey struct {
	UserID        uuid.UUID
	Fingerprint   string
	KeyIDLong     string
	ArmoredPublic string
	Algorithm     string
	KeyVersion    int
	WrappedSecret []byte
	KDF           string // argon2id | pbkdf2-sha256
	KDFSalt       []byte
	KDFParams     []byte // raw JSON
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// IdentityKey is one per-email PGP keypair (Skiff layer 2).
type IdentityKey struct {
	ID                    uuid.UUID
	UserID                uuid.UUID
	Email                 string
	Fingerprint           string
	KeyIDLong             string
	ArmoredPublic         string
	PrimaryUID            string
	Algorithm             string
	Bits                  int
	IsDefault             bool
	IsActive              bool
	ExpiresAt             *time.Time
	RevokedAt             *time.Time
	RevocationCertificate string
	CreatedAt             time.Time
	AvatarDataURL         string
	AvatarColor           string
	StatusBadgeEnabled    bool
}

// IdentitySecret is the wrapped-to-account-pubkey identity private key blob.
type IdentitySecret struct {
	UserID        uuid.UUID
	Fingerprint   string
	WrapMethod    string // account-key | password
	Algorithm     string
	KeyVersion    int
	WrappedSecret []byte
	CreatedAt     time.Time
}

// BootstrapAccountKey inserts the account key row. Fails if a row already exists for userID.
func (s *Store) BootstrapAccountKey(ctx context.Context, k AccountKey) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	if strings.TrimSpace(k.Algorithm) == "" {
		k.Algorithm = "openpgp-ecc-curve25519"
	}
	if k.KeyVersion <= 0 {
		k.KeyVersion = 1
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO user_account_keys
		(user_id, fingerprint, key_id_long, armored_public, algorithm, key_version, wrapped_secret, kdf, kdf_salt, kdf_params, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())`,
		k.UserID, k.Fingerprint, k.KeyIDLong, k.ArmoredPublic, k.Algorithm, k.KeyVersion, k.WrappedSecret, k.KDF, k.KDFSalt, k.KDFParams,
	)
	return err
}

// UpdateAccountKey replaces the wrapped secret + KDF params for password change.
func (s *Store) UpdateAccountKey(ctx context.Context, userID uuid.UUID, wrapped []byte, kdf string, salt []byte, params []byte) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE user_account_keys
		SET wrapped_secret = $1, kdf = $2, kdf_salt = $3, kdf_params = $4, updated_at = now()
		WHERE user_id = $5`,
		wrapped, kdf, salt, params, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetAccountKey returns the user's account key row.
func (s *Store) GetAccountKey(ctx context.Context, userID uuid.UUID) (*AccountKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	var k AccountKey
	err := s.pool.QueryRow(ctx, `SELECT user_id, fingerprint, key_id_long, armored_public, algorithm, key_version, wrapped_secret, kdf, kdf_salt, kdf_params, created_at, updated_at
		FROM user_account_keys WHERE user_id = $1`, userID).Scan(
		&k.UserID, &k.Fingerprint, &k.KeyIDLong, &k.ArmoredPublic, &k.Algorithm, &k.KeyVersion, &k.WrappedSecret, &k.KDF, &k.KDFSalt, &k.KDFParams, &k.CreatedAt, &k.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &k, nil
}

// InsertIdentityKey adds a per-email identity keypair + the wrapped secret blob (account-key wrapped).
func (s *Store) InsertIdentityKey(ctx context.Context, k IdentityKey, wrappedSecret []byte) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if k.ID == uuid.Nil {
		k.ID = uuid.New()
	}
	k.AvatarDataURL = strings.TrimSpace(k.AvatarDataURL)
	k.AvatarColor = NormalizeIdentityAvatarColor(k.AvatarColor, k.Email)
	if _, err := tx.Exec(ctx, `INSERT INTO user_identity_keys
		(id, user_id, email, fingerprint, key_id_long, armored_public, primary_uid, algorithm, bits, is_default, is_active, expires_at, revoked_at, revocation_certificate, created_at, avatar_data_url, avatar_color, status_badge_enabled)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),$15,$16,$17)`,
		k.ID, k.UserID, k.Email, k.Fingerprint, k.KeyIDLong, k.ArmoredPublic, k.PrimaryUID, k.Algorithm, k.Bits,
		k.IsDefault, k.IsActive, k.ExpiresAt, k.RevokedAt, k.RevocationCertificate, k.AvatarDataURL, k.AvatarColor, k.StatusBadgeEnabled,
	); err != nil {
		return err
	}
	alg := strings.TrimSpace(k.Algorithm)
	if alg == "" {
		alg = "openpgp-ecc-curve25519"
	}
	if _, err := tx.Exec(ctx, `INSERT INTO identity_secret_blobs (user_id, fingerprint, wrap_method, algorithm, key_version, wrapped_secret, created_at)
		VALUES ($1, $2, 'account-key', $3, $4, $5, now())`, k.UserID, k.Fingerprint, alg, 1, wrappedSecret); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ListIdentityKeys returns all identities for userID (newest first).
func (s *Store) ListIdentityKeys(ctx context.Context, userID uuid.UUID) ([]IdentityKey, []IdentitySecret, error) {
	if s == nil || s.pool == nil {
		return nil, nil, errors.New("mailmeta: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT id, user_id, email, fingerprint, key_id_long, armored_public, primary_uid, algorithm, bits,
		is_default, is_active, expires_at, revoked_at, revocation_certificate, created_at, avatar_data_url, avatar_color, status_badge_enabled
		FROM user_identity_keys WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var keys []IdentityKey
	for rows.Next() {
		var k IdentityKey
		if err := rows.Scan(&k.ID, &k.UserID, &k.Email, &k.Fingerprint, &k.KeyIDLong, &k.ArmoredPublic, &k.PrimaryUID, &k.Algorithm, &k.Bits,
			&k.IsDefault, &k.IsActive, &k.ExpiresAt, &k.RevokedAt, &k.RevocationCertificate, &k.CreatedAt, &k.AvatarDataURL, &k.AvatarColor, &k.StatusBadgeEnabled,
		); err != nil {
			return nil, nil, err
		}
		keys = append(keys, k)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	srows, err := s.pool.Query(ctx, `SELECT user_id, fingerprint, wrap_method, algorithm, key_version, wrapped_secret, created_at
		FROM identity_secret_blobs WHERE user_id = $1`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer srows.Close()
	var secrets []IdentitySecret
	for srows.Next() {
		var sec IdentitySecret
		if err := srows.Scan(&sec.UserID, &sec.Fingerprint, &sec.WrapMethod, &sec.Algorithm, &sec.KeyVersion, &sec.WrappedSecret, &sec.CreatedAt); err != nil {
			return nil, nil, err
		}
		secrets = append(secrets, sec)
	}
	return keys, secrets, srows.Err()
}

// DefaultIdentityForUser returns the default identity row (or the most recent active one if none flagged).
func (s *Store) DefaultIdentityForUser(ctx context.Context, userID uuid.UUID) (*IdentityKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	var k IdentityKey
	err := s.pool.QueryRow(ctx, `SELECT id, user_id, email, fingerprint, key_id_long, armored_public, primary_uid, algorithm, bits,
		is_default, is_active, expires_at, revoked_at, revocation_certificate, created_at, avatar_data_url, avatar_color, status_badge_enabled
		FROM user_identity_keys WHERE user_id = $1 AND is_active = true
		ORDER BY is_default DESC, created_at DESC LIMIT 1`, userID).Scan(
		&k.ID, &k.UserID, &k.Email, &k.Fingerprint, &k.KeyIDLong, &k.ArmoredPublic, &k.PrimaryUID, &k.Algorithm, &k.Bits,
		&k.IsDefault, &k.IsActive, &k.ExpiresAt, &k.RevokedAt, &k.RevocationCertificate, &k.CreatedAt, &k.AvatarDataURL, &k.AvatarColor, &k.StatusBadgeEnabled,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &k, nil
}

// WKDReverseLookup scans active aliases at domain for the local-part whose Z-Base-32 SHA-1 matches hash.
// Returns the matching email address or "" when no match. Uses a small, indexed scan.
func (s *Store) WKDReverseLookup(ctx context.Context, domain, hash string) (string, error) {
	if s == nil || s.pool == nil {
		return "", errors.New("mailmeta: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT email FROM mail_aliases WHERE is_active = true AND email LIKE $1`,
		"%@"+domain,
	)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	for rows.Next() {
		var em string
		if err := rows.Scan(&em); err != nil {
			return "", err
		}
		at := lastAt(em)
		if at <= 0 {
			continue
		}
		if hashLocalPart(em[:at]) == hash {
			return em, nil
		}
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	// Fall back to user identities (if no alias matches, try identity emails directly).
	idrows, err := s.pool.Query(ctx, `SELECT email FROM user_identity_keys WHERE is_active = true AND email LIKE $1`,
		"%@"+domain,
	)
	if err != nil {
		return "", err
	}
	defer idrows.Close()
	for idrows.Next() {
		var em string
		if err := idrows.Scan(&em); err != nil {
			return "", err
		}
		at := lastAt(em)
		if at <= 0 {
			continue
		}
		if hashLocalPart(em[:at]) == hash {
			return em, nil
		}
	}
	return "", idrows.Err()
}

func scanIdentityKey(row pgx.Row) (*IdentityKey, error) {
	var k IdentityKey
	err := row.Scan(
		&k.ID, &k.UserID, &k.Email, &k.Fingerprint, &k.KeyIDLong, &k.ArmoredPublic, &k.PrimaryUID, &k.Algorithm, &k.Bits,
		&k.IsDefault, &k.IsActive, &k.ExpiresAt, &k.RevokedAt, &k.RevocationCertificate, &k.CreatedAt, &k.AvatarDataURL, &k.AvatarColor, &k.StatusBadgeEnabled,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &k, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// NormalizeIdentityAvatarColor returns a supported avatar color or a deterministic fallback for seed.
func NormalizeIdentityAvatarColor(color, seed string) string {
	color = strings.ToLower(strings.TrimSpace(color))
	for _, allowed := range identityAvatarColors {
		if color == allowed {
			return color
		}
	}
	seed = normalizeEmail(seed)
	if seed == "" {
		return "blue"
	}
	var sum int
	for i, b := range []byte(seed) {
		sum += int(b) * (i + 1)
	}
	return identityAvatarColors[sum%len(identityAvatarColors)]
}

func (s *Store) identityForExactEmail(ctx context.Context, email string) (*IdentityKey, error) {
	return scanIdentityKey(s.pool.QueryRow(ctx, identitySelectColumns+`
		FROM user_identity_keys ik
		WHERE ik.email = $1 AND ik.is_active = true
		ORDER BY ik.is_default DESC, ik.created_at DESC
		LIMIT 1`, email))
}

func (s *Store) identityForAliasEmail(ctx context.Context, email string) (*IdentityKey, error) {
	return scanIdentityKey(s.pool.QueryRow(ctx, identitySelectColumns+`
		FROM mail_aliases a
		JOIN user_identity_keys ik
			ON ik.user_id = a.user_id
			AND ik.fingerprint = a.identity_fingerprint
		WHERE a.email = $1
			AND a.is_active = true
			AND ik.is_active = true
		ORDER BY a.is_default DESC, ik.is_default DESC, ik.created_at DESC
		LIMIT 1`, email))
}

func (s *Store) identityForCatchall(ctx context.Context, domain string) (*IdentityKey, error) {
	return scanIdentityKey(s.pool.QueryRow(ctx, identitySelectColumns+`
		FROM mail_domains d
		JOIN user_identity_keys ik
			ON ik.user_id = d.owner_user_id
			AND ik.fingerprint = d.catchall_identity_fp
		WHERE d.domain = $1
			AND d.status = 'active'
			AND d.mx_verified = true
			AND d.catchall_identity_fp <> ''
			AND ik.is_active = true
		LIMIT 1`, domain))
}

// IdentityForEmail resolves the active local mailbox identity for a specific email.
// Resolution checks exact identities first, then active aliases, then verified
// custom-domain catch-all routing.
func (s *Store) IdentityForEmail(ctx context.Context, email string) (*IdentityKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	email = normalizeEmail(email)
	if email == "" {
		return nil, ErrNotFound
	}
	if k, err := s.identityForExactEmail(ctx, email); err == nil {
		return k, nil
	} else if !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	if k, err := s.identityForAliasEmail(ctx, email); err == nil {
		return k, nil
	} else if !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	_, domain, ok := strings.Cut(email, "@")
	if !ok || domain == "" {
		return nil, ErrNotFound
	}
	return s.identityForCatchall(ctx, domain)
}

// IdentityByID returns one identity row by its stable UUID handle.
func (s *Store) IdentityByID(ctx context.Context, userID, id uuid.UUID) (*IdentityKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	var k IdentityKey
	err := s.pool.QueryRow(ctx, `SELECT id, user_id, email, fingerprint, key_id_long, armored_public, primary_uid, algorithm, bits,
		is_default, is_active, expires_at, revoked_at, revocation_certificate, created_at, avatar_data_url, avatar_color, status_badge_enabled
		FROM user_identity_keys WHERE user_id = $1 AND id = $2`, userID, id).Scan(
		&k.ID, &k.UserID, &k.Email, &k.Fingerprint, &k.KeyIDLong, &k.ArmoredPublic, &k.PrimaryUID, &k.Algorithm, &k.Bits,
		&k.IsDefault, &k.IsActive, &k.ExpiresAt, &k.RevokedAt, &k.RevocationCertificate, &k.CreatedAt, &k.AvatarDataURL, &k.AvatarColor, &k.StatusBadgeEnabled,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &k, nil
}

// IdentityByFingerprint returns one identity row by fingerprint for a specific user.
func (s *Store) IdentityByFingerprint(ctx context.Context, userID uuid.UUID, fingerprint string) (*IdentityKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	fingerprint = strings.ToUpper(strings.TrimSpace(fingerprint))
	if fingerprint == "" {
		return nil, ErrNotFound
	}
	return scanIdentityKey(s.pool.QueryRow(ctx, identitySelectColumns+`
		FROM user_identity_keys ik
		WHERE ik.user_id = $1 AND ik.fingerprint = $2
		LIMIT 1`, userID, fingerprint))
}

// IdentityForUserEmail resolves one active identity owned by userID for email.
func (s *Store) IdentityForUserEmail(ctx context.Context, userID uuid.UUID, email string) (*IdentityKey, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	email = normalizeEmail(email)
	if email == "" {
		return nil, ErrNotFound
	}
	return scanIdentityKey(s.pool.QueryRow(ctx, identitySelectColumns+`
		FROM user_identity_keys ik
		WHERE ik.user_id = $1 AND ik.email = $2 AND ik.is_active = true
		ORDER BY ik.is_default DESC, ik.created_at DESC
		LIMIT 1`, userID, email))
}

// UpdateIdentityProfile stores avatar + status-badge settings for a single identity.
func (s *Store) UpdateIdentityProfile(ctx context.Context, userID uuid.UUID, fingerprint, avatarDataURL, avatarColor string, statusBadgeEnabled bool) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	fingerprint = strings.ToUpper(strings.TrimSpace(fingerprint))
	if fingerprint == "" {
		return ErrNotFound
	}
	avatarDataURL = strings.TrimSpace(avatarDataURL)
	avatarColor = NormalizeIdentityAvatarColor(avatarColor, "")
	current, err := s.IdentityByFingerprint(ctx, userID, fingerprint)
	if err != nil {
		return err
	}
	avatarColor = NormalizeIdentityAvatarColor(avatarColor, current.Email)
	tag, err := s.pool.Exec(ctx, `UPDATE user_identity_keys
		SET avatar_data_url = $1, avatar_color = $2, status_badge_enabled = $3
		WHERE user_id = $4 AND fingerprint = $5`,
		avatarDataURL, avatarColor, statusBadgeEnabled, userID, fingerprint,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetDefaultIdentity flags one identity as default for the user, clearing the flag on others.
func (s *Store) SetDefaultIdentity(ctx context.Context, userID uuid.UUID, fingerprint string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `UPDATE user_identity_keys SET is_default = false WHERE user_id = $1`, userID); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `UPDATE user_identity_keys SET is_default = true WHERE user_id = $1 AND fingerprint = $2`, userID, fingerprint)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

// RevokeIdentity stores a revocation certificate and marks the row inactive.
func (s *Store) RevokeIdentity(ctx context.Context, userID uuid.UUID, fingerprint, revocationCertificate string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE user_identity_keys SET is_active = false, revoked_at = now(), revocation_certificate = $1
		WHERE user_id = $2 AND fingerprint = $3`, revocationCertificate, userID, fingerprint)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteIdentity removes an identity and its wrapped secret.
func (s *Store) DeleteIdentity(ctx context.Context, userID uuid.UUID, fingerprint string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `DELETE FROM identity_secret_blobs WHERE user_id = $1 AND fingerprint = $2`, userID, fingerprint); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM user_identity_keys WHERE user_id = $1 AND fingerprint = $2`, userID, fingerprint)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

// identity, active alias, or another user's login email (case-insensitive).
func (s *Store) MailboxAddressGloballyTaken(ctx context.Context, ownerUserID uuid.UUID, email string) (bool, error) {
	if s == nil || s.pool == nil {
		return false, errors.New("mailmeta: nil")
	}
	em := normalizeEmail(email)
	if em == "" {
		return false, errors.New("mailmeta: empty email")
	}
	var one int
	err := s.pool.QueryRow(ctx, `SELECT 1 FROM user_identity_keys WHERE lower(email) = $1 AND is_active = true LIMIT 1`, em).Scan(&one)
	if err == nil {
		return true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return false, err
	}
	err = s.pool.QueryRow(ctx, `SELECT 1 FROM mail_aliases WHERE lower(email) = $1 AND is_active = true LIMIT 1`, em).Scan(&one)
	if err == nil {
		return true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return false, err
	}
	err = s.pool.QueryRow(ctx, `SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2 LIMIT 1`, em, ownerUserID).Scan(&one)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return false, err
}

// CountActiveIdentities returns active identity rows for a user.
func (s *Store) CountActiveIdentities(ctx context.Context, userID uuid.UUID) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("mailmeta: nil")
	}
	var n int64
	err := s.pool.QueryRow(ctx, `SELECT count(*)::bigint FROM user_identity_keys WHERE user_id = $1 AND is_active = true`, userID).Scan(&n)
	return n, err
}

// CountOwnedMailDomains returns mail_domains rows owned by the user.
func (s *Store) CountOwnedMailDomains(ctx context.Context, userID uuid.UUID) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("mailmeta: nil")
	}
	var n int64
	err := s.pool.QueryRow(ctx, `SELECT count(*)::bigint FROM mail_domains WHERE owner_user_id = $1`, userID).Scan(&n)
	return n, err
}

// CountDomainAllowlistMemberships returns how many shared domains list this user.
func (s *Store) CountDomainAllowlistMemberships(ctx context.Context, userID uuid.UUID) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("mailmeta: nil")
	}
	var n int64
	err := s.pool.QueryRow(ctx, `SELECT count(*)::bigint FROM mail_domain_allowlist WHERE user_id = $1`, userID).Scan(&n)
	return n, err
}
