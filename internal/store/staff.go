package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"elvish/internal/models"
)

const staffDisabledSentinel = "$disabled$"

// CreateStaffUser inserts a new Console staff account.
func (s *Store) CreateStaffUser(ctx context.Context, email, name, passwordHash string, role models.StaffRole) (*models.StaffUser, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || passwordHash == "" {
		return nil, errors.New("store: invalid staff user")
	}
	if role == "" {
		role = models.StaffRoleOperator
	}
	const q = `INSERT INTO staff_users (email, name, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $5)
		RETURNING id, email, name, password_hash, role, disabled_at, created_at, updated_at`
	now := time.Now().UTC()
	var u models.StaffUser
	var roleStr string
	err := s.pool.QueryRow(ctx, q, email, strings.TrimSpace(name), passwordHash, string(role), now).Scan(
		&u.ID, &u.Email, &u.Name, &u.PasswordHash, &roleStr, &u.DisabledAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	u.Role = models.StaffRole(roleStr)
	return &u, nil
}

func scanStaffUser(row pgx.Row) (*models.StaffUser, error) {
	var u models.StaffUser
	var roleStr string
	err := row.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &roleStr, &u.DisabledAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	u.Role = models.StaffRole(roleStr)
	return &u, nil
}

// StaffByEmail returns a staff user by email.
func (s *Store) StaffByEmail(ctx context.Context, email string) (*models.StaffUser, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	email = strings.TrimSpace(strings.ToLower(email))
	const q = `SELECT id, email, name, password_hash, role, disabled_at, created_at, updated_at
		FROM staff_users WHERE lower(email) = $1`
	u, err := scanStaffUser(s.pool.QueryRow(ctx, q, email))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return u, err
}

// StaffByID returns a staff user by id.
func (s *Store) StaffByID(ctx context.Context, id uuid.UUID) (*models.StaffUser, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, email, name, password_hash, role, disabled_at, created_at, updated_at
		FROM staff_users WHERE id = $1`
	u, err := scanStaffUser(s.pool.QueryRow(ctx, q, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return u, err
}

// CountStaffUsers returns the number of staff accounts.
func (s *Store) CountStaffUsers(ctx context.Context) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("store: nil")
	}
	var n int64
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM staff_users`).Scan(&n)
	return n, err
}

// ListStaffUsers returns paginated staff accounts.
func (s *Store) ListStaffUsers(ctx context.Context, offset, limit int, query string) ([]models.StaffUser, int64, error) {
	if s == nil || s.pool == nil {
		return nil, 0, errors.New("store: nil")
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	query = strings.TrimSpace(strings.ToLower(query))
	var total int64
	var rows pgx.Rows
	var err error
	if query != "" {
		pattern := "%" + query + "%"
		err = s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM staff_users WHERE lower(email) LIKE $1 OR lower(name) LIKE $1`, pattern).Scan(&total)
		if err != nil {
			return nil, 0, err
		}
		rows, err = s.pool.Query(ctx, `SELECT id, email, name, password_hash, role, disabled_at, created_at, updated_at
			FROM staff_users WHERE lower(email) LIKE $1 OR lower(name) LIKE $1
			ORDER BY created_at DESC OFFSET $2 LIMIT $3`, pattern, offset, limit)
	} else {
		err = s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM staff_users`).Scan(&total)
		if err != nil {
			return nil, 0, err
		}
		rows, err = s.pool.Query(ctx, `SELECT id, email, name, password_hash, role, disabled_at, created_at, updated_at
			FROM staff_users ORDER BY created_at DESC OFFSET $1 LIMIT $2`, offset, limit)
	}
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []models.StaffUser
	for rows.Next() {
		u, err := scanStaffUser(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *u)
	}
	return out, total, rows.Err()
}

// DisableStaffUser marks a staff account disabled.
func (s *Store) DisableStaffUser(ctx context.Context, id uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	now := time.Now().UTC()
	tag, err := s.pool.Exec(ctx, `UPDATE staff_users SET password_hash = $1, disabled_at = $2, updated_at = $2 WHERE id = $3`,
		staffDisabledSentinel, now, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// UpdateStaffUserRole changes a staff member's role.
func (s *Store) UpdateStaffUserRole(ctx context.Context, id uuid.UUID, role models.StaffRole) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE staff_users SET role = $1, updated_at = $2 WHERE id = $3`, string(role), time.Now().UTC(), id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteStaffUser removes a staff account.
func (s *Store) DeleteStaffUser(ctx context.Context, id uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM staff_users WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// InsertStaffAuditLog appends a staff audit entry.
func (s *Store) InsertStaffAuditLog(ctx context.Context, actorID *uuid.UUID, action, targetType, targetID string, metadata map[string]any) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	meta := metadata
	if meta == nil {
		meta = map[string]any{}
	}
	raw, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO staff_audit_log (actor_staff_id, action, target_type, target_id, metadata_json, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		actorID, action, targetType, targetID, raw, time.Now().UTC())
	return err
}

// GetSupportMailboxConfig returns the singleton support mailbox config.
func (s *Store) GetSupportMailboxConfig(ctx context.Context) (*models.SupportMailboxConfig, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, platform_user_id, primary_address, status, updated_at FROM support_mailbox_config WHERE id = 'default'`
	var c models.SupportMailboxConfig
	err := s.pool.QueryRow(ctx, q).Scan(&c.ID, &c.PlatformUserID, &c.PrimaryAddress, &c.Status, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &c, err
}

// UpsertSupportMailboxConfig saves support mailbox configuration.
func (s *Store) UpsertSupportMailboxConfig(ctx context.Context, platformUserID uuid.UUID, primaryAddress, status string) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `INSERT INTO support_mailbox_config (id, platform_user_id, primary_address, status, updated_at)
		VALUES ('default', $1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE SET platform_user_id = $1, primary_address = $2, status = $3, updated_at = $4`,
		platformUserID, primaryAddress, status, now)
	return err
}

// GetSupportKeyVault returns escrowed keys for a platform user.
func (s *Store) GetSupportKeyVault(ctx context.Context, platformUserID uuid.UUID) (*models.SupportKeyVault, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT platform_user_id, encrypted_account_key, encrypted_identity_keys_json, vault_key_id, rotated_at, updated_at
		FROM support_key_vault WHERE platform_user_id = $1`
	var v models.SupportKeyVault
	err := s.pool.QueryRow(ctx, q, platformUserID).Scan(
		&v.PlatformUserID, &v.EncryptedAccountKey, &v.EncryptedIdentityKeysJSON, &v.VaultKeyID, &v.RotatedAt, &v.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &v, err
}

// UpsertSupportKeyVault stores escrowed support keys.
func (s *Store) UpsertSupportKeyVault(ctx context.Context, platformUserID uuid.UUID, encAccountKey, encIdentityKeysJSON []byte, vaultKeyID string) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	now := time.Now().UTC()
	_, err := s.pool.Exec(ctx, `INSERT INTO support_key_vault (platform_user_id, encrypted_account_key, encrypted_identity_keys_json, vault_key_id, rotated_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $5)
		ON CONFLICT (platform_user_id) DO UPDATE SET
			encrypted_account_key = $2, encrypted_identity_keys_json = $3, vault_key_id = $4, rotated_at = $5, updated_at = $5`,
		platformUserID, encAccountKey, encIdentityKeysJSON, vaultKeyID, now)
	return err
}
