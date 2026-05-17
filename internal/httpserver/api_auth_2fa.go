package httpserver

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/google/uuid"

	mfautil "elvish/internal/mfa"
	"elvish/internal/models"
	"elvish/internal/store"
)

type totpBeginBody struct {
	Label string `json:"label"`
}

type totpConfirmBody struct {
	SetupID string `json:"setup_id"`
	Code    string `json:"code"`
}

type codeVerifyBody struct {
	ChallengeID string `json:"challenge_id,omitempty"`
	Code        string `json:"code"`
}

type webAuthnFinishBody struct {
	ChallengeID string          `json:"challenge_id"`
	Credential  json.RawMessage `json:"credential"`
	Label       string          `json:"label,omitempty"`
}

func (s *Server) handleAuth2FAAPI(w http.ResponseWriter, r *http.Request, p string) {
	switch {
	case p == "" && r.Method == http.MethodGet:
		s.apiAuth2FAGet(w, r)
	case p == "/totp/begin" && r.Method == http.MethodPost:
		s.apiAuth2FATOTPBegin(w, r)
	case p == "/totp/confirm" && r.Method == http.MethodPost:
		s.apiAuth2FATOTPConfirm(w, r)
	case p == "/verify/totp" && r.Method == http.MethodPost:
		s.apiAuth2FAVerifyTOTP(w, r)
	case p == "/login/totp" && r.Method == http.MethodPost:
		s.apiAuth2FALoginTOTP(w, r)
	case p == "/verify/recovery" && r.Method == http.MethodPost:
		s.apiAuth2FAVerifyRecovery(w, r)
	case p == "/login/recovery" && r.Method == http.MethodPost:
		s.apiAuth2FALoginRecovery(w, r)
	case p == "/recovery/regenerate" && r.Method == http.MethodPost:
		s.apiAuth2FARecoveryRegenerate(w, r)
	case p == "/webauthn/register/begin" && r.Method == http.MethodPost:
		s.apiAuth2FAWebAuthnRegisterBegin(w, r)
	case p == "/webauthn/register/finish" && r.Method == http.MethodPost:
		s.apiAuth2FAWebAuthnRegisterFinish(w, r)
	case p == "/login/webauthn/begin" && r.Method == http.MethodPost:
		s.apiAuth2FALoginWebAuthnBegin(w, r)
	case p == "/login/webauthn/finish" && r.Method == http.MethodPost:
		s.apiAuth2FALoginWebAuthnFinish(w, r)
	case p == "/verify/webauthn/begin" && r.Method == http.MethodPost:
		s.apiAuth2FAVerifyWebAuthnBegin(w, r)
	case p == "/verify/webauthn/finish" && r.Method == http.MethodPost:
		s.apiAuth2FAVerifyWebAuthnFinish(w, r)
	case strings.HasPrefix(p, "/totp/") && r.Method == http.MethodDelete:
		s.apiAuth2FATOTPDelete(w, r, strings.TrimPrefix(p, "/totp/"))
	case strings.HasPrefix(p, "/webauthn/") && r.Method == http.MethodDelete:
		s.apiAuth2FAWebAuthnDelete(w, r, strings.TrimPrefix(p, "/webauthn/"))
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) apiAuth2FAGet(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	status, err := s.loadMFAStatus(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "2fa status", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":  true,
		"mfa": mfaFactorSummary(status),
	})
}

func (s *Server) apiAuth2FATOTPBegin(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	status, err := s.loadMFAStatus(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "2fa status", err)
		return
	}
	if status.Settings != nil && status.Settings.Enabled && !s.requireRecentMFA(w, r, u) {
		return
	}
	var body totpBeginBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	key, err := mfautil.NewTOTPKey("Elvish", u.Email)
	if err != nil {
		s.writeErrAPIInternal(w, "totp key", err)
		return
	}
	qrURL, err := mfautil.QRPNGDataURL(key.URL())
	if err != nil {
		s.writeErrAPIInternal(w, "totp qr", err)
		return
	}
	setupID, err := s.sessions.SaveTemporaryJSON(r.Context(), mfaTempTOTPSetup, pendingTOTPSetupState{
		UserID:      u.ID.String(),
		Label:       strings.TrimSpace(body.Label),
		Secret:      key.Secret(),
		Issuer:      "Elvish",
		AccountName: u.Email,
		CreatedAt:   time.Now().UTC(),
	}, mfaPendingChallengeTTL)
	if err != nil {
		s.writeErrAPIInternal(w, "totp temp", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"setup_id":    setupID,
		"secret":      key.Secret(),
		"otpauth_url": key.URL(),
		"qr_png_url":  qrURL,
	})
}

func (s *Server) apiAuth2FATOTPConfirm(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, pay, _, ok := s.mustSessionContext(w, r)
	if !ok {
		return
	}
	var body totpConfirmBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	var setup pendingTOTPSetupState
	okState, err := s.sessions.LoadTemporaryJSON(r.Context(), mfaTempTOTPSetup, strings.TrimSpace(body.SetupID), &setup)
	if err != nil {
		s.writeErrAPIInternal(w, "totp setup load", err)
		return
	}
	if !okState || setup.UserID != u.ID.String() {
		s.writeErr(w, http.StatusBadRequest, "invalid setup session")
		return
	}
	if !mfautil.ValidateTOTP(body.Code, setup.Secret) {
		s.writeErr(w, http.StatusUnauthorized, "invalid authenticator code")
		return
	}
	svc, err := s.mfaService()
	if err != nil {
		s.writeErr(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	secretEncrypted, err := svc.Encrypt([]byte(setup.Secret))
	if err != nil {
		s.writeErrAPIInternal(w, "totp encrypt", err)
		return
	}
	status, err := s.loadMFAStatus(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "2fa status", err)
		return
	}
	now := time.Now().UTC()
	label := setup.Label
	if label == "" {
		label = "Authenticator app"
	}
	factor, err := s.store.CreateTOTPFactor(r.Context(), models.TOTPFactor{
		UserID:          u.ID,
		Label:           label,
		SecretEncrypted: secretEncrypted,
		SecretVersion:   1,
		Issuer:          setup.Issuer,
		AccountName:     setup.AccountName,
		Algorithm:       "SHA1",
		Digits:          6,
		PeriodSeconds:   30,
		VerifiedAt:      &now,
	})
	if err != nil {
		s.writeErrAPIInternal(w, "totp save", err)
		return
	}
	if err := s.sessions.DeleteTemporaryJSON(r.Context(), mfaTempTOTPSetup, strings.TrimSpace(body.SetupID)); err != nil {
		s.writeErrAPIInternal(w, "totp temp cleanup", err)
		return
	}
	var recoveryCodes []string
	if status.Settings == nil || !status.Settings.Enabled {
		recoveryCodes, err = mfautil.GenerateRecoveryCodes(8)
		if err != nil {
			s.writeErrAPIInternal(w, "recovery codes", err)
			return
		}
		hashes := make([]string, 0, len(recoveryCodes))
		for _, code := range recoveryCodes {
			hashes = append(hashes, mfautil.HashRecoveryCode(code))
		}
		if err := s.store.ReplaceRecoveryCodes(r.Context(), u.ID, hashes); err != nil {
			s.writeErrAPIInternal(w, "recovery save", err)
			return
		}
	}
	if err := s.syncMFASettings(r.Context(), u.ID, "totp"); err != nil {
		s.writeErrAPIInternal(w, "2fa settings", err)
		return
	}
	if s.sessions != nil {
		_ = s.sessions.DeleteUserSessions(r.Context(), u.ID)
	}
	if err := s.issueLoginSession(w, r.Context(), u, appendMFAMethod(pay.AMR, "totp"), true); err != nil {
		s.writeErrAPIInternal(w, "2fa session rotate", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"factor_id":      factor.ID.String(),
		"recovery_codes": recoveryCodes,
	})
}

func (s *Server) apiAuth2FAVerifyTOTP(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, pay, token, ok := s.mustSessionContext(w, r)
	if !ok {
		return
	}
	var body codeVerifyBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if _, err := s.verifyTOTPCode(r.Context(), u.ID, body.Code); err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid authenticator code")
		return
	}
	if err := s.markSessionMFAVerified(r.Context(), token, pay); err != nil {
		s.writeErrAPIInternal(w, "2fa verify session", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) apiAuth2FALoginTOTP(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	var body codeVerifyBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	var state pendingLoginState
	okState, err := s.sessions.LoadTemporaryJSON(r.Context(), mfaTempPendingLogin, strings.TrimSpace(body.ChallengeID), &state)
	if err != nil {
		s.writeErrAPIInternal(w, "pending login load", err)
		return
	}
	if !okState {
		s.writeErr(w, http.StatusUnauthorized, "login challenge expired")
		return
	}
	userID, err := uuid.Parse(strings.TrimSpace(state.UserID))
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid login challenge")
		return
	}
	u, err := s.store.UserByID(r.Context(), userID)
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid login challenge")
		return
	}
	if _, err := s.verifyTOTPCode(r.Context(), u.ID, body.Code); err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid authenticator code")
		return
	}
	_ = s.sessions.DeleteTemporaryJSON(r.Context(), mfaTempPendingLogin, strings.TrimSpace(body.ChallengeID))
	if err := s.issueLoginSession(w, r.Context(), u, appendMFAMethod(mfaMethodFromFirstFactor(state.FirstFactor), "totp"), true); err != nil {
		s.writeErrAPIInternal(w, "login session", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "user": userAuthJSON(u)})
}

func (s *Server) apiAuth2FAVerifyRecovery(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, pay, token, ok := s.mustSessionContext(w, r)
	if !ok {
		return
	}
	var body codeVerifyBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := s.consumeRecoveryCode(r.Context(), u.ID, body.Code); err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid recovery code")
		return
	}
	if err := s.markSessionMFAVerified(r.Context(), token, pay); err != nil {
		s.writeErrAPIInternal(w, "2fa verify session", err)
		return
	}
	remaining, _ := s.store.CountUnusedRecoveryCodes(r.Context(), u.ID)
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "recovery_remaining": remaining})
}

func (s *Server) apiAuth2FALoginRecovery(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	var body codeVerifyBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	var state pendingLoginState
	okState, err := s.sessions.LoadTemporaryJSON(r.Context(), mfaTempPendingLogin, strings.TrimSpace(body.ChallengeID), &state)
	if err != nil {
		s.writeErrAPIInternal(w, "pending login load", err)
		return
	}
	if !okState {
		s.writeErr(w, http.StatusUnauthorized, "login challenge expired")
		return
	}
	userID, err := uuid.Parse(strings.TrimSpace(state.UserID))
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid login challenge")
		return
	}
	u, err := s.store.UserByID(r.Context(), userID)
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid login challenge")
		return
	}
	if err := s.consumeRecoveryCode(r.Context(), u.ID, body.Code); err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid recovery code")
		return
	}
	_ = s.sessions.DeleteTemporaryJSON(r.Context(), mfaTempPendingLogin, strings.TrimSpace(body.ChallengeID))
	if err := s.issueLoginSession(w, r.Context(), u, appendMFAMethod(mfaMethodFromFirstFactor(state.FirstFactor), "recovery"), true); err != nil {
		s.writeErrAPIInternal(w, "login session", err)
		return
	}
	remaining, _ := s.store.CountUnusedRecoveryCodes(r.Context(), u.ID)
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "user": userAuthJSON(u), "recovery_remaining": remaining})
}

func (s *Server) apiAuth2FARecoveryRegenerate(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, pay, _, ok := s.mustSessionContext(w, r)
	if !ok {
		return
	}
	if !s.requireRecentMFA(w, r, u) {
		return
	}
	codes, err := mfautil.GenerateRecoveryCodes(8)
	if err != nil {
		s.writeErrAPIInternal(w, "recovery codes", err)
		return
	}
	hashes := make([]string, 0, len(codes))
	for _, code := range codes {
		hashes = append(hashes, mfautil.HashRecoveryCode(code))
	}
	if err := s.store.ReplaceRecoveryCodes(r.Context(), u.ID, hashes); err != nil {
		s.writeErrAPIInternal(w, "recovery save", err)
		return
	}
	if s.sessions != nil {
		_ = s.sessions.DeleteUserSessions(r.Context(), u.ID)
	}
	if err := s.issueLoginSession(w, r.Context(), u, pay.AMR, true); err != nil {
		s.writeErrAPIInternal(w, "recovery session rotate", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "recovery_codes": codes})
}

func (s *Server) apiAuth2FAWebAuthnRegisterBegin(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, _, _, ok := s.mustSessionContext(w, r)
	if !ok {
		return
	}
	status, err := s.loadMFAStatus(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "2fa status", err)
		return
	}
	if status.Settings != nil && status.Settings.Enabled && !s.requireRecentMFA(w, r, u) {
		return
	}
	_, waUser, err := s.loadWebAuthnUser(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn user", err)
		return
	}
	wa, err := s.webauthnForRequest(r)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn config", err)
		return
	}
	options, sessionData, err := wa.BeginRegistration(waUser)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn begin registration", err)
		return
	}
	challengeID, err := s.sessions.SaveTemporaryJSON(r.Context(), mfaTempWebAuthnRegister, pendingWebAuthnState{
		UserID:      u.ID.String(),
		SessionData: *sessionData,
		CreatedAt:   time.Now().UTC(),
	}, mfaPendingChallengeTTL)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn temp", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "challenge_id": challengeID, "options": options})
}

func (s *Server) apiAuth2FAWebAuthnRegisterFinish(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, pay, _, ok := s.mustSessionContext(w, r)
	if !ok {
		return
	}
	var body webAuthnFinishBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	var state pendingWebAuthnState
	okState, err := s.sessions.LoadTemporaryJSON(r.Context(), mfaTempWebAuthnRegister, strings.TrimSpace(body.ChallengeID), &state)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn temp load", err)
		return
	}
	if !okState || state.UserID != u.ID.String() {
		s.writeErr(w, http.StatusBadRequest, "invalid webauthn challenge")
		return
	}
	status, err := s.loadMFAStatus(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "2fa status", err)
		return
	}
	_, waUser, err := s.loadWebAuthnUser(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn user", err)
		return
	}
	wa, err := s.webauthnForRequest(r)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn config", err)
		return
	}
	credential, err := wa.FinishRegistration(waUser, state.SessionData, webauthnRequestWithCredential(r, body.Credential))
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "security key registration failed")
		return
	}
	recordJSON, err := json.Marshal(credential)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn marshal", err)
		return
	}
	label := strings.TrimSpace(body.Label)
	if label == "" {
		label = "Security key"
	}
	if _, err := s.store.CreateWebAuthnCredential(r.Context(), models.WebAuthnCredential{
		UserID:         u.ID,
		Label:          label,
		CredentialID:   credential.ID,
		CredentialJSON: recordJSON,
		AAGUID:         hex.EncodeToString(credential.Authenticator.AAGUID),
		SignCount:      int64(credential.Authenticator.SignCount),
		Transports:     transportStrings(credential.Transport),
		Attachment:     string(credential.Authenticator.Attachment),
		Discoverable:   false,
		UserVerified:   credential.Flags.UserVerified,
		BackupEligible: credential.Flags.BackupEligible,
		BackupState:    credential.Flags.BackupState,
	}); err != nil {
		s.writeErrAPIInternal(w, "webauthn save", err)
		return
	}
	_ = s.sessions.DeleteTemporaryJSON(r.Context(), mfaTempWebAuthnRegister, strings.TrimSpace(body.ChallengeID))
	var recoveryCodes []string
	if status.Settings == nil || !status.Settings.Enabled {
		recoveryCodes, err = mfautil.GenerateRecoveryCodes(8)
		if err != nil {
			s.writeErrAPIInternal(w, "recovery codes", err)
			return
		}
		hashes := make([]string, 0, len(recoveryCodes))
		for _, code := range recoveryCodes {
			hashes = append(hashes, mfautil.HashRecoveryCode(code))
		}
		if err := s.store.ReplaceRecoveryCodes(r.Context(), u.ID, hashes); err != nil {
			s.writeErrAPIInternal(w, "recovery save", err)
			return
		}
	}
	if err := s.syncMFASettings(r.Context(), u.ID, "webauthn"); err != nil {
		s.writeErrAPIInternal(w, "2fa settings", err)
		return
	}
	if s.sessions != nil {
		_ = s.sessions.DeleteUserSessions(r.Context(), u.ID)
	}
	if err := s.issueLoginSession(w, r.Context(), u, appendMFAMethod(pay.AMR, "webauthn"), true); err != nil {
		s.writeErrAPIInternal(w, "webauthn session rotate", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "recovery_codes": recoveryCodes})
}

func (s *Server) apiAuth2FALoginWebAuthnBegin(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	var body codeVerifyBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	var loginState pendingLoginState
	okState, err := s.sessions.LoadTemporaryJSON(r.Context(), mfaTempPendingLogin, strings.TrimSpace(body.ChallengeID), &loginState)
	if err != nil {
		s.writeErrAPIInternal(w, "pending login load", err)
		return
	}
	if !okState {
		s.writeErr(w, http.StatusUnauthorized, "login challenge expired")
		return
	}
	userID, err := uuid.Parse(strings.TrimSpace(loginState.UserID))
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid login challenge")
		return
	}
	_, waUser, err := s.loadWebAuthnUser(r.Context(), userID)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn user", err)
		return
	}
	wa, err := s.webauthnForRequest(r)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn config", err)
		return
	}
	options, sessionData, err := wa.BeginLogin(waUser)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn begin login", err)
		return
	}
	challengeID, err := s.sessions.SaveTemporaryJSON(r.Context(), mfaTempWebAuthnLogin, pendingWebAuthnState{
		UserID:       loginState.UserID,
		LoginStateID: strings.TrimSpace(body.ChallengeID),
		SessionData:  *sessionData,
		CreatedAt:    time.Now().UTC(),
	}, mfaPendingChallengeTTL)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn temp", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "challenge_id": challengeID, "options": options})
}

func (s *Server) apiAuth2FALoginWebAuthnFinish(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	var body webAuthnFinishBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	var state pendingWebAuthnState
	okState, err := s.sessions.LoadTemporaryJSON(r.Context(), mfaTempWebAuthnLogin, strings.TrimSpace(body.ChallengeID), &state)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn temp load", err)
		return
	}
	if !okState {
		s.writeErr(w, http.StatusUnauthorized, "security key challenge expired")
		return
	}
	var loginState pendingLoginState
	okLogin, err := s.sessions.LoadTemporaryJSON(r.Context(), mfaTempPendingLogin, strings.TrimSpace(state.LoginStateID), &loginState)
	if err != nil {
		s.writeErrAPIInternal(w, "pending login load", err)
		return
	}
	if !okLogin {
		s.writeErr(w, http.StatusUnauthorized, "login challenge expired")
		return
	}
	userID, err := uuid.Parse(strings.TrimSpace(state.UserID))
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid security key challenge")
		return
	}
	u, waUser, err := s.loadWebAuthnUser(r.Context(), userID)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn user", err)
		return
	}
	wa, err := s.webauthnForRequest(r)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn config", err)
		return
	}
	credential, err := wa.FinishLogin(waUser, state.SessionData, webauthnRequestWithCredential(r, body.Credential))
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "security key verification failed")
		return
	}
	if err := s.store.UpdateWebAuthnCredentialUsage(r.Context(), u.ID, credential.ID, *credential, time.Now().UTC()); err != nil {
		s.writeErrAPIInternal(w, "webauthn credential update", err)
		return
	}
	_ = s.sessions.DeleteTemporaryJSON(r.Context(), mfaTempWebAuthnLogin, strings.TrimSpace(body.ChallengeID))
	_ = s.sessions.DeleteTemporaryJSON(r.Context(), mfaTempPendingLogin, strings.TrimSpace(state.LoginStateID))
	if err := s.issueLoginSession(w, r.Context(), u, appendMFAMethod(mfaMethodFromFirstFactor(loginState.FirstFactor), "webauthn"), true); err != nil {
		s.writeErrAPIInternal(w, "login session", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "user": userAuthJSON(u)})
}

func (s *Server) apiAuth2FAVerifyWebAuthnBegin(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, _, token, ok := s.mustSessionContext(w, r)
	if !ok {
		return
	}
	_, waUser, err := s.loadWebAuthnUser(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn user", err)
		return
	}
	wa, err := s.webauthnForRequest(r)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn config", err)
		return
	}
	options, sessionData, err := wa.BeginLogin(waUser)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn begin verify", err)
		return
	}
	challengeID, err := s.sessions.SaveTemporaryJSON(r.Context(), mfaTempWebAuthnStepUp, pendingWebAuthnState{
		UserID:       u.ID.String(),
		SessionToken: token,
		SessionData:  *sessionData,
		CreatedAt:    time.Now().UTC(),
	}, mfaPendingChallengeTTL)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn temp", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "challenge_id": challengeID, "options": options})
}

func (s *Server) apiAuth2FAVerifyWebAuthnFinish(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, pay, _, ok := s.mustSessionContext(w, r)
	if !ok {
		return
	}
	var body webAuthnFinishBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	var state pendingWebAuthnState
	okState, err := s.sessions.LoadTemporaryJSON(r.Context(), mfaTempWebAuthnStepUp, strings.TrimSpace(body.ChallengeID), &state)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn temp load", err)
		return
	}
	if !okState || state.UserID != u.ID.String() {
		s.writeErr(w, http.StatusUnauthorized, "security key challenge expired")
		return
	}
	_, waUser, err := s.loadWebAuthnUser(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn user", err)
		return
	}
	wa, err := s.webauthnForRequest(r)
	if err != nil {
		s.writeErrAPIInternal(w, "webauthn config", err)
		return
	}
	credential, err := wa.FinishLogin(waUser, state.SessionData, webauthnRequestWithCredential(r, body.Credential))
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "security key verification failed")
		return
	}
	if err := s.store.UpdateWebAuthnCredentialUsage(r.Context(), u.ID, credential.ID, *credential, time.Now().UTC()); err != nil {
		s.writeErrAPIInternal(w, "webauthn credential update", err)
		return
	}
	_ = s.sessions.DeleteTemporaryJSON(r.Context(), mfaTempWebAuthnStepUp, strings.TrimSpace(body.ChallengeID))
	if err := s.markSessionMFAVerified(r.Context(), state.SessionToken, pay); err != nil {
		s.writeErrAPIInternal(w, "webauthn session update", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) apiAuth2FATOTPDelete(w http.ResponseWriter, r *http.Request, idStr string) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, pay, _, ok := s.mustSessionContext(w, r)
	if !ok {
		return
	}
	if !s.requireRecentMFA(w, r, u) {
		return
	}
	factorID, err := uuid.Parse(strings.TrimSpace(idStr))
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid factor id")
		return
	}
	if err := s.store.RevokeTOTPFactor(r.Context(), u.ID, factorID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "factor not found")
			return
		}
		s.writeErrAPIInternal(w, "totp revoke", err)
		return
	}
	status, err := s.loadMFAStatus(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "2fa status", err)
		return
	}
	preferred := ""
	if len(status.WebAuthnFactors) > 0 {
		preferred = "webauthn"
	}
	if err := s.syncMFASettings(r.Context(), u.ID, preferred); err != nil {
		s.writeErrAPIInternal(w, "2fa settings", err)
		return
	}
	if len(status.WebAuthnFactors) == 0 && len(status.TOTPFactors) <= 1 {
		_ = s.store.ReplaceRecoveryCodes(r.Context(), u.ID, nil)
	}
	if s.sessions != nil {
		_ = s.sessions.DeleteUserSessions(r.Context(), u.ID)
	}
	mfaStillEnabled := len(status.WebAuthnFactors) > 0 || len(status.TOTPFactors) > 1
	if err := s.issueLoginSession(w, r.Context(), u, filterNonMFAAMR(pay.AMR), mfaStillEnabled && pay.MFAVerifiedAt > 0); err != nil {
		s.writeErrAPIInternal(w, "2fa session rotate", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) apiAuth2FAWebAuthnDelete(w http.ResponseWriter, r *http.Request, idStr string) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "2fa requires database and Valkey")
		return
	}
	u, pay, _, ok := s.mustSessionContext(w, r)
	if !ok {
		return
	}
	if !s.requireRecentMFA(w, r, u) {
		return
	}
	credID, err := uuid.Parse(strings.TrimSpace(idStr))
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid credential id")
		return
	}
	if err := s.store.RevokeWebAuthnCredential(r.Context(), u.ID, credID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "credential not found")
			return
		}
		s.writeErrAPIInternal(w, "webauthn revoke", err)
		return
	}
	status, err := s.loadMFAStatus(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "2fa status", err)
		return
	}
	preferred := ""
	if len(status.TOTPFactors) > 0 {
		preferred = "totp"
	}
	if err := s.syncMFASettings(r.Context(), u.ID, preferred); err != nil {
		s.writeErrAPIInternal(w, "2fa settings", err)
		return
	}
	if len(status.TOTPFactors) == 0 && len(status.WebAuthnFactors) <= 1 {
		_ = s.store.ReplaceRecoveryCodes(r.Context(), u.ID, nil)
	}
	if s.sessions != nil {
		_ = s.sessions.DeleteUserSessions(r.Context(), u.ID)
	}
	mfaStillEnabled := len(status.TOTPFactors) > 0 || len(status.WebAuthnFactors) > 1
	if err := s.issueLoginSession(w, r.Context(), u, filterNonMFAAMR(pay.AMR), mfaStillEnabled && pay.MFAVerifiedAt > 0); err != nil {
		s.writeErrAPIInternal(w, "2fa session rotate", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func webauthnRequestWithCredential(r *http.Request, raw json.RawMessage) *http.Request {
	req := r.Clone(r.Context())
	body := bytes.TrimSpace(raw)
	req.Body = io.NopCloser(bytes.NewReader(body))
	req.ContentLength = int64(len(body))
	req.Header = req.Header.Clone()
	req.Header.Set("Content-Type", "application/json")
	return req
}

func transportStrings(transports []protocol.AuthenticatorTransport) []string {
	out := make([]string, 0, len(transports))
	for _, transport := range transports {
		out = append(out, string(transport))
	}
	return out
}

func filterNonMFAAMR(amr []string) []string {
	out := make([]string, 0, len(amr))
	for _, method := range amr {
		switch method {
		case "totp", "webauthn", "recovery":
			continue
		default:
			out = append(out, method)
		}
	}
	if len(out) == 0 {
		out = []string{"pwd"}
	}
	return out
}
