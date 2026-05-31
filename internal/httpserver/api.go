package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"elvish/internal/adminbootstrap"
	"elvish/internal/blog"
	"elvish/internal/markdown"
	"elvish/internal/migrate"
	"elvish/internal/models"
	"elvish/internal/openpgp"
	"elvish/internal/pake"
	"elvish/internal/render"
	"elvish/internal/store"
)

const sessionCookie = "elvish_session"

var adminEmailCfg struct {
	once sync.Once
	set  map[string]struct{}
}

func registrationDisallowed(ctx context.Context, st *store.Store) bool {
	if !envTruthy("ELVISH_DISABLE_REGISTRATION") {
		return false
	}
	if st == nil {
		return true
	}
	n, err := st.CountUsers(ctx)
	if err != nil {
		return true
	}
	return n > 0
}

func adminEmailConfigured(email string) bool {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return false
	}
	adminEmailCfg.once.Do(func() {
		adminEmailCfg.set = make(map[string]struct{})
		raw := os.Getenv("ELVISH_ADMIN_EMAILS")
		for _, p := range strings.Split(raw, ",") {
			k := strings.TrimSpace(strings.ToLower(p))
			if k != "" {
				adminEmailCfg.set[k] = struct{}{}
			}
		}
	})
	if len(adminEmailCfg.set) == 0 {
		return false
	}
	_, ok := adminEmailCfg.set[email]
	return ok
}

func legacyConsoleEnabled() bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("ELVISH_LEGACY_CONSOLE")))
	return v == "1" || v == "true" || v == "yes"
}

func (s *Server) handleAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet && r.URL.Path == "/api/healthz" {
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
		return
	}
	if r.Method == http.MethodGet {
		switch r.URL.Path {
		case "/api/openapi.yaml":
			s.serveOpenAPISpec(w, r)
			return
		case "/api/docs", "/api/docs/":
			s.serveOpenAPIDocs(w, r)
			return
		}
	}
	setCacheAPIDefault(w)
	p := strings.TrimPrefix(r.URL.Path, "/api/")
	p = strings.TrimSuffix(p, "/")
	switch {
	case p == "bootstrap.json" && r.Method == http.MethodGet:
		s.apiBootstrap(w, r)
	case p == "site/topbar.json" && r.Method == http.MethodGet:
		s.apiSiteTopbar(w, r)
	case p == "auth/signup-config" && r.Method == http.MethodGet:
		s.apiAuthSignupConfig(w, r)
	case p == "auth/register" && r.Method == http.MethodPost:
		s.apiRegister(w, r)
	case p == "auth/login/begin" && r.Method == http.MethodPost:
		s.apiLoginSRPBegin(w, r)
	case p == "auth/login/finish" && r.Method == http.MethodPost:
		s.apiLoginSRPFinish(w, r)
	case p == "auth/login" && r.Method == http.MethodPost:
		s.apiLogin(w, r)
	case p == "auth/logout" && r.Method == http.MethodPost:
		s.apiLogout(w, r)
	case p == "auth/me" && r.Method == http.MethodGet:
		s.apiMe(w, r)
	case p == "auth/appearance" && (r.Method == http.MethodPatch || r.Method == http.MethodPut):
		s.apiAuthAppearance(w, r)
	case strings.HasPrefix(p, "auth/2fa"):
		s.handleAuth2FAAPI(w, r, strings.TrimPrefix(p, "auth/2fa"))
	case p == "auth/password/begin" && r.Method == http.MethodPost:
		s.apiAuthPasswordSRPBegin(w, r)
	case p == "auth/password/finish" && r.Method == http.MethodPost:
		s.apiAuthPasswordSRPFinish(w, r)
	case p == "auth/password" && r.Method == http.MethodPost:
		s.apiAuthPasswordChange(w, r)
	case p == "auth/account-delete/begin" && r.Method == http.MethodPost:
		s.apiAuthAccountDeleteSRPBegin(w, r)
	case p == "auth/account-delete/finish" && r.Method == http.MethodPost:
		s.apiAuthAccountDeleteSRPFinish(w, r)
	case p == "auth/account-delete/now" && r.Method == http.MethodPost:
		s.apiAuthAccountDeleteNow(w, r)
	case p == "auth/account-delete/schedule" && r.Method == http.MethodPost:
		s.apiAuthAccountDeleteSchedule(w, r)
	case p == "auth/account-delete/cancel" && r.Method == http.MethodPost:
		s.apiAuthAccountDeleteCancel(w, r)
	case p == "v1/account/delete-policy" && r.Method == http.MethodGet:
		s.apiAccountDeletePolicyGet(w, r)
	case p == "v1/account/delete-policy" && r.Method == http.MethodPut:
		s.apiAccountDeletePolicyPut(w, r)
	case p == "v1/billing/status" && r.Method == http.MethodGet:
		s.apiBillingStatus(w, r)
	case p == "v1/account" && r.Method == http.MethodDelete:
		s.apiAccountDelete(w, r)
	case p == "pgp/keys" && r.Method == http.MethodPost:
		if !legacyConsoleEnabled() {
			http.NotFound(w, r)
			return
		}
		s.apiPGPUpload(w, r)
	case p == "migrate/posts" && r.Method == http.MethodPost:
		if !legacyConsoleEnabled() {
			http.NotFound(w, r)
			return
		}
		s.apiMigratePosts(w, r)
	case p == "posts" && r.Method == http.MethodGet:
		if !legacyConsoleEnabled() {
			http.NotFound(w, r)
			return
		}
		s.apiPostsList(w, r)
	case p == "posts" && r.Method == http.MethodPost:
		if !legacyConsoleEnabled() {
			http.NotFound(w, r)
			return
		}
		s.apiPostUpsert(w, r)
	case p == "tools/calls" && r.Method == http.MethodGet:
		s.apiToolCalls(w, r)
	case p == "uptime.json" && r.Method == http.MethodGet:
		s.apiUptime(w, r)
	case strings.HasPrefix(p, "admin/"):
		if !legacyConsoleEnabled() {
			http.NotFound(w, r)
			return
		}
		s.RoutePlatformConsoleAPI(w, r, "/"+strings.TrimPrefix(p, "admin/"))
	case p == "telemetry/browser" && r.Method == http.MethodPost:
		s.apiBrowserTelemetry(w, r)
	// v1/mailbox must precede v1/mail: strings.HasPrefix("v1/mailbox/…", "v1/mail") is true.
	case strings.HasPrefix(p, "v1/mailbox"):
		s.handleMailboxAPI(w, r, p)
	case strings.HasPrefix(p, "v1/mail"):
		s.handleMailAPI(w, r, p)
	case strings.HasPrefix(p, "v1/filters"):
		s.handleFiltersAPI(w, r, p)
	case strings.HasPrefix(p, "v1/custom-domains"):
		s.handleCustomDomainsAPI(w, r, p)
	case strings.HasPrefix(p, "v1/smtp-submission"):
		s.handleSMTPSubmissionAPI(w, r, p)
	case strings.HasPrefix(p, "v1/account-key"):
		s.handleAccountKeyAPI(w, r, p)
	case strings.HasPrefix(p, "v1/identities"):
		s.handleIdentitiesAPI(w, r, p)
	case strings.HasPrefix(p, "v1/keys"):
		s.handleKeysAPI(w, r, p)
	case strings.HasPrefix(p, "v1/protected-links"):
		s.handleProtectedLinksPublicAPI(w, r, p)
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) apiBootstrap(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	raw, err := os.ReadFile(filepath.Join(s.root, "content", "home.json"))
	if err != nil {
		s.writeErrAPIInternal(w, "bootstrap read home.json", err)
		return
	}
	if s.store != nil {
		if y, err := s.store.GetSiteHomeJSON(ctx); err == nil && strings.TrimSpace(y) != "" {
			raw = []byte(y)
		}
	}
	posts, err := s.loadPosts(ctx)
	if err != nil {
		s.writeErrAPIInternal(w, "bootstrap load posts", err)
		return
	}
	metrics, err := s.loadMetrics()
	if err != nil {
		s.writeErrAPIInternal(w, "bootstrap load metrics", err)
		return
	}
	b, err := adminbootstrap.BuildJSONFromHomeBytes(raw, posts, metrics)
	if err != nil {
		s.writeErrAPIInternal(w, "bootstrap build json", err)
		return
	}
	if s.store != nil {
		var wrap map[string]any
		if err := json.Unmarshal(b, &wrap); err == nil {
			wrap["persist_home"] = true
			if b, err = json.MarshalIndent(wrap, "", "  "); err != nil {
				s.writeErrAPIInternal(w, "bootstrap wrap persist flag", err)
				return
			}
		}
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	s.writeBytes(w, "api bootstrap", b)
}

func (s *Server) apiSiteTopbar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	h, err := s.loadHome(ctx)
	if err != nil {
		s.writeErrAPIInternal(w, "topbar load home", err)
		return
	}
	type navItem struct {
		ID    string `json:"id"`
		Href  string `json:"href"`
		Label string `json:"label"`
	}
	nav := make([]navItem, 0, len(h.Nav))
	for _, n := range h.Nav {
		nav = append(nav, navItem{ID: n.ID, Href: n.Href, Label: n.Label})
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"version":     h.Version,
		"build_label": h.BuildLabel,
		"nav":         nav,
	})
}

func (s *Server) apiAuthSignupConfig(w http.ResponseWriter, r *http.Request) {
	out := map[string]any{"mail_domain": s.EffectiveMailDomain()}
	capOut := map[string]any{"enabled": false}
	out["cap"] = capOut
	if s.store == nil {
		s.writeJSON(w, http.StatusOK, out)
		return
	}
	doc, err := s.store.GetAuthCaptchaSettings(r.Context())
	if err != nil {
		s.log.Warn("signup-config captcha", "err", err)
		s.writeJSON(w, http.StatusOK, out)
		return
	}
	active := doc.Enabled &&
		strings.TrimSpace(doc.WidgetAPIEndpoint) != "" &&
		strings.TrimSpace(doc.Secret) != ""
	if active {
		ep := strings.TrimSpace(doc.WidgetAPIEndpoint)
		if ep != "" && !strings.HasSuffix(ep, "/") {
			ep += "/"
		}
		capOut["enabled"] = true
		capOut["widget_api_endpoint"] = ep
	}
	s.writeJSON(w, http.StatusOK, out)
}

func userAuthJSON(u *models.User) map[string]any {
	if u == nil {
		return nil
	}
	return map[string]any{
		"email":    u.Email,
		"username": UsernameFromCanonicalEmail(u.Email),
		"name":     u.Name,
		"is_admin": u.IsAdmin,
		"ui_theme": normalizeUITheme(u.UITheme),
	}
}

type regBody struct {
	Username       string               `json:"username"`
	Name           string               `json:"name"`
	Company        string               `json:"company,omitempty"`
	CapToken       string               `json:"cap_token,omitempty"`
	UITheme        string               `json:"ui_theme,omitempty"`
	SRPSaltB64     string               `json:"srp_salt_b64"`
	SRPVerifierB64 string               `json:"srp_verifier_b64"`
	SRPGroup       string               `json:"srp_group"`
	SRPHash        string               `json:"srp_hash"`
	AccountKey     *accountKeyBootstrap `json:"account_key"`
}

func (s *Server) apiRegister(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "registration requires database and Valkey")
		return
	}
	if !s.rateLimitOK(w, r, "auth_register", rateLimitAuthPerHour, rateLimitAuthWindow) {
		return
	}
	ctx := r.Context()
	if registrationDisallowed(ctx, s.store) {
		s.writeErr(w, http.StatusForbidden, "registration is disabled")
		return
	}
	var body regBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if !s.rejectFilledAuthHoneypot(w, body.Company) {
		return
	}
	if !s.requireCapToken(w, r, body.CapToken) {
		return
	}
	user, err := NormalizeAndValidateUsername(body.Username)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "username required (3–64 chars, letters/digits/._-)")
		return
	}
	if strings.TrimSpace(body.SRPSaltB64) == "" || strings.TrimSpace(body.SRPVerifierB64) == "" || body.AccountKey == nil {
		s.writeErr(w, http.StatusBadRequest, "browser-generated srp_salt_b64, srp_verifier_b64, and account_key are required")
		return
	}
	email := ComposeCanonicalEmail(user, s.EffectiveMailDomain())
	reserved, err := s.store.IsDeletedAddressReserved(ctx, email)
	if err != nil {
		s.writeErrAPIInternal(w, "register reservation check", err)
		return
	}
	if reserved {
		s.writeErr(w, http.StatusConflict, "username is reserved after account deletion")
		return
	}
	isAdmin := adminEmailConfigured(email)
	if n, err := s.store.CountUsers(ctx); err == nil && n == 0 {
		isAdmin = true
	}
	salt, err := decodeB64Field(body.SRPSaltB64, "srp_salt_b64")
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	verifier, err := decodeB64Field(body.SRPVerifierB64, "srp_verifier_b64")
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if _, err := pake.ParseGroup(body.SRPGroup, body.SRPHash); err != nil {
		s.writeErr(w, http.StatusBadRequest, "unsupported srp parameters")
		return
	}
	uiTheme := normalizeUITheme(body.UITheme)
	u, err := s.store.CreateUserWithSRP(ctx, email, body.Name, salt, verifier, body.SRPGroup, body.SRPHash, isAdmin, uiTheme)
	if err != nil {
		if store.IsDuplicateKey(err) {
			s.writeErr(w, http.StatusConflict, "username already taken")
			return
		}
		s.writeErrAPIInternal(w, "register create srp user", err)
		return
	}
	accountKey, identities, err := parseAccountKeyBootstrap(u.ID, *body.AccountKey)
	if err != nil {
		_ = s.store.DeleteUser(ctx, u.ID)
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.ensureBootstrapIdentitiesAvailable(ctx, identities); err != nil {
		_ = s.store.DeleteUser(ctx, u.ID)
		if errors.Is(err, errReservedDeletedAddress) {
			s.writeErr(w, http.StatusConflict, "identity address is reserved after account deletion")
			return
		}
		s.writeErrAPIInternal(w, "register bootstrap reservation check", err)
		return
	}
	if err := s.storeParsedAccountBootstrap(ctx, accountKey, identities); err != nil {
		_ = s.store.DeleteUser(ctx, u.ID)
		s.writeErrAPIInternal(w, "register bootstrap account key", err)
		return
	}
	if err := s.issueSession(w, ctx, u); err != nil {
		s.writeErrAPIInternal(w, "register issue session", err)
		return
	}
	s.writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "user": userAuthJSON(u)})
}

type loginBody struct {
	Username string `json:"username"`
	Password string `json:"password"`
	CapToken string `json:"cap_token,omitempty"`
}

func (s *Server) apiLogin(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "login requires database and Valkey")
		return
	}
	if !s.rateLimitOK(w, r, "auth_login", rateLimitAuthPerHour, rateLimitAuthWindow) {
		return
	}
	var body loginBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if !s.requireCapToken(w, r, body.CapToken) {
		return
	}
	user, err := NormalizeAndValidateUsername(body.Username)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid username")
		return
	}
	email := ComposeCanonicalEmail(user, s.EffectiveMailDomain())
	ctx := r.Context()
	u, err := s.store.UserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		s.writeErrAPIInternal(w, "login user lookup", err)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(body.Password)) != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	challengeID, methods, err := s.createPendingLogin(ctx, u, "password")
	if err != nil {
		s.writeErrAPIInternal(w, "login mfa status", err)
		return
	}
	if challengeID != "" {
		s.writeJSON(w, http.StatusOK, map[string]any{
			"ok":           true,
			"mfa_required": true,
			"challenge_id": challengeID,
			"methods":      methods,
			"user":         userAuthJSON(u),
		})
		return
	}
	if err := s.issueLoginSession(w, ctx, u, []string{"pwd"}, false); err != nil {
		s.writeErrAPIInternal(w, "login issue session", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "user": userAuthJSON(u)})
}

func (s *Server) issueSession(w http.ResponseWriter, ctx context.Context, u *models.User) error {
	tok, err := s.sessions.Create(ctx, u.ID, u.Email)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    tok,
		Path:     "/",
		MaxAge:   int((14 * 24 * time.Hour).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cookieSecure,
	})
	return nil
}

func (s *Server) apiLogout(w http.ResponseWriter, r *http.Request) {
	if s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "sessions not configured")
		return
	}
	s.clearBrowserSession(w, r)
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// clearBrowserSession revokes the Valkey session (if configured) and clears the cookie.
func (s *Server) clearBrowserSession(w http.ResponseWriter, r *http.Request) {
	if s.sessions != nil {
		if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
			if err := s.sessions.Delete(r.Context(), c.Value); err != nil {
				// Best-effort revoke; cookie is cleared regardless.
				s.log.Warn("session delete", "err", err)
			}
		}
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cookieSecure,
	})
}

func (s *Server) apiMe(w http.ResponseWriter, r *http.Request) {
	u, ok := s.userFromRequest(r)
	if !ok {
		s.writeJSON(w, http.StatusOK, map[string]any{"user": nil})
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"user": userAuthJSON(u)})
}

func (s *Server) apiAuthAppearance(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	var body struct {
		UITheme string `json:"ui_theme"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	theme := normalizeUITheme(body.UITheme)
	ctx := r.Context()
	if err := s.store.UpdateUserUITheme(ctx, u.ID, theme); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "appearance update", err)
		return
	}
	u2, err := s.store.UserByID(ctx, u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "appearance reload user", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "user": userAuthJSON(u2)})
}

func (s *Server) userFromRequest(r *http.Request) (*models.User, bool) {
	u, _, _, ok := s.sessionFromRequest(r)
	return u, ok
}

// navAuthFromRequest returns template data for the public topbar.
func (s *Server) navAuthFromRequest(r *http.Request) render.NavAuth {
	next := r.URL.Path
	if next == "" || !strings.HasPrefix(next, "/") {
		next = "/"
	}
	u, ok := s.userFromRequest(r)
	if !ok || u == nil {
		return render.NavAuth{LogoutNext: next}
	}
	return render.NavAuth{
		LoggedIn:   true,
		Email:      u.Email,
		Name:       u.Name,
		IsAdmin:    u.IsAdmin,
		UITheme:    normalizeUITheme(u.UITheme),
		LogoutNext: next,
	}
}

func (s *Server) requireUser(w http.ResponseWriter, r *http.Request) (*models.User, bool) {
	u, ok := s.userFromRequest(r)
	if !ok {
		s.writeErr(w, http.StatusUnauthorized, "login required")
		return nil, false
	}
	return u, true
}

func (s *Server) requireAdmin(w http.ResponseWriter, r *http.Request) (*models.User, bool) {
	if st, ok := StaffFromContext(r.Context()); ok {
		if st.DisabledAt != nil || st.PasswordHash == "$disabled$" {
			s.writeErr(w, http.StatusForbidden, "staff account disabled")
			return nil, false
		}
		if !staffRoleAtLeast(st.Role, models.StaffRoleOperator) {
			s.writeErr(w, http.StatusForbidden, "operator access required")
			return nil, false
		}
		return nil, true
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return nil, false
	}
	if !u.IsAdmin {
		s.writeErr(w, http.StatusForbidden, "admin required")
		return nil, false
	}
	return u, true
}

type pgpUploadBody struct {
	Armored string `json:"armored"`
	Label   string `json:"label,omitempty"`
}

func (s *Server) apiPGPUpload(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	var body pgpUploadBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	meta, err := openpgp.ParseArmoredPublicKeyMeta(body.Armored)
	if err != nil {
		s.log.Warn("pgp parse armored", "err", err)
		s.writeErr(w, http.StatusBadRequest, "invalid armored public key")
		return
	}
	k := &models.PGPPublicKey{
		Fingerprint16: meta.Fingerprint16,
		FullKeyID:     meta.FullKeyID,
		Armored:       strings.TrimSpace(body.Armored),
		Label:         strings.TrimSpace(body.Label),
	}
	if err := s.store.InsertPGPKey(r.Context(), k); err != nil {
		s.writeErrAPIInternal(w, "pgp insert key", err)
		return
	}
	s.invalidateContentCache()
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "fingerprint16": k.Fingerprint16})
}

func (s *Server) apiMigratePosts(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	n, err := migrate.PostsFromDisk(r.Context(), s.store, filepath.Join(s.root, "content"))
	if err != nil {
		s.writeErrAPIInternal(w, "migrate posts from disk", err)
		return
	}
	s.invalidateContentCache()
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "upserted": n})
}

func (s *Server) apiPostsList(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	docs, err := s.store.ListPosts(ctx)
	if err != nil {
		s.writeErrAPIInternal(w, "posts list", err)
		return
	}
	s.writeJSON(w, http.StatusOK, docs)
}

type postUpsertBody struct {
	Slug               string `json:"slug"`
	BodyMarkdown       string `json:"body_markdown"`
	DetachedOpenPGPSig string `json:"detached_openpgp_sig,omitempty"`
	DetachedMinisig    string `json:"detached_minisig,omitempty"`
	OpenPGPKeyID       string `json:"openpgp_key_id,omitempty"`
}

func (s *Server) apiPostUpsert(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	var body postUpsertBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	body.Slug = strings.TrimSpace(body.Slug)
	if body.Slug == "" || strings.TrimSpace(body.BodyMarkdown) == "" {
		s.writeErr(w, http.StatusBadRequest, "slug and body_markdown required")
		return
	}
	mdr := markdown.NewRenderer()
	parsed, skip, err := blog.ParsePostMarkdown("", "api/"+body.Slug+".md", []byte(body.BodyMarkdown), mdr, nil, nil)
	if err != nil {
		s.log.Warn("post markdown parse", "slug", body.Slug, "err", err)
		s.writeErr(w, http.StatusBadRequest, "invalid post markdown")
		return
	}
	if skip {
		s.writeErr(w, http.StatusBadRequest, "draft posts are not accepted on this endpoint")
		return
	}
	if parsed.Slug != body.Slug {
		s.writeErr(w, http.StatusBadRequest, "slug must match slug: in front matter")
		return
	}
	sigArmor := strings.TrimSpace(body.DetachedOpenPGPSig)
	miniSig := strings.TrimSpace(body.DetachedMinisig)
	if sigArmor != "" && miniSig != "" {
		s.writeErr(w, http.StatusBadRequest, "only one of detached_openpgp_sig or detached_minisig may be set")
		return
	}
	fp := strings.TrimSpace(strings.ToUpper(body.OpenPGPKeyID))
	if miniSig != "" {
		if fp != "" {
			s.writeErr(w, http.StatusBadRequest, "openpgp_key_id is only used with detached_openpgp_sig")
			return
		}
		pubPath := filepath.Join(s.root, "content", "blog", "signing.pub")
		if fi, err := os.Stat(pubPath); err != nil || fi.IsDir() {
			s.writeErr(w, http.StatusBadRequest, "detached_minisig requires content/blog/signing.pub on the server")
			return
		}
		st, err := blog.VerifyMinisigDetached(pubPath, []byte(body.BodyMarkdown), []byte(miniSig))
		if err != nil {
			s.log.Warn("minisign verify", "slug", body.Slug, "err", err)
			s.writeErr(w, http.StatusBadRequest, "minisign verification failed")
			return
		}
		if !st.VerifiedOK {
			s.log.Warn("minisign verify failed", "slug", body.Slug, "detail", st.ErrMsg)
			s.writeErr(w, http.StatusBadRequest, "minisign verification failed")
			return
		}
	}
	if sigArmor != "" {
		if fp != "" {
			arm, err := s.store.PGPPublicKeyArmoredByFingerprint16(r.Context(), fp)
			if err != nil || arm == "" {
				s.writeErr(w, http.StatusBadRequest, "openpgp_key_id must match an uploaded key when signature is set")
				return
			}
			if err := openpgp.VerifyDetached(arm, []byte(body.BodyMarkdown), []byte(sigArmor)); err != nil {
				s.log.Warn("openpgp verify detached", "slug", body.Slug, "err", err)
				s.writeErr(w, http.StatusBadRequest, "signature verification failed")
				return
			}
		} else {
			keys, err := s.store.ListPGPKeys(r.Context())
			if err != nil || len(keys) == 0 {
				s.writeErr(w, http.StatusBadRequest, "detached_openpgp_sig requires at least one uploaded key or openpgp_key_id")
				return
			}
			var ok bool
			for _, k := range keys {
				if err := openpgp.VerifyDetached(k.Armored, []byte(body.BodyMarkdown), []byte(sigArmor)); err == nil {
					fp = k.Fingerprint16
					ok = true
					break
				}
			}
			if !ok {
				s.writeErr(w, http.StatusBadRequest, "signature does not verify with any uploaded key")
				return
			}
		}
	}
	bp := &models.BlogPost{
		Slug:               parsed.Slug,
		Title:              parsed.Title,
		Date:               parsed.Date,
		DisplayDate:        parsed.DisplayDate,
		Time:               parsed.Time,
		Type:               parsed.Type,
		Tags:               parsed.Tags,
		Bytes:              parsed.Bytes,
		Reach:              parsed.Reach,
		Draft:              parsed.Draft,
		BodyMarkdown:       body.BodyMarkdown,
		DetachedOpenPGPSig: sigArmor,
		DetachedMinisig:    miniSig,
		OpenPGPKeyID:       fp,
	}
	if err := s.store.UpsertPostBySlug(r.Context(), bp); err != nil {
		s.writeErrAPIInternal(w, "post upsert", err)
		return
	}
	s.invalidateContentCache()
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "slug": body.Slug})
}

// apiToolCalls returns per-slug counts when Valkey is configured (same keys as GET /go/<slug>/).
func (s *Server) apiToolCalls(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	h, err := s.loadHome(ctx)
	if err != nil {
		s.writeErrAPIInternal(w, "tool calls load home", err)
		return
	}
	if s.toolCalls == nil {
		s.writeJSON(w, http.StatusOK, map[string]any{"live": false, "counts": map[string]int64{}})
		return
	}
	slugs := make([]string, 0, len(h.Tools))
	for _, t := range h.Tools {
		if strings.TrimSpace(t.Slug) != "" {
			slugs = append(slugs, t.Slug)
		}
	}
	counts, err := s.toolCalls.GetMany(ctx, slugs)
	if err != nil {
		s.writeErrAPIUnavailable(w, "tool calls get many", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"live": true, "counts": counts})
}

// apiUptime returns the latest probe snapshot; target URLs are omitted from the public JSON.
func (s *Server) apiUptime(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	if s.getUptimeMem() == nil && s.uptimeSnap != nil {
		if _, _, err := s.uptimeSnap.GetSnapshot(ctx); err != nil {
			s.writeErrAPIInternal(w, "uptime snapshot", err)
			return
		}
	}
	s.writeJSON(w, http.StatusOK, s.uptimeAPIPayload(ctx))
}
