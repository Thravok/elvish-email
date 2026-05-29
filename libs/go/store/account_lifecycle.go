package store

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"elvish/libs/go/models"
)

const (
	InactivityDeleteUnitDays   = "days"
	InactivityDeleteUnitWeeks  = "weeks"
	InactivityDeleteUnitMonths = "months"

	deletedAddressReservationKeyEnv = "ELVISH_ADDRESS_RESERVATION_KEY"
)

var (
	deletedAddressKeyOnce sync.Once
	deletedAddressKey     []byte
)

const userLifecycleColumns = `id, email, name, password_hash, auth_method, srp_salt, srp_verifier, srp_group, srp_hash,
	is_admin, last_activity_at, scheduled_delete_at, scheduled_delete_reason, inactivity_delete_value, inactivity_delete_unit, created_at, ui_theme`

// DeletedAddressReservation is one irreversible address tombstone kept after account purge.
type DeletedAddressReservation struct {
	Address     string
	AddressKind string
	ReservedAt  time.Time
	ExpiresAt   time.Time
}

func deletedAddressReservationKey() []byte {
	deletedAddressKeyOnce.Do(func() {
		if raw := strings.TrimSpace(os.Getenv(deletedAddressReservationKeyEnv)); raw != "" {
			deletedAddressKey = []byte(raw)
		}
	})
	return deletedAddressKey
}

func normalizeReservedAddress(address string) string {
	return strings.ToLower(strings.TrimSpace(address))
}

func hashReservedAddress(address string) string {
	address = normalizeReservedAddress(address)
	if address == "" {
		return ""
	}
	if key := deletedAddressReservationKey(); len(key) > 0 {
		mac := hmac.New(sha256.New, key)
		_, _ = mac.Write([]byte(address))
		return hex.EncodeToString(mac.Sum(nil))
	}
	sum := sha256.Sum256([]byte(address))
	return hex.EncodeToString(sum[:])
}

func normalizeInactivityDeleteUnit(unit string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case "":
		return "", nil
	case InactivityDeleteUnitDays:
		return InactivityDeleteUnitDays, nil
	case InactivityDeleteUnitWeeks:
		return InactivityDeleteUnitWeeks, nil
	case InactivityDeleteUnitMonths:
		return InactivityDeleteUnitMonths, nil
	default:
		return "", errors.New("store: invalid inactivity delete unit")
	}
}

func normalizeActivityDay(at time.Time) time.Time {
	if at.IsZero() {
		at = time.Now().UTC()
	}
	y, m, d := at.UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func scanLifecycleUser(scanner interface{ Scan(...any) error }) (*models.User, error) {
	var u models.User
	err := scanner.Scan(
		&u.ID,
		&u.Email,
		&u.Name,
		&u.PasswordHash,
		&u.AuthMethod,
		&u.SRPSalt,
		&u.SRPVerifier,
		&u.SRPGroup,
		&u.SRPHash,
		&u.IsAdmin,
		&u.LastActivityAt,
		&u.ScheduledDeleteAt,
		&u.ScheduledDeleteReason,
		&u.InactivityDeleteValue,
		&u.InactivityDeleteUnit,
		&u.CreatedAt,
		&u.UITheme,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// UserLifecycleByID loads a user row including deletion/activity lifecycle fields.
func (s *Store) UserLifecycleByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	return scanLifecycleUser(s.pool.QueryRow(ctx, `SELECT `+userLifecycleColumns+` FROM users WHERE id = $1`, userID))
}

// UpdateUserLastActivity stores the latest authenticated activity day.
func (s *Store) UpdateUserLastActivity(ctx context.Context, userID uuid.UUID, at time.Time) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	at = normalizeActivityDay(at)
	tag, err := s.pool.Exec(ctx, `UPDATE users SET last_activity_at = $2 WHERE id = $1`, userID, at.UTC())
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ScheduleUserDeletion marks an account for deletion at a future time.
func (s *Store) ScheduleUserDeletion(ctx context.Context, userID uuid.UUID, deleteAt time.Time, reason string) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if deleteAt.IsZero() {
		return errors.New("store: deleteAt required")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE users
		SET scheduled_delete_at = $2, scheduled_delete_reason = $3
		WHERE id = $1`, userID, deleteAt.UTC(), strings.TrimSpace(reason))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// CancelUserDeletion clears any pending scheduled delete.
func (s *Store) CancelUserDeletion(ctx context.Context, userID uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE users
		SET scheduled_delete_at = NULL, scheduled_delete_reason = ''
		WHERE id = $1`, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetUserInactivityDeletion stores the per-user inactivity auto-delete policy.
func (s *Store) SetUserInactivityDeletion(ctx context.Context, userID uuid.UUID, value int, unit string) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if value < 0 {
		return errors.New("store: invalid inactivity delete value")
	}
	unit, err := normalizeInactivityDeleteUnit(unit)
	if err != nil {
		return err
	}
	if value == 0 || unit == "" {
		value = 0
		unit = ""
	}
	tag, err := s.pool.Exec(ctx, `UPDATE users
		SET inactivity_delete_value = $2, inactivity_delete_unit = $3
		WHERE id = $1`, userID, value, unit)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListUsersDueForScheduledDeletion returns users whose scheduled delete time has passed.
func (s *Store) ListUsersDueForScheduledDeletion(ctx context.Context, now time.Time, limit int) ([]models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `SELECT `+userLifecycleColumns+`
		FROM users
		WHERE scheduled_delete_at IS NOT NULL AND scheduled_delete_at <= $1
		ORDER BY scheduled_delete_at ASC
		LIMIT $2`, now.UTC(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.User
	for rows.Next() {
		u, err := scanLifecycleUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *u)
	}
	return out, rows.Err()
}

// ListUsersDueForInactivityDeletion returns users whose inactivity window has elapsed.
func (s *Store) ListUsersDueForInactivityDeletion(ctx context.Context, now time.Time, limit int) ([]models.User, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	now = normalizeActivityDay(now)
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `SELECT `+userLifecycleColumns+`
		FROM users
		WHERE inactivity_delete_value > 0
		  AND inactivity_delete_unit <> ''
		ORDER BY last_activity_at ASC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.User
	for rows.Next() {
		u, err := scanLifecycleUser(rows)
		if err != nil {
			return nil, err
		}
		deadline, ok := inactivityDeleteDeadline(u.LastActivityAt, u.InactivityDeleteValue, u.InactivityDeleteUnit)
		if ok && !deadline.After(now.UTC()) {
			out = append(out, *u)
		}
	}
	return out, rows.Err()
}

func inactivityDeleteDeadline(lastActivity time.Time, value int, unit string) (time.Time, bool) {
	if value <= 0 {
		return time.Time{}, false
	}
	lastActivity = normalizeActivityDay(lastActivity)
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case InactivityDeleteUnitDays:
		return lastActivity.AddDate(0, 0, value), true
	case InactivityDeleteUnitWeeks:
		return lastActivity.AddDate(0, 0, value*7), true
	case InactivityDeleteUnitMonths:
		return lastActivity.AddDate(0, value, 0), true
	default:
		return time.Time{}, false
	}
}

// ListUserOwnedAddresses returns every email address currently tied to the account.
func (s *Store) ListUserOwnedAddresses(ctx context.Context, userID uuid.UUID) ([]DeletedAddressReservation, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT address, address_kind FROM (
			SELECT email AS address, 'primary' AS address_kind FROM users WHERE id = $1
			UNION ALL
			SELECT email AS address, 'identity' AS address_kind FROM user_identity_keys WHERE user_id = $1
			UNION ALL
			SELECT email AS address, 'alias' AS address_kind FROM mail_aliases WHERE user_id = $1
		) owned
		WHERE address <> ''`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seen := make(map[string]DeletedAddressReservation)
	for rows.Next() {
		var address string
		var kind string
		if err := rows.Scan(&address, &kind); err != nil {
			return nil, err
		}
		address = normalizeReservedAddress(address)
		if address == "" {
			continue
		}
		if _, ok := seen[address]; ok {
			continue
		}
		seen[address] = DeletedAddressReservation{Address: address, AddressKind: kind}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]DeletedAddressReservation, 0, len(seen))
	for _, reservation := range seen {
		out = append(out, reservation)
	}
	return out, nil
}

// ListUserOwnedDomains returns every custom domain currently tied to the account.
func (s *Store) ListUserOwnedDomains(ctx context.Context, userID uuid.UUID) ([]DeletedAddressReservation, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT domain FROM mail_domains WHERE owner_user_id = $1 AND domain <> ''`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]DeletedAddressReservation, 0)
	for rows.Next() {
		var domain string
		if err := rows.Scan(&domain); err != nil {
			return nil, err
		}
		domain = normalizeReservedAddress(domain)
		if domain == "" {
			continue
		}
		out = append(out, DeletedAddressReservation{Address: domain, AddressKind: "custom_domain"})
	}
	return out, rows.Err()
}

// ReserveDeletedAddresses writes 2-year tombstones for the provided addresses.
func (s *Store) ReserveDeletedAddresses(ctx context.Context, reservations []DeletedAddressReservation) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if len(reservations) == 0 {
		return nil
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	now := time.Now().UTC()
	for _, reservation := range reservations {
		addressHash := hashReservedAddress(reservation.Address)
		if addressHash == "" {
			continue
		}
		reservedAt := reservation.ReservedAt
		if reservedAt.IsZero() {
			reservedAt = now
		}
		expiresAt := reservation.ExpiresAt
		if expiresAt.IsZero() {
			expiresAt = reservedAt.AddDate(2, 0, 0)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO deleted_address_reservations (address_hash, address_kind, reserved_at, expires_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (address_hash) DO UPDATE
			SET address_kind = EXCLUDED.address_kind,
			    reserved_at = EXCLUDED.reserved_at,
			    expires_at = EXCLUDED.expires_at`,
			addressHash, strings.TrimSpace(reservation.AddressKind), reservedAt.UTC(), expiresAt.UTC(),
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// IsDeletedAddressReserved reports whether the normalized address is still tombstoned.
func (s *Store) IsDeletedAddressReserved(ctx context.Context, address string) (bool, error) {
	if s == nil || s.pool == nil {
		return false, errors.New("store: nil")
	}
	addressHash := hashReservedAddress(address)
	if addressHash == "" {
		return false, nil
	}
	var ok bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(
		SELECT 1 FROM deleted_address_reservations
		WHERE address_hash = $1 AND expires_at > now()
	)`, addressHash).Scan(&ok); err != nil {
		return false, err
	}
	return ok, nil
}

// IsDeletedDomainReserved reports whether a deleted custom-domain namespace is still held back.
func (s *Store) IsDeletedDomainReserved(ctx context.Context, domain string) (bool, error) {
	return s.IsDeletedAddressReserved(ctx, domain)
}

// DeleteExpiredDeletedAddressReservations prunes tombstones whose hold window has elapsed.
func (s *Store) DeleteExpiredDeletedAddressReservations(ctx context.Context, now time.Time) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("store: nil")
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM deleted_address_reservations WHERE expires_at <= $1`, now.UTC())
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
