package httpserver

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"elvish/internal/mailmeta"
	"elvish/internal/pake"
)

type passwordChangeBody struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
	AccountKey      struct {
		WrappedSecretB64 string `json:"wrapped_secret_b64"`
		KDF              string `json:"kdf"`
		KDFSaltB64       string `json:"kdf_salt_b64"`
		KDFParamsJSON    string `json:"kdf_params_json"`
	} `json:"account_key"`
}

type passwordChangeSRPFinishBody struct {
	SessionID         string `json:"session_id"`
	ClientProofB64    string `json:"client_proof_b64"`
	NewSRPSaltB64     string `json:"new_srp_salt_b64"`
	NewSRPVerifierB64 string `json:"new_srp_verifier_b64"`
	NewSRPGroup       string `json:"new_srp_group"`
	NewSRPHash        string `json:"new_srp_hash"`
	AccountKey        struct {
		WrappedSecretB64 string `json:"wrapped_secret_b64"`
		KDF              string `json:"kdf"`
		KDFSaltB64       string `json:"kdf_salt_b64"`
		KDFParamsJSON    string `json:"kdf_params_json"`
	} `json:"account_key"`
}

// apiAuthPasswordChange updates the login password and account-key wrap blob (client re-derived KEK).
func (s *Server) apiAuthPasswordChange(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusGone, map[string]any{
		"error": "legacy plaintext password change is disabled; use /api/auth/password/begin and /api/auth/password/finish",
	})
}

// apiAuthPasswordSRPBegin starts a session-authenticated SRP proof for password change.
func (s *Server) apiAuthPasswordSRPBegin(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "auth subsystem not configured")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	var body srpBeginBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if !s.rejectFilledAuthHoneypot(w, body.Company) {
		return
	}
	clientPublic, err := decodeB64Field(body.ClientPublicB64, "client_public_b64")
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	fresh, err := s.store.UserAuthByID(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "password srp load user", err)
		return
	}
	if strings.TrimSpace(fresh.AuthMethod) != "srp" || len(fresh.SRPSalt) == 0 || len(fresh.SRPVerifier) == 0 {
		s.writeErr(w, http.StatusBadRequest, "browser auth is not SRP-enabled for this account")
		return
	}
	sess, err := pake.NewServerSession(UsernameFromCanonicalEmail(fresh.Email), fresh.SRPSalt, fresh.SRPVerifier, clientPublic)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid client public")
		return
	}
	chID, err := s.issueSRPChallenge(r.Context(), &srpChallenge{
		Purpose:             "password-change",
		UserID:              fresh.ID.String(),
		ExpectedClientProof: sess.ExpectedClientProof(),
		ServerProof:         sess.ServerProof(),
	})
	if err != nil {
		s.writeErrAPIInternal(w, "password srp challenge store", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"session_id":        chID,
		"salt_b64":          base64.StdEncoding.EncodeToString(fresh.SRPSalt),
		"server_public_b64": base64.StdEncoding.EncodeToString(sess.ServerPublic()),
		"group":             fresh.SRPGroup,
		"hash":              fresh.SRPHash,
	})
}

// apiAuthPasswordSRPFinish verifies the old-password SRP proof and stores fresh verifier data.
func (s *Server) apiAuthPasswordSRPFinish(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "auth subsystem not configured")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if !s.requireRecentMFA(w, r, u) {
		return
	}
	var body passwordChangeSRPFinishBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	ch, ok, err := s.takeSRPChallenge(r.Context(), strings.TrimSpace(body.SessionID), "password-change")
	if err != nil {
		s.writeErrAPIInternal(w, "password srp challenge load", err)
		return
	}
	if !ok || strings.TrimSpace(ch.UserID) != u.ID.String() {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	proof, err := decodeB64Field(body.ClientProofB64, "client_proof_b64")
	if err != nil || !bytes.Equal(proof, ch.ExpectedClientProof) {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	wrapped, err := base64.StdEncoding.DecodeString(body.AccountKey.WrappedSecretB64)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid wrapped_secret_b64")
		return
	}
	salt, err := base64.StdEncoding.DecodeString(body.AccountKey.KDFSaltB64)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid kdf_salt_b64")
		return
	}
	switch body.AccountKey.KDF {
	case "argon2id", "pbkdf2-sha256", "pbkdf2-sha256-600k":
	default:
		s.writeErr(w, http.StatusBadRequest, "unsupported kdf")
		return
	}
	newSRPSalt, err := decodeB64Field(body.NewSRPSaltB64, "new_srp_salt_b64")
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	newSRPVerifier, err := decodeB64Field(body.NewSRPVerifierB64, "new_srp_verifier_b64")
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if _, err := pake.ParseGroup(body.NewSRPGroup, body.NewSRPHash); err != nil {
		s.writeErr(w, http.StatusBadRequest, "unsupported srp parameters")
		return
	}
	if err := s.mailmeta.UpdateAccountKey(r.Context(), u.ID, wrapped, body.AccountKey.KDF, salt, []byte(body.AccountKey.KDFParamsJSON)); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusBadRequest, "account key not bootstrapped")
			return
		}
		s.writeErrAPIInternal(w, "account key update", err)
		return
	}
	if err := s.store.UpdateUserSRP(r.Context(), u.ID, newSRPSalt, newSRPVerifier, body.NewSRPGroup, body.NewSRPHash); err != nil {
		s.writeErrAPIInternal(w, "srp update", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"server_proof_b64": base64.StdEncoding.EncodeToString(ch.ServerProof),
	})
}

// apiAccountDelete removes the authenticated user and cascades PostgreSQL mail rows.
func (s *Server) apiAccountDelete(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusGone, map[string]any{
		"error": "legacy plaintext account deletion is disabled; use /api/auth/account-delete/begin and /api/auth/account-delete/finish",
	})
}

func (s *Server) apiAuthAccountDeleteSRPBegin(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "auth subsystem not configured")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	var body srpBeginBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if !s.rejectFilledAuthHoneypot(w, body.Company) {
		return
	}
	clientPublic, err := decodeB64Field(body.ClientPublicB64, "client_public_b64")
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	fresh, err := s.store.UserAuthByID(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "delete srp load user", err)
		return
	}
	if strings.TrimSpace(fresh.AuthMethod) != "srp" || len(fresh.SRPSalt) == 0 || len(fresh.SRPVerifier) == 0 {
		s.writeErr(w, http.StatusBadRequest, "browser auth is not SRP-enabled for this account")
		return
	}
	sess, err := pake.NewServerSession(UsernameFromCanonicalEmail(fresh.Email), fresh.SRPSalt, fresh.SRPVerifier, clientPublic)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid client public")
		return
	}
	chID, err := s.issueSRPChallenge(r.Context(), &srpChallenge{
		Purpose:             "account-delete",
		UserID:              fresh.ID.String(),
		ExpectedClientProof: sess.ExpectedClientProof(),
		ServerProof:         sess.ServerProof(),
	})
	if err != nil {
		s.writeErrAPIInternal(w, "delete srp challenge store", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"session_id":        chID,
		"salt_b64":          base64.StdEncoding.EncodeToString(fresh.SRPSalt),
		"server_public_b64": base64.StdEncoding.EncodeToString(sess.ServerPublic()),
		"group":             fresh.SRPGroup,
		"hash":              fresh.SRPHash,
	})
}

func (s *Server) apiAuthAccountDeleteSRPFinish(w http.ResponseWriter, r *http.Request) {
	s.apiAuthAccountDeleteNow(w, r)
}
