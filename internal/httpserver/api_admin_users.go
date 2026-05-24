package httpserver

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"elvish/internal/store"
)

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
	query := strings.TrimSpace(r.URL.Query().Get("q"))

	users, total, err := s.store.ListUsers(r.Context(), offset, limit, query)
	if err != nil {
		s.writeErrAPIInternal(w, "list users", err)
		return
	}

	type userItem struct {
		ID        string `json:"id"`
		Email     string `json:"email"`
		Name      string `json:"name,omitempty"`
		IsAdmin   bool   `json:"is_admin"`
		CreatedAt string `json:"created_at"`
	}
	items := make([]userItem, 0, len(users))
	for _, u := range users {
		items = append(items, userItem{
			ID:        u.ID.String(),
			Email:     u.Email,
			Name:      u.Name,
			IsAdmin:   u.IsAdmin,
			CreatedAt: u.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	s.writeJSON(w, http.StatusOK, map[string]any{
		"users": items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
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

	user, err := s.store.UserByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "get user", err)
		return
	}

	out := map[string]any{
		"id":         user.ID.String(),
		"email":      user.Email,
		"name":       user.Name,
		"is_admin":   user.IsAdmin,
		"created_at": user.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
	if strings.TrimSpace(r.URL.Query().Get("expand")) == "mail" && s.mailmeta != nil {
		identN, errI := s.mailmeta.CountActiveIdentities(r.Context(), userID)
		if errI != nil {
			s.writeErrAPIInternal(w, "count identities", errI)
			return
		}
		domN, errD := s.mailmeta.CountOwnedMailDomains(r.Context(), userID)
		if errD != nil {
			s.writeErrAPIInternal(w, "count domains", errD)
			return
		}
		alN, errA := s.mailmeta.CountDomainAllowlistMemberships(r.Context(), userID)
		if errA != nil {
			s.writeErrAPIInternal(w, "count allowlist", errA)
			return
		}
		out["identity_count"] = identN
		out["owned_domain_count"] = domN
		out["shared_domain_allowlist_count"] = alN
	}

	s.writeJSON(w, http.StatusOK, out)
}

func (s *Server) apiAdminUsersDisable(w http.ResponseWriter, r *http.Request, idStr string) {
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

	if err := s.store.UpdateUserPasswordHash(r.Context(), userID, store.DisabledPasswordHash()); err != nil {
		s.writeErrAPIInternal(w, "disable user", err)
		return
	}

	if s.sessions != nil {
		_ = s.sessions.DeleteUserSessions(r.Context(), userID)
	}

	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
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

	if err := s.store.DeleteUser(r.Context(), userID); err != nil {
		s.writeErrAPIInternal(w, "delete user", err)
		return
	}

	if s.sessions != nil {
		_ = s.sessions.DeleteUserSessions(r.Context(), userID)
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
	case strings.HasPrefix(p, "/") && r.Method == http.MethodDelete:
		idStr := strings.TrimPrefix(p, "/")
		s.apiAdminUsersDelete(w, r, idStr)
	default:
		http.NotFound(w, r)
	}
}
