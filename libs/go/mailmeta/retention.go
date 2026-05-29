package mailmeta

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// FolderRetention stores one folder retention override for a user.
type FolderRetention struct {
	UserID        uuid.UUID
	Folder        string
	RetentionDays *int
	UpdatedAt     time.Time
}

// MessageLifecycle tracks the current folder and folder-entry timestamp for one message.
type MessageLifecycle struct {
	UserID          uuid.UUID
	MessageID       uuid.UUID
	CurrentFolder   string
	FolderEnteredAt time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
	ExpiresAt       *time.Time
	MaxReads        int64
	Reads           int64
	BurnedAt        *time.Time
}

// ExpiredMessage is one lifecycle row selected by the retention sweeper.
type ExpiredMessage struct {
	UserID          uuid.UUID
	MessageID       uuid.UUID
	CurrentFolder   string
	FolderEnteredAt time.Time
	RetentionDays   int
}

// DefaultFolderRetention returns the secure default retention map for standard folders.
func DefaultFolderRetention() map[string]*int {
	return map[string]*int{
		FolderInbox:   nil,
		FolderSent:    intPtr(30),
		FolderTrash:   intPtr(30),
		FolderArchive: nil,
	}
}

// EnsureDefaultFolderRetention inserts missing standard-folder retention rows for a user.
func (s *Store) EnsureDefaultFolderRetention(ctx context.Context, userID uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	defaults := DefaultFolderRetention()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	for _, folder := range []string{FolderInbox, FolderSent, FolderTrash, FolderArchive} {
		days := defaults[folder]
		if _, err := tx.Exec(ctx, `INSERT INTO mail_folder_retention (user_id, folder, retention_days, updated_at)
			VALUES ($1, $2, $3, now())
			ON CONFLICT (user_id, folder) DO NOTHING`, userID, folder, days); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// GetFolderRetention returns the user's folder retention map with defaults applied.
func (s *Store) GetFolderRetention(ctx context.Context, userID uuid.UUID) (map[string]*int, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	if err := s.EnsureDefaultFolderRetention(ctx, userID); err != nil {
		return nil, err
	}
	out := cloneRetentionMap(DefaultFolderRetention())
	rows, err := s.pool.Query(ctx, `SELECT folder, retention_days FROM mail_folder_retention WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var folder string
		var retentionDays sql.NullInt32
		if err := rows.Scan(&folder, &retentionDays); err != nil {
			return nil, err
		}
		folder = normalizeFolderName(folder)
		if folder == "" {
			continue
		}
		if retentionDays.Valid {
			out[folder] = intPtr(int(retentionDays.Int32))
		} else {
			out[folder] = nil
		}
	}
	return out, rows.Err()
}

// SetFolderRetention upserts folder retention values for a user.
func (s *Store) SetFolderRetention(ctx context.Context, userID uuid.UUID, retention map[string]*int) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	for folder, days := range retention {
		name := normalizeFolderName(folder)
		if name == "" {
			return errors.New("mailmeta: invalid folder name")
		}
		if days != nil && *days <= 0 {
			return errors.New("mailmeta: retention must be positive")
		}
		if _, err := tx.Exec(ctx, `INSERT INTO mail_folder_retention (user_id, folder, retention_days, updated_at)
			VALUES ($1, $2, $3, now())
			ON CONFLICT (user_id, folder) DO UPDATE SET retention_days = $3, updated_at = now()`, userID, name, days); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// UpsertMessageLifecycle records the current folder entry timestamp for a message.
func (s *Store) UpsertMessageLifecycle(ctx context.Context, lc MessageLifecycle) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	if lc.UserID == uuid.Nil || lc.MessageID == uuid.Nil {
		return errors.New("mailmeta: lifecycle ids required")
	}
	if lc.FolderEnteredAt.IsZero() {
		lc.FolderEnteredAt = time.Now().UTC()
	}
	lc.CurrentFolder = normalizeFolderName(lc.CurrentFolder)
	if lc.CurrentFolder == "" {
		return errors.New("mailmeta: lifecycle folder required")
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO mail_message_lifecycle
		(user_id, message_id, current_folder, folder_entered_at, created_at, updated_at, expires_at, max_reads, reads)
		VALUES ($1, $2, $3, $4, now(), now(), $5, $6, 0)
		ON CONFLICT (user_id, message_id) DO UPDATE
		SET current_folder = $3, folder_entered_at = $4, updated_at = now()`,
		lc.UserID, lc.MessageID, lc.CurrentFolder, lc.FolderEnteredAt, lc.ExpiresAt, lc.MaxReads,
	)
	return err
}

// GetMessageLifecycle returns the lifecycle row for one message.
func (s *Store) GetMessageLifecycle(ctx context.Context, userID, messageID uuid.UUID) (*MessageLifecycle, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	var lc MessageLifecycle
	err := s.pool.QueryRow(ctx, `SELECT user_id, message_id, current_folder, folder_entered_at, created_at, updated_at,
		expires_at, max_reads, reads, burned_at
		FROM mail_message_lifecycle WHERE user_id = $1 AND message_id = $2`, userID, messageID).Scan(
		&lc.UserID, &lc.MessageID, &lc.CurrentFolder, &lc.FolderEnteredAt, &lc.CreatedAt, &lc.UpdatedAt,
		&lc.ExpiresAt, &lc.MaxReads, &lc.Reads, &lc.BurnedAt,
	)
	if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &lc, nil
}

// DeleteMessageLifecycle removes one lifecycle row.
func (s *Store) DeleteMessageLifecycle(ctx context.Context, userID, messageID uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM mail_message_lifecycle WHERE user_id = $1 AND message_id = $2`, userID, messageID)
	return err
}

// ListExpiredMessages returns lifecycle rows that have exceeded their folder retention policy.
func (s *Store) ListExpiredMessages(ctx context.Context, limit int) ([]ExpiredMessage, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `SELECT l.user_id, l.message_id, l.current_folder, l.folder_entered_at,
		COALESCE(r.retention_days, 0)
		FROM mail_message_lifecycle l
		LEFT JOIN mail_folder_retention r ON r.user_id = l.user_id AND r.folder = l.current_folder
		WHERE (
		  (r.retention_days IS NOT NULL AND r.retention_days > 0
		   AND l.folder_entered_at <= now() - (r.retention_days * interval '1 day'))
		  OR (l.expires_at IS NOT NULL AND l.expires_at <= now())
		  OR (l.max_reads > 0 AND l.reads >= l.max_reads)
		  OR l.burned_at IS NOT NULL
		)
		ORDER BY l.folder_entered_at ASC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ExpiredMessage
	for rows.Next() {
		var item ExpiredMessage
		if err := rows.Scan(&item.UserID, &item.MessageID, &item.CurrentFolder, &item.FolderEnteredAt, &item.RetentionDays); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func cloneRetentionMap(src map[string]*int) map[string]*int {
	out := make(map[string]*int, len(src))
	for folder, days := range src {
		if days == nil {
			out[folder] = nil
			continue
		}
		out[folder] = intPtr(*days)
	}
	return out
}

func intPtr(v int) *int {
	n := v
	return &n
}
