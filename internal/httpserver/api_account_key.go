package httpserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"elvish/internal/mailmeta"
	"elvish/internal/openpgp"
)

var errReservedDeletedAddress = errors.New("reserved after account deletion")

// handleAccountKeyAPI dispatches /api/v1/account-key/{bootstrap,me} routes.
//
// All key material is opaque to the server: the wrapped account secret is
// AES-256-GCM(KEK, account_priv) where KEK = Argon2id|PBKDF2(password, salt).
// The server only stores the wrapped blob + KDF parameters + armored public.
func (s *Server) handleAccountKeyAPI(w http.ResponseWriter, r *http.Request, p string) {
	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem not configured")
		return
	}
	rest := strings.TrimPrefix(p, "v1/account-key")
	rest = strings.TrimPrefix(rest, "/")
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	switch rest {
	case "bootstrap":
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		s.apiAccountKeyBootstrap(w, r, u.ID)
	case "me":
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		s.apiAccountKeyMe(w, r, u.ID)
	default:
		http.NotFound(w, r)
	}
}

// accountKeyBootstrap is the JSON body uploaded by static/auth/keygen.js.
type accountKeyBootstrap struct {
	ArmoredPublic    string                  `json:"armored_public"`
	Algorithm        string                  `json:"algorithm"`
	KeyVersion       int                     `json:"key_version"`
	WrappedSecretB64 string                  `json:"wrapped_secret_b64"`
	KDF              string                  `json:"kdf"`
	KDFSaltB64       string                  `json:"kdf_salt_b64"`
	KDFParamsJSON    string                  `json:"kdf_params_json"`
	Identities       []bootstrapIdentityBody `json:"identities"`
}

type bootstrapIdentityBody struct {
	Email            string `json:"email"`
	ArmoredPublic    string `json:"armored_public"`
	PrimaryUID       string `json:"primary_uid"`
	WrappedSecretB64 string `json:"wrapped_secret_b64"`
	IsDefault        bool   `json:"is_default"`
}

type parsedBootstrapIdentity struct {
	key     mailmeta.IdentityKey
	wrapped []byte
}

func (s *Server) apiAccountKeyBootstrap(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var body accountKeyBootstrap
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	accountKey, identities, err := parseAccountKeyBootstrap(userID, body)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.ensureBootstrapIdentitiesAvailable(r.Context(), identities); err != nil {
		if errors.Is(err, errReservedDeletedAddress) {
			s.writeErr(w, http.StatusConflict, "identity address is reserved after account deletion")
			return
		}
		s.writeErrAPIInternal(w, "account key bootstrap reservation check", err)
		return
	}
	if err := s.storeParsedAccountBootstrap(r.Context(), accountKey, identities); err != nil {
		s.writeErrAPIInternal(w, "account key bootstrap", err)
		return
	}
	s.writeJSON(w, http.StatusCreated, map[string]any{
		"ok":          true,
		"fingerprint": accountKey.Fingerprint,
		"identities":  len(identities),
	})
}

func (s *Server) apiAccountKeyMe(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	k, err := s.mailmeta.GetAccountKey(r.Context(), userID)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeJSON(w, http.StatusOK, map[string]any{"bootstrapped": false})
			return
		}
		s.writeErrAPIInternal(w, "account key get", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"bootstrapped":       true,
		"armored_public":     k.ArmoredPublic,
		"algorithm":          k.Algorithm,
		"key_version":        k.KeyVersion,
		"fingerprint":        k.Fingerprint,
		"key_id_long":        k.KeyIDLong,
		"wrapped_secret_b64": base64.StdEncoding.EncodeToString(k.WrappedSecret),
		"kdf":                k.KDF,
		"kdf_salt_b64":       base64.StdEncoding.EncodeToString(k.KDFSalt),
		"kdf_params_json":    string(k.KDFParams),
		"created_at":         k.CreatedAt,
		"updated_at":         k.UpdatedAt,
	})
}

func defaultAccountKeyAlgorithm(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return "openpgp-ecc-curve25519"
	}
	return v
}

func normalizedKeyVersion(v int) int {
	if v <= 0 {
		return 1
	}
	return v
}

func parseAccountKeyBootstrap(userID uuid.UUID, body accountKeyBootstrap) (mailmeta.AccountKey, []parsedBootstrapIdentity, error) {
	if body.ArmoredPublic == "" || body.WrappedSecretB64 == "" || body.KDF == "" || body.KDFSaltB64 == "" {
		return mailmeta.AccountKey{}, nil, errors.New("armored_public, wrapped_secret_b64, kdf, kdf_salt_b64 required")
	}
	switch body.KDF {
	case "argon2id", "pbkdf2-sha256", "pbkdf2-sha256-600k":
	default:
		return mailmeta.AccountKey{}, nil, errors.New("kdf must be argon2id or pbkdf2-sha256[-600k]")
	}
	wrapped, err := base64.StdEncoding.DecodeString(body.WrappedSecretB64)
	if err != nil {
		return mailmeta.AccountKey{}, nil, errors.New("invalid wrapped_secret_b64")
	}
	salt, err := base64.StdEncoding.DecodeString(body.KDFSaltB64)
	if err != nil {
		return mailmeta.AccountKey{}, nil, errors.New("invalid kdf_salt_b64")
	}
	if len(salt) < 16 {
		return mailmeta.AccountKey{}, nil, errors.New("kdf_salt_b64 must be at least 16 bytes")
	}
	meta, err := openpgp.ParseArmoredPublicKeyMeta(body.ArmoredPublic)
	if err != nil {
		return mailmeta.AccountKey{}, nil, errors.New("invalid armored_public")
	}
	accountKey := mailmeta.AccountKey{
		UserID:        userID,
		Fingerprint:   meta.Fingerprint16,
		KeyIDLong:     meta.FullKeyID,
		ArmoredPublic: body.ArmoredPublic,
		Algorithm:     defaultAccountKeyAlgorithm(body.Algorithm),
		KeyVersion:    normalizedKeyVersion(body.KeyVersion),
		WrappedSecret: wrapped,
		KDF:           body.KDF,
		KDFSalt:       salt,
		KDFParams:     []byte(body.KDFParamsJSON),
	}
	identities := make([]parsedBootstrapIdentity, 0, len(body.Identities))
	for i, id := range body.Identities {
		if id.Email == "" || id.ArmoredPublic == "" || id.WrappedSecretB64 == "" {
			return mailmeta.AccountKey{}, nil, errors.New("identity entry missing fields")
		}
		idMeta, err := openpgp.ParseArmoredPublicKeyMeta(id.ArmoredPublic)
		if err != nil {
			return mailmeta.AccountKey{}, nil, errors.New("invalid identity armored_public")
		}
		idWrapped, err := base64.StdEncoding.DecodeString(id.WrappedSecretB64)
		if err != nil {
			return mailmeta.AccountKey{}, nil, errors.New("invalid identity wrapped_secret_b64")
		}
		ik := mailmeta.IdentityKey{
			UserID:        userID,
			Email:         strings.ToLower(strings.TrimSpace(id.Email)),
			Fingerprint:   idMeta.Fingerprint16,
			KeyIDLong:     idMeta.FullKeyID,
			ArmoredPublic: id.ArmoredPublic,
			PrimaryUID:    id.PrimaryUID,
			Algorithm:     "ecc-curve25519",
			Bits:          256,
			IsActive:      true,
			IsDefault:     id.IsDefault || i == 0,
			AvatarColor:   mailmeta.NormalizeIdentityAvatarColor("", id.Email),
		}
		identities = append(identities, parsedBootstrapIdentity{
			key:     ik,
			wrapped: idWrapped,
		})
	}
	if len(identities) == 0 {
		return mailmeta.AccountKey{}, nil, fmt.Errorf("at least one identity is required")
	}
	return accountKey, identities, nil
}

func (s *Server) ensureBootstrapIdentitiesAvailable(ctx context.Context, identities []parsedBootstrapIdentity) error {
	if s == nil || s.store == nil {
		return errors.New("store: nil")
	}
	for _, identity := range identities {
		reserved, err := s.store.IsDeletedAddressReserved(ctx, identity.key.Email)
		if err != nil {
			return err
		}
		if reserved {
			return errReservedDeletedAddress
		}
	}
	return nil
}

func (s *Server) storeParsedAccountBootstrap(ctx context.Context, accountKey mailmeta.AccountKey, identities []parsedBootstrapIdentity) error {
	if s.mailmeta == nil || s.mailmeta.Pool() == nil {
		return errors.New("mailmeta: nil")
	}
	tx, err := s.mailmeta.Pool().Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `INSERT INTO user_account_keys
		(user_id, fingerprint, key_id_long, armored_public, algorithm, key_version, wrapped_secret, kdf, kdf_salt, kdf_params, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())`,
		accountKey.UserID, accountKey.Fingerprint, accountKey.KeyIDLong, accountKey.ArmoredPublic, accountKey.Algorithm, accountKey.KeyVersion,
		accountKey.WrappedSecret, accountKey.KDF, accountKey.KDFSalt, accountKey.KDFParams,
	); err != nil {
		return err
	}
	for _, id := range identities {
		if id.key.ID == uuid.Nil {
			id.key.ID = uuid.New()
		}
		if _, err := tx.Exec(ctx, `INSERT INTO user_identity_keys
			(id, user_id, email, fingerprint, key_id_long, armored_public, primary_uid, algorithm, bits, is_default, is_active, expires_at, revoked_at, revocation_certificate, created_at, avatar_data_url, avatar_color, status_badge_enabled)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),$15,$16,$17)`,
			id.key.ID, id.key.UserID, id.key.Email, id.key.Fingerprint, id.key.KeyIDLong, id.key.ArmoredPublic, id.key.PrimaryUID, id.key.Algorithm, id.key.Bits,
			id.key.IsDefault, id.key.IsActive, id.key.ExpiresAt, id.key.RevokedAt, id.key.RevocationCertificate, strings.TrimSpace(id.key.AvatarDataURL), mailmeta.NormalizeIdentityAvatarColor(id.key.AvatarColor, id.key.Email), id.key.StatusBadgeEnabled,
		); err != nil {
			return err
		}
		alg := strings.TrimSpace(id.key.Algorithm)
		if alg == "" {
			alg = "openpgp-ecc-curve25519"
		}
		if _, err := tx.Exec(ctx, `INSERT INTO identity_secret_blobs (user_id, fingerprint, wrap_method, algorithm, key_version, wrapped_secret, created_at)
			VALUES ($1, $2, 'account-key', $3, $4, $5, now())`,
			id.key.UserID, id.key.Fingerprint, alg, 1, id.wrapped,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
