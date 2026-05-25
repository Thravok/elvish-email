package httpserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/blobstore"
	"elvish/internal/mailmeta"
	"elvish/internal/mailops"
	"elvish/internal/mailpipe"
	"elvish/internal/mailutil"
	vopenpgp "elvish/internal/openpgp"
	"elvish/internal/scyllastore"
)

// mailStorageLikelySchemaIssue heuristically detects missing Scylla tables/columns (common dev misconfig).
func mailStorageLikelySchemaIssue(err error) bool {
	if err == nil {
		return false
	}
	s := strings.ToLower(err.Error())
	return strings.Contains(s, "invalid table") ||
		strings.Contains(s, "table") && strings.Contains(s, "does not exist") ||
		strings.Contains(s, "unconfigured table") ||
		strings.Contains(s, "no column") ||
		strings.Contains(s, "unknown identifier")
}

// handleMailAPI dispatches /api/v1/mail/* (the legacy plain-body model is removed; manifests + ciphertext only).
func (s *Server) handleMailAPI(w http.ResponseWriter, r *http.Request, p string) {
	if s.mailmeta == nil || s.scylla == nil || s.blob == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem not configured")
		return
	}
	rest := strings.TrimPrefix(p, "v1/mail")
	rest = strings.TrimPrefix(rest, "/")
	parts := strings.FieldsFunc(rest, func(c rune) bool { return c == '/' })
	if len(parts) == 0 {
		http.NotFound(w, r)
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if !s.rateLimitMailUser(w, r, u.ID.String()) {
		return
	}
	switch parts[0] {
	case "messages":
		s.routeMessages(w, r, u.ID, parts[1:])
		return
	case "settings":
		s.routeMailSettings(w, r, u.ID, parts[1:])
		return
	case "usable-domains":
		if len(parts) == 1 && r.Method == http.MethodGet {
			s.apiMailUsableDomains(w, r, u.ID)
			return
		}
		http.NotFound(w, r)
		return
	case "outbox":
		s.routeOutbox(w, r, u.ID, parts[1:])
		return
	case "outbox-plain":
		s.routeOutboxPlain(w, r, u.ID, u.Email, parts[1:])
		return
	case "protected-links":
		s.routeProtectedLinksAuthored(w, r, u.ID, parts[1:])
		return
	case "search":
		s.routeMailSearch(w, r, u.ID, parts[1:])
		return
	case "test":
		s.routeMailTest(w, r, u.ID, u.Email, parts[1:])
		return
	case "sender-icon":
		s.routeSenderIcon(w, r, parts[1:])
		return
	}
	http.NotFound(w, r)
}

func (s *Server) apiMailUsableDomains(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	list, err := s.mailmeta.ListUsableDomainsForUser(r.Context(), userID)
	if err != nil {
		s.writeErrAPIInternal(w, "usable domains", err)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, d := range list {
		out = append(out, map[string]any{"domain": d.Domain, "source": d.Source})
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"domains": out})
}

// ---- /api/v1/mail/messages ------------------------------------------------

func (s *Server) routeMessages(w http.ResponseWriter, r *http.Request, userID uuid.UUID, parts []string) {
	switch len(parts) {
	case 0:
		switch r.Method {
		case http.MethodGet:
			s.apiMailMessagesList(w, r, userID)
		case http.MethodPost:
			s.apiMailMessagesPost(w, r, userID)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case 1:
		switch r.Method {
		case http.MethodGet:
			s.apiMailManifestGet(w, r, userID, parts[0])
		case http.MethodPatch:
			s.apiMailMessagePatch(w, r, userID, parts[0])
		case http.MethodDelete:
			s.apiMailMessageDelete(w, r, userID, parts[0])
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case 2:
		if parts[1] == "blob" && r.Method == http.MethodGet {
			s.apiMailMessageBlob(w, r, userID, parts[0])
			return
		}
		http.NotFound(w, r)
	default:
		http.NotFound(w, r)
	}
}

// manifestJSON is the wire shape returned to the browser. header_ciphertext_b64
// is always present; sparse plaintext fields appear only if the user has
// consent for that field AND the row exists in opt_in_metadata_by_user.
type manifestJSON struct {
	ID                  string   `json:"id"`
	Folder              string   `json:"folder"`
	BodyBlobRef         string   `json:"body_blob_ref"`
	BodySizeBytes       int64    `json:"body_size_bytes"`
	HeaderCiphertextB64 string   `json:"header_ciphertext_b64"`
	Provenance          string   `json:"provenance"`
	Source              string   `json:"source"`
	HasAttachments      bool     `json:"has_attachments"`
	ReceivedAt          string   `json:"received_at"`
	Subject             string   `json:"subject,omitempty"`
	FromAddr            string   `json:"from_addr,omitempty"`
	ToAddrs             []string `json:"to_addrs,omitempty"`
	SentAt              string   `json:"sent_at,omitempty"`
	ThreadID            string   `json:"thread_id,omitempty"`
	FlagsSummary        string   `json:"flags_summary,omitempty"`
	Read                bool     `json:"read"`
	ExpiresAt           string   `json:"expires_at,omitempty"`
	MaxReads            int64    `json:"max_reads,omitempty"`
	Reads               int64    `json:"reads,omitempty"`
	ReadsRemaining      int64    `json:"reads_remaining,omitempty"`
	Expired             bool     `json:"expired,omitempty"`
	Burned              bool     `json:"burned,omitempty"`
}

func (s *Server) apiMailMessagesList(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	folder := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("folder")))
	if folder == "" {
		folder = mailmeta.FolderInbox
	}
	switch folder {
	case mailmeta.FolderInbox, mailmeta.FolderSent, mailmeta.FolderDrafts, mailmeta.FolderTrash, mailmeta.FolderArchive:
	default:
		ok, err := s.mailmeta.UserHasFolder(r.Context(), userID, folder)
		if err != nil || !ok {
			s.writeErr(w, http.StatusBadRequest, "unknown folder")
			return
		}
	}
	limit := 50
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	var before time.Time
	if v := strings.TrimSpace(r.URL.Query().Get("before")); v != "" {
		if t, err := time.Parse(time.RFC3339Nano, v); err == nil {
			before = t
		}
	}
	rows, err := s.scylla.ListMailbox(r.Context(), userID, folder, before, limit)
	if err != nil {
		s.logHTTPServer("mail list", err)
		msg := "mail storage unavailable"
		if mailStorageLikelySchemaIssue(err) {
			msg = "mail storage schema missing or out of date; run `make db-up` or `docker compose run --rm scylla-init`"
		}
		s.writeErr(w, http.StatusServiceUnavailable, msg)
		return
	}
	out := make([]manifestJSON, 0, len(rows))
	for _, row := range rows {
		mf, err := s.scylla.GetManifest(r.Context(), userID, row.MessageID)
		if err != nil {
			continue
		}
		out = append(out, s.buildManifestJSON(r.Context(), userID, &row, mf))
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"messages": out})
}

// buildManifestJSON merges manifest + sparse opt-in metadata from storage.
func (s *Server) buildManifestJSON(ctx context.Context, userID uuid.UUID, row *scyllastore.MailboxRow, mf *scyllastore.Manifest) manifestJSON {
	j := manifestJSON{
		ID:                  mf.MessageID.String(),
		Folder:              mf.Folder,
		BodyBlobRef:         mf.BodyBlobRef,
		BodySizeBytes:       mf.BodySizeBytes,
		HeaderCiphertextB64: base64.StdEncoding.EncodeToString(mf.HeaderCiphertext),
		Provenance:          mf.Provenance,
		Source:              mf.Source,
		HasAttachments:      mf.HasAttachments,
		ReceivedAt:          mf.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
	if row != nil {
		j.HasAttachments = row.HasAttachments
		j.ReceivedAt = row.ReceivedAt.UTC().Format(time.RFC3339Nano)
	}
	if flags, err := s.scylla.GetFlags(ctx, userID, mf.MessageID); err == nil && flags != nil {
		j.Read = flags.Read
	}
	s.applyManifestExpiry(ctx, userID, mf.MessageID, &j)
	opt, err := s.scylla.GetOptInMetadata(ctx, userID, mf.MessageID)
	if err != nil || opt == nil {
		return j
	}
	j.Subject = opt.Subject
	j.FromAddr = opt.FromAddr
	j.ToAddrs = opt.ToAddrs
	if !opt.SentAt.IsZero() {
		j.SentAt = opt.SentAt.UTC().Format(time.RFC3339Nano)
	}
	j.ThreadID = opt.ThreadID
	j.FlagsSummary = opt.FlagsSummary
	return j
}

func (s *Server) applyManifestExpiry(ctx context.Context, userID, messageID uuid.UUID, j *manifestJSON) {
	if s == nil || s.mailmeta == nil || j == nil {
		return
	}
	lc, err := s.mailmeta.GetMessageLifecycle(ctx, userID, messageID)
	if err != nil || lc == nil {
		return
	}
	now := time.Now().UTC()
	if lc.ExpiresAt != nil {
		j.ExpiresAt = lc.ExpiresAt.UTC().Format(time.RFC3339Nano)
	}
	if lc.MaxReads > 0 {
		j.MaxReads = lc.MaxReads
		j.Reads = lc.Reads
		j.ReadsRemaining = lc.MaxReads - lc.Reads
		if j.ReadsRemaining < 0 {
			j.ReadsRemaining = 0
		}
	}
	j.Expired = mailmeta.MessageLifecycleExpired(lc, now)
	j.Burned = lc.BurnedAt != nil || (lc.MaxReads > 0 && lc.Reads >= lc.MaxReads)
}

func (s *Server) apiMailManifestGet(w http.ResponseWriter, r *http.Request, userID uuid.UUID, idStr string) {
	id, err := uuid.Parse(strings.TrimSpace(idStr))
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	mf, err := s.scylla.GetManifest(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, scyllastore.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		s.writeErrAPIInternal(w, "mail manifest", err)
		return
	}
	s.writeJSON(w, http.StatusOK, s.buildManifestJSON(r.Context(), userID, nil, mf))
}

func (s *Server) apiMailMessageBlob(w http.ResponseWriter, r *http.Request, userID uuid.UUID, idStr string) {
	id, err := uuid.Parse(strings.TrimSpace(idStr))
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	mf, err := s.scylla.GetManifest(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, scyllastore.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		s.writeErrAPIInternal(w, "mail blob manifest", err)
		return
	}
	if err := s.enforceMessageReadable(r.Context(), userID, id, true); err != nil {
		switch {
		case errors.Is(err, mailmeta.ErrMessageExpired), errors.Is(err, mailmeta.ErrMessageBurned):
			s.writeErr(w, http.StatusGone, "message expired or read limit reached")
		case errors.Is(err, scyllastore.ErrNotFound), errors.Is(err, mailmeta.ErrNotFound):
			http.NotFound(w, r)
		default:
			s.writeErrAPIInternal(w, "mail blob access", err)
		}
		return
	}
	body, err := s.blob.Get(r.Context(), mf.BodyBlobRef)
	if err != nil {
		if errors.Is(err, blobstore.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		s.writeErrAPIInternal(w, "mail blob get", err)
		return
	}
	w.Header().Set("Content-Type", "application/pgp-encrypted")
	w.Header().Set("Cache-Control", "private, no-store")
	s.writeBytes(w, "mail blob", body)
}

// enforceMessageReadable rejects expired/burned messages and optionally consumes a read.
func (s *Server) enforceMessageReadable(ctx context.Context, userID, messageID uuid.UUID, consumeRead bool) error {
	if s == nil || s.mailmeta == nil {
		return nil
	}
	lc, err := s.mailmeta.GetMessageLifecycle(ctx, userID, messageID)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			return nil
		}
		return err
	}
	if lc.ExpiresAt != nil && !time.Now().Before(*lc.ExpiresAt) {
		return mailmeta.ErrMessageExpired
	}
	if lc.BurnedAt != nil || (lc.MaxReads > 0 && lc.Reads >= lc.MaxReads) {
		return mailmeta.ErrMessageBurned
	}
	if consumeRead && lc.MaxReads > 0 {
		if _, err := s.mailmeta.ConsumeRead(ctx, userID, messageID); err != nil {
			return err
		}
	}
	return nil
}

type messagePatchBody struct {
	Read                *bool   `json:"read,omitempty"`
	Folder              *string `json:"folder,omitempty"`
	HeaderCiphertextB64 *string `json:"header_ciphertext_b64,omitempty"`
}

func (s *Server) apiMailMessagePatch(w http.ResponseWriter, r *http.Request, userID uuid.UUID, idStr string) {
	id, err := uuid.Parse(strings.TrimSpace(idStr))
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if _, err := s.scylla.GetManifest(r.Context(), userID, id); err != nil {
		if errors.Is(err, scyllastore.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		s.writeErrAPIInternal(w, "mail manifest", err)
		return
	}
	var body messagePatchBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.Read == nil && body.Folder == nil && body.HeaderCiphertextB64 == nil {
		s.writeErr(w, http.StatusBadRequest, "read, folder, or header_ciphertext_b64 required")
		return
	}
	resp := map[string]any{"ok": true}
	if body.HeaderCiphertextB64 != nil {
		headerCiphertextB64 := strings.TrimSpace(*body.HeaderCiphertextB64)
		if headerCiphertextB64 == "" {
			s.writeErr(w, http.StatusBadRequest, "header_ciphertext_b64 required")
			return
		}
		headerCiphertext, err := base64.StdEncoding.DecodeString(headerCiphertextB64)
		if err != nil {
			s.writeErr(w, http.StatusBadRequest, "invalid header_ciphertext_b64")
			return
		}
		if err := s.scylla.UpdateManifestHeaderCiphertext(r.Context(), id, headerCiphertext); err != nil {
			s.writeErrAPIInternal(w, "mail header refresh", err)
			return
		}
		if err := s.scylla.AppendEvent(r.Context(), userID, "refresh_header", id, "ui"); err != nil {
			s.log.Warn("mail event append", "kind", "refresh_header", "message_id", id.String(), "err", err)
		}
		resp["header_refreshed"] = true
	}
	if body.Folder != nil {
		targetFolder := strings.TrimSpace(strings.ToLower(*body.Folder))
		if targetFolder == "" {
			s.writeErr(w, http.StatusBadRequest, "folder required")
			return
		}
		moved, err := mailops.New(s.mailmeta, s.scylla, s.blob).MoveMessage(r.Context(), userID, id, targetFolder)
		if err != nil {
			if strings.Contains(err.Error(), "unknown folder") {
				s.writeErr(w, http.StatusBadRequest, "unknown folder")
				return
			}
			if errors.Is(err, scyllastore.ErrNotFound) {
				http.NotFound(w, r)
				return
			}
			s.writeErrAPIInternal(w, "mail move folder", err)
			return
		}
		resp["folder"] = moved.Folder
		resp["prior_folder"] = moved.PriorFolder
	}
	if body.Read != nil {
		flags, err := s.scylla.GetFlags(r.Context(), userID, id)
		switch {
		case errors.Is(err, scyllastore.ErrNotFound):
			flags = &scyllastore.Flags{}
		case err != nil:
			s.writeErrAPIInternal(w, "mail flags get", err)
			return
		}
		flags.Read = *body.Read
		if err := s.scylla.SetFlags(r.Context(), userID, id, *flags); err != nil {
			s.writeErrAPIInternal(w, "mail flags set", err)
			return
		}
		eventKind := "mark_unread"
		if *body.Read {
			eventKind = "mark_read"
		}
		if err := s.scylla.AppendEvent(r.Context(), userID, eventKind, id, "ui"); err != nil {
			s.log.Warn("mail event append", "kind", eventKind, "message_id", id.String(), "err", err)
		}
		resp["read"] = *body.Read
	}
	s.writeJSON(w, http.StatusOK, resp)
}

func (s *Server) apiMailMessageDelete(w http.ResponseWriter, r *http.Request, userID uuid.UUID, idStr string) {
	id, err := uuid.Parse(strings.TrimSpace(idStr))
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	ops := mailops.New(s.mailmeta, s.scylla, s.blob)
	if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("mode")), "permanent") {
		res, err := ops.DeletePermanent(r.Context(), userID, id)
		if err != nil {
			if errors.Is(err, scyllastore.ErrNotFound) {
				http.NotFound(w, r)
				return
			}
			s.writeErrAPIInternal(w, "mail delete permanent", err)
			return
		}
		s.writeJSON(w, http.StatusOK, map[string]any{
			"ok":          true,
			"deleted":     true,
			"folder":      "",
			"message":     "deleted",
			"message_id":  res.MessageID.String(),
			"priorFolder": res.Folder,
		})
		return
	}
	mf, err := s.scylla.GetManifest(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, scyllastore.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		s.writeErrAPIInternal(w, "mail manifest", err)
		return
	}
	if mf.Folder == mailmeta.FolderTrash {
		s.apiMailMessageDeletePermanent(w, r, userID, mf)
		return
	}
	moved, err := ops.MoveMessage(r.Context(), userID, mf.MessageID, mailmeta.FolderTrash)
	if err != nil {
		s.writeErrAPIInternal(w, "mail move to trash", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"deleted":     false,
		"folder":      mailmeta.FolderTrash,
		"message":     "moved to trash",
		"message_id":  mf.MessageID.String(),
		"priorFolder": moved.PriorFolder,
	})
}

func (s *Server) apiMailMessageDeletePermanent(w http.ResponseWriter, r *http.Request, userID uuid.UUID, mf *scyllastore.Manifest) {
	res, err := mailops.New(s.mailmeta, s.scylla, s.blob).DeletePermanent(r.Context(), userID, mf.MessageID)
	if err != nil {
		s.writeErrAPIInternal(w, "mail delete manifest", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"deleted":     true,
		"folder":      "",
		"message":     "deleted",
		"message_id":  mf.MessageID.String(),
		"priorFolder": res.Folder,
	})
}

// messagesPostBody is the client→server upload of a fully PGP-encrypted message.
type messagesPostBody struct {
	Recipient                 string   `json:"recipient"`
	HeaderCiphertextB64       string   `json:"header_ciphertext_b64"`
	BodyCiphertextB64         string   `json:"body_ciphertext_b64"`
	SenderHeaderCiphertextB64 string   `json:"sender_header_ciphertext_b64"`
	SenderBodyCiphertextB64   string   `json:"sender_body_ciphertext_b64"`
	FromAddr                  string   `json:"from_addr"`
	ToAddrs                   []string `json:"to_addrs"`
	ExpiresInSeconds          int64    `json:"expires_in_seconds,omitempty"`
	MaxReads                  int64    `json:"max_reads,omitempty"`
}

func (s *Server) apiMailMessagesPost(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var body messagesPostBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 32<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.Recipient == "" || body.BodyCiphertextB64 == "" {
		s.writeErr(w, http.StatusBadRequest, "recipient and body_ciphertext_b64 required")
		return
	}
	recipient, err := mailutil.ParseMailbox(body.Recipient)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid recipient")
		return
	}
	if body.FromAddr != "" {
		if _, err := mailutil.ParseMailbox(body.FromAddr); err != nil {
			s.writeErr(w, http.StatusBadRequest, "invalid from_addr")
			return
		}
	}
	if len(body.ToAddrs) > 0 {
		if _, err := mailutil.ParseMailboxList(body.ToAddrs); err != nil {
			s.writeErr(w, http.StatusBadRequest, "invalid to_addrs")
			return
		}
	}
	cipher, err := base64.StdEncoding.DecodeString(body.BodyCiphertextB64)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid body_ciphertext_b64")
		return
	}
	headerCT, err := base64.StdEncoding.DecodeString(body.HeaderCiphertextB64)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid header_ciphertext_b64")
		return
	}
	var senderHeaderCT, senderCipher []byte
	if strings.TrimSpace(body.SenderHeaderCiphertextB64) != "" || strings.TrimSpace(body.SenderBodyCiphertextB64) != "" {
		if body.SenderHeaderCiphertextB64 == "" || body.SenderBodyCiphertextB64 == "" {
			s.writeErr(w, http.StatusBadRequest, "sender sent-copy ciphertext requires both header and body")
			return
		}
		senderHeaderCT, err = base64.StdEncoding.DecodeString(body.SenderHeaderCiphertextB64)
		if err != nil {
			s.writeErr(w, http.StatusBadRequest, "invalid sender_header_ciphertext_b64")
			return
		}
		senderCipher, err = base64.StdEncoding.DecodeString(body.SenderBodyCiphertextB64)
		if err != nil {
			s.writeErr(w, http.StatusBadRequest, "invalid sender_body_ciphertext_b64")
			return
		}
	}
	senderIdentity, err := s.mailmeta.IdentityForUserEmail(r.Context(), userID, body.FromAddr)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusBadRequest, "from_addr must be one of your active identities")
			return
		}
		s.writeErrAPIInternal(w, "sender identity lookup", err)
		return
	}
	recipientIdentity, err := s.mailmeta.IdentityForEmail(r.Context(), recipient)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusBadRequest, "recipient is not a local Elvish identity")
			return
		}
		s.writeErrAPIInternal(w, "recipient identity lookup", err)
		return
	}
	pipe := mailpipe.New(s.blob, s.scylla, s.mailmeta, s.log)
	pipe.Telemetry = s.telemetry
	expiry, err := mailmeta.NormalizeMessageExpiry(body.ExpiresInSeconds, body.MaxReads)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	var senderCopy *mailpipe.IngestResult
	if len(senderCipher) > 0 && len(senderHeaderCT) > 0 {
		senderCopy, err = pipe.IngestClientSent(r.Context(), body.FromAddr, senderHeaderCT, senderCipher, body.FromAddr, body.ToAddrs)
		if err != nil {
			s.writeErrAPIInternal(w, "mail ingest sent copy", err)
			return
		}
	}
	res, err := pipe.IngestInternal(r.Context(), recipient, headerCT, cipher, body.FromAddr, body.ToAddrs, expiry)
	if err != nil {
		if senderCopy != nil {
			_, _ = mailops.New(s.mailmeta, s.scylla, s.blob).DeletePermanent(r.Context(), senderCopy.UserID, senderCopy.MessageID)
		}
		s.writeErrAPIInternal(w, "mail ingest internal", err)
		return
	}
	if err := s.mailmeta.AdvanceIdentityVisibilityOnLocalSend(r.Context(), senderIdentity, recipientIdentity, time.Now().UTC()); err != nil {
		s.log.Warn("identity visibility advance", "sender_fp", senderIdentity.Fingerprint, "recipient_fp", recipientIdentity.Fingerprint, "err", err)
	}
	resp := map[string]any{"id": res.MessageID.String(), "blob_ref": res.BodyBlobRef}
	if senderCopy != nil {
		resp["sent_message_id"] = senderCopy.MessageID.String()
	}
	s.writeJSON(w, http.StatusCreated, resp)
}

// ---- /api/v1/mail/settings ------------------------------------------------

func (s *Server) routeMailSettings(w http.ResponseWriter, r *http.Request, userID uuid.UUID, parts []string) {
	if len(parts) > 0 {
		http.NotFound(w, r)
		return
	}
	switch r.Method {
	case http.MethodGet:
		s.apiMailSettingsGet(w, r, userID)
	case http.MethodPost, http.MethodPut:
		s.apiMailSettingsPost(w, r, userID)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) apiMailSettingsGet(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	st, err := s.mailmeta.GetSettings(r.Context(), userID)
	if err != nil {
		s.writeErrAPIInternal(w, "mail settings get", err)
		return
	}
	retention, err := s.mailmeta.GetFolderRetention(r.Context(), userID)
	if err != nil {
		s.writeErrAPIInternal(w, "mail retention get", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"settings": map[string]any{
			"auto_encrypt_inbound":         st.AutoEncryptInbound,
			"wkd_publish":                  st.WKDPublish,
			"attach_public_key_default":    st.AttachPublicKeyDefault,
			"keyvault_idle_min":            st.KeyVaultIdleMin,
			"retention_setup_completed":    st.RetentionSetupCompletedAt != nil,
			"retention_setup_completed_at": st.RetentionSetupCompletedAt,
		},
		"retention_days": retentionMapToJSON(retention),
	})
}

type mailSettingsBody struct {
	AutoEncryptInbound      *bool           `json:"auto_encrypt_inbound,omitempty"`
	WKDPublish              *bool           `json:"wkd_publish,omitempty"`
	AttachPublicKeyDefault  *bool           `json:"attach_public_key_default,omitempty"`
	KeyVaultIdleMin         *int            `json:"keyvault_idle_min,omitempty"`
	RetentionSetupCompleted *bool           `json:"retention_setup_completed,omitempty"`
	RetentionDays           map[string]*int `json:"retention_days,omitempty"`
}

func (s *Server) apiMailSettingsPost(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var body mailSettingsBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	st, err := s.mailmeta.GetSettings(r.Context(), userID)
	if err != nil {
		s.writeErrAPIInternal(w, "mail settings load", err)
		return
	}
	if body.AutoEncryptInbound != nil {
		st.AutoEncryptInbound = *body.AutoEncryptInbound
	}
	if body.WKDPublish != nil {
		st.WKDPublish = *body.WKDPublish
	}
	if body.AttachPublicKeyDefault != nil {
		st.AttachPublicKeyDefault = *body.AttachPublicKeyDefault
	}
	if body.KeyVaultIdleMin != nil && *body.KeyVaultIdleMin > 0 {
		st.KeyVaultIdleMin = *body.KeyVaultIdleMin
	}
	if body.RetentionSetupCompleted != nil {
		if *body.RetentionSetupCompleted {
			now := time.Now().UTC()
			st.RetentionSetupCompletedAt = &now
		} else {
			st.RetentionSetupCompletedAt = nil
		}
	}
	if err := s.mailmeta.SetSettings(r.Context(), st); err != nil {
		s.writeErrAPIInternal(w, "mail settings save", err)
		return
	}
	if body.RetentionDays != nil {
		if err := s.mailmeta.SetFolderRetention(r.Context(), userID, body.RetentionDays); err != nil {
			s.writeErrAPIInternal(w, "mail retention save", err)
			return
		}
	}
	s.apiMailSettingsGet(w, r, userID)
}

// ---- /api/v1/mail/outbox -------------------------------------------------

func (s *Server) routeOutbox(w http.ResponseWriter, r *http.Request, userID uuid.UUID, parts []string) {
	switch len(parts) {
	case 0:
		switch r.Method {
		case http.MethodPost:
			s.apiMailOutboxPost(w, r, userID)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case 1:
		switch r.Method {
		case http.MethodGet:
			s.apiMailOutboxGet(w, r, userID, parts[0])
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	default:
		http.NotFound(w, r)
	}
}

type outboxPostBody struct {
	PayloadCiphertextB64      string   `json:"payload_ciphertext_b64"`
	RecipientSummary          []string `json:"recipient_summary"`
	SenderHeaderCiphertextB64 string   `json:"sender_header_ciphertext_b64"`
	SenderBodyCiphertextB64   string   `json:"sender_body_ciphertext_b64"`
	FromAddr                  string   `json:"from_addr"`
}

func (s *Server) apiMailOutboxPost(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var body outboxPostBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 32<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.PayloadCiphertextB64 == "" {
		s.writeErr(w, http.StatusBadRequest, "payload_ciphertext_b64 required")
		return
	}
	cipher, err := base64.StdEncoding.DecodeString(body.PayloadCiphertextB64)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid payload_ciphertext_b64")
		return
	}
	if vopenpgp.Sniff(cipher) == vopenpgp.BodyCleartext {
		s.writeErr(w, http.StatusBadRequest, "payload must be OpenPGP ciphertext")
		return
	}
	rcptList, err := mailutil.ParseMailboxList(body.RecipientSummary)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid recipient_summary")
		return
	}
	var sentCopy *mailmeta.OutboxSentCopy
	var sentCopyTempKey string
	if strings.TrimSpace(body.SenderHeaderCiphertextB64) != "" || strings.TrimSpace(body.SenderBodyCiphertextB64) != "" {
		if body.SenderHeaderCiphertextB64 == "" || body.SenderBodyCiphertextB64 == "" {
			s.writeErr(w, http.StatusBadRequest, "sender sent-copy ciphertext requires both header and body")
			return
		}
		if strings.TrimSpace(body.FromAddr) == "" {
			s.writeErr(w, http.StatusBadRequest, "from_addr required for sender sent copy")
			return
		}
		if _, err := s.mailmeta.IdentityForUserEmail(r.Context(), userID, body.FromAddr); err != nil {
			if errors.Is(err, mailmeta.ErrNotFound) {
				s.writeErr(w, http.StatusBadRequest, "from_addr must be one of your active identities")
				return
			}
			s.writeErrAPIInternal(w, "sender identity lookup", err)
			return
		}
		senderHeaderCT, err := base64.StdEncoding.DecodeString(body.SenderHeaderCiphertextB64)
		if err != nil {
			s.writeErr(w, http.StatusBadRequest, "invalid sender_header_ciphertext_b64")
			return
		}
		senderCipher, err := base64.StdEncoding.DecodeString(body.SenderBodyCiphertextB64)
		if err != nil {
			s.writeErr(w, http.StatusBadRequest, "invalid sender_body_ciphertext_b64")
			return
		}
		sentCopyTempKey = blobstore.OutboxKey(userID.String(), uuid.New().String()+"-sentcopy")
		if err := s.blob.Put(r.Context(), sentCopyTempKey, senderCipher, "application/pgp-encrypted"); err != nil {
			s.writeErrAPIInternal(w, "outbox sent-copy blob put", err)
			return
		}
		sentCopy = &mailmeta.OutboxSentCopy{
			BodyBlobRef:      sentCopyTempKey,
			BodySizeBytes:    int64(len(senderCipher)),
			HeaderCiphertext: senderHeaderCT,
			FromAddr:         body.FromAddr,
		}
	}
	id := uuid.New()
	key := blobstore.OutboxKey(userID.String(), id.String())
	if err := s.blob.Put(r.Context(), key, cipher, "application/pgp-encrypted"); err != nil {
		if sentCopyTempKey != "" {
			_ = s.blob.Delete(r.Context(), sentCopyTempKey)
		}
		s.writeErrAPIInternal(w, "outbox blob put", err)
		return
	}
	rcptSummary := strings.Join(rcptList, " ")
	rowID, err := s.mailmeta.InsertOutboxMeta(r.Context(), userID, mailmeta.OutboxKindPGP, key, int64(len(cipher)), rcptSummary, "", uuid.Nil, sentCopy)
	if err != nil {
		_ = s.blob.Delete(r.Context(), key)
		if sentCopyTempKey != "" {
			_ = s.blob.Delete(r.Context(), sentCopyTempKey)
		}
		s.writeErrAPIInternal(w, "outbox insert", err)
		return
	}
	s.writeJSON(w, http.StatusAccepted, map[string]any{"id": rowID.String(), "blob_ref": key})
}

func (s *Server) apiMailOutboxGet(w http.ResponseWriter, r *http.Request, userID uuid.UUID, idStr string) {
	id, err := uuid.Parse(strings.TrimSpace(idStr))
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	row, err := s.mailmeta.GetOutbox(r.Context(), userID, id)
	if err != nil {
		s.writeErrAPIInternal(w, "outbox get", err)
		return
	}
	bounces, _ := s.mailmeta.ListBounces(r.Context(), id)
	s.writeJSON(w, http.StatusOK, map[string]any{
		"id":                 row.ID.String(),
		"status":             row.Status,
		"attempts":           row.Attempts,
		"next_attempt_at":    row.NextAttemptAt.UTC().Format(time.RFC3339Nano),
		"last_smtp_code":     row.LastSMTPCode,
		"last_error":         row.LastError,
		"recipient_summary":  row.RecipientSummary,
		"payload_size_bytes": row.PayloadSizeBytes,
		"bounces":            bounces,
	})
}

// ---- /api/v1/mail/test/echo ----------------------------------------------

func (s *Server) routeMailTest(w http.ResponseWriter, r *http.Request, userID uuid.UUID, userEmail string, parts []string) {
	if len(parts) == 1 && parts[0] == "echo" && r.Method == http.MethodPost {
		s.apiMailTestEcho(w, r, userID, userEmail)
		return
	}
	http.NotFound(w, r)
}

type echoBody struct {
	BodyCiphertextB64   string `json:"body_ciphertext_b64"`
	HeaderCiphertextB64 string `json:"header_ciphertext_b64"`
}

func (s *Server) apiMailTestEcho(w http.ResponseWriter, r *http.Request, userID uuid.UUID, userEmail string) {
	var body echoBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 16<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	cipher, err := base64.StdEncoding.DecodeString(body.BodyCiphertextB64)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid body_ciphertext_b64")
		return
	}
	headerCT, _ := base64.StdEncoding.DecodeString(body.HeaderCiphertextB64)
	id, err := s.mailmeta.DefaultIdentityForUser(r.Context(), userID)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "no default identity for user (bootstrap account-key first)")
		return
	}
	target := id.Email
	if target == "" {
		target = userEmail
	}
	pipe := mailpipe.New(s.blob, s.scylla, s.mailmeta, s.log)
	pipe.Telemetry = s.telemetry
	res, err := pipe.IngestInternal(r.Context(), target, headerCT, cipher, target, []string{target}, nil)
	if err != nil {
		s.writeErrAPIInternal(w, "mail test echo", err)
		return
	}
	s.writeJSON(w, http.StatusCreated, map[string]any{"message_id": res.MessageID.String(), "blob_ref": res.BodyBlobRef})
}

func retentionMapToJSON(retention map[string]*int) map[string]any {
	out := make(map[string]any, len(retention))
	for folder, days := range retention {
		if days == nil {
			out[folder] = nil
			continue
		}
		out[folder] = *days
	}
	return out
}
