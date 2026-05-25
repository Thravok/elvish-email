package mailmeta

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// MaxMessageExpiry is the longest per-message TTL senders may request (matches protected links).
const MaxMessageExpiry = 30 * 24 * time.Hour

// ErrMessageExpired indicates the message is past expires_at.
var ErrMessageExpired = errors.New("mailmeta: message expired")

// ErrMessageBurned indicates the read cap was reached or the row is burned.
var ErrMessageBurned = errors.New("mailmeta: message burned")

// MessageExpiry is optional sender policy applied to one mailbox copy at ingest.
type MessageExpiry struct {
	ExpiresAt *time.Time
	MaxReads  int64
}

// NormalizeMessageExpiry validates sender expiry options.
func NormalizeMessageExpiry(expiresInSeconds, maxReads int64) (*MessageExpiry, error) {
	if maxReads < 0 {
		return nil, errors.New("mailmeta: max_reads must be >= 0")
	}
	if expiresInSeconds < 0 {
		return nil, errors.New("mailmeta: expires_in_seconds must be >= 0")
	}
	if expiresInSeconds == 0 && maxReads == 0 {
		return nil, nil
	}
	out := &MessageExpiry{MaxReads: maxReads}
	if expiresInSeconds > 0 {
		if expiresInSeconds > int64(MaxMessageExpiry/time.Second) {
			return nil, fmt.Errorf("mailmeta: expires_in_seconds must be <= %d", int64(MaxMessageExpiry/time.Second))
		}
		t := time.Now().UTC().Add(time.Duration(expiresInSeconds) * time.Second)
		out.ExpiresAt = &t
	}
	return out, nil
}

// MessageLifecycleExpired reports whether a lifecycle row is no longer readable.
func MessageLifecycleExpired(lc *MessageLifecycle, now time.Time) bool {
	if lc == nil {
		return false
	}
	if lc.BurnedAt != nil {
		return true
	}
	if lc.ExpiresAt != nil && !now.Before(*lc.ExpiresAt) {
		return true
	}
	return lc.MaxReads > 0 && lc.Reads >= lc.MaxReads
}

// ConsumeReadResult is returned after a successful read consumption.
type ConsumeReadResult struct {
	Lifecycle      *MessageLifecycle
	ReadsRemaining int64
	Burned         bool
}

// ConsumeRead atomically increments reads when max_reads > 0 and the message is still valid.
func (s *Store) ConsumeRead(ctx context.Context, userID, messageID uuid.UUID) (*ConsumeReadResult, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	if userID == uuid.Nil || messageID == uuid.Nil {
		return nil, errors.New("mailmeta: ids required")
	}
	var lc MessageLifecycle
	var burned *time.Time
	err := s.pool.QueryRow(ctx, `UPDATE mail_message_lifecycle
		SET reads = reads + 1,
		    burned_at = CASE
		      WHEN max_reads > 0 AND reads + 1 >= max_reads THEN now()
		      ELSE burned_at
		    END,
		    updated_at = now()
		WHERE user_id = $1 AND message_id = $2
		  AND max_reads > 0
		  AND burned_at IS NULL
		  AND (expires_at IS NULL OR expires_at > now())
		  AND reads < max_reads
		RETURNING user_id, message_id, current_folder, folder_entered_at, created_at, updated_at,
		          expires_at, max_reads, reads, burned_at`,
		userID, messageID,
	).Scan(
		&lc.UserID, &lc.MessageID, &lc.CurrentFolder, &lc.FolderEnteredAt, &lc.CreatedAt, &lc.UpdatedAt,
		&lc.ExpiresAt, &lc.MaxReads, &lc.Reads, &burned,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		row, getErr := s.GetMessageLifecycle(ctx, userID, messageID)
		if getErr != nil {
			if errors.Is(getErr, ErrNotFound) {
				return nil, ErrNotFound
			}
			return nil, getErr
		}
		if MessageLifecycleExpired(row, time.Now().UTC()) {
			if row.ExpiresAt != nil && !time.Now().Before(*row.ExpiresAt) {
				return nil, ErrMessageExpired
			}
			return nil, ErrMessageBurned
		}
		return &ConsumeReadResult{Lifecycle: row, ReadsRemaining: readsRemaining(row)}, nil
	}
	if err != nil {
		return nil, err
	}
	lc.BurnedAt = burned
	res := &ConsumeReadResult{Lifecycle: &lc, ReadsRemaining: readsRemaining(&lc), Burned: burned != nil}
	return res, nil
}

func readsRemaining(lc *MessageLifecycle) int64 {
	if lc == nil || lc.MaxReads <= 0 {
		return 0
	}
	remaining := lc.MaxReads - lc.Reads
	if remaining < 0 {
		return 0
	}
	return remaining
}
