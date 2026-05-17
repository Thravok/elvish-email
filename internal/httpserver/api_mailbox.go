package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/mailmeta"
	"elvish/internal/store"
)

// handleMailboxAPI dispatches /api/v1/mailbox/folders.
func (s *Server) handleMailboxAPI(w http.ResponseWriter, r *http.Request, p string) {
	if s.mailmeta == nil || s.scylla == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem not configured")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if !s.rateLimitMailUser(w, r, u.ID.String()) {
		return
	}
	rest := strings.TrimPrefix(p, "v1/mailbox")
	rest = strings.TrimPrefix(rest, "/")
	parts := strings.FieldsFunc(rest, func(c rune) bool { return c == '/' })
	if len(parts) == 0 || parts[0] != "folders" {
		http.NotFound(w, r)
		return
	}
	switch len(parts) {
	case 1:
		switch r.Method {
		case http.MethodGet:
			s.apiMailboxFoldersList(w, r, u.ID)
		case http.MethodPost:
			s.apiMailboxFoldersCreate(w, r, u.ID)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case 2:
		if r.Method != http.MethodDelete {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		s.apiMailboxFoldersDelete(w, r, u.ID, parts[1])
	default:
		http.NotFound(w, r)
	}
}

func folderEntryJSON(name string, standard bool, total, unread int64, customCreatedAt string) map[string]any {
	m := map[string]any{
		"name":        name,
		"total":       total,
		"unread":      unread,
		"is_standard": standard,
	}
	if customCreatedAt != "" {
		m["created_at"] = customCreatedAt
	}
	return m
}

func (s *Server) apiMailboxFoldersList(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	ctx := r.Context()
	custom, err := s.mailmeta.ListUserFolders(ctx, userID)
	if err != nil {
		s.writeErrAPIInternal(w, "folders list", err)
		return
	}
	standardNames := []string{mailmeta.FolderInbox, mailmeta.FolderSent, mailmeta.FolderDrafts, mailmeta.FolderTrash, mailmeta.FolderArchive}
	out := make([]map[string]any, 0, len(standardNames)+len(custom))
	for _, name := range standardNames {
		n, err := s.scylla.CountMailbox(ctx, userID, name)
		if err != nil {
			s.logHTTPServer("folder count", err)
			n = 0
		}
		out = append(out, folderEntryJSON(name, true, n, 0, ""))
	}
	for _, f := range custom {
		n, err := s.scylla.CountMailbox(ctx, userID, f.Name)
		if err != nil {
			s.logHTTPServer("folder count", err)
			n = 0
		}
		out = append(out, folderEntryJSON(f.Name, false, n, 0, f.CreatedAt.UTC().Format(time.RFC3339Nano)))
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"folders": out})
}

type mailboxFolderBody struct {
	Name string `json:"name"`
}

func (s *Server) apiMailboxFoldersCreate(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var body mailboxFolderBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	name := strings.TrimSpace(strings.ToLower(body.Name))
	if name == "" || len(name) > 50 {
		s.writeErr(w, http.StatusBadRequest, "folder name required (max 50 chars)")
		return
	}
	if !validFolderName(name) {
		s.writeErr(w, http.StatusBadRequest, "only letters, numbers, dashes, and underscores")
		return
	}
	if err := s.mailmeta.CreateUserFolder(r.Context(), userID, name); err != nil {
		if strings.Contains(err.Error(), "reserved") {
			s.writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if store.IsDuplicateKey(err) {
			s.writeErr(w, http.StatusConflict, "folder already exists")
			return
		}
		s.writeErrAPIInternal(w, "folder create", err)
		return
	}
	s.writeJSON(w, http.StatusCreated, map[string]any{
		"folder": map[string]any{"name": name, "is_standard": false, "total": 0, "unread": 0},
	})
}

func (s *Server) apiMailboxFoldersDelete(w http.ResponseWriter, r *http.Request, userID uuid.UUID, nameEnc string) {
	name := strings.TrimSpace(strings.ToLower(nameEnc))
	if name == "" {
		s.writeErr(w, http.StatusBadRequest, "name required")
		return
	}
	if err := s.mailmeta.DeleteUserFolder(r.Context(), userID, name); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "folder not found")
			return
		}
		s.writeErrAPIInternal(w, "folder delete", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func validFolderName(s string) bool {
	for _, c := range s {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			continue
		}
		return false
	}
	return true
}
