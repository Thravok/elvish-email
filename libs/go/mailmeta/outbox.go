package mailmeta

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// OutboxStatus values.
const (
	OutboxPending = "pending"
	OutboxSending = "sending"
	OutboxSent    = "sent"
	OutboxFailed  = "failed"
)

// OutboxKind discriminates dispatch modes (see migration 00004).
const (
	// OutboxKindPGP: payload is opaque PGP ciphertext addressable to recipient(s).
	// The worker transmits it as-is (after optional DKIM signing).
	OutboxKindPGP = "pgp"
	// OutboxKindPlaintextRelay: payload is wrapped to the server's relay key. The
	// worker decrypts in memory just before SMTP DATA, signs DKIM, sends, wipes.
	OutboxKindPlaintextRelay = "plaintext_relay"
)

// OutboxRow is the durable state for one queued message; payload bytes live in object storage.
type OutboxRow struct {
	ID                       uuid.UUID
	UserID                   uuid.UUID
	Status                   string
	Kind                     string
	Source                   string
	AdminRunID               uuid.UUID
	PayloadBlobRef           string
	PayloadSizeBytes         int64
	Attempts                 int
	NextAttemptAt            time.Time
	LastSMTPCode             int
	LastError                string
	RecipientSummary         string
	SentCopyBodyBlobRef      string
	SentCopyBodySizeBytes    int64
	SentCopyHeaderCiphertext []byte
	SentCopyFromAddr         string
	SentCopyMessageID        uuid.UUID
	CreatedAt                time.Time
	UpdatedAt                time.Time
}

// OutboxSentCopy stages a sender-readable ciphertext copy until delivery succeeds.
type OutboxSentCopy struct {
	BodyBlobRef      string
	BodySizeBytes    int64
	HeaderCiphertext []byte
	FromAddr         string
}

// InsertOutbox creates a pending PGP-kind row pointing at the ciphertext payload in object storage.
func (s *Store) InsertOutbox(ctx context.Context, userID uuid.UUID, payloadBlobRef string, sizeBytes int64, recipientSummary string) (uuid.UUID, error) {
	return s.InsertOutboxMeta(ctx, userID, OutboxKindPGP, payloadBlobRef, sizeBytes, recipientSummary, "", uuid.Nil, nil)
}

// InsertOutboxKind creates a pending row with a specific dispatch kind.
func (s *Store) InsertOutboxKind(ctx context.Context, userID uuid.UUID, kind, payloadBlobRef string, sizeBytes int64, recipientSummary string) (uuid.UUID, error) {
	return s.InsertOutboxMeta(ctx, userID, kind, payloadBlobRef, sizeBytes, recipientSummary, "", uuid.Nil, nil)
}

// InsertOutboxMeta creates a pending row with explicit source/admin-run metadata.
func (s *Store) InsertOutboxMeta(ctx context.Context, userID uuid.UUID, kind, payloadBlobRef string, sizeBytes int64, recipientSummary, source string, adminRunID uuid.UUID, sentCopy *OutboxSentCopy) (uuid.UUID, error) {
	if s == nil || s.pool == nil {
		return uuid.Nil, errors.New("mailmeta: nil")
	}
	if kind == "" {
		kind = OutboxKindPGP
	}
	id := uuid.New()
	var sentBodyRef string
	var sentBodySize int64
	var sentHeaderCT []byte
	var sentFromAddr string
	if sentCopy != nil {
		sentBodyRef = sentCopy.BodyBlobRef
		sentBodySize = sentCopy.BodySizeBytes
		sentHeaderCT = sentCopy.HeaderCiphertext
		sentFromAddr = strings.TrimSpace(sentCopy.FromAddr)
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO mail_outbox
		(id, user_id, status, kind, source, admin_run_id, payload_blob_ref, payload_size_bytes, attempts, next_attempt_at, last_smtp_code, last_error, recipient_summary,
		 sent_copy_body_blob_ref, sent_copy_body_size_bytes, sent_copy_header_ciphertext, sent_copy_from_addr, created_at, updated_at)
		VALUES ($1, $2, 'pending', $3, $4, NULLIF($5, '00000000-0000-0000-0000-000000000000'::uuid), $6, $7, 0, now(), 0, '', $8, $9, $10, $11, $12, now(), now())`,
		id, userID, kind, source, adminRunID, payloadBlobRef, sizeBytes, recipientSummary, sentBodyRef, sentBodySize, sentHeaderCT, sentFromAddr,
	)
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

// LeasePendingOutbox marks up to limit ready rows as sending and returns them.
func (s *Store) LeasePendingOutbox(ctx context.Context, limit int) ([]OutboxRow, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	rows, err := tx.Query(ctx, `SELECT id, user_id, status, kind, source, COALESCE(admin_run_id, '00000000-0000-0000-0000-000000000000'::uuid), payload_blob_ref, payload_size_bytes, attempts, next_attempt_at,
		last_smtp_code, last_error, recipient_summary, sent_copy_body_blob_ref, sent_copy_body_size_bytes, sent_copy_header_ciphertext, sent_copy_from_addr,
		COALESCE(sent_copy_message_id, '00000000-0000-0000-0000-000000000000'::uuid), created_at, updated_at
		FROM mail_outbox
		WHERE status = 'pending' AND next_attempt_at <= now()
		ORDER BY next_attempt_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED`, limit)
	if err != nil {
		return nil, err
	}
	var leased []OutboxRow
	var ids []uuid.UUID
	for rows.Next() {
		var r OutboxRow
		if err := rows.Scan(&r.ID, &r.UserID, &r.Status, &r.Kind, &r.Source, &r.AdminRunID, &r.PayloadBlobRef, &r.PayloadSizeBytes, &r.Attempts, &r.NextAttemptAt,
			&r.LastSMTPCode, &r.LastError, &r.RecipientSummary, &r.SentCopyBodyBlobRef, &r.SentCopyBodySizeBytes, &r.SentCopyHeaderCiphertext, &r.SentCopyFromAddr,
			&r.SentCopyMessageID, &r.CreatedAt, &r.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		leased = append(leased, r)
		ids = append(ids, r.ID)
	}
	rows.Close()
	if len(ids) == 0 {
		return nil, tx.Commit(ctx)
	}
	if _, err := tx.Exec(ctx, `UPDATE mail_outbox SET status = 'sending', updated_at = now()
		WHERE id = ANY($1::uuid[]) AND status = 'pending'`, ids); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return leased, nil
}

// MarkOutboxSent marks a row as sent.
func (s *Store) MarkOutboxSent(ctx context.Context, id uuid.UUID, smtpCode int) error {
	_, err := s.pool.Exec(ctx, `UPDATE mail_outbox SET status = 'sent', updated_at = now(), last_smtp_code = $1, last_error = '' WHERE id = $2`,
		smtpCode, id,
	)
	return err
}

// RecordSentCopy marks the sender-side copy as persisted and clears staging metadata.
func (s *Store) RecordSentCopy(ctx context.Context, id, messageID uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	_, err := s.pool.Exec(ctx, `UPDATE mail_outbox
		SET sent_copy_message_id = $1,
		    sent_copy_body_blob_ref = '',
		    sent_copy_body_size_bytes = 0,
		    sent_copy_header_ciphertext = NULL,
		    sent_copy_from_addr = '',
		    updated_at = now()
		WHERE id = $2`, messageID, id)
	return err
}

// MarkOutboxFailed records a delivery failure. transient=true reschedules with backoff; false marks permanent.
func (s *Store) MarkOutboxFailed(ctx context.Context, id uuid.UUID, smtpCode int, errMsg string, transient bool) error {
	if !transient {
		_, err := s.pool.Exec(ctx, `UPDATE mail_outbox
			SET status = 'failed', updated_at = now(), last_smtp_code = $1, last_error = $2, attempts = attempts + 1
			WHERE id = $3`, smtpCode, errMsg, id)
		return err
	}
	_, err := s.pool.Exec(ctx, `UPDATE mail_outbox
		SET status = 'pending', updated_at = now(), last_smtp_code = $1, last_error = $2, attempts = attempts + 1,
		    next_attempt_at = now() + ((60 * CAST(power(2, LEAST(attempts, 8)) AS INT)) * interval '1 second')
		WHERE id = $3`, smtpCode, errMsg, id)
	return err
}

// RecoverStuckSending resets sending rows older than olderThan back to pending.
func (s *Store) RecoverStuckSending(ctx context.Context, olderThan time.Duration) error {
	if olderThan <= 0 {
		olderThan = 15 * time.Minute
	}
	cutoff := time.Now().UTC().Add(-olderThan)
	_, err := s.pool.Exec(ctx, `UPDATE mail_outbox SET status = 'pending', updated_at = now()
		WHERE status = 'sending' AND updated_at < $1`, cutoff)
	return err
}

// GetOutbox returns a single outbox row (owner-scoped).
func (s *Store) GetOutbox(ctx context.Context, userID, id uuid.UUID) (*OutboxRow, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	var r OutboxRow
	err := s.pool.QueryRow(ctx, `SELECT id, user_id, status, kind, source, COALESCE(admin_run_id, '00000000-0000-0000-0000-000000000000'::uuid), payload_blob_ref, payload_size_bytes, attempts, next_attempt_at,
		last_smtp_code, last_error, recipient_summary, sent_copy_body_blob_ref, sent_copy_body_size_bytes, sent_copy_header_ciphertext, sent_copy_from_addr,
		COALESCE(sent_copy_message_id, '00000000-0000-0000-0000-000000000000'::uuid), created_at, updated_at
		FROM mail_outbox WHERE id = $1 AND user_id = $2`, id, userID).Scan(
		&r.ID, &r.UserID, &r.Status, &r.Kind, &r.Source, &r.AdminRunID, &r.PayloadBlobRef, &r.PayloadSizeBytes, &r.Attempts, &r.NextAttemptAt,
		&r.LastSMTPCode, &r.LastError, &r.RecipientSummary, &r.SentCopyBodyBlobRef, &r.SentCopyBodySizeBytes, &r.SentCopyHeaderCiphertext, &r.SentCopyFromAddr,
		&r.SentCopyMessageID, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// ListOutboxByUser returns every outbox row for one account, newest first.
func (s *Store) ListOutboxByUser(ctx context.Context, userID uuid.UUID) ([]OutboxRow, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT id, user_id, status, kind, source, COALESCE(admin_run_id, '00000000-0000-0000-0000-000000000000'::uuid), payload_blob_ref, payload_size_bytes, attempts, next_attempt_at,
		last_smtp_code, last_error, recipient_summary, sent_copy_body_blob_ref, sent_copy_body_size_bytes, sent_copy_header_ciphertext, sent_copy_from_addr,
		COALESCE(sent_copy_message_id, '00000000-0000-0000-0000-000000000000'::uuid), created_at, updated_at
		FROM mail_outbox WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OutboxRow
	for rows.Next() {
		var r OutboxRow
		if err := rows.Scan(&r.ID, &r.UserID, &r.Status, &r.Kind, &r.Source, &r.AdminRunID, &r.PayloadBlobRef, &r.PayloadSizeBytes, &r.Attempts, &r.NextAttemptAt,
			&r.LastSMTPCode, &r.LastError, &r.RecipientSummary, &r.SentCopyBodyBlobRef, &r.SentCopyBodySizeBytes, &r.SentCopyHeaderCiphertext, &r.SentCopyFromAddr,
			&r.SentCopyMessageID, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// Bounce is one delivery bounce report.
type Bounce struct {
	ID           uuid.UUID
	OutboxID     uuid.UUID
	Recipient    string
	Code         int
	EnhancedCode string
	Reason       string
	ReceivedAt   time.Time
}

// InsertBounce records a bounce row.
func (s *Store) InsertBounce(ctx context.Context, b Bounce) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO mail_bounces (outbox_id, recipient, code, enhanced_code, reason, received_at)
		VALUES ($1, $2, $3, $4, $5, now())`,
		b.OutboxID, b.Recipient, b.Code, b.EnhancedCode, b.Reason,
	)
	return err
}

// ListBounces returns bounces for one outbox row.
func (s *Store) ListBounces(ctx context.Context, outboxID uuid.UUID) ([]Bounce, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, outbox_id, recipient, code, enhanced_code, reason, received_at
		FROM mail_bounces WHERE outbox_id = $1 ORDER BY received_at ASC`, outboxID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Bounce
	for rows.Next() {
		var b Bounce
		if err := rows.Scan(&b.ID, &b.OutboxID, &b.Recipient, &b.Code, &b.EnhancedCode, &b.Reason, &b.ReceivedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// IngestLedger is one row from mail_ingest_ledger (audit log).
type IngestLedger struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	MessageID   uuid.UUID
	Source      string
	Provenance  string
	BodyBlobRef string
	ReceivedAt  time.Time
}

// AppendIngestLedger inserts an audit row.
func (s *Store) AppendIngestLedger(ctx context.Context, l IngestLedger) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO mail_ingest_ledger (user_id, message_id, source, provenance, body_blob_ref, received_at)
		VALUES ($1, $2, $3, $4, $5, now())`,
		l.UserID, l.MessageID, l.Source, l.Provenance, l.BodyBlobRef,
	)
	return err
}

// IngestLedgerByMessage looks up the audit row for a message id (owner check).
func (s *Store) IngestLedgerByMessage(ctx context.Context, messageID uuid.UUID) (*IngestLedger, error) {
	var l IngestLedger
	err := s.pool.QueryRow(ctx, `SELECT id, user_id, message_id, source, provenance, body_blob_ref, received_at
		FROM mail_ingest_ledger WHERE message_id = $1`, messageID).Scan(
		&l.ID, &l.UserID, &l.MessageID, &l.Source, &l.Provenance, &l.BodyBlobRef, &l.ReceivedAt,
	)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

// ListIngestLedgerByUser returns every persisted message ledger row for one account.
func (s *Store) ListIngestLedgerByUser(ctx context.Context, userID uuid.UUID) ([]IngestLedger, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT id, user_id, message_id, source, provenance, body_blob_ref, received_at
		FROM mail_ingest_ledger WHERE user_id = $1 ORDER BY received_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []IngestLedger
	for rows.Next() {
		var row IngestLedger
		if err := rows.Scan(&row.ID, &row.UserID, &row.MessageID, &row.Source, &row.Provenance, &row.BodyBlobRef, &row.ReceivedAt); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// backoff computes exponential delay with jitter (min 60s * 2^attempt, capped at 1h).
func backoff(attempts int) time.Duration {
	base := 60 * time.Second
	for i := 0; i < attempts && i < 8; i++ {
		base *= 2
	}
	if base > time.Hour {
		base = time.Hour
	}
	return base
}

// OutboxStats returns aggregate counts by status (admin use).
func (s *Store) OutboxStats(ctx context.Context) (map[string]int64, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	rows, err := s.pool.Query(ctx, `SELECT status, count(*) FROM mail_outbox GROUP BY status`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int64{"pending": 0, "sending": 0, "sent": 0, "failed": 0}
	for rows.Next() {
		var status string
		var cnt int64
		if err := rows.Scan(&status, &cnt); err != nil {
			return nil, err
		}
		out[status] = cnt
	}
	return out, rows.Err()
}

// ListOutboxAdmin returns paginated outbox rows for admin (no user filter).
func (s *Store) ListOutboxAdmin(ctx context.Context, status, source string, offset, limit int) ([]OutboxRow, int64, error) {
	if s == nil || s.pool == nil {
		return nil, 0, errors.New("mailmeta: nil")
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	var total int64
	var out []OutboxRow

	clauses := make([]string, 0, 2)
	args := make([]any, 0, 4)
	if status != "" {
		args = append(args, status)
		clauses = append(clauses, "status = $1")
	}
	if source != "" {
		if source == "user_mail" {
			clauses = append(clauses, "source = ''")
		} else {
			args = append(args, source)
			clauses = append(clauses, "source = $"+itoa(len(args)))
		}
	}
	where := ""
	if len(clauses) > 0 {
		where = " WHERE " + strings.Join(clauses, " AND ")
	}

	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM mail_outbox`+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, limit, offset)
	rows, err := s.pool.Query(ctx, `SELECT id, user_id, status, kind, source, COALESCE(admin_run_id, '00000000-0000-0000-0000-000000000000'::uuid), payload_blob_ref, payload_size_bytes, attempts, next_attempt_at,
		last_smtp_code, last_error, recipient_summary, created_at, updated_at
		FROM mail_outbox`+where+` ORDER BY created_at DESC LIMIT $`+itoa(len(args)-1)+` OFFSET $`+itoa(len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var r OutboxRow
		if err := rows.Scan(&r.ID, &r.UserID, &r.Status, &r.Kind, &r.Source, &r.AdminRunID, &r.PayloadBlobRef, &r.PayloadSizeBytes, &r.Attempts, &r.NextAttemptAt,
			&r.LastSMTPCode, &r.LastError, &r.RecipientSummary, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, r)
	}
	return out, total, rows.Err()
}

func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}

// GetOutboxByID returns a single outbox row without user filter (admin).
func (s *Store) GetOutboxByID(ctx context.Context, id uuid.UUID) (*OutboxRow, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	var r OutboxRow
	err := s.pool.QueryRow(ctx, `SELECT id, user_id, status, kind, source, COALESCE(admin_run_id, '00000000-0000-0000-0000-000000000000'::uuid), payload_blob_ref, payload_size_bytes, attempts, next_attempt_at,
		last_smtp_code, last_error, recipient_summary, created_at, updated_at
		FROM mail_outbox WHERE id = $1`, id).Scan(
		&r.ID, &r.UserID, &r.Status, &r.Kind, &r.Source, &r.AdminRunID, &r.PayloadBlobRef, &r.PayloadSizeBytes, &r.Attempts, &r.NextAttemptAt,
		&r.LastSMTPCode, &r.LastError, &r.RecipientSummary, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// RetryOutboxEntry resets a failed outbox entry to pending (admin).
func (s *Store) RetryOutboxEntry(ctx context.Context, id uuid.UUID) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE mail_outbox SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = '', updated_at = now()
		WHERE id = $1 AND status = 'failed'`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("not found or not failed")
	}
	return nil
}
