package httpserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/mailmeta"
	"elvish/internal/openpgp"
)

// handleIdentitiesAPI dispatches /api/v1/identities[/{fingerprint}[/default|/revoke]] routes.
//
// Identity private keys are PGP-encrypted to the account public key, so the
// server only stores opaque ciphertext. Listing returns those wrapped blobs
// alongside the public material so the client can unwrap with the unlocked
// account secret.
func (s *Server) handleIdentitiesAPI(w http.ResponseWriter, r *http.Request, p string) {
	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem not configured")
		return
	}
	rest := strings.TrimPrefix(p, "v1/identities")
	rest = strings.TrimPrefix(rest, "/")
	parts := strings.FieldsFunc(rest, func(c rune) bool { return c == '/' })
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	switch len(parts) {
	case 0:
		switch r.Method {
		case http.MethodGet:
			s.apiIdentitiesList(w, r, u.ID)
		case http.MethodPost:
			s.apiIdentitiesPost(w, r, u.ID)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case 1:
		if parts[0] == "visible-profile" {
			if r.Method != http.MethodGet {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			s.apiVisibleIdentityProfile(w, r, u.ID)
			return
		}
		fp, err := s.resolveIdentitySelector(r.Context(), u.ID, parts[0])
		if err != nil {
			if errors.Is(err, mailmeta.ErrNotFound) {
				s.writeErr(w, http.StatusNotFound, "identity not found")
				return
			}
			s.writeErrAPIInternal(w, "identity resolve", err)
			return
		}
		switch r.Method {
		case http.MethodDelete:
			if err := s.mailmeta.DeleteIdentity(r.Context(), u.ID, fp); err != nil {
				s.writeErrAPIInternal(w, "identity delete", err)
				return
			}
			s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		case http.MethodPatch:
			s.apiIdentityPatch(w, r, u.ID, fp)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case 2:
		fp, err := s.resolveIdentitySelector(r.Context(), u.ID, parts[0])
		if err != nil {
			if errors.Is(err, mailmeta.ErrNotFound) {
				s.writeErr(w, http.StatusNotFound, "identity not found")
				return
			}
			s.writeErrAPIInternal(w, "identity resolve", err)
			return
		}
		switch parts[1] {
		case "default":
			if r.Method != http.MethodPost {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			if err := s.mailmeta.SetDefaultIdentity(r.Context(), u.ID, fp); err != nil {
				if errors.Is(err, mailmeta.ErrNotFound) {
					s.writeErr(w, http.StatusNotFound, "identity not found")
					return
				}
				s.writeErrAPIInternal(w, "identity set default", err)
				return
			}
			s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		case "revoke":
			if r.Method != http.MethodPost {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			s.apiIdentityRevoke(w, r, u.ID, fp)
		default:
			http.NotFound(w, r)
		}
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) resolveIdentitySelector(ctx context.Context, userID uuid.UUID, selector string) (string, error) {
	selector = strings.TrimSpace(selector)
	if selector == "" {
		return "", mailmeta.ErrNotFound
	}
	if id, err := uuid.Parse(selector); err == nil {
		k, err := s.mailmeta.IdentityByID(ctx, userID, id)
		if err != nil {
			return "", err
		}
		return strings.ToUpper(strings.TrimSpace(k.Fingerprint)), nil
	}
	return strings.ToUpper(selector), nil
}

func (s *Server) apiIdentitiesList(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	keys, secrets, err := s.mailmeta.ListIdentityKeys(r.Context(), userID)
	if err != nil {
		s.writeErrAPIInternal(w, "identity list", err)
		return
	}
	secMap := make(map[string]mailmeta.IdentitySecret, len(secrets))
	for _, sec := range secrets {
		secMap[sec.Fingerprint] = sec
	}
	out := make([]map[string]any, 0, len(keys))
	for _, k := range keys {
		entry := map[string]any{
			"id":                   k.ID.String(),
			"email":                k.Email,
			"fingerprint":          k.Fingerprint,
			"key_id_long":          k.KeyIDLong,
			"armored_public":       k.ArmoredPublic,
			"primary_uid":          k.PrimaryUID,
			"algorithm":            k.Algorithm,
			"bits":                 k.Bits,
			"is_default":           k.IsDefault,
			"is_active":            k.IsActive,
			"avatar_data_url":      k.AvatarDataURL,
			"avatar_color":         mailmeta.NormalizeIdentityAvatarColor(k.AvatarColor, k.Email),
			"status_badge_enabled": k.StatusBadgeEnabled,
			"created_at":           k.CreatedAt,
			"type":                 identityWireType(k.Email, k),
		}
		if k.ExpiresAt != nil {
			entry["expires_at"] = k.ExpiresAt.UTC().Format(time.RFC3339Nano)
		}
		if k.RevokedAt != nil {
			entry["revoked_at"] = k.RevokedAt
		}
		if sec, ok := secMap[k.Fingerprint]; ok {
			entry["wrap_method"] = sec.WrapMethod
			entry["wrap_algorithm"] = sec.Algorithm
			entry["wrap_key_version"] = sec.KeyVersion
			entry["wrapped_secret_b64"] = base64.StdEncoding.EncodeToString(sec.WrappedSecret)
		}
		out = append(out, entry)
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"identities": out})
}

// identityWireType groups identities for the settings UI.
// Disposable addresses created in the browser use local parts like "d_<14 alnum>" when plus-address matching is not used.
func identityWireType(email string, k mailmeta.IdentityKey) string {
	if k.ExpiresAt != nil {
		return "disposable"
	}
	local, _, ok := strings.Cut(strings.ToLower(strings.TrimSpace(email)), "@")
	if ok && isDisposableGeneratedLocalPart(local) {
		return "disposable"
	}
	if ok && strings.Contains(local, "+") {
		return "plus"
	}
	if k.IsDefault {
		return "primary"
	}
	return "alias"
}

func isDisposableGeneratedLocalPart(local string) bool {
	// Mirrors static/mail/mail-settings.jsx disposable mint: d_<14 lowercase alphanumeric>
	if len(local) < 10 { // "d_" + at least 8 chars
		return false
	}
	if !strings.HasPrefix(local, "d_") {
		return false
	}
	for _, c := range local[2:] {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			continue
		}
		return false
	}
	return len(local[2:]) >= 8
}

func validatePlusTagLocal(tag string) error {
	tag = strings.ToLower(strings.TrimSpace(tag))
	if len(tag) < 1 || len(tag) > 30 {
		return errors.New("plus tag must be 1-30 characters")
	}
	for _, r := range tag {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			continue
		}
		return errors.New("plus tag may only contain letters, digits, hyphens, and underscores")
	}
	return nil
}

// validateIdentityMailboxEmailForUser enforces local-part and domain rules for newly created identities.
func (s *Server) validateIdentityMailboxEmailForUser(ctx context.Context, userID uuid.UUID, email string, expiresAt *time.Time) error {
	email = strings.TrimSpace(strings.ToLower(email))
	at := strings.LastIndex(email, "@")
	if at <= 0 || at == len(email)-1 {
		return errors.New("invalid mailbox address")
	}
	local := email[:at]
	domain := email[at+1:]
	platform := strings.ToLower(strings.TrimSpace(s.EffectiveMailDomain()))
	onPlatform := platform != "" && domain == platform
	customOK := false
	if !onPlatform {
		var err error
		customOK, err = s.mailmeta.UserMayUseDomainForMailbox(ctx, userID, domain)
		if err != nil {
			return err
		}
	}
	if !onPlatform && !customOK {
		return errors.New("domain not allowed for your mailbox (use your host domain or an active, MX-verified custom domain)")
	}
	isDisposable := expiresAt != nil && !expiresAt.IsZero()
	if isDisposable {
		if !isDisposableGeneratedLocalPart(local) {
			return errors.New("invalid disposable address format")
		}
		return nil
	}
	if strings.Contains(local, "+") {
		if strings.Count(local, "+") != 1 {
			return errors.New("plus address must contain exactly one \"+\"")
		}
		before, after, _ := strings.Cut(local, "+")
		if _, err := NormalizeAndValidateUsername(before); err != nil {
			return errors.New("invalid base local part before \"+\"")
		}
		if err := validatePlusTagLocal(after); err != nil {
			return err
		}
		return nil
	}
	if _, err := NormalizeAndValidateUsername(local); err != nil {
		return errors.New("invalid local part (use 3-64 letters, digits, dots, hyphens, or underscores)")
	}
	if isDisposableGeneratedLocalPart(local) {
		return errors.New("this local part is reserved for disposable addresses; set expires_at or choose a different address")
	}
	return nil
}

type identityPostBody struct {
	Email              string `json:"email"`
	ArmoredPublic      string `json:"armored_public"`
	PrimaryUID         string `json:"primary_uid"`
	Algorithm          string `json:"algorithm"`
	WrappedSecretB64   string `json:"wrapped_secret_b64"`
	IsDefault          bool   `json:"is_default"`
	ExpiresAt          string `json:"expires_at,omitempty"`
	AvatarDataURL      string `json:"avatar_data_url,omitempty"`
	AvatarColor        string `json:"avatar_color,omitempty"`
	StatusBadgeEnabled bool   `json:"status_badge_enabled,omitempty"`
}

func (s *Server) apiIdentitiesPost(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var body identityPostBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.Email == "" || body.ArmoredPublic == "" || body.WrappedSecretB64 == "" {
		s.writeErr(w, http.StatusBadRequest, "email, armored_public, wrapped_secret_b64 required")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	var expiresAt *time.Time
	if strings.TrimSpace(body.ExpiresAt) != "" {
		t, err := time.Parse(time.RFC3339, strings.TrimSpace(body.ExpiresAt))
		if err != nil {
			s.writeErr(w, http.StatusBadRequest, "invalid expires_at (RFC3339)")
			return
		}
		expiresAt = &t
	}
	if err := s.validateIdentityMailboxEmailForUser(r.Context(), userID, email, expiresAt); err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	reserved, err := s.store.IsDeletedAddressReserved(r.Context(), email)
	if err != nil {
		s.writeErrAPIInternal(w, "identity reservation check", err)
		return
	}
	if reserved {
		s.writeErr(w, http.StatusConflict, "address is reserved after account deletion")
		return
	}
	taken, err := s.mailmeta.MailboxAddressGloballyTaken(r.Context(), userID, email)
	if err != nil {
		s.writeErrAPIInternal(w, "identity address availability", err)
		return
	}
	if taken {
		s.writeErr(w, http.StatusConflict, "address already in use")
		return
	}
	wrapped, err := base64.StdEncoding.DecodeString(body.WrappedSecretB64)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid wrapped_secret_b64")
		return
	}
	meta, err := openpgp.ParseArmoredPublicKeyMeta(body.ArmoredPublic)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid armored_public")
		return
	}
	ik := mailmeta.IdentityKey{
		UserID: userID, Email: email,
		Fingerprint: meta.Fingerprint16, KeyIDLong: meta.FullKeyID,
		ArmoredPublic: body.ArmoredPublic, PrimaryUID: body.PrimaryUID,
		Algorithm: identityAlgorithmOrDefault(body.Algorithm), Bits: 256, IsActive: true, IsDefault: body.IsDefault,
		AvatarColor:        mailmeta.NormalizeIdentityAvatarColor(body.AvatarColor, email),
		StatusBadgeEnabled: body.StatusBadgeEnabled,
	}
	avatarDataURL, err := normalizeAvatarDataURL(body.AvatarDataURL)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	ik.AvatarDataURL = avatarDataURL
	if expiresAt != nil {
		ik.ExpiresAt = expiresAt
	}
	if err := s.mailmeta.InsertIdentityKey(r.Context(), ik, wrapped); err != nil {
		s.writeErrAPIInternal(w, "identity insert", err)
		return
	}
	s.writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "fingerprint": meta.Fingerprint16})
}

type identityPatchBody struct {
	AvatarDataURL      *string `json:"avatar_data_url,omitempty"`
	AvatarColor        *string `json:"avatar_color,omitempty"`
	StatusBadgeEnabled *bool   `json:"status_badge_enabled,omitempty"`
}

func (s *Server) apiIdentityPatch(w http.ResponseWriter, r *http.Request, userID uuid.UUID, fp string) {
	var body identityPatchBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.AvatarDataURL == nil && body.AvatarColor == nil && body.StatusBadgeEnabled == nil {
		s.writeErr(w, http.StatusBadRequest, "at least one profile field is required")
		return
	}
	current, err := s.mailmeta.IdentityByFingerprint(r.Context(), userID, fp)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "identity not found")
			return
		}
		s.writeErrAPIInternal(w, "identity load", err)
		return
	}
	avatarDataURL := current.AvatarDataURL
	if body.AvatarDataURL != nil {
		normalized, err := normalizeAvatarDataURL(*body.AvatarDataURL)
		if err != nil {
			s.writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		avatarDataURL = normalized
	}
	avatarColor := current.AvatarColor
	if body.AvatarColor != nil {
		avatarColor = mailmeta.NormalizeIdentityAvatarColor(*body.AvatarColor, current.Email)
	}
	statusBadgeEnabled := current.StatusBadgeEnabled
	if body.StatusBadgeEnabled != nil {
		statusBadgeEnabled = *body.StatusBadgeEnabled
	}
	if err := s.mailmeta.UpdateIdentityProfile(r.Context(), userID, fp, avatarDataURL, avatarColor, statusBadgeEnabled); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "identity not found")
			return
		}
		s.writeErrAPIInternal(w, "identity profile update", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func normalizeAvatarDataURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	lower := strings.ToLower(raw)
	if !strings.HasPrefix(lower, "data:image/") {
		return "", errors.New("avatar_data_url must be a data:image URL")
	}
	header, payload, ok := strings.Cut(raw, ",")
	if !ok || strings.TrimSpace(payload) == "" {
		return "", errors.New("avatar_data_url is malformed")
	}
	headerLower := strings.ToLower(header)
	switch {
	case strings.HasPrefix(headerLower, "data:image/png;base64"),
		strings.HasPrefix(headerLower, "data:image/jpeg;base64"),
		strings.HasPrefix(headerLower, "data:image/gif;base64"),
		strings.HasPrefix(headerLower, "data:image/webp;base64"):
	default:
		return "", errors.New("avatar_data_url must be png, jpeg, gif, or webp")
	}
	decoded, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return "", errors.New("avatar_data_url base64 is invalid")
	}
	if len(decoded) == 0 {
		return "", errors.New("avatar_data_url image is empty")
	}
	if len(decoded) > 256*1024 {
		return "", errors.New("avatar_data_url image exceeds 256 KB")
	}
	return header + "," + payload, nil
}

func (s *Server) apiVisibleIdentityProfile(w http.ResponseWriter, r *http.Request, viewerUserID uuid.UUID) {
	email := strings.TrimSpace(r.URL.Query().Get("email"))
	if email == "" {
		s.writeErr(w, http.StatusBadRequest, "email required")
		return
	}
	profile, err := s.mailmeta.LookupVisibleIdentityProfile(r.Context(), viewerUserID, email)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeJSON(w, http.StatusOK, map[string]any{"visible": false})
			return
		}
		s.writeErrAPIInternal(w, "visible identity profile", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"visible":              true,
		"email":                profile.Email,
		"fingerprint":          profile.Fingerprint,
		"primary_uid":          profile.PrimaryUID,
		"avatar_data_url":      profile.AvatarDataURL,
		"avatar_color":         profile.AvatarColor,
		"status_badge_enabled": profile.StatusBadgeEnabled,
		"status_badge_visible": profile.StatusBadgeVisible,
	})
}

func identityAlgorithmOrDefault(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return "openpgp-ecc-curve25519"
	}
	return v
}

type identityRevokeBody struct {
	RevocationCertificate string `json:"revocation_certificate"`
}

func (s *Server) apiIdentityRevoke(w http.ResponseWriter, r *http.Request, userID uuid.UUID, fp string) {
	var body identityRevokeBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if strings.TrimSpace(body.RevocationCertificate) == "" {
		s.writeErr(w, http.StatusBadRequest, "revocation_certificate required")
		return
	}
	if err := s.mailmeta.RevokeIdentity(r.Context(), userID, fp, body.RevocationCertificate); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "identity not found")
			return
		}
		s.writeErrAPIInternal(w, "identity revoke", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
