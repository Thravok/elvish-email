package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"elvish/libs/go/models"
	"elvish/libs/go/store"
)

func userPasswordDisabled(hash string) bool {
	return strings.TrimSpace(hash) == store.DisabledPasswordHash()
}

func userAuthMethodLabel(u *models.User) string {
	if u == nil {
		return "unknown"
	}
	if userPasswordDisabled(u.PasswordHash) {
		return "disabled"
	}
	if strings.TrimSpace(u.AuthMethod) == "srp" {
		return "srp"
	}
	if strings.TrimSpace(u.PasswordHash) == store.SRPPasswordHash() {
		return "srp"
	}
	return "legacy"
}

func adminUserListItem(u models.User) map[string]any {
	return map[string]any{
		"id":          u.ID.String(),
		"email":       u.Email,
		"name":        u.Name,
		"is_admin":    u.IsAdmin,
		"disabled":    userPasswordDisabled(u.PasswordHash),
		"auth_method": userAuthMethodLabel(&u),
		"ui_theme":    u.UITheme,
		"created_at":  u.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

func (s *Server) apiAdminUsersList(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	f := store.AdminUserListFilter{
		Query:  strings.TrimSpace(r.URL.Query().Get("q")),
		Status: strings.TrimSpace(r.URL.Query().Get("status")),
	}
	if f.Status == "" {
		f.Status = "all"
	}
	if v := strings.TrimSpace(r.URL.Query().Get("admin")); v != "" {
		b := v == "true" || v == "1"
		f.Admin = &b
	}

	users, total, err := s.store.ListUsersAdmin(r.Context(), offset, limit, f)
	if err != nil {
		if strings.Contains(err.Error(), "invalid status") {
			s.writeErr(w, http.StatusBadRequest, "invalid status filter")
			return
		}
		s.writeErrAPIInternal(w, "list users", err)
		return
	}

	items := make([]map[string]any, 0, len(users))
	for _, u := range users {
		items = append(items, adminUserListItem(u))
	}

	s.writeJSON(w, http.StatusOK, map[string]any{
		"users": items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (s *Server) adminUserDetailResponse(ctx context.Context, user *models.User, expand string) (map[string]any, error) {
	if user == nil {
		return nil, store.ErrNotFound
	}
	out := adminUserListItem(*user)
	if user.ScheduledDeleteAt != nil {
		out["scheduled_delete_at"] = user.ScheduledDeleteAt.UTC().Format("2006-01-02T15:04:05Z")
	}
	if user.ScheduledDeleteReason != "" {
		out["scheduled_delete_reason"] = user.ScheduledDeleteReason
	}
	if !user.LastActivityAt.IsZero() {
		out["last_activity_at"] = user.LastActivityAt.UTC().Format("2006-01-02T15:04:05Z")
	}
	if user.InactivityDeleteValue > 0 && strings.TrimSpace(user.InactivityDeleteUnit) != "" {
		out["inactivity_policy"] = map[string]any{
			"value": user.InactivityDeleteValue,
			"unit":  user.InactivityDeleteUnit,
		}
	}

	exp := strings.TrimSpace(expand)
	if strings.Contains(exp, "mail") && s.mailmeta != nil {
		identN, errI := s.mailmeta.CountActiveIdentities(ctx, user.ID)
		if errI != nil {
			return nil, errI
		}
		domN, errD := s.mailmeta.CountOwnedMailDomains(ctx, user.ID)
		if errD != nil {
			return nil, errD
		}
		alN, errA := s.mailmeta.CountDomainAllowlistMemberships(ctx, user.ID)
		if errA != nil {
			return nil, errA
		}
		out["identity_count"] = identN
		out["owned_domain_count"] = domN
		out["shared_domain_allowlist_count"] = alN
	}
	if strings.Contains(exp, "auth") {
		mfa, err := s.store.GetMFASettings(ctx, user.ID)
		if err != nil {
			return nil, err
		}
		out["mfa_enabled"] = mfa != nil && mfa.Enabled
	}
	return out, nil
}

func (s *Server) apiAdminUsersGet(w http.ResponseWriter, r *http.Request, idStr string) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}

	userID, err := uuid.Parse(idStr)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}

	user, err := s.store.UserLifecycleByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "get user", err)
		return
	}

	out, err := s.adminUserDetailResponse(r.Context(), user, r.URL.Query().Get("expand"))
	if err != nil {
		s.writeErrAPIInternal(w, "get user detail", err)
		return
	}
	s.writeJSON(w, http.StatusOK, out)
}

func (s *Server) apiAdminUsersDisable(w http.ResponseWriter, r *http.Request, idStr string) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}

	userID, err := uuid.Parse(idStr)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if admin.ID == userID {
		s.writeErr(w, http.StatusBadRequest, "cannot disable yourself")
		return
	}

	target, err := s.store.UserAuthByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "disable user", err)
		return
	}
	if target.IsAdmin {
		n, err := s.store.CountAdminUsers(r.Context())
		if err != nil {
			s.writeErrAPIInternal(w, "count admins", err)
			return
		}
		if n <= 1 {
			s.writeErr(w, http.StatusBadRequest, "cannot disable the last admin")
			return
		}
	}

	if err := s.store.UpdateUserPasswordHash(r.Context(), userID, store.DisabledPasswordHash()); err != nil {
		s.writeErrAPIInternal(w, "disable user", err)
		return
	}
	if s.sessions != nil {
		_ = s.sessions.DeleteUserSessions(r.Context(), userID)
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) apiAdminUsersEnable(w http.ResponseWriter, r *http.Request, idStr string) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}

	userID, err := uuid.Parse(idStr)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}

	user, err := s.store.UserAuthByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "enable user", err)
		return
	}
	if !userPasswordDisabled(user.PasswordHash) {
		s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "already_active": true})
		return
	}
	if strings.TrimSpace(user.AuthMethod) == "srp" && len(user.SRPSalt) > 0 && len(user.SRPVerifier) > 0 {
		if err := s.store.UpdateUserPasswordHash(r.Context(), userID, store.SRPPasswordHash()); err != nil {
			s.writeErrAPIInternal(w, "enable user", err)
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	s.writeErr(w, http.StatusConflict, "cannot re-enable legacy disabled accounts without a password reset")
}

func (s *Server) apiAdminUsersPatch(w http.ResponseWriter, r *http.Request, idStr string) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}

	userID, err := uuid.Parse(idStr)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var body struct {
		IsAdmin *bool `json:"is_admin"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.IsAdmin == nil {
		s.writeErr(w, http.StatusBadRequest, "is_admin required")
		return
	}

	target, err := s.store.UserByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "patch user", err)
		return
	}

	if target.IsAdmin && !*body.IsAdmin {
		if admin.ID == userID {
			s.writeErr(w, http.StatusBadRequest, "cannot demote yourself")
			return
		}
		n, err := s.store.CountAdminUsers(r.Context())
		if err != nil {
			s.writeErrAPIInternal(w, "count admins", err)
			return
		}
		if n <= 1 {
			s.writeErr(w, http.StatusBadRequest, "cannot demote the last admin")
			return
		}
	}

	if err := s.store.UpdateUserIsAdmin(r.Context(), userID, *body.IsAdmin); err != nil {
		s.writeErrAPIInternal(w, "patch user", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "is_admin": *body.IsAdmin})
}

func (s *Server) apiAdminUsersDelete(w http.ResponseWriter, r *http.Request, idStr string) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}

	userID, err := uuid.Parse(idStr)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if admin.ID == userID {
		s.writeErr(w, http.StatusBadRequest, "cannot delete yourself")
		return
	}

	target, err := s.store.UserByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "delete user", err)
		return
	}
	if target.IsAdmin {
		n, err := s.store.CountAdminUsers(r.Context())
		if err != nil {
			s.writeErrAPIInternal(w, "count admins", err)
			return
		}
		if n <= 1 {
			s.writeErr(w, http.StatusBadRequest, "cannot delete the last admin")
			return
		}
	}

	if err := s.purgeUserAccount(r.Context(), userID); err != nil {
		s.writeErrAPIInternal(w, "delete user", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminUsersAPI(w http.ResponseWriter, r *http.Request, p string) {
	switch {
	case p == "" && r.Method == http.MethodGet:
		s.apiAdminUsersList(w, r)
	case strings.HasPrefix(p, "/") && r.Method == http.MethodGet:
		idStr := strings.TrimPrefix(p, "/")
		if idx := strings.Index(idStr, "/"); idx != -1 {
			idStr = idStr[:idx]
		}
		s.apiAdminUsersGet(w, r, idStr)
	case strings.HasSuffix(p, "/disable") && r.Method == http.MethodPost:
		idStr := strings.TrimPrefix(p, "/")
		idStr = strings.TrimSuffix(idStr, "/disable")
		s.apiAdminUsersDisable(w, r, idStr)
	case strings.HasSuffix(p, "/enable") && r.Method == http.MethodPost:
		idStr := strings.TrimPrefix(p, "/")
		idStr = strings.TrimSuffix(idStr, "/enable")
		s.apiAdminUsersEnable(w, r, idStr)
	case strings.HasPrefix(p, "/") && r.Method == http.MethodPatch:
		idStr := strings.TrimPrefix(p, "/")
		s.apiAdminUsersPatch(w, r, idStr)
	case strings.HasPrefix(p, "/") && r.Method == http.MethodDelete:
		idStr := strings.TrimPrefix(p, "/")
		s.apiAdminUsersDelete(w, r, idStr)
	default:
		http.NotFound(w, r)
	}
}
