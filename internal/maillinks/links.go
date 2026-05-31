package maillinks

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound indicates a missing token (or one already deleted).
var ErrNotFound = errors.New("maillinks: not found")

// ErrBurned indicates the link has been viewed too many times or expired.
var ErrBurned = errors.New("maillinks: burned")

// TokenLength is the canonical encoded token length: base64url(32 random bytes), unpadded.
const TokenLength = 43

// Store wraps the Cockroach connection pool.
type Store struct {
	pool *pgxpool.Pool
}

// New constructs a Store. pool must not be nil.
func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Row is one persisted protected link. Fields prefixed with KDF describe how the
// recipient browser must derive the KEK from the sender-supplied password.
type Row struct {
	Token            string
	UserID           uuid.UUID
	BlobRef          string
	BodySizeBytes    int64
	RecipientSummary string
	SubjectHint      string
	KDF              string
	KDFSalt          []byte
	KDFParamsJSON    string
	WrappedMsgKey    []byte
	CreatedAt        time.Time
	ExpiresAt        time.Time
	MaxViews         int64
	Views            int64
	BurnedAt         *time.Time
}

// CreateInput is the caller-supplied subset of fields. The token, blob_ref, and
// timestamps are produced by the store.
type CreateInput struct {
	UserID           uuid.UUID
	BlobRef          string
	BodySizeBytes    int64
	RecipientSummary string
	SubjectHint      string
	KDF              string
	KDFSalt          []byte
	KDFParamsJSON    string
	WrappedMsgKey    []byte
	TTL              time.Duration
	MaxViews         int64
}

// NewToken returns a fresh URL-safe token (43 chars, base64url unpadded of 32 random bytes).
func NewToken() (string, error) {
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf[:]), nil
}

// ValidateToken returns true if s is the right shape (does not check existence).
func ValidateToken(s string) bool {
	if len(s) != TokenLength {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'A' && r <= 'Z':
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '-' || r == '_':
		default:
			return false
		}
	}
	return true
}

// Create inserts a new protected-link row and returns the generated token + persisted row.
// The caller is responsible for storing the ciphertext at in.BlobRef before/after this call;
// the store itself only owns the metadata row.
func (s *Store) Create(ctx context.Context, in CreateInput) (*Row, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("maillinks: nil store")
	}
	if in.UserID == uuid.Nil {
		return nil, errors.New("maillinks: user_id required")
	}
	if in.KDF == "" || len(in.KDFSalt) == 0 || len(in.WrappedMsgKey) == 0 {
		return nil, errors.New("maillinks: kdf, salt, wrapped_msg_key required")
	}
	if in.TTL <= 0 || in.TTL > 30*24*time.Hour {
		return nil, errors.New("maillinks: ttl must be in (0, 30d]")
	}
	if in.MaxViews < 0 {
		return nil, errors.New("maillinks: max_views must be >= 0")
	}
	if in.KDFParamsJSON == "" {
		in.KDFParamsJSON = "{}"
	}
	token, err := NewToken()
	if err != nil {
		return nil, err
	}
	expires := time.Now().UTC().Add(in.TTL)
	_, err = s.pool.Exec(ctx, `INSERT INTO mail_protected_links
		(token, user_id, blob_ref, body_size_bytes, recipient_summary, subject_hint,
		 kdf, kdf_salt, kdf_params_json, wrapped_msg_key, created_at, expires_at, max_views, views)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $11, $12, 0)`,
		token, in.UserID, in.BlobRef, in.BodySizeBytes, in.RecipientSummary, in.SubjectHint,
		in.KDF, in.KDFSalt, in.KDFParamsJSON, in.WrappedMsgKey, expires, in.MaxViews,
	)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, token)
}

// Get returns a row by token (does not consume a view).
func (s *Store) Get(ctx context.Context, token string) (*Row, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("maillinks: nil store")
	}
	token = strings.TrimSpace(token)
	if !ValidateToken(token) {
		return nil, ErrNotFound
	}
	var r Row
	var burned *time.Time
	err := s.pool.QueryRow(ctx, `SELECT token, user_id, blob_ref, body_size_bytes, recipient_summary, subject_hint,
		kdf, kdf_salt, kdf_params_json, wrapped_msg_key, created_at, expires_at, max_views, views, burned_at
		FROM mail_protected_links WHERE token = $1`, token).Scan(
		&r.Token, &r.UserID, &r.BlobRef, &r.BodySizeBytes, &r.RecipientSummary, &r.SubjectHint,
		&r.KDF, &r.KDFSalt, &r.KDFParamsJSON, &r.WrappedMsgKey, &r.CreatedAt, &r.ExpiresAt, &r.MaxViews, &r.Views, &burned,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	r.BurnedAt = burned
	return &r, nil
}

// ConsumeResult is the outcome of an atomic view-consumption attempt.
type ConsumeResult struct {
	Row            *Row
	ViewsRemaining int64 // 0 means burned after this view (only meaningful when MaxViews > 0)
	Burned         bool  // true if this attempt set burned_at (or the row was already burned)
}

// ConsumeView atomically increments views, marks burned_at if max_views is now reached,
// and returns the row. Returns ErrBurned if the link is already past expires_at, already
// burned, or this attempt would exceed max_views.
//
// A single UPDATE ... RETURNING ensures the counter is race-free even under concurrent calls.
func (s *Store) ConsumeView(ctx context.Context, token string) (*ConsumeResult, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("maillinks: nil store")
	}
	token = strings.TrimSpace(token)
	if !ValidateToken(token) {
		return nil, ErrNotFound
	}
	var r Row
	var burned *time.Time
	err := s.pool.QueryRow(ctx, `UPDATE mail_protected_links
		SET views = views + 1,
		    burned_at = CASE
		      WHEN max_views > 0 AND views + 1 >= max_views THEN now()
		      ELSE burned_at
		    END
		WHERE token = $1
		  AND burned_at IS NULL
		  AND expires_at > now()
		  AND (max_views = 0 OR views < max_views)
		RETURNING token, user_id, blob_ref, body_size_bytes, recipient_summary, subject_hint,
		          kdf, kdf_salt, kdf_params_json, wrapped_msg_key, created_at, expires_at,
		          max_views, views, burned_at`,
		token).Scan(
		&r.Token, &r.UserID, &r.BlobRef, &r.BodySizeBytes, &r.RecipientSummary, &r.SubjectHint,
		&r.KDF, &r.KDFSalt, &r.KDFParamsJSON, &r.WrappedMsgKey, &r.CreatedAt, &r.ExpiresAt,
		&r.MaxViews, &r.Views, &burned,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		// Either the row doesn't exist, is expired, or already burned. Distinguish for the caller.
		if _, getErr := s.Get(ctx, token); errors.Is(getErr, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrBurned
	}
	if err != nil {
		return nil, err
	}
	r.BurnedAt = burned
	res := &ConsumeResult{Row: &r}
	if r.MaxViews > 0 {
		remaining := r.MaxViews - r.Views
		if remaining < 0 {
			remaining = 0
		}
		res.ViewsRemaining = remaining
		res.Burned = burned != nil
	}
	return res, nil
}

// Delete removes the metadata row by token (caller is responsible for the blob).
func (s *Store) Delete(ctx context.Context, token string) error {
	if s == nil || s.pool == nil {
		return errors.New("maillinks: nil store")
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM mail_protected_links WHERE token = $1`, token)
	return err
}

// Expired is one expired/burned row returned by PurgeExpired so the caller can
// also delete the underlying ciphertext blob.
type Expired struct {
	Token   string
	UserID  uuid.UUID
	BlobRef string
}

// PurgeExpired removes rows where expires_at < now() OR (max_views > 0 AND views >= max_views).
// Returns the rows that were deleted so the caller can also drop the matching blobs.
func (s *Store) PurgeExpired(ctx context.Context, limit int) ([]Expired, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("maillinks: nil store")
	}
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `DELETE FROM mail_protected_links
		WHERE token IN (
		  SELECT token FROM mail_protected_links
		  WHERE expires_at < now() OR (max_views > 0 AND views >= max_views)
		  LIMIT $1
		)
		RETURNING token, user_id, blob_ref`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Expired
	for rows.Next() {
		var e Expired
		if err := rows.Scan(&e.Token, &e.UserID, &e.BlobRef); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// ListByUser returns links owned by user, newest first (for the sender's "Sent links" UI).
func (s *Store) ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]Row, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("maillinks: nil store")
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `SELECT token, user_id, blob_ref, body_size_bytes, recipient_summary, subject_hint,
		kdf, kdf_salt, kdf_params_json, wrapped_msg_key, created_at, expires_at, max_views, views, burned_at
		FROM mail_protected_links WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Row
	for rows.Next() {
		var r Row
		var burned *time.Time
		if err := rows.Scan(&r.Token, &r.UserID, &r.BlobRef, &r.BodySizeBytes, &r.RecipientSummary, &r.SubjectHint,
			&r.KDF, &r.KDFSalt, &r.KDFParamsJSON, &r.WrappedMsgKey, &r.CreatedAt, &r.ExpiresAt, &r.MaxViews, &r.Views, &burned); err != nil {
			return nil, err
		}
		r.BurnedAt = burned
		out = append(out, r)
	}
	return out, rows.Err()
}

// ListAllByUser returns all protected-link rows owned by a user.
func (s *Store) ListAllByUser(ctx context.Context, userID uuid.UUID) ([]Row, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("maillinks: nil store")
	}
	rows, err := s.pool.Query(ctx, `SELECT token, user_id, blob_ref, body_size_bytes, recipient_summary, subject_hint,
		kdf, kdf_salt, kdf_params_json, wrapped_msg_key, created_at, expires_at, max_views, views, burned_at
		FROM mail_protected_links WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Row
	for rows.Next() {
		var r Row
		var burned *time.Time
		if err := rows.Scan(&r.Token, &r.UserID, &r.BlobRef, &r.BodySizeBytes, &r.RecipientSummary, &r.SubjectHint,
			&r.KDF, &r.KDFSalt, &r.KDFParamsJSON, &r.WrappedMsgKey, &r.CreatedAt, &r.ExpiresAt, &r.MaxViews, &r.Views, &burned); err != nil {
			return nil, err
		}
		r.BurnedAt = burned
		out = append(out, r)
	}
	return out, rows.Err()
}
