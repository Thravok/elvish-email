package mailmeta

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// AdminMailRun records one admin-triggered system mail batch.
type AdminMailRun struct {
	ID              uuid.UUID `json:"id"`
	AdminUserID     uuid.UUID `json:"admin_user_id"`
	AudienceKind    string    `json:"audience_kind"`
	SendMode        string    `json:"send_mode"`
	SenderAddr      string    `json:"sender_addr"`
	Subject         string    `json:"subject"`
	BodySHA256      string    `json:"body_sha256"`
	AttachmentCount int       `json:"attachment_count"`
	AttachmentBytes int64     `json:"attachment_bytes"`
	RecipientCount  int       `json:"recipient_count"`
	QueuedCount     int       `json:"queued_count"`
	PendingCount    int       `json:"pending_count"`
	SendingCount    int       `json:"sending_count"`
	SentCount       int       `json:"sent_count"`
	FailedCount     int       `json:"failed_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// AdminMailRunInput is the data required to insert an admin mail run.
type AdminMailRunInput struct {
	AdminUserID     uuid.UUID
	AudienceKind    string
	SendMode        string
	SenderAddr      string
	Subject         string
	BodySHA256      string
	AttachmentCount int
	AttachmentBytes int64
	RecipientCount  int
	QueuedCount     int
}

// InsertAdminMailRun creates an admin mail run row.
func (s *Store) InsertAdminMailRun(ctx context.Context, in AdminMailRunInput) (uuid.UUID, error) {
	if s == nil || s.pool == nil {
		return uuid.Nil, errors.New("mailmeta: nil")
	}
	id := uuid.New()
	_, err := s.pool.Exec(ctx, `INSERT INTO admin_mail_runs
		(id, admin_user_id, audience_kind, send_mode, sender_addr, subject, body_sha256, attachment_count, attachment_bytes, recipient_count, queued_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())`,
		id, in.AdminUserID, in.AudienceKind, in.SendMode, in.SenderAddr, in.Subject, in.BodySHA256, in.AttachmentCount, in.AttachmentBytes, in.RecipientCount, in.QueuedCount,
	)
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

// UpdateAdminMailRunQueuedCount records how many rows were queued for a run.
func (s *Store) UpdateAdminMailRunQueuedCount(ctx context.Context, runID uuid.UUID, queuedCount int) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	_, err := s.pool.Exec(ctx, `UPDATE admin_mail_runs SET queued_count = $2, updated_at = now() WHERE id = $1`, runID, queuedCount)
	return err
}

// ListAdminMailRuns returns recent admin mail runs with aggregate outbox status counts.
func (s *Store) ListAdminMailRuns(ctx context.Context, offset, limit int) ([]AdminMailRun, int64, error) {
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
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM admin_mail_runs`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.pool.Query(ctx, `SELECT r.id, r.admin_user_id, r.audience_kind, r.send_mode, r.sender_addr, r.subject, r.body_sha256,
		r.attachment_count, r.attachment_bytes, r.recipient_count, r.queued_count, r.created_at, r.updated_at,
		COUNT(o.id) FILTER (WHERE o.status = 'pending') AS pending_count,
		COUNT(o.id) FILTER (WHERE o.status = 'sending') AS sending_count,
		COUNT(o.id) FILTER (WHERE o.status = 'sent') AS sent_count,
		COUNT(o.id) FILTER (WHERE o.status = 'failed') AS failed_count
		FROM admin_mail_runs r
		LEFT JOIN mail_outbox o ON o.admin_run_id = r.id
		GROUP BY r.id
		ORDER BY r.created_at DESC
		LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]AdminMailRun, 0, limit)
	for rows.Next() {
		var run AdminMailRun
		if err := rows.Scan(
			&run.ID, &run.AdminUserID, &run.AudienceKind, &run.SendMode, &run.SenderAddr, &run.Subject, &run.BodySHA256,
			&run.AttachmentCount, &run.AttachmentBytes, &run.RecipientCount, &run.QueuedCount, &run.CreatedAt, &run.UpdatedAt,
			&run.PendingCount, &run.SendingCount, &run.SentCount, &run.FailedCount,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, run)
	}
	return out, total, rows.Err()
}
