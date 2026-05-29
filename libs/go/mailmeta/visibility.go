package mailmeta

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// VisibleIdentityProfile is the current identity profile view available to a specific viewer.
type VisibleIdentityProfile struct {
	UserID             uuid.UUID
	Email              string
	Fingerprint        string
	PrimaryUID         string
	AvatarDataURL      string
	AvatarColor        string
	StatusBadgeEnabled bool
	StatusBadgeVisible bool
}

// AdvanceIdentityVisibilityOnLocalSend updates avatar/status exposure after one local Elvish identity sends to another.
func (s *Store) AdvanceIdentityVisibilityOnLocalSend(ctx context.Context, sender, recipient *IdentityKey, at time.Time) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	if sender == nil || recipient == nil {
		return errors.New("mailmeta: sender and recipient required")
	}
	if sender.UserID == uuid.Nil || recipient.UserID == uuid.Nil {
		return errors.New("mailmeta: user ids required")
	}
	senderFP := strings.ToUpper(strings.TrimSpace(sender.Fingerprint))
	recipientFP := strings.ToUpper(strings.TrimSpace(recipient.Fingerprint))
	if senderFP == "" || recipientFP == "" {
		return errors.New("mailmeta: fingerprints required")
	}
	if sender.UserID == recipient.UserID {
		return nil
	}
	if at.IsZero() {
		at = time.Now().UTC()
	} else {
		at = at.UTC()
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `INSERT INTO identity_profile_visibility
		(viewer_user_id, remote_user_id, remote_identity_fingerprint, avatar_visible, status_visible, first_shared_at, updated_at)
		VALUES ($1, $2, $3, true, false, $4, $4)
		ON CONFLICT (viewer_user_id, remote_identity_fingerprint) DO UPDATE
		SET remote_user_id = EXCLUDED.remote_user_id,
		    avatar_visible = true,
		    first_shared_at = LEAST(identity_profile_visibility.first_shared_at, EXCLUDED.first_shared_at),
		    updated_at = EXCLUDED.updated_at`,
		recipient.UserID, sender.UserID, senderFP, at,
	); err != nil {
		return err
	}
	var reciprocalAvatarVisible bool
	err = tx.QueryRow(ctx, `SELECT avatar_visible
		FROM identity_profile_visibility
		WHERE viewer_user_id = $1 AND remote_identity_fingerprint = $2`,
		sender.UserID, recipientFP,
	).Scan(&reciprocalAvatarVisible)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		reciprocalAvatarVisible = false
	case err != nil:
		return err
	}
	if reciprocalAvatarVisible {
		if _, err := tx.Exec(ctx, `UPDATE identity_profile_visibility
			SET status_visible = true,
			    status_visible_at = COALESCE(status_visible_at, $3),
			    updated_at = $3
			WHERE viewer_user_id = $1 AND remote_identity_fingerprint = $2`,
			recipient.UserID, senderFP, at,
		); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE identity_profile_visibility
			SET status_visible = true,
			    status_visible_at = COALESCE(status_visible_at, $3),
			    updated_at = $3
			WHERE viewer_user_id = $1 AND remote_identity_fingerprint = $2`,
			sender.UserID, recipientFP, at,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// LookupVisibleIdentityProfile resolves a local identity profile if it is visible to viewerUserID.
func (s *Store) LookupVisibleIdentityProfile(ctx context.Context, viewerUserID uuid.UUID, email string) (*VisibleIdentityProfile, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	remote, err := s.IdentityForEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	profile := &VisibleIdentityProfile{
		UserID:             remote.UserID,
		Email:              remote.Email,
		Fingerprint:        remote.Fingerprint,
		PrimaryUID:         remote.PrimaryUID,
		AvatarDataURL:      remote.AvatarDataURL,
		AvatarColor:        NormalizeIdentityAvatarColor(remote.AvatarColor, remote.Email),
		StatusBadgeEnabled: remote.StatusBadgeEnabled,
	}
	if remote.UserID == viewerUserID {
		profile.StatusBadgeVisible = remote.StatusBadgeEnabled
		return profile, nil
	}
	var avatarVisible bool
	err = s.pool.QueryRow(ctx, `SELECT avatar_visible, status_visible
		FROM identity_profile_visibility
		WHERE viewer_user_id = $1 AND remote_identity_fingerprint = $2`,
		viewerUserID, strings.ToUpper(strings.TrimSpace(remote.Fingerprint)),
	).Scan(&avatarVisible, &profile.StatusBadgeVisible)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if !avatarVisible {
		return nil, ErrNotFound
	}
	profile.StatusBadgeVisible = profile.StatusBadgeVisible && remote.StatusBadgeEnabled
	return profile, nil
}
