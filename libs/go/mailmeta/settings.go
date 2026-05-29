package mailmeta

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Field names for mail_metadata_consent.
const (
	FieldSubject            = "subject"
	FieldFromAddr           = "from_addr"
	FieldToAddrs            = "to_addrs"
	FieldDate               = "date"
	FieldThreadID           = "thread_id"
	FieldFlagsSummary       = "flags_summary"
	FieldAttachmentsSummary = "attachments_summary"
)

// AllowedConsentFields lists every legal field name (whitelist for API validation).
var AllowedConsentFields = []string{
	FieldSubject, FieldFromAddr, FieldToAddrs, FieldDate, FieldThreadID, FieldFlagsSummary, FieldAttachmentsSummary,
}

// Settings is per-user mail behaviour configuration.
type Settings struct {
	UserID                    uuid.UUID
	AutoEncryptInbound        bool
	WKDPublish                bool
	AttachPublicKeyDefault    bool
	KeyVaultIdleMin           int
	RetentionSetupCompletedAt *time.Time
	UpdatedAt                 time.Time
}

// DefaultSettings returns the application defaults.
func DefaultSettings(userID uuid.UUID) Settings {
	return Settings{UserID: userID, AutoEncryptInbound: true, WKDPublish: true, KeyVaultIdleMin: 15}
}

// GetSettings returns the user's settings, applying defaults for missing rows.
func (s *Store) GetSettings(ctx context.Context, userID uuid.UUID) (Settings, error) {
	if s == nil || s.pool == nil {
		return Settings{}, errors.New("mailmeta: nil")
	}
	out := DefaultSettings(userID)
	err := s.pool.QueryRow(ctx, `SELECT user_id, auto_encrypt_inbound, wkd_publish, attach_public_key_default, keyvault_idle_min, retention_setup_completed_at, updated_at
		FROM user_mail_settings WHERE user_id = $1`, userID).Scan(
		&out.UserID, &out.AutoEncryptInbound, &out.WKDPublish, &out.AttachPublicKeyDefault, &out.KeyVaultIdleMin, &out.RetentionSetupCompletedAt, &out.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, nil
	}
	return out, err
}

// SetSettings upserts the user's settings.
func (s *Store) SetSettings(ctx context.Context, st Settings) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO user_mail_settings (user_id, auto_encrypt_inbound, wkd_publish, attach_public_key_default, keyvault_idle_min, retention_setup_completed_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, now(), now())
		ON CONFLICT (user_id) DO UPDATE SET auto_encrypt_inbound = $2, wkd_publish = $3, attach_public_key_default = $4, keyvault_idle_min = $5, retention_setup_completed_at = $6, updated_at = now()`,
		st.UserID, st.AutoEncryptInbound, st.WKDPublish, st.AttachPublicKeyDefault, st.KeyVaultIdleMin, st.RetentionSetupCompletedAt,
	)
	return err
}

// Consent maps each field to a bool (true = consented; false/absent = not consented).
type Consent map[string]bool

// DefaultConsent returns an all-false consent map (used for privacy posture checks).
func DefaultConsent() Consent {
	out := make(Consent, len(AllowedConsentFields))
	for _, f := range AllowedConsentFields {
		out[f] = false
	}
	return out
}

// FullConsent returns every known metadata field as allowed (per-field toggles were removed).
func FullConsent() Consent {
	out := make(Consent, len(AllowedConsentFields))
	for _, f := range AllowedConsentFields {
		out[f] = true
	}
	return out
}

// GetConsent returns FullConsent. Per-field server metadata opt-in is no longer user-configurable.
func (s *Store) GetConsent(ctx context.Context, userID uuid.UUID) (Consent, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("mailmeta: nil")
	}
	_ = ctx
	_ = userID
	return FullConsent(), nil
}

// SetConsent is a no-op kept for API compatibility; consent rows in the database are ignored.
func (s *Store) SetConsent(ctx context.Context, userID uuid.UUID, c Consent) error {
	if s == nil || s.pool == nil {
		return errors.New("mailmeta: nil")
	}
	_ = ctx
	_ = userID
	_ = c
	return nil
}

// IsValidConsentField reports whether f is in AllowedConsentFields.
func IsValidConsentField(f string) bool {
	for _, k := range AllowedConsentFields {
		if k == f {
			return true
		}
	}
	return false
}
