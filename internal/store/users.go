package store

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"elvish/internal/models"
)

const disabledPasswordSentinel = "$disabled$"
const srpPasswordSentinel = "$srp$"

// DisabledPasswordHash returns the sentinel hash used to disable user logins.
func DisabledPasswordHash() string {
	return disabledPasswordSentinel
}

// SRPPasswordHash is the password_hash placeholder for SRP-authenticated accounts.
func SRPPasswordHash() string {
	return srpPasswordSentinel
}

// IsDisabledPasswordHash reports whether passwordHash is the disabled-user sentinel.
func IsDisabledPasswordHash(passwordHash string) bool {
	return strings.TrimSpace(passwordHash) == disabledPasswordSentinel
}

// IsDisabledUser reports whether u is marked disabled.
func IsDisabledUser(u *models.User) bool {
	return u != nil && IsDisabledPasswordHash(u.PasswordHash)
}

// AuthMethodStats summarizes browser-auth posture across the user table.
type AuthMethodStats struct {
	TotalUsers      int64
	SRPUsers        int64
	LegacyUsers     int64
	DisabledUsers   int64
	BcryptUsers     int64
	UnknownAuthMode int64
}

// CreateUser inserts a new user (email normalized lowercase).
func (s *Store) CreateUser(ctx context.Context, email, name, passwordHash string, isAdmin bool) (*models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || passwordHash == "" {
		return nil, errors.New("store: invalid user")
	}
	const q = `INSERT INTO users (email, name, password_hash, is_admin, created_at, ui_theme)
		VALUES ($1, $2, $3, $4, $5, 'auto') RETURNING id, email, name, password_hash, is_admin, created_at, ui_theme`
	var u models.User
	err := s.pool.QueryRow(ctx, q, email, strings.TrimSpace(name), passwordHash, isAdmin, time.Now().UTC()).Scan(
		&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.IsAdmin, &u.CreatedAt, &u.UITheme,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// CreateUserWithSRP inserts a new user whose browser auth uses SRP verifier data.
func (s *Store) CreateUserWithSRP(ctx context.Context, email, name string, srpSalt, srpVerifier []byte, srpGroup, srpHash string, isAdmin bool, uiTheme string) (*models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || len(srpSalt) == 0 || len(srpVerifier) == 0 {
		return nil, errors.New("store: invalid user")
	}
	const q = `INSERT INTO users (email, name, password_hash, auth_method, srp_salt, srp_verifier, srp_group, srp_hash, is_admin, created_at, ui_theme)
		VALUES ($1, $2, $3, 'srp', $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, email, name, password_hash, auth_method, srp_salt, srp_verifier, srp_group, srp_hash, is_admin, created_at, ui_theme`
	var u models.User
	err := s.pool.QueryRow(ctx, q,
		email, strings.TrimSpace(name), srpPasswordSentinel, srpSalt, srpVerifier, strings.TrimSpace(srpGroup), strings.TrimSpace(srpHash), isAdmin, time.Now().UTC(), uiTheme,
	).Scan(
		&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.AuthMethod, &u.SRPSalt, &u.SRPVerifier, &u.SRPGroup, &u.SRPHash, &u.IsAdmin, &u.CreatedAt, &u.UITheme,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// UserByEmail returns a user by email (case-insensitive via stored lowercase).
func (s *Store) UserByEmail(ctx context.Context, email string) (*models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	email = strings.TrimSpace(strings.ToLower(email))
	const q = `SELECT id, email, name, password_hash, is_admin, created_at, ui_theme FROM users WHERE email = $1`
	var u models.User
	err := s.pool.QueryRow(ctx, q, email).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.IsAdmin, &u.CreatedAt, &u.UITheme)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// UserAuthByEmail returns a user plus browser-auth fields.
func (s *Store) UserAuthByEmail(ctx context.Context, email string) (*models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	email = strings.TrimSpace(strings.ToLower(email))
	const q = `SELECT id, email, name, password_hash, auth_method, srp_salt, srp_verifier, srp_group, srp_hash, is_admin, created_at, ui_theme
		FROM users WHERE email = $1`
	var u models.User
	err := s.pool.QueryRow(ctx, q, email).Scan(
		&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.AuthMethod, &u.SRPSalt, &u.SRPVerifier, &u.SRPGroup, &u.SRPHash, &u.IsAdmin, &u.CreatedAt, &u.UITheme,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// UserByID loads a user by UUID.
func (s *Store) UserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, email, name, password_hash, is_admin, created_at, ui_theme FROM users WHERE id = $1`
	var u models.User
	err := s.pool.QueryRow(ctx, q, id).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.IsAdmin, &u.CreatedAt, &u.UITheme)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// UserAuthByID returns a user plus browser-auth fields.
func (s *Store) UserAuthByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, email, name, password_hash, auth_method, srp_salt, srp_verifier, srp_group, srp_hash, is_admin, created_at, ui_theme
		FROM users WHERE id = $1`
	var u models.User
	err := s.pool.QueryRow(ctx, q, id).Scan(
		&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.AuthMethod, &u.SRPSalt, &u.SRPVerifier, &u.SRPGroup, &u.SRPHash, &u.IsAdmin, &u.CreatedAt, &u.UITheme,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// CountUsers returns how many user documents exist (for bootstrap / policy).
func (s *Store) CountUsers(ctx context.Context) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("store: nil")
	}
	var n int64
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&n)
	return n, err
}

// AuthMethodSummary returns aggregate counts for SRP, legacy bcrypt, and disabled users.
func (s *Store) AuthMethodSummary(ctx context.Context) (AuthMethodStats, error) {
	if s == nil || s.pool == nil {
		return AuthMethodStats{}, errors.New("store: nil")
	}
	var out AuthMethodStats
	err := s.pool.QueryRow(ctx, `SELECT
		count(*) AS total_users,
		sum(CASE WHEN auth_method = 'srp' THEN 1 ELSE 0 END) AS srp_users,
		sum(CASE WHEN password_hash = $1 THEN 1 ELSE 0 END) AS disabled_users,
		sum(CASE WHEN auth_method = 'bcrypt' AND password_hash <> $1 THEN 1 ELSE 0 END) AS bcrypt_users,
		sum(CASE WHEN auth_method <> 'srp' AND auth_method <> 'bcrypt' AND password_hash <> $1 THEN 1 ELSE 0 END) AS unknown_auth_mode
		FROM users`, disabledPasswordSentinel).Scan(
		&out.TotalUsers, &out.SRPUsers, &out.DisabledUsers, &out.BcryptUsers, &out.UnknownAuthMode,
	)
	if err != nil {
		return AuthMethodStats{}, err
	}
	out.LegacyUsers = out.BcryptUsers + out.UnknownAuthMode
	return out, nil
}

// Pool exposes the underlying pool for mailstore and other packages (optional).
func (s *Store) Pool() *pgxpool.Pool {
	if s == nil {
		return nil
	}
	return s.pool
}

// UpdateUserPasswordHash replaces the bcrypt hash for a user (login password change).
func (s *Store) UpdateUserPasswordHash(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if passwordHash == "" {
		return errors.New("store: invalid hash")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, userID, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// UpdateUserSRP replaces a user's browser-auth verifier with fresh SRP material.
func (s *Store) UpdateUserSRP(ctx context.Context, userID uuid.UUID, srpSalt, srpVerifier []byte, srpGroup, srpHash string) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if len(srpSalt) == 0 || len(srpVerifier) == 0 {
		return errors.New("store: invalid srp data")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE users
		SET auth_method = 'srp', password_hash = $2, srp_salt = $3, srp_verifier = $4, srp_group = $5, srp_hash = $6
		WHERE id = $1`,
		userID, srpPasswordSentinel, srpSalt, srpVerifier, strings.TrimSpace(srpGroup), strings.TrimSpace(srpHash),
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteUser removes the user row (CASCADE deletes dependent PostgreSQL mail rows).
func (s *Store) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AdminUserListFilter narrows operator directory queries.
type AdminUserListFilter struct {
	Query  string // email or name substring (ILIKE)
	Status string // "", "all", "active", "disabled"
	Admin  *bool  // nil = any
}

// CountAdminUsers returns users with is_admin=true.
func (s *Store) CountAdminUsers(ctx context.Context) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("store: nil")
	}
	var n int64
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE is_admin = true`).Scan(&n)
	return n, err
}

// UpdateUserIsAdmin sets or clears operator privileges.
func (s *Store) UpdateUserIsAdmin(ctx context.Context, userID uuid.UUID, isAdmin bool) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE users SET is_admin = $2 WHERE id = $1`, userID, isAdmin)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListUsers returns a paginated list of users, optionally filtered by email substring.
func (s *Store) ListUsers(ctx context.Context, offset, limit int, query string) ([]models.User, int64, error) {
	return s.ListUsersAdmin(ctx, offset, limit, AdminUserListFilter{Query: query, Status: "all"})
}

// ListUsersAdmin returns users for the operator directory with optional filters.
func (s *Store) ListUsersAdmin(ctx context.Context, offset, limit int, f AdminUserListFilter) ([]models.User, int64, error) {
	if s == nil || s.pool == nil {
		return nil, 0, errors.New("store: nil")
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	where := []string{"1=1"}
	args := make([]any, 0, 4)
	if q := strings.TrimSpace(f.Query); q != "" {
		pattern := "%" + q + "%"
		args = append(args, pattern)
		where = append(where, "email ILIKE $"+strconv.Itoa(len(args))+" OR name ILIKE $"+strconv.Itoa(len(args)))
	}
	switch strings.ToLower(strings.TrimSpace(f.Status)) {
	case "", "all":
		// no filter
	case "active":
		args = append(args, disabledPasswordSentinel)
		where = append(where, "password_hash <> $"+strconv.Itoa(len(args)))
	case "disabled":
		args = append(args, disabledPasswordSentinel)
		where = append(where, "password_hash = $"+strconv.Itoa(len(args)))
	default:
		return nil, 0, errors.New("store: invalid status filter")
	}
	if f.Admin != nil {
		args = append(args, *f.Admin)
		where = append(where, "is_admin = $"+strconv.Itoa(len(args)))
	}
	whereSQL := strings.Join(where, " AND ")

	var total int64
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE `+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listArgs := append(append([]any{}, args...), limit, offset)
	limitArg := len(args) + 1
	offsetArg := len(args) + 2
	rows, err := s.pool.Query(ctx,
		`SELECT id, email, name, password_hash, auth_method, is_admin, created_at, ui_theme
		 FROM users WHERE `+whereSQL+` ORDER BY created_at DESC LIMIT $`+strconv.Itoa(limitArg)+` OFFSET $`+strconv.Itoa(offsetArg),
		listArgs...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.AuthMethod, &u.IsAdmin, &u.CreatedAt, &u.UITheme); err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}
	return users, total, rows.Err()
}

// UsersByIDs returns users for the provided UUIDs.
func (s *Store) UsersByIDs(ctx context.Context, ids []uuid.UUID) ([]models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	if len(ids) == 0 {
		return []models.User{}, nil
	}
	rows, err := s.pool.Query(ctx, `SELECT id, email, name, password_hash, is_admin, created_at, ui_theme
		FROM users WHERE id = ANY($1::uuid[]) ORDER BY created_at DESC`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.User, 0, len(ids))
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.IsAdmin, &u.CreatedAt, &u.UITheme); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// ListActiveUsers returns users that are not disabled.
func (s *Store) ListActiveUsers(ctx context.Context, limit int) ([]models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	query := `SELECT id, email, name, password_hash, is_admin, created_at, ui_theme
		FROM users WHERE password_hash <> $1 ORDER BY created_at DESC`
	var rows pgx.Rows
	var err error
	if limit > 0 {
		rows, err = s.pool.Query(ctx, query+` LIMIT $2`, disabledPasswordSentinel, limit)
	} else {
		rows, err = s.pool.Query(ctx, query, disabledPasswordSentinel)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.IsAdmin, &u.CreatedAt, &u.UITheme); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// UpdateUserUITheme sets appearance preference (auto, dark, light).
func (s *Store) UpdateUserUITheme(ctx context.Context, userID uuid.UUID, uiTheme string) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE users SET ui_theme = $2 WHERE id = $1`, userID, uiTheme)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
