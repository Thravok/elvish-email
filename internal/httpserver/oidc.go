package httpserver

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"html"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/models"
	"elvish/internal/oauthoidc"
	"elvish/internal/store"
)

const oidcAuthCodeTTL = 90 * time.Second

// WithOAuthOIDC wires the optional "Login with Elvish" OIDC issuer (nil disables).
func (s *Server) WithOAuthOIDC(iss *oauthoidc.Issuer) {
	if s == nil {
		return
	}
	s.oidcIssuer = iss
}

func (s *Server) oidcIssuerEnabled() bool {
	return s != nil && s.oidcIssuer != nil && s.sessions != nil && s.store != nil
}

func safeOAuthAuthorizeNext(next string) string {
	next = strings.TrimSpace(next)
	if next == "" || !strings.HasPrefix(next, "/oauth/authorize") || strings.HasPrefix(next, "//") {
		return ""
	}
	return next
}

func parseClientSecretBasic(h string) (id, secret string, ok bool) {
	const pfx = "Basic "
	if !strings.HasPrefix(h, pfx) {
		return "", "", false
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(strings.TrimPrefix(h, pfx)))
	if err != nil {
		return "", "", false
	}
	s := string(raw)
	idx := strings.IndexByte(s, ':')
	if idx < 0 {
		return "", "", false
	}
	return s[:idx], s[idx+1:], true
}

func (s *Server) handleOIDCWebFinger(w http.ResponseWriter, r *http.Request) {
	if !s.oidcIssuerEnabled() {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	res := strings.TrimSpace(r.URL.Query().Get("resource"))
	if res == "" {
		http.Error(w, "resource required", http.StatusBadRequest)
		return
	}
	if len(res) < 6 || strings.ToLower(res[0:6]) != "acct:" {
		http.Error(w, "unsupported resource", http.StatusBadRequest)
		return
	}
	rest := res[6:]
	at := strings.LastIndex(rest, "@")
	if at < 0 || at == len(rest)-1 {
		http.Error(w, "invalid resource", http.StatusBadRequest)
		return
	}
	domain := strings.ToLower(strings.TrimSpace(rest[at+1:]))
	mailDomain := strings.ToLower(strings.TrimSpace(s.EffectiveMailDomain()))
	if mailDomain == "" || domain != mailDomain {
		http.Error(w, "unknown resource", http.StatusNotFound)
		return
	}
	issuer := s.oidcIssuer.IssuerURL
	type link struct {
		Rel  string `json:"rel"`
		Href string `json:"href"`
	}
	out := map[string]any{
		"subject": res,
		"links": []link{{
			Rel:  "http://openid.net/specs/connect/1.0/issuer",
			Href: issuer,
		}},
	}
	w.Header().Set("Content-Type", "application/jrd+json; charset=utf-8")
	setCacheJSONNoStore(w)
	_ = json.NewEncoder(w).Encode(out)
}

func (s *Server) handleOIDCDiscovery(w http.ResponseWriter, r *http.Request) {
	if !s.oidcIssuerEnabled() {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	b, err := s.oidcIssuer.MarshalDiscoveryJSON()
	if err != nil {
		s.log.Error("oidc discovery", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	setCacheJSONNoStore(w)
	_, _ = w.Write(b)
}

func (s *Server) handleOIDCJWKS(w http.ResponseWriter, r *http.Request) {
	if !s.oidcIssuerEnabled() {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	b, err := s.oidcIssuer.MarshalJWKSJSON()
	if err != nil {
		s.log.Error("oidc jwks", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	setCacheJSONNoStore(w)
	_, _ = w.Write(b)
}

func (s *Server) handleOIDCAuthorize(w http.ResponseWriter, r *http.Request) {
	if !s.oidcIssuerEnabled() {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !s.rateLimitOK(w, r, "oidc_authorize", rateLimitAuthPerHour, rateLimitAuthWindow) {
		return
	}
	iss := s.oidcIssuer
	q := r.URL.Query()
	if strings.TrimSpace(q.Get("response_type")) != "code" {
		http.Error(w, "unsupported response_type", http.StatusBadRequest)
		return
	}
	clientID := strings.TrimSpace(q.Get("client_id"))
	if clientID != iss.ClientID {
		http.Error(w, "invalid client", http.StatusBadRequest)
		return
	}
	redirectURI := strings.TrimSpace(q.Get("redirect_uri"))
	if redirectURI == "" || !iss.RedirectAllowed(redirectURI) {
		http.Error(w, "invalid redirect_uri", http.StatusBadRequest)
		return
	}
	scope := strings.TrimSpace(q.Get("scope"))
	if !oauthoidc.ScopesIncludeOIDCRequired(scope) {
		http.Error(w, "invalid scope", http.StatusBadRequest)
		return
	}
	state := strings.TrimSpace(q.Get("state"))
	if state == "" || len(state) > 2048 {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	nonce := strings.TrimSpace(q.Get("nonce"))
	if nonce == "" || len(nonce) > 512 {
		http.Error(w, "invalid nonce", http.StatusBadRequest)
		return
	}

	u, ok := s.userFromRequest(r)
	if !ok || u == nil {
		next := safeOAuthAuthorizeNext(r.URL.RequestURI())
		if next == "" {
			http.Error(w, "invalid authorize url", http.StatusBadRequest)
			return
		}
		login := "/login?next=" + url.QueryEscape(next)
		http.Redirect(w, r, login, http.StatusFound)
		return
	}

	if !s.oidcRecentMFAGate(w, r, u) {
		return
	}

	codeBytes := make([]byte, 32)
	if _, err := rand.Read(codeBytes); err != nil {
		s.log.Error("oidc authorize rand", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	code := hex.EncodeToString(codeBytes)
	payload := oauthoidc.StoredAuthCode{
		UserID:      u.ID.String(),
		Email:       u.Email,
		Name:        strings.TrimSpace(u.Name),
		Nonce:       nonce,
		ClientID:    clientID,
		RedirectURI: redirectURI,
	}
	ctx := r.Context()
	if err := s.sessions.PutEphemeralJSON(ctx, oauthoidc.EphemeralOAuthCodeBucket, code, &payload, oidcAuthCodeTTL); err != nil {
		s.log.Error("oidc authorize store code", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	redir, err := iss.RedirectTarget(redirectURI)
	if err != nil {
		http.Error(w, "invalid redirect_uri", http.StatusBadRequest)
		return
	}
	qq := redir.Query()
	qq.Set("code", code)
	qq.Set("state", state)
	redir.RawQuery = qq.Encode()
	w.Header().Set("Cache-Control", cacheControlRedirect)
	http.Redirect(w, r, redir.String(), http.StatusFound)
}

// oidcRecentMFAGate requires a fresh MFA verification when MFA is enabled.
func (s *Server) oidcRecentMFAGate(w http.ResponseWriter, r *http.Request, u *models.User) bool {
	if s.store == nil {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
		return false
	}
	status, err := s.loadMFAStatus(r.Context(), u.ID)
	if err != nil {
		s.log.Error("oidc mfa status", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return false
	}
	if status.Settings == nil || !status.Settings.Enabled {
		return true
	}
	_, pay, _, ok := s.sessionFromRequest(r)
	if !ok || pay == nil {
		next := safeOAuthAuthorizeNext(r.URL.RequestURI())
		if next == "" {
			http.Error(w, "session invalid", http.StatusUnauthorized)
			return false
		}
		http.Redirect(w, r, "/login?next="+url.QueryEscape(next), http.StatusFound)
		return false
	}
	if pay.MFAVerifiedAt == 0 || time.Since(time.Unix(pay.MFAVerifiedAt, 0)) > mfaRecentVerificationTTL {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusForbidden)
		retry := r.URL.RequestURI()
		_, _ = io.WriteString(w, "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Two-factor required</title></head><body><p>Recent two-factor authentication is required before continuing to the external application.</p><p><a href=\""+
			html.EscapeString(retry)+"\">Try again</a> after completing 2FA in Elvish.</p></body></html>")
		return false
	}
	return true
}

func (s *Server) handleOIDCToken(w http.ResponseWriter, r *http.Request) {
	if !s.oidcIssuerEnabled() {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if !s.rateLimitOK(w, r, "oidc_token", rateLimitAuthPerHour, rateLimitAuthWindow) {
		return
	}
	if err := r.ParseForm(); err != nil {
		writeOIDCTokenErr(w, http.StatusBadRequest, "invalid_request", "invalid form body")
		return
	}
	iss := s.oidcIssuer
	clientID := strings.TrimSpace(r.PostFormValue("client_id"))
	clientSecret := strings.TrimSpace(r.PostFormValue("client_secret"))
	if cid, sec, ok := parseClientSecretBasic(r.Header.Get("Authorization")); ok {
		if clientID == "" {
			clientID = cid
		}
		if clientSecret == "" {
			clientSecret = sec
		}
	}
	if clientID != iss.ClientID || !iss.ClientSecretMatches(clientSecret) {
		writeOIDCTokenErr(w, http.StatusUnauthorized, "invalid_client", "invalid client credentials")
		return
	}
	if strings.TrimSpace(r.PostFormValue("grant_type")) != "authorization_code" {
		writeOIDCTokenErr(w, http.StatusBadRequest, "unsupported_grant_type", "unsupported grant_type")
		return
	}
	code := strings.TrimSpace(r.PostFormValue("code"))
	redirectURI := strings.TrimSpace(r.PostFormValue("redirect_uri"))
	if code == "" || redirectURI == "" {
		writeOIDCTokenErr(w, http.StatusBadRequest, "invalid_request", "code and redirect_uri required")
		return
	}
	var stored oauthoidc.StoredAuthCode
	ok, err := s.sessions.TakeEphemeralJSON(r.Context(), oauthoidc.EphemeralOAuthCodeBucket, code, &stored)
	if err != nil {
		s.log.Error("oidc token take code", "err", err)
		writeOIDCTokenErr(w, http.StatusInternalServerError, "server_error", "temporary failure")
		return
	}
	if !ok {
		writeOIDCTokenErr(w, http.StatusBadRequest, "invalid_grant", "invalid or expired code")
		return
	}
	if stored.ClientID != clientID || stored.RedirectURI != redirectURI {
		writeOIDCTokenErr(w, http.StatusBadRequest, "invalid_grant", "code mismatch")
		return
	}
	uid, err := uuid.Parse(strings.TrimSpace(stored.UserID))
	if err != nil {
		writeOIDCTokenErr(w, http.StatusBadRequest, "invalid_grant", "invalid code")
		return
	}
	u, err := s.store.UserByID(r.Context(), uid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeOIDCTokenErr(w, http.StatusBadRequest, "invalid_grant", "invalid code")
			return
		}
		s.log.Error("oidc token user", "err", err)
		writeOIDCTokenErr(w, http.StatusInternalServerError, "server_error", "temporary failure")
		return
	}
	if strings.TrimSpace(u.Email) != strings.TrimSpace(stored.Email) {
		writeOIDCTokenErr(w, http.StatusBadRequest, "invalid_grant", "invalid code")
		return
	}

	idTok, err := oauthoidc.SignIDToken(iss.Signer, iss.IssuerURL, iss.ClientID, u.ID.String(), stored.Nonce, u.Email, strings.TrimSpace(u.Name), time.Hour)
	if err != nil {
		s.log.Error("oidc sign id token", "err", err)
		writeOIDCTokenErr(w, http.StatusInternalServerError, "server_error", "temporary failure")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	setCacheJSONNoStore(w)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"access_token": idTok,
		"id_token":     idTok,
		"token_type":   "Bearer",
		"expires_in":   3600,
	})
}

func writeOIDCTokenErr(w http.ResponseWriter, status int, errCode, desc string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	setCacheJSONNoStore(w)
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":             errCode,
		"error_description": desc,
	})
}

func setCacheJSONNoStore(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cacheControlAPINoStore)
}
