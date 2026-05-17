package httpserver

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/blobstore"
	"elvish/internal/maillinks"
	"elvish/internal/mailmeta"
)

const (
	adminTestPreviewPerHour = int64(120)
	adminTestSendPerHour    = int64(20)
	adminTestUploadPerHour  = int64(60)
	adminTestWindow         = time.Hour
	adminTestUploadMaxBytes = 20 << 20

	adminTestSendModePlaintext     = "plaintext"
	adminTestSendModeProtectedLink = "protected_link"
)

type adminTestAttachmentRef struct {
	UploadID    string `json:"upload_id,omitempty"`
	FileName    string `json:"file_name"`
	ContentType string `json:"content_type,omitempty"`
	SizeBytes   int64  `json:"size_bytes,omitempty"`
}

type adminTestProtectedLinkBody struct {
	NotifyRecipients  bool   `json:"notify_recipients"`
	TTLSeconds        int64  `json:"ttl_seconds"`
	MaxViews          int64  `json:"max_views"`
	KDF               string `json:"kdf"`
	KDFSaltB64        string `json:"kdf_salt_b64"`
	KDFParamsJSON     string `json:"kdf_params_json"`
	WrappedMsgKeyB64  string `json:"wrapped_msg_key_b64"`
	BodyCiphertextB64 string `json:"body_ciphertext_b64"`
}

type adminTestMailBody struct {
	LocalUserIDs   []string                   `json:"local_user_ids"`
	ExternalEmails []string                   `json:"external_emails"`
	FromAddr       string                     `json:"from_addr"`
	Subject        string                     `json:"subject"`
	BodyText       string                     `json:"body_text"`
	SendMode       string                     `json:"send_mode"`
	Attachments    []adminTestAttachmentRef   `json:"attachments"`
	ProtectedLink  adminTestProtectedLinkBody `json:"protected_link"`
}

type adminTestRecipient struct {
	UserID       uuid.UUID `json:"user_id,omitempty"`
	Email        string    `json:"email"`
	Name         string    `json:"name,omitempty"`
	Source       string    `json:"source"`
	DeliveryKind string    `json:"delivery_kind"`
}

type adminTestUploadMeta struct {
	UploadID    string    `json:"upload_id"`
	FileName    string    `json:"file_name"`
	ContentType string    `json:"content_type"`
	SizeBytes   int64     `json:"size_bytes"`
	CreatedAt   time.Time `json:"created_at"`
}

func (s *Server) apiAdminTestUpload(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_test_upload", admin.ID.String(), adminTestUploadPerHour, adminTestWindow) {
		return
	}
	if s.blob == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "blobstore required")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, adminTestUploadMaxBytes)
	if err := r.ParseMultipartForm(adminTestUploadMaxBytes); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid multipart upload")
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "file required")
		return
	}
	defer file.Close() //nolint:errcheck // multipart file close error irrelevant after read
	content, err := io.ReadAll(file)
	if err != nil {
		s.writeErrAPIInternal(w, "admin test upload read", err)
		return
	}
	uploadID := uuid.New().String()
	meta := adminTestUploadMeta{
		UploadID:    uploadID,
		FileName:    sanitizeAttachmentName(hdr.Filename),
		ContentType: sanitizeContentType(hdr.Header.Get("Content-Type")),
		SizeBytes:   int64(len(content)),
		CreatedAt:   time.Now().UTC(),
	}
	metaJSON, err := json.Marshal(meta)
	if err != nil {
		s.writeErrAPIInternal(w, "admin test upload meta", err)
		return
	}
	contentKey := adminTestUploadContentKey(admin.ID, uploadID)
	metaKey := adminTestUploadMetaKey(admin.ID, uploadID)
	if err := s.blob.Put(r.Context(), contentKey, content, meta.ContentType); err != nil {
		s.writeErrAPIInternal(w, "admin test upload blob", err)
		return
	}
	if err := s.blob.Put(r.Context(), metaKey, metaJSON, "application/json"); err != nil {
		_ = s.blob.Delete(r.Context(), contentKey)
		s.writeErrAPIInternal(w, "admin test upload meta blob", err)
		return
	}
	s.writeJSON(w, http.StatusCreated, meta)
}

func (s *Server) apiAdminTestSendPreview(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_test_preview", admin.ID.String(), adminTestPreviewPerHour, adminTestWindow) {
		return
	}
	body, recipients, domains, err := s.decodeAndValidateAdminTestMail(r.Context(), r, false)
	if err != nil {
		s.handleAdminSystemMailErr(w, err)
		return
	}
	s.writeJSON(w, http.StatusOK, s.buildAdminTestPreview(body, recipients, domains))
}

func (s *Server) apiAdminTestSend(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_test_send", admin.ID.String(), adminTestSendPerHour, adminTestWindow) {
		return
	}
	body, recipients, _, err := s.decodeAndValidateAdminTestMail(r.Context(), r, true)
	if err != nil {
		s.handleAdminSystemMailErr(w, err)
		return
	}
	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail metadata store not configured")
		return
	}
	defer s.cleanupAdminTestUploads(r.Context(), admin.ID, body.Attachments)
	attachmentCount, attachmentBytes := attachmentStats(body.Attachments)
	sum := sha256.Sum256([]byte(body.BodyText))
	runID, err := s.mailmeta.InsertAdminMailRun(r.Context(), mailmeta.AdminMailRunInput{
		AdminUserID:     admin.ID,
		AudienceKind:    "test_send",
		SendMode:        body.SendMode,
		SenderAddr:      body.FromAddr,
		Subject:         body.Subject,
		BodySHA256:      hex.EncodeToString(sum[:]),
		AttachmentCount: attachmentCount,
		AttachmentBytes: attachmentBytes,
		RecipientCount:  len(recipients),
	})
	if err != nil {
		s.writeErrAPIInternal(w, "admin test run insert", err)
		return
	}
	switch body.SendMode {
	case adminTestSendModeProtectedLink:
		s.sendAdminProtectedLink(w, r, admin.ID, runID, body, recipients)
	default:
		s.sendAdminPlaintext(w, r, admin.ID, runID, body, recipients)
	}
}

func (s *Server) sendAdminPlaintext(w http.ResponseWriter, r *http.Request, adminUserID, runID uuid.UUID, body *adminTestMailBody, recipients []adminTestRecipient) {
	attachments, err := s.loadAdminTestPlaintextAttachments(r.Context(), adminUserID, body.Attachments)
	if err != nil {
		s.handleAdminSystemMailErr(w, err)
		return
	}
	dispatched := 0
	queuedExternal := 0
	deliveredLocal := 0
	failures := make([]string, 0, 10)
	for _, recipient := range recipients {
		res, err := s.submitPlaintextOutboxWithContext(r.Context(), adminUserID, outboxPlainBody{
			FromAddr:    body.FromAddr,
			ToAddrs:     []string{recipient.Email},
			Subject:     body.Subject,
			BodyText:    body.BodyText,
			Attachments: clonePlaintextAttachments(attachments),
		}, outboxSubmitOpts{
			Source:     "admin_test_send",
			AdminRunID: runID,
		})
		if err != nil {
			if len(failures) < cap(failures) {
				failures = append(failures, recipient.Email+": "+err.Error())
			}
			continue
		}
		dispatched++
		queuedExternal += len(res.OutboxIDs)
		deliveredLocal += len(res.LocalMessageIDs)
	}
	if err := s.mailmeta.UpdateAdminMailRunQueuedCount(r.Context(), runID, dispatched); err != nil {
		s.writeErrAPIInternal(w, "admin test run update", err)
		return
	}
	status := http.StatusAccepted
	if dispatched == 0 {
		status = http.StatusServiceUnavailable
	}
	s.writeJSON(w, status, map[string]any{
		"ok":                    dispatched > 0,
		"run_id":                runID.String(),
		"send_mode":             body.SendMode,
		"queued_count":          dispatched,
		"queued_external_count": queuedExternal,
		"delivered_local_count": deliveredLocal,
		"failed_count":          len(recipients) - dispatched,
		"errors":                failures,
	})
}

func (s *Server) sendAdminProtectedLink(w http.ResponseWriter, r *http.Request, adminUserID, runID uuid.UUID, body *adminTestMailBody, recipients []adminTestRecipient) {
	if s.mailLinks == nil || s.blob == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "protected-link mode not configured")
		return
	}
	pl, err := body.toProtectedLinkCreateBody(recipients, body.FromAddr)
	if err != nil {
		s.handleAdminSystemMailErr(w, err)
		return
	}
	row, url, err := s.createProtectedLinkRow(r, adminUserID, pl)
	if err != nil {
		s.handleAdminSystemMailErr(w, err)
		return
	}
	dispatched := 0
	queuedExternal := 0
	deliveredLocal := 0
	failures := make([]string, 0, 10)
	if pl.NotifyRecipients {
		for _, recipient := range recipients {
			notice := buildProtectedLinkNotice(body.Subject, body.FromAddr, url, row.ExpiresAt, row.MaxViews)
			notice.ToAddrs = []string{recipient.Email}
			res, err := s.submitPlaintextOutboxWithContext(r.Context(), adminUserID, *notice, outboxSubmitOpts{
				Source:     "admin_test_protected_link",
				AdminRunID: runID,
			})
			if err != nil {
				if len(failures) < cap(failures) {
					failures = append(failures, recipient.Email+": "+err.Error())
				}
				continue
			}
			dispatched++
			queuedExternal += len(res.OutboxIDs)
			deliveredLocal += len(res.LocalMessageIDs)
		}
	}
	if err := s.mailmeta.UpdateAdminMailRunQueuedCount(r.Context(), runID, dispatched); err != nil {
		s.writeErrAPIInternal(w, "admin test run update", err)
		return
	}
	s.writeJSON(w, http.StatusAccepted, map[string]any{
		"ok":                    true,
		"run_id":                runID.String(),
		"send_mode":             body.SendMode,
		"url":                   url,
		"token":                 row.Token,
		"queued_count":          dispatched,
		"queued_external_count": queuedExternal,
		"delivered_local_count": deliveredLocal,
		"failed_count":          len(failures),
		"errors":                failures,
		"notify_recipients":     pl.NotifyRecipients,
		"expires_at":            row.ExpiresAt.UTC().Format(time.RFC3339Nano),
		"max_views":             row.MaxViews,
	})
}

func (s *Server) decodeAndValidateAdminTestMail(ctx context.Context, r *http.Request, requireCipher bool) (*adminTestMailBody, []adminTestRecipient, []adminSenderDomainOption, error) {
	var body adminTestMailBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 40<<20)).Decode(&body); err != nil {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "invalid json")
	}
	body.FromAddr = strings.ToLower(strings.TrimSpace(body.FromAddr))
	body.Subject = strings.TrimSpace(body.Subject)
	body.BodyText = strings.TrimSpace(body.BodyText)
	body.SendMode = strings.ToLower(strings.TrimSpace(body.SendMode))
	if body.SendMode == "" {
		body.SendMode = adminTestSendModePlaintext
	}
	if body.SendMode != adminTestSendModePlaintext && body.SendMode != adminTestSendModeProtectedLink {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "send_mode must be plaintext or protected_link")
	}
	if body.FromAddr == "" {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "from_addr required")
	}
	if body.Subject == "" {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "subject required")
	}
	if body.BodyText == "" {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "body_text required")
	}
	if len(body.Subject) > 200 {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "subject too long")
	}
	if len(body.BodyText) > 64<<10 {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "body_text too long")
	}
	domains, err := s.adminSenderDomainOptions(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	if err := validateAdminFromAddr(body.FromAddr, domains); err != nil {
		return nil, nil, nil, err
	}
	recipients, err := s.resolveAdminTestRecipients(ctx, body.LocalUserIDs, body.ExternalEmails)
	if err != nil {
		return nil, nil, nil, err
	}
	if len(body.Attachments) > 8 {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "too many attachments")
	}
	for i := range body.Attachments {
		body.Attachments[i].FileName = sanitizeAttachmentName(body.Attachments[i].FileName)
		body.Attachments[i].ContentType = sanitizeContentType(body.Attachments[i].ContentType)
		if body.Attachments[i].SizeBytes < 0 {
			return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "attachment size invalid")
		}
	}
	switch body.SendMode {
	case adminTestSendModePlaintext:
		for _, attachment := range body.Attachments {
			if strings.TrimSpace(attachment.UploadID) == "" {
				return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "plaintext attachments must be uploaded before send")
			}
		}
	case adminTestSendModeProtectedLink:
		if requireCipher {
			if err := validateProtectedLinkFields(&body.ProtectedLink); err != nil {
				return nil, nil, nil, err
			}
		}
		if s.mailLinks == nil || s.blob == nil {
			return nil, nil, nil, adminSystemErr(http.StatusServiceUnavailable, "protected-link mode not configured")
		}
	}
	return &body, recipients, domains, nil
}

func (s *Server) resolveAdminTestRecipients(ctx context.Context, localUserIDs, externalEmails []string) ([]adminTestRecipient, error) {
	recipients := make([]adminTestRecipient, 0, len(localUserIDs)+len(externalEmails))
	seen := map[string]int{}
	if len(localUserIDs) > 0 {
		if s.store == nil {
			return nil, adminSystemErr(http.StatusServiceUnavailable, "database required")
		}
		ids := make([]uuid.UUID, 0, len(localUserIDs))
		dedup := map[uuid.UUID]struct{}{}
		for _, raw := range localUserIDs {
			id, err := uuid.Parse(strings.TrimSpace(raw))
			if err != nil {
				return nil, adminSystemErr(http.StatusBadRequest, "invalid user id")
			}
			if _, ok := dedup[id]; ok {
				continue
			}
			dedup[id] = struct{}{}
			ids = append(ids, id)
		}
		users, err := s.store.UsersByIDs(ctx, ids)
		if err != nil {
			return nil, err
		}
		for _, user := range filterActiveUsers(users) {
			email := strings.ToLower(strings.TrimSpace(user.Email))
			if email == "" {
				continue
			}
			recipients = append(recipients, adminTestRecipient{
				UserID: user.ID,
				Email:  email,
				Name:   user.Name,
				Source: "user",
			})
			seen[email] = len(recipients) - 1
		}
	}
	for _, raw := range externalEmails {
		addr, err := normalizePlainEmail(raw)
		if err != nil {
			return nil, adminSystemErr(http.StatusBadRequest, "invalid external email")
		}
		if idx, ok := seen[addr]; ok {
			if recipients[idx].Source == "user" {
				continue
			}
		}
		recipients = append(recipients, adminTestRecipient{
			Email:  addr,
			Source: "external",
		})
		seen[addr] = len(recipients) - 1
	}
	if len(recipients) == 0 {
		return nil, adminSystemErr(http.StatusBadRequest, "add at least one recipient")
	}
	emails := make([]string, 0, len(recipients))
	for _, recipient := range recipients {
		emails = append(emails, recipient.Email)
	}
	localEmails, externalResolved, err := s.partitionLocalRecipients(ctx, emails)
	if err != nil {
		return nil, err
	}
	localSet := make(map[string]struct{}, len(localEmails))
	for _, email := range localEmails {
		localSet[email] = struct{}{}
	}
	externalSet := make(map[string]struct{}, len(externalResolved))
	for _, email := range externalResolved {
		externalSet[email] = struct{}{}
	}
	for i := range recipients {
		switch {
		case hasEmail(localSet, recipients[i].Email):
			recipients[i].DeliveryKind = "local"
		case hasEmail(externalSet, recipients[i].Email):
			recipients[i].DeliveryKind = "external"
		default:
			recipients[i].DeliveryKind = "external"
		}
	}
	return recipients, nil
}

func (s *Server) buildAdminTestPreview(body *adminTestMailBody, recipients []adminTestRecipient, domains []adminSenderDomainOption) map[string]any {
	sampleCap := len(recipients)
	if sampleCap > 10 {
		sampleCap = 10
	}
	localCount := 0
	externalCount := 0
	for _, recipient := range recipients {
		if recipient.DeliveryKind == "local" {
			localCount++
		} else {
			externalCount++
		}
	}
	attachmentCount, attachmentBytes := attachmentStats(body.Attachments)
	return map[string]any{
		"ok":                       true,
		"send_mode":                body.SendMode,
		"from_addr":                body.FromAddr,
		"subject":                  body.Subject,
		"body_chars":               len(body.BodyText),
		"recipient_count":          len(recipients),
		"local_recipient_count":    localCount,
		"external_recipient_count": externalCount,
		"attachment_count":         attachmentCount,
		"attachment_bytes":         attachmentBytes,
		"attachments":              body.Attachments,
		"sample":                   recipients[:sampleCap],
		"sender_domains":           domains,
		"relay_enabled":            s.relayKey != nil,
		"protected_link_enabled":   s.mailLinks != nil && s.blob != nil,
		"notify_recipients":        body.ProtectedLink.NotifyRecipients,
	}
}

func (body *adminTestMailBody) toProtectedLinkCreateBody(recipients []adminTestRecipient, fromAddr string) (*protectedLinkCreateBody, error) {
	emails := make([]string, 0, len(recipients))
	for _, recipient := range recipients {
		emails = append(emails, recipient.Email)
	}
	pl := &protectedLinkCreateBody{
		SubjectHint:       body.Subject,
		RecipientEmails:   emails,
		NotifyRecipients:  body.ProtectedLink.NotifyRecipients,
		NotifyFromAddr:    fromAddr,
		TTLSeconds:        body.ProtectedLink.TTLSeconds,
		MaxViews:          body.ProtectedLink.MaxViews,
		KDF:               body.ProtectedLink.KDF,
		KDFSaltB64:        body.ProtectedLink.KDFSaltB64,
		KDFParamsJSON:     body.ProtectedLink.KDFParamsJSON,
		WrappedMsgKeyB64:  body.ProtectedLink.WrappedMsgKeyB64,
		BodyCiphertextB64: body.ProtectedLink.BodyCiphertextB64,
	}
	return pl, nil
}

func validateProtectedLinkFields(body *adminTestProtectedLinkBody) error {
	body.KDF = strings.ToLower(strings.TrimSpace(body.KDF))
	switch body.KDF {
	case "argon2id", "pbkdf2-sha256", "pbkdf2-sha256-600k":
	default:
		return adminSystemErr(http.StatusBadRequest, "protected_link.kdf must be argon2id or pbkdf2-sha256[-600k]")
	}
	salt, err := base64.StdEncoding.DecodeString(body.KDFSaltB64)
	if err != nil || len(salt) < 8 {
		return adminSystemErr(http.StatusBadRequest, "invalid protected_link.kdf_salt_b64")
	}
	wrapped, err := base64.StdEncoding.DecodeString(body.WrappedMsgKeyB64)
	if err != nil || len(wrapped) < 32 {
		return adminSystemErr(http.StatusBadRequest, "invalid protected_link.wrapped_msg_key_b64")
	}
	cipher, err := base64.StdEncoding.DecodeString(body.BodyCiphertextB64)
	if err != nil || len(cipher) < 16 {
		return adminSystemErr(http.StatusBadRequest, "invalid protected_link.body_ciphertext_b64")
	}
	if body.KDFParamsJSON == "" {
		body.KDFParamsJSON = "{}"
	}
	if !json.Valid([]byte(body.KDFParamsJSON)) {
		return adminSystemErr(http.StatusBadRequest, "protected_link.kdf_params_json must be json")
	}
	if body.TTLSeconds <= 0 {
		body.TTLSeconds = int64((7 * 24 * time.Hour) / time.Second)
	}
	if body.TTLSeconds > int64((30*24*time.Hour)/time.Second) {
		return adminSystemErr(http.StatusBadRequest, "protected_link.ttl_seconds may not exceed 30 days")
	}
	if body.MaxViews < 0 || body.MaxViews > 1000 {
		return adminSystemErr(http.StatusBadRequest, "protected_link.max_views out of range")
	}
	return nil
}

func (s *Server) createProtectedLinkRow(r *http.Request, userID uuid.UUID, body *protectedLinkCreateBody) (*maillinks.Row, string, error) {
	salt, _ := base64.StdEncoding.DecodeString(body.KDFSaltB64)
	wrapped, _ := base64.StdEncoding.DecodeString(body.WrappedMsgKeyB64)
	cipher, _ := base64.StdEncoding.DecodeString(body.BodyCiphertextB64)
	token, err := maillinks.NewToken()
	if err != nil {
		return nil, "", fmt.Errorf("protected-link token: %w", err)
	}
	key := blobstore.ProtectedLinkKey(token)
	if err := s.blob.Put(r.Context(), key, cipher, "application/octet-stream"); err != nil {
		return nil, "", fmt.Errorf("protected-link blob put: %w", err)
	}
	row, err := s.mailLinks.Create(r.Context(), maillinks.CreateInput{
		UserID:           userID,
		BlobRef:          key,
		BodySizeBytes:    int64(len(cipher)),
		RecipientSummary: strings.Join(body.RecipientEmails, ", "),
		SubjectHint:      strings.TrimSpace(body.SubjectHint),
		KDF:              body.KDF,
		KDFSalt:          salt,
		KDFParamsJSON:    body.KDFParamsJSON,
		WrappedMsgKey:    wrapped,
		TTL:              time.Duration(body.TTLSeconds) * time.Second,
		MaxViews:         body.MaxViews,
	})
	if err != nil {
		_ = s.blob.Delete(r.Context(), key)
		return nil, "", fmt.Errorf("protected-link create: %w", err)
	}
	return row, s.protectedLinkURL(r, row.Token), nil
}

func (s *Server) loadAdminTestPlaintextAttachments(ctx context.Context, adminUserID uuid.UUID, refs []adminTestAttachmentRef) ([]plaintextAttachment, error) {
	if len(refs) == 0 {
		return nil, nil
	}
	if s.blob == nil {
		return nil, adminSystemErr(http.StatusServiceUnavailable, "blobstore required")
	}
	out := make([]plaintextAttachment, 0, len(refs))
	for _, ref := range refs {
		meta, content, err := s.loadAdminTestUpload(ctx, adminUserID, ref.UploadID)
		if err != nil {
			return nil, err
		}
		out = append(out, plaintextAttachment{
			FileName:    meta.FileName,
			ContentType: meta.ContentType,
			Data:        content,
		})
	}
	return out, nil
}

func (s *Server) loadAdminTestUpload(ctx context.Context, adminUserID uuid.UUID, uploadID string) (*adminTestUploadMeta, []byte, error) {
	uploadID = strings.TrimSpace(uploadID)
	if uploadID == "" {
		return nil, nil, adminSystemErr(http.StatusBadRequest, "attachment upload_id required")
	}
	metaRaw, err := s.blob.Get(ctx, adminTestUploadMetaKey(adminUserID, uploadID))
	if err != nil {
		return nil, nil, adminSystemErr(http.StatusBadRequest, "attachment upload metadata not found")
	}
	var meta adminTestUploadMeta
	if err := json.Unmarshal(metaRaw, &meta); err != nil {
		return nil, nil, adminSystemErr(http.StatusBadRequest, "attachment upload metadata invalid")
	}
	content, err := s.blob.Get(ctx, adminTestUploadContentKey(adminUserID, uploadID))
	if err != nil {
		return nil, nil, adminSystemErr(http.StatusBadRequest, "attachment upload content not found")
	}
	return &meta, content, nil
}

func (s *Server) cleanupAdminTestUploads(ctx context.Context, adminUserID uuid.UUID, refs []adminTestAttachmentRef) {
	if s == nil || s.blob == nil {
		return
	}
	seen := map[string]struct{}{}
	for _, ref := range refs {
		uploadID := strings.TrimSpace(ref.UploadID)
		if uploadID == "" {
			continue
		}
		if _, ok := seen[uploadID]; ok {
			continue
		}
		seen[uploadID] = struct{}{}
		_ = s.blob.Delete(ctx, adminTestUploadContentKey(adminUserID, uploadID))
		_ = s.blob.Delete(ctx, adminTestUploadMetaKey(adminUserID, uploadID))
	}
}

func adminTestUploadContentKey(adminUserID uuid.UUID, uploadID string) string {
	return "admin-test/" + adminUserID.String() + "/uploads/" + strings.TrimSpace(uploadID) + "/content.bin"
}

func adminTestUploadMetaKey(adminUserID uuid.UUID, uploadID string) string {
	return "admin-test/" + adminUserID.String() + "/uploads/" + strings.TrimSpace(uploadID) + "/meta.json"
}

func clonePlaintextAttachments(in []plaintextAttachment) []plaintextAttachment {
	if len(in) == 0 {
		return nil
	}
	out := make([]plaintextAttachment, 0, len(in))
	for _, attachment := range in {
		out = append(out, plaintextAttachment{
			FileName:    attachment.FileName,
			ContentType: attachment.ContentType,
			Data:        append([]byte(nil), attachment.Data...),
		})
	}
	return out
}

func attachmentStats(refs []adminTestAttachmentRef) (int, int64) {
	var total int64
	for _, ref := range refs {
		total += ref.SizeBytes
	}
	return len(refs), total
}

func normalizePlainEmail(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	addr, err := mail.ParseAddress(trimmed)
	if err != nil {
		return "", err
	}
	email := strings.ToLower(strings.TrimSpace(addr.Address))
	if email == "" || email != strings.ToLower(trimmed) {
		return "", fmt.Errorf("plain email required")
	}
	return email, nil
}

func hasEmail(set map[string]struct{}, email string) bool {
	_, ok := set[strings.ToLower(strings.TrimSpace(email))]
	return ok
}
