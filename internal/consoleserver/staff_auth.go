package consoleserver

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"elvish/internal/consoleapi"
	"elvish/internal/httpserver"
	"elvish/internal/models"
	"elvish/internal/staffsession"
	"elvish/internal/store"
	"elvish/internal/supportvault"
)

const staffDisabledSentinel = "$disabled$"

// Server is the ELVish Console HTTP service.
type Server struct {
	log           *slog.Logger
	root          string
	staticRoot    string
	store         *store.Store
	staffSessions *staffsession.Store
	platform      *httpserver.Server
	platformAPI   *consoleapi.Platform
	vault         *supportvault.Vault
	cookieSecure  bool
	publicURL     string
}

// Options configures the Console server.
type Options struct {
	Root         string
	CookieSecure bool
	Logger       *slog.Logger
	PublicURL    string
}

// New creates a Console server. platform must be a fully wired httpserver.Server for operator APIs.
func New(opts Options, sqlStore *store.Store, staffSess *staffsession.Store, platform *httpserver.Server, vault *supportvault.Vault) (*Server, error) {
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	root := opts.Root
	if root == "" {
		root = "."
	}
	staticRoot := filepath.Join(root, "static", "console")
	s := &Server{
		log:           opts.Logger,
		root:          root,
		staticRoot:    staticRoot,
		store:         sqlStore,
		staffSessions: staffSess,
		platform:      platform,
		platformAPI:   &consoleapi.Platform{Srv: platform},
		vault:         vault,
		cookieSecure:  opts.CookieSecure,
		publicURL:     strings.TrimRight(strings.TrimSpace(opts.PublicURL), "/"),
	}
	return s, nil
}

// Handler returns the root HTTP handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealthz)
	mux.HandleFunc("/api/", s.handleAPI)
	mux.HandleFunc("/", s.handleStatic)
	return mux
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (s *Server) handleAPI(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	switch {
	case path == "/api/healthz" && r.Method == http.MethodGet:
		s.handleHealthz(w, r)
	case strings.HasPrefix(path, "/api/staff/"):
		s.handleStaffAPI(w, r, strings.TrimPrefix(path, "/api/staff/"))
	case strings.HasPrefix(path, "/api/console/"):
		r2, st, ok := s.injectStaffContext(w, r)
		if !ok {
			return
		}
		if !roleAtLeast(st.Role, models.StaffRoleOperator) {
			s.writeErr(w, http.StatusForbidden, "operator access required")
			return
		}
		s.platformAPI.Handle(w, r2)
	case strings.HasPrefix(path, "/api/support/"):
		r2, st, ok := s.injectStaffContext(w, r)
		if !ok {
			return
		}
		if !roleAtLeast(st.Role, models.StaffRoleSupportAgent) {
			s.writeErr(w, http.StatusForbidden, "support access required")
			return
		}
		_ = st
		s.handleSupportAPI(w, r2, strings.TrimPrefix(path, "/api/support/"))
	case path == "/api/bootstrap.json" && r.Method == http.MethodGet:
		r2, st, ok := s.injectStaffContext(w, r)
		if !ok {
			return
		}
		if !roleAtLeast(st.Role, models.StaffRoleOperator) {
			s.writeErr(w, http.StatusForbidden, "operator access required")
			return
		}
		s.platform.RoutePlatformConsoleAPI(w, r2, "/bootstrap.json")
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) handleStaffAPI(w http.ResponseWriter, r *http.Request, sub string) {
	sub = strings.TrimPrefix(sub, "/")
	switch {
	case sub == "login" && r.Method == http.MethodPost:
		s.apiStaffLogin(w, r)
	case sub == "logout" && r.Method == http.MethodPost:
		s.apiStaffLogout(w, r)
	case sub == "me" && r.Method == http.MethodGet:
		s.apiStaffMe(w, r)
	case strings.HasPrefix(sub, "users"):
		s.handleStaffUsersAPI(w, r, strings.TrimPrefix(sub, "users"))
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) staffFromRequest(r *http.Request) (*models.StaffUser, bool) {
	if s.store == nil || s.staffSessions == nil {
		return nil, false
	}
	c, err := r.Cookie(staffsession.CookieName())
	if err != nil || c.Value == "" {
		return nil, false
	}
	payload, err := s.staffSessions.Get(r.Context(), c.Value)
	if err != nil {
		return nil, false
	}
	id, err := uuid.Parse(payload.StaffID)
	if err != nil {
		return nil, false
	}
	st, err := s.store.StaffByID(r.Context(), id)
	if err != nil {
		return nil, false
	}
	return st, true
}

func (s *Server) injectStaffContext(w http.ResponseWriter, r *http.Request) (*http.Request, *models.StaffUser, bool) {
	st, ok := s.staffFromRequest(r)
	if !ok {
		s.writeErr(w, http.StatusUnauthorized, "login required")
		return r, nil, false
	}
	return httpserver.WithStaffContext(r, st), st, true
}

func (s *Server) apiStaffLogin(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.staffSessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	email := strings.TrimSpace(strings.ToLower(body.Email))
	if email == "" || body.Password == "" {
		s.writeErr(w, http.StatusBadRequest, "email and password required")
		return
	}
	st, err := s.store.StaffByEmail(r.Context(), email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		s.writeErr(w, http.StatusInternalServerError, "login failed")
		return
	}
	if st.DisabledAt != nil || st.PasswordHash == staffDisabledSentinel {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(st.PasswordHash), []byte(body.Password)); err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	token, err := s.staffSessions.Create(r.Context(), st.ID, st.Email, string(st.Role))
	if err != nil {
		s.writeErr(w, http.StatusInternalServerError, "session failed")
		return
	}
	s.setStaffCookie(w, token)
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"staff": map[string]any{
			"id":    st.ID.String(),
			"email": st.Email,
			"name":  st.Name,
			"role":  st.Role,
		},
	})
}

func (s *Server) apiStaffLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(staffsession.CookieName()); err == nil && c.Value != "" && s.staffSessions != nil {
		_ = s.staffSessions.Delete(r.Context(), c.Value)
	}
	s.clearStaffCookie(w)
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) apiStaffMe(w http.ResponseWriter, r *http.Request) {
	st, ok := s.staffFromRequest(r)
	if !ok {
		s.writeJSON(w, http.StatusOK, map[string]any{"staff": nil})
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"staff": map[string]any{
			"id":    st.ID.String(),
			"email": st.Email,
			"name":  st.Name,
			"role":  st.Role,
		},
	})
}

func (s *Server) handleStaffUsersAPI(w http.ResponseWriter, r *http.Request, p string) {
	st, ok := s.staffFromRequest(r)
	if !ok {
		s.writeErr(w, http.StatusUnauthorized, "login required")
		return
	}
	if !roleAtLeast(st.Role, models.StaffRoleSuperAdmin) {
		s.writeErr(w, http.StatusForbidden, "super_admin required")
		return
	}
	p = strings.TrimPrefix(p, "/")
	switch {
	case p == "" && r.Method == http.MethodGet:
		s.apiStaffUsersList(w, r)
	case p == "" && r.Method == http.MethodPost:
		s.apiStaffUsersCreate(w, r)
	case strings.HasPrefix(p, "/") && r.Method == http.MethodDelete:
		idStr := strings.TrimPrefix(p, "/")
		s.apiStaffUsersDelete(w, r, idStr, st.ID)
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) apiStaffUsersList(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset := (page - 1) * limit
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	users, total, err := s.store.ListStaffUsers(r.Context(), offset, limit, query)
	if err != nil {
		s.writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	items := make([]map[string]any, 0, len(users))
	for _, u := range users {
		items = append(items, map[string]any{
			"id":         u.ID.String(),
			"email":      u.Email,
			"name":       u.Name,
			"role":       u.Role,
			"created_at": u.CreatedAt.Format(time.RFC3339),
		})
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"staff": items, "total": total, "page": page, "limit": limit})
}

func (s *Server) apiStaffUsersCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string            `json:"email"`
		Name     string            `json:"name"`
		Password string            `json:"password"`
		Role     models.StaffRole  `json:"role"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		s.writeErr(w, http.StatusInternalServerError, "hash failed")
		return
	}
	u, err := s.store.CreateStaffUser(r.Context(), body.Email, body.Name, string(hash), body.Role)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "create failed")
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": u.ID.String()})
}

func (s *Server) apiStaffUsersDelete(w http.ResponseWriter, r *http.Request, idStr string, actor uuid.UUID) {
	id, err := uuid.Parse(idStr)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if id == actor {
		s.writeErr(w, http.StatusBadRequest, "cannot delete yourself")
		return
	}
	if err := s.store.DeleteStaffUser(r.Context(), id); err != nil {
		s.writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if s.staffSessions != nil {
		_ = s.staffSessions.DeleteStaffSessions(r.Context(), id)
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) setStaffCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     staffsession.CookieName(),
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((14 * 24 * time.Hour).Seconds()),
		Secure:   s.cookieSecure,
	})
}

func (s *Server) clearStaffCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     staffsession.CookieName(),
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		Secure:   s.cookieSecure,
	})
}

func (s *Server) writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) writeErr(w http.ResponseWriter, status int, msg string) {
	s.writeJSON(w, status, map[string]string{"error": msg})
}

func roleAtLeast(role, min models.StaffRole) bool {
	order := map[models.StaffRole]int{
		models.StaffRoleSupportAgent: 1,
		models.StaffRoleOperator:       2,
		models.StaffRoleSuperAdmin:     3,
	}
	return order[role] >= order[min]
}

// BootstrapStaff ensures initial super_admin accounts from ELVISH_STAFF_BOOTSTRAP_EMAILS.
func BootstrapStaff(ctx context.Context, st *store.Store, logger *slog.Logger) error {
	if st == nil {
		return nil
	}
	n, err := st.CountStaffUsers(ctx)
	if err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	raw := os.Getenv("ELVISH_STAFF_BOOTSTRAP_EMAILS")
	parts := strings.Split(raw, ",")
	if len(parts) == 0 {
		return nil
	}
	tempPass := os.Getenv("ELVISH_STAFF_BOOTSTRAP_PASSWORD")
	if tempPass == "" {
		tempPass = "changeme-console-" + uuid.New().String()[:8]
		if logger != nil {
			logger.Warn("ELVISH_STAFF_BOOTSTRAP_PASSWORD unset; using ephemeral bootstrap password — change immediately",
				"hint", "set ELVISH_STAFF_BOOTSTRAP_PASSWORD before first boot in production")
		}
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(tempPass), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	for _, p := range parts {
		email := strings.TrimSpace(strings.ToLower(p))
		if email == "" {
			continue
		}
		u, err := st.CreateStaffUser(ctx, email, "Bootstrap Admin", string(hash), models.StaffRoleSuperAdmin)
		if err != nil {
			return err
		}
		if logger != nil {
			logger.Info("bootstrapped console staff", "email", email, "id", u.ID.String())
		}
	}
	return nil
}

// ConstantTimeCompare wraps subtle for tests.
func constantTimeCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
