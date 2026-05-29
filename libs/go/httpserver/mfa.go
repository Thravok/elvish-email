package httpserver

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"

	mfautil "elvish/libs/go/mfa"
	"elvish/libs/go/models"
	"elvish/libs/go/session"
	"elvish/libs/go/store"
)

const (
	mfaTempPendingLogin      = "mfa-login"
	mfaTempTOTPSetup         = "mfa-totp-setup"
	mfaTempWebAuthnRegister  = "mfa-webauthn-register"
	mfaTempWebAuthnLogin     = "mfa-webauthn-login"
	mfaTempWebAuthnStepUp    = "mfa-webauthn-stepup"
	mfaPendingChallengeTTL   = 10 * time.Minute
	mfaRecentVerificationTTL = 10 * time.Minute
)

type pendingLoginState struct {
	UserID      string    `json:"user_id"`
	Email       string    `json:"email"`
	Name        string    `json:"name,omitempty"`
	Username    string    `json:"username"`
	IsAdmin     bool      `json:"is_admin"`
	FirstFactor string    `json:"first_factor"`
	Methods     []string  `json:"methods"`
	CreatedAt   time.Time `json:"created_at"`
}

type pendingTOTPSetupState struct {
	UserID      string    `json:"user_id"`
	Label       string    `json:"label"`
	Secret      string    `json:"secret"`
	Issuer      string    `json:"issuer"`
	AccountName string    `json:"account_name"`
	CreatedAt   time.Time `json:"created_at"`
}

type pendingWebAuthnState struct {
	UserID       string               `json:"user_id"`
	SessionToken string               `json:"session_token,omitempty"`
	LoginStateID string               `json:"login_state_id,omitempty"`
	SessionData  webauthn.SessionData `json:"session_data"`
	CreatedAt    time.Time            `json:"created_at"`
}

type mfaStatus struct {
	Settings          *models.MFASettings
	TOTPFactors       []models.TOTPFactor
	WebAuthnFactors   []models.WebAuthnCredential
	RecoveryRemaining int
}

type webAuthnUser struct {
	user        *models.User
	credentials []webauthn.Credential
}

func (u *webAuthnUser) WebAuthnID() []byte {
	id := u.user.ID
	return id[:]
}

func (u *webAuthnUser) WebAuthnName() string {
	return u.user.Email
}

func (u *webAuthnUser) WebAuthnDisplayName() string {
	if strings.TrimSpace(u.user.Name) != "" {
		return u.user.Name
	}
	return u.user.Email
}

func (u *webAuthnUser) WebAuthnCredentials() []webauthn.Credential {
	return u.credentials
}

func (s *Server) mfaService() (*mfautil.Service, error) {
	return mfautil.NewFromEnv()
}

func (s *Server) sessionFromRequest(r *http.Request) (*models.User, *session.Payload, string, bool) {
	if s.store == nil || s.sessions == nil {
		return nil, nil, "", false
	}
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return nil, nil, "", false
	}
	pay, err := s.sessions.Get(r.Context(), c.Value)
	if err != nil {
		return nil, nil, "", false
	}
	uid, err := uuid.Parse(strings.TrimSpace(pay.UserID))
	if err != nil {
		return nil, nil, "", false
	}
	u, err := s.store.UserByID(r.Context(), uid)
	if err != nil {
		return nil, nil, "", false
	}
	if store.IsDisabledUser(u) {
		return nil, nil, "", false
	}
	now := time.Now().UTC()
	if !sameActivityDay(u.LastActivityAt, now) {
		if err := s.store.UpdateUserLastActivity(r.Context(), uid, now); err != nil {
			if !errors.Is(err, store.ErrNotFound) && s.log != nil {
				s.log.Warn("user activity touch", "err", err)
			}
		} else {
			u.LastActivityAt = activityDay(now)
		}
	}
	return u, pay, c.Value, true
}

func (s *Server) issueLoginSession(w http.ResponseWriter, ctx context.Context, u *models.User, methods []string, mfaVerified bool) error {
	if s.sessions == nil {
		return errors.New("sessions not configured")
	}
	if store.IsDisabledUser(u) {
		return errors.New("disabled user")
	}
	now := time.Now().UTC().Unix()
	payload := session.Payload{
		UserID:        u.ID.String(),
		Email:         u.Email,
		AMR:           append([]string(nil), methods...),
		Authenticated: now,
	}
	if mfaVerified {
		payload.MFAVerifiedAt = now
	}
	tok, err := s.sessions.CreateWithPayload(ctx, payload)
	if err != nil {
		return err
	}
	http.SetCookie(w, s.newSessionCookie(ctx, sessionCookie, tok, int((14*24*time.Hour).Seconds())))
	return nil
}

func (s *Server) markSessionMFAVerified(ctx context.Context, token string, pay *session.Payload) error {
	if s.sessions == nil || pay == nil {
		return errors.New("sessions not configured")
	}
	pay.MFAVerifiedAt = time.Now().UTC().Unix()
	return s.sessions.Put(ctx, token, *pay)
}

func activityDay(at time.Time) time.Time {
	y, m, d := at.UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func sameActivityDay(a, b time.Time) bool {
	if a.IsZero() {
		return false
	}
	return activityDay(a).Equal(activityDay(b))
}

func (s *Server) requestOrigin(r *http.Request) string {
	if base := s.resolvedPublicBaseURL(r.Context()); base != "" {
		return strings.TrimRight(base, "/")
	}
	scheme := "http"
	if r.TLS != nil || strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https") {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}

func (s *Server) webauthnForRequest(r *http.Request) (*webauthn.WebAuthn, error) {
	origin := s.requestOrigin(r)
	u, err := url.Parse(origin)
	if err != nil {
		return nil, err
	}
	cfg := &webauthn.Config{
		RPDisplayName: "Elvish",
		RPID:          u.Hostname(),
		RPOrigins:     []string{origin},
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			AuthenticatorAttachment: protocol.CrossPlatform,
			UserVerification:        protocol.VerificationDiscouraged,
			ResidentKey:             protocol.ResidentKeyRequirementDiscouraged,
		},
	}
	return webauthn.New(cfg)
}

func (s *Server) loadMFAStatus(ctx context.Context, userID uuid.UUID) (*mfaStatus, error) {
	if s.store == nil {
		return nil, errors.New("store unavailable")
	}
	settings, err := s.store.GetMFASettings(ctx, userID)
	if err != nil {
		return nil, err
	}
	totpFactors, err := s.store.ListTOTPFactors(ctx, userID)
	if err != nil {
		return nil, err
	}
	webFactors, err := s.store.ListWebAuthnCredentials(ctx, userID)
	if err != nil {
		return nil, err
	}
	recoveryRemaining, err := s.store.CountUnusedRecoveryCodes(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &mfaStatus{
		Settings:          settings,
		TOTPFactors:       totpFactors,
		WebAuthnFactors:   webFactors,
		RecoveryRemaining: recoveryRemaining,
	}, nil
}

func (s *Server) mfaMethodsForStatus(status *mfaStatus) []string {
	return mfaMethodsForStatus(status)
}

func mfaMethodsForStatus(status *mfaStatus) []string {
	if status == nil {
		return nil
	}
	methods := make([]string, 0, 3)
	if status.Settings != nil && status.Settings.Enabled && len(status.TOTPFactors) > 0 {
		methods = append(methods, "totp")
	}
	if status.Settings != nil && status.Settings.Enabled && len(status.WebAuthnFactors) > 0 {
		methods = append(methods, "webauthn")
	}
	if status.Settings != nil && status.Settings.Enabled && status.RecoveryRemaining > 0 {
		methods = append(methods, "recovery")
	}
	return methods
}

func (s *Server) createPendingLogin(ctx context.Context, u *models.User, firstFactor string) (string, []string, error) {
	status, err := s.loadMFAStatus(ctx, u.ID)
	if err != nil {
		return "", nil, err
	}
	methods := s.mfaMethodsForStatus(status)
	if len(methods) == 0 {
		return "", nil, nil
	}
	state := pendingLoginState{
		UserID:      u.ID.String(),
		Email:       u.Email,
		Name:        u.Name,
		Username:    UsernameFromCanonicalEmail(u.Email),
		IsAdmin:     u.IsAdmin,
		FirstFactor: strings.TrimSpace(firstFactor),
		Methods:     methods,
		CreatedAt:   time.Now().UTC(),
	}
	id, err := s.sessions.SaveTemporaryJSON(ctx, mfaTempPendingLogin, state, mfaPendingChallengeTTL)
	if err != nil {
		return "", nil, err
	}
	return id, methods, nil
}

func (s *Server) requireRecentMFA(w http.ResponseWriter, r *http.Request, u *models.User) bool {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return false
	}
	status, err := s.loadMFAStatus(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "mfa status", err)
		return false
	}
	if status.Settings == nil || !status.Settings.Enabled {
		return true
	}
	_, pay, _, ok := s.sessionFromRequest(r)
	if !ok || pay == nil {
		s.writeErr(w, http.StatusUnauthorized, "login required")
		return false
	}
	if pay.MFAVerifiedAt == 0 || time.Since(time.Unix(pay.MFAVerifiedAt, 0)) > mfaRecentVerificationTTL {
		s.writeJSON(w, http.StatusPreconditionRequired, map[string]any{
			"error":        "recent 2fa verification required",
			"mfa_required": true,
			"methods":      s.mfaMethodsForStatus(status),
		})
		return false
	}
	return true
}

func (s *Server) syncMFASettings(ctx context.Context, userID uuid.UUID, preferred string) error {
	if s.store == nil {
		return errors.New("store unavailable")
	}
	totpCount, err := s.store.ActiveTOTPFactorCount(ctx, userID)
	if err != nil {
		return err
	}
	webCount, err := s.store.ActiveWebAuthnCredentialCount(ctx, userID)
	if err != nil {
		return err
	}
	enabled := totpCount+webCount > 0
	return s.store.PutMFASettings(ctx, userID, enabled, strings.TrimSpace(preferred))
}

func (s *Server) verifyTOTPCode(ctx context.Context, userID uuid.UUID, code string) (*models.TOTPFactor, error) {
	if s.store == nil {
		return nil, errors.New("store unavailable")
	}
	svc, err := s.mfaService()
	if err != nil {
		return nil, err
	}
	factors, err := s.store.ListTOTPFactors(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, factor := range factors {
		secret, err := svc.Decrypt(factor.SecretEncrypted)
		if err != nil {
			return nil, err
		}
		if mfautil.ValidateTOTP(code, string(secret)) {
			if err := s.store.TouchTOTPFactor(ctx, userID, factor.ID, time.Now().UTC()); err != nil && !errors.Is(err, store.ErrNotFound) {
				return nil, err
			}
			return &factor, nil
		}
	}
	return nil, store.ErrNotFound
}

func (s *Server) consumeRecoveryCode(ctx context.Context, userID uuid.UUID, code string) error {
	if s.store == nil {
		return errors.New("store unavailable")
	}
	return s.store.ConsumeRecoveryCode(ctx, userID, mfautil.HashRecoveryCode(code), time.Now().UTC())
}

func (s *Server) loadWebAuthnUser(ctx context.Context, userID uuid.UUID) (*models.User, *webAuthnUser, error) {
	if s.store == nil {
		return nil, nil, errors.New("store unavailable")
	}
	user, err := s.store.UserByID(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	records, err := s.store.ListWebAuthnCredentials(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	creds, err := store.DecodeWebAuthnCredentials(records)
	if err != nil {
		return nil, nil, err
	}
	return user, &webAuthnUser{user: user, credentials: creds}, nil
}

func mfaFactorSummary(status *mfaStatus) map[string]any {
	totpFactors := make([]map[string]any, 0, len(status.TOTPFactors))
	for _, factor := range status.TOTPFactors {
		totpFactors = append(totpFactors, map[string]any{
			"id":           factor.ID.String(),
			"label":        factor.Label,
			"verified_at":  factor.VerifiedAt,
			"last_used_at": factor.LastUsedAt,
		})
	}
	webFactors := make([]map[string]any, 0, len(status.WebAuthnFactors))
	for _, factor := range status.WebAuthnFactors {
		webFactors = append(webFactors, map[string]any{
			"id":            factor.ID.String(),
			"label":         factor.Label,
			"aaguid":        factor.AAGUID,
			"attachment":    factor.Attachment,
			"user_verified": factor.UserVerified,
			"created_at":    factor.CreatedAt,
			"last_used_at":  factor.LastUsedAt,
		})
	}
	preferred := ""
	enabled := false
	if status.Settings != nil {
		preferred = status.Settings.PreferredMethod
		enabled = status.Settings.Enabled
	}
	return map[string]any{
		"enabled":            enabled,
		"preferred_method":   preferred,
		"methods":            mfaMethodsForStatus(status),
		"totp_factors":       totpFactors,
		"webauthn_factors":   webFactors,
		"recovery_remaining": status.RecoveryRemaining,
	}
}

func mfaMethodFromFirstFactor(firstFactor string) []string {
	switch strings.TrimSpace(firstFactor) {
	case "password":
		return []string{"pwd"}
	case "srp":
		return []string{"pwd", "srp"}
	default:
		return []string{"pwd"}
	}
}

func appendMFAMethod(methods []string, mfaMethod string) []string {
	out := append([]string(nil), methods...)
	for _, method := range out {
		if method == mfaMethod {
			return out
		}
	}
	return append(out, mfaMethod)
}

func (s *Server) mustSessionContext(w http.ResponseWriter, r *http.Request) (*models.User, *session.Payload, string, bool) {
	u, pay, token, ok := s.sessionFromRequest(r)
	if !ok {
		s.writeErr(w, http.StatusUnauthorized, "login required")
		return nil, nil, "", false
	}
	return u, pay, token, true
}

func (s *Server) parseUserID(raw string) (uuid.UUID, error) {
	id, err := uuid.Parse(strings.TrimSpace(raw))
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user id: %w", err)
	}
	return id, nil
}
