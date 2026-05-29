package mailmeta

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// UserFolder is a user-created mailbox folder name (messages use this string in Scylla).
type UserFolder struct {
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// ListUserFolders returns custom folders for the user (standard folders are implicit).
func (s *Store) ListUserFolders(ctx context.Context, userID uuid.UUID) ([]UserFolder, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT name, created_at FROM mail_user_folders WHERE user_id = $1 ORDER BY name ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []UserFolder
	for rows.Next() {
		var f UserFolder
		if err := rows.Scan(&f.Name, &f.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// CreateUserFolder inserts a folder name (lowercase normalized).
func (s *Store) CreateUserFolder(ctx context.Context, userID uuid.UUID, name string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	name = normalizeFolderName(name)
	if name == "" {
		return errors.New("mailmeta: invalid folder name")
	}
	switch name {
	case FolderInbox, FolderSent, FolderDrafts, FolderTrash, FolderArchive:
		return errors.New("mailmeta: reserved folder name")
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO mail_user_folders (user_id, name, created_at) VALUES ($1, $2, now())`, userID, name)
	return err
}

// DeleteUserFolder removes a custom folder row (does not move Scylla messages).
func (s *Store) DeleteUserFolder(ctx context.Context, userID uuid.UUID, name string) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	name = normalizeFolderName(name)
	tag, err := s.pool.Exec(ctx, `DELETE FROM mail_user_folders WHERE user_id = $1 AND name = $2`, userID, name)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// UserHasFolder returns true if name is a stored custom folder for the user.
func (s *Store) UserHasFolder(ctx context.Context, userID uuid.UUID, name string) (bool, error) {
	if s == nil || s.pool == nil {
		return false, errors.New("mailmeta: nil")
	}
	name = normalizeFolderName(name)
	var one int
	err := s.pool.QueryRow(ctx, `SELECT 1 FROM mail_user_folders WHERE user_id = $1 AND name = $2`, userID, name).Scan(&one)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func normalizeFolderName(name string) string {
	s := strings.TrimSpace(strings.ToLower(name))
	if len(s) > 50 {
		s = s[:50]
	}
	return s
}

// MailFilterRow is a stored rule row (conditions/actions as JSON arrays).
type MailFilterRow struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Name       string
	Enabled    bool
	Priority   int
	Conditions json.RawMessage
	Actions    json.RawMessage
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// ListMailFilters returns filters ordered by priority descending.
func (s *Store) ListMailFilters(ctx context.Context, userID uuid.UUID) ([]MailFilterRow, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT filter_id, user_id, name, enabled, priority, conditions, actions, created_at, updated_at
		FROM mail_user_filters WHERE user_id = $1 ORDER BY priority DESC, created_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MailFilterRow
	for rows.Next() {
		var r MailFilterRow
		if err := rows.Scan(&r.ID, &r.UserID, &r.Name, &r.Enabled, &r.Priority, &r.Conditions, &r.Actions, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// InsertMailFilter creates a filter and returns its id.
func (s *Store) InsertMailFilter(ctx context.Context, userID uuid.UUID, name string, enabled bool, priority int, conditions, actions json.RawMessage) (uuid.UUID, error) {
	if s == nil || s.pool == nil {
		return uuid.Nil, errors.New("mailmeta: nil")
	}
	id := uuid.New()
	if priority == 0 {
		priority = 100
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO mail_user_filters (user_id, filter_id, name, enabled, priority, conditions, actions, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())`,
		userID, id, strings.TrimSpace(name), enabled, priority, conditions, actions)
	return id, err
}

// UpdateMailFilter replaces filter fields.
func (s *Store) UpdateMailFilter(ctx context.Context, userID, filterID uuid.UUID, name string, enabled bool, priority int, conditions, actions json.RawMessage) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE mail_user_filters SET name=$3, enabled=$4, priority=$5, conditions=$6, actions=$7, updated_at=now()
		WHERE user_id=$1 AND filter_id=$2`,
		userID, filterID, strings.TrimSpace(name), enabled, priority, conditions, actions)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteMailFilter removes one filter.
func (s *Store) DeleteMailFilter(ctx context.Context, userID, filterID uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM mail_user_filters WHERE user_id=$1 AND filter_id=$2`, userID, filterID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
