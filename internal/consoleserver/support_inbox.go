package consoleserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/ProtonMail/go-crypto/openpgp"
	"github.com/google/uuid"

	"elvish/internal/httpserver"
	"elvish/internal/models"
	"elvish/internal/scyllastore"
	"elvish/internal/store"
)

func (s *Server) handleSupportAPI(w http.ResponseWriter, r *http.Request, sub string) {
	sub = strings.TrimPrefix(sub, "/")
	switch {
	case sub == "inbox" && r.Method == http.MethodGet:
		s.apiSupportInboxList(w, r)
	case sub == "config" && r.Method == http.MethodGet:
		s.apiSupportConfigGet(w, r)
	case sub == "config" && r.Method == http.MethodPut:
		s.apiSupportConfigPut(w, r)
	case sub == "vault" && r.Method == http.MethodPut:
		s.apiSupportVaultPut(w, r)
	case strings.HasPrefix(sub, "inbox/") && r.Method == http.MethodGet:
		id := strings.TrimPrefix(sub, "inbox/")
		id = strings.TrimSuffix(id, "/")
		s.apiSupportInboxGet(w, r, id)
	case strings.HasPrefix(sub, "inbox/") && strings.HasSuffix(sub, "/reply") && r.Method == http.MethodPost:
		id := strings.TrimPrefix(sub, "inbox/")
		id = strings.TrimSuffix(id, "/reply")
		id = strings.TrimSuffix(id, "/")
		s.apiSupportInboxReply(w, r, id)
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) supportDeps() (*store.Store, *scyllastore.Store, bool) {
	if s.store == nil || s.platform == nil {
		return nil, nil, false
	}
	scy := s.platform.Scylla()
	return s.store, scy, scy != nil && s.platform.Blob() != nil
}

func (s *Server) apiSupportConfigGet(w http.ResponseWriter, r *http.Request) {
	st, _, ok := s.supportDeps()
	if !ok {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem required")
		return
	}
	cfg, err := st.GetSupportMailboxConfig(r.Context())
	if errors.Is(err, store.ErrNotFound) {
		s.writeJSON(w, http.StatusOK, map[string]any{"configured": false})
		return
	}
	if err != nil {
		s.writeErr(w, http.StatusInternalServerError, "load failed")
		return
	}
	hasVault := false
	if _, err := st.GetSupportKeyVault(r.Context(), cfg.PlatformUserID); err == nil {
		hasVault = true
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"configured":       true,
		"platform_user_id": cfg.PlatformUserID.String(),
		"primary_address":  cfg.PrimaryAddress,
		"status":           cfg.Status,
		"has_vault":        hasVault,
	})
}

func (s *Server) apiSupportConfigPut(w http.ResponseWriter, r *http.Request) {
	st, _, ok := s.supportDeps()
	if !ok {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	staff, _ := httpserver.StaffFromContext(r.Context())
	if staff == nil || !roleAtLeast(staff.Role, models.StaffRoleSuperAdmin) {
		s.writeErr(w, http.StatusForbidden, "super_admin required")
		return
	}
	var body struct {
		PlatformUserID string `json:"platform_user_id"`
		PrimaryAddress string `json:"primary_address"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	uid, err := uuid.Parse(strings.TrimSpace(body.PlatformUserID))
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid platform_user_id")
		return
	}
	addr := strings.TrimSpace(body.PrimaryAddress)
	if addr == "" {
		s.writeErr(w, http.StatusBadRequest, "primary_address required")
		return
	}
	if err := st.UpsertSupportMailboxConfig(r.Context(), uid, addr, "active"); err != nil {
		s.writeErr(w, http.StatusInternalServerError, "save failed")
		return
	}
	actor := staff.ID
	_ = st.InsertStaffAuditLog(r.Context(), &actor, "support.config.update", "support_mailbox", uid.String(), nil)
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) apiSupportVaultPut(w http.ResponseWriter, r *http.Request) {
	st, _, ok := s.supportDeps()
	if !ok || s.vault == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "vault not configured")
		return
	}
	staff, _ := httpserver.StaffFromContext(r.Context())
	if staff == nil || !roleAtLeast(staff.Role, models.StaffRoleSuperAdmin) {
		s.writeErr(w, http.StatusForbidden, "super_admin required")
		return
	}
	var body struct {
		PlatformUserID   string          `json:"platform_user_id"`
		AccountKeyJSON   json.RawMessage `json:"account_key_json"`
		IdentityKeysJSON json.RawMessage `json:"identity_keys_json"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	uid, err := uuid.Parse(strings.TrimSpace(body.PlatformUserID))
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid platform_user_id")
		return
	}
	encAcct, err := s.vault.Encrypt(body.AccountKeyJSON)
	if err != nil {
		s.writeErr(w, http.StatusInternalServerError, "encrypt failed")
		return
	}
	encIdent, err := s.vault.Encrypt(body.IdentityKeysJSON)
	if err != nil {
		s.writeErr(w, http.StatusInternalServerError, "encrypt failed")
		return
	}
	if err := st.UpsertSupportKeyVault(r.Context(), uid, encAcct, encIdent, s.vault.KeyID()); err != nil {
		s.writeErr(w, http.StatusInternalServerError, "save failed")
		return
	}
	actor := staff.ID
	_ = st.InsertStaffAuditLog(r.Context(), &actor, "support.vault.import", "platform_user", uid.String(), nil)
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) apiSupportInboxList(w http.ResponseWriter, r *http.Request) {
	st, scy, ok := s.supportDeps()
	if !ok {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem required")
		return
	}
	cfg, err := st.GetSupportMailboxConfig(r.Context())
	if errors.Is(err, store.ErrNotFound) {
		s.writeJSON(w, http.StatusOK, map[string]any{"items": []any{}, "configured": false})
		return
	}
	if err != nil {
		s.writeErr(w, http.StatusInternalServerError, "config failed")
		return
	}
	rows, err := scy.ListMailbox(r.Context(), cfg.PlatformUserID, "INBOX", time.Time{}, 50)
	if err != nil {
		s.writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		item := map[string]any{
			"message_id":  row.MessageID.String(),
			"received_at": row.ReceivedAt.UTC().Format(time.RFC3339),
			"provenance":  row.Provenance,
		}
		if meta, err := scy.GetOptInMetadata(r.Context(), cfg.PlatformUserID, row.MessageID); err == nil && meta != nil {
			item["subject"] = meta.Subject
			item["from"] = meta.FromAddr
		}
		items = append(items, item)
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"items": items, "configured": true})
}

func (s *Server) apiSupportInboxGet(w http.ResponseWriter, r *http.Request, idStr string) {
	st, scy, ok := s.supportDeps()
	if !ok {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem required")
		return
	}
	msgID, err := uuid.Parse(idStr)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid message id")
		return
	}
	cfg, err := st.GetSupportMailboxConfig(r.Context())
	if err != nil {
		s.writeErr(w, http.StatusServiceUnavailable, "support mailbox not configured")
		return
	}
	manifest, err := scy.GetManifest(r.Context(), cfg.PlatformUserID, msgID)
	if err != nil {
		s.writeErr(w, http.StatusNotFound, "message not found")
		return
	}
	out := map[string]any{
		"message_id": msgID.String(),
		"folder":     manifest.Folder,
		"provenance": manifest.Provenance,
	}
	if meta, err := scy.GetOptInMetadata(r.Context(), cfg.PlatformUserID, msgID); err == nil && meta != nil {
		out["subject"] = meta.Subject
		out["from"] = meta.FromAddr
		out["to"] = meta.ToAddrs
	}
	if bodyText, err := s.decryptSupportBody(r, cfg.PlatformUserID, manifest.BodyBlobRef); err == nil && bodyText != "" {
		out["body_text"] = bodyText
	} else if err != nil {
		out["body_error"] = "decrypt unavailable"
	}
	staff, _ := httpserver.StaffFromContext(r.Context())
	if staff != nil {
		actor := staff.ID
		_ = st.InsertStaffAuditLog(r.Context(), &actor, "support.inbox.read", "message", msgID.String(), nil)
	}
	s.writeJSON(w, http.StatusOK, out)
}

func (s *Server) decryptSupportBody(r *http.Request, platformUserID uuid.UUID, blobRef string) (string, error) {
	if s.vault == nil || s.store == nil || s.platform == nil || s.platform.Blob() == nil {
		return "", errors.New("vault unavailable")
	}
	vrec, err := s.store.GetSupportKeyVault(r.Context(), platformUserID)
	if err != nil {
		return "", err
	}
	identJSON, err := s.vault.Decrypt(vrec.EncryptedIdentityKeysJSON)
	if err != nil {
		return "", err
	}
	var keys []struct {
		ArmoredPrivate string `json:"armored_private"`
	}
	if err := json.Unmarshal(identJSON, &keys); err != nil || len(keys) == 0 || keys[0].ArmoredPrivate == "" {
		return "", errors.New("no identity keys")
	}
	ct, err := s.platform.Blob().Get(r.Context(), blobRef)
	if err != nil {
		return "", err
	}
	entity, err := openpgp.ReadArmoredKeyRing(strings.NewReader(keys[0].ArmoredPrivate))
	if err != nil {
		return "", err
	}
	md, err := openpgp.ReadMessage(strings.NewReader(string(ct)), entity, nil, nil)
	if err != nil {
		return "", err
	}
	plain, err := io.ReadAll(io.LimitReader(md.UnverifiedBody, 8<<20))
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func (s *Server) apiSupportInboxReply(w http.ResponseWriter, r *http.Request, idStr string) {
	st, scy, ok := s.supportDeps()
	if !ok {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem required")
		return
	}
	msgID, err := uuid.Parse(idStr)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid message id")
		return
	}
	cfg, err := st.GetSupportMailboxConfig(r.Context())
	if err != nil {
		s.writeErr(w, http.StatusServiceUnavailable, "support mailbox not configured")
		return
	}
	manifest, err := scy.GetManifest(r.Context(), cfg.PlatformUserID, msgID)
	if err != nil {
		s.writeErr(w, http.StatusNotFound, "message not found")
		return
	}
	var body struct {
		BodyText string `json:"body_text"`
		Subject  string `json:"subject"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 2<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	toAddr := ""
	if meta, err := scy.GetOptInMetadata(r.Context(), cfg.PlatformUserID, msgID); err == nil && meta != nil {
		if addr, err := mail.ParseAddress(meta.FromAddr); err == nil {
			toAddr = addr.Address
		}
	}
	if toAddr == "" {
		s.writeErr(w, http.StatusBadRequest, "cannot resolve reply recipient")
		return
	}
	subject := strings.TrimSpace(body.Subject)
	if subject == "" {
		subject = "Re: support"
	}
	res, err := s.platform.SubmitSupportPlaintextOutbox(r.Context(), cfg.PlatformUserID, httpserver.OutboxPlainBody{
		FromAddr: cfg.PrimaryAddress,
		ToAddrs:  []string{toAddr},
		Subject:  subject,
		BodyText: body.BodyText,
	})
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	staff, _ := httpserver.StaffFromContext(r.Context())
	if staff != nil {
		actor := staff.ID
		_ = st.InsertStaffAuditLog(r.Context(), &actor, "support.inbox.reply", "message", msgID.String(), map[string]any{
			"in_reply_to": manifest.MessageID.String(),
			"outbox_id":   res.String(),
		})
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "outbox_id": res.String()})
}
