package httpserver

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/mail"
	"net/textproto"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/blobstore"
	"elvish/internal/mailmeta"
	"elvish/internal/mailpipe"
)

// outboxPlainBody is the user-supplied composition for a plaintext outbound mail.
// The server builds the RFC 5322 message in memory, wraps it to the relay key,
// and persists only the ciphertext. The mail worker decrypts in memory just
// before SMTP DATA. This is opt-in (Mode C) and requires ELVISH_RELAY_KEY_PATH.
type outboxPlainBody struct {
	FromAddr string   `json:"from_addr"`
	ToAddrs  []string `json:"to_addrs"`
	Subject  string   `json:"subject"`
	BodyText string   `json:"body_text"`
	// Attachments are server-side resolved blobs used by admin-authored sends.
	Attachments []plaintextAttachment `json:"-"`
}

type plaintextAttachment struct {
	FileName    string
	ContentType string
	Data        []byte
}

type outboxSubmitOpts struct {
	Source     string
	AdminRunID uuid.UUID
}

type plaintextDispatchResult struct {
	OutboxIDs       []uuid.UUID
	LocalMessageIDs []uuid.UUID
}

func (r plaintextDispatchResult) FirstOutboxID() uuid.UUID {
	if len(r.OutboxIDs) == 0 {
		return uuid.Nil
	}
	return r.OutboxIDs[0]
}

// routeOutboxPlain handles POST /api/v1/mail/outbox-plain.
func (s *Server) routeOutboxPlain(w http.ResponseWriter, r *http.Request, userID uuid.UUID, _ string, parts []string) {
	if len(parts) > 0 {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.writeJSON(w, http.StatusGone, map[string]any{
		"error": "plaintext relay is disabled for user-authored mail; use OpenPGP direct or a protected link",
	})
}

// submitPlaintextOutbox builds the RFC 5322 message, wraps it with the relay key,
// uploads the ciphertext, and inserts the mail_outbox row. If body is nil, the
// request body is parsed; otherwise body is used directly (callers like the
// protected-link sender supply a server-built notification email).
func (s *Server) submitPlaintextOutbox(r *http.Request, userID uuid.UUID, override *outboxPlainBody) (plaintextDispatchResult, error) {
	if s.mailmeta == nil || s.blob == nil {
		return plaintextDispatchResult{}, plainErr(http.StatusServiceUnavailable, "mail subsystem not configured")
	}
	var body outboxPlainBody
	if override != nil {
		body = *override
	} else if r != nil {
		if err := json.NewDecoder(io.LimitReader(r.Body, 8<<20)).Decode(&body); err != nil {
			return plaintextDispatchResult{}, plainErr(http.StatusBadRequest, "invalid json")
		}
	}
	ctx := context.Background()
	if r != nil {
		ctx = r.Context()
	}
	return s.submitPlaintextOutboxWithContext(ctx, userID, body, outboxSubmitOpts{})
}

func (s *Server) submitPlaintextOutboxWithContext(ctx context.Context, userID uuid.UUID, body outboxPlainBody, opts outboxSubmitOpts) (plaintextDispatchResult, error) {
	body.FromAddr = strings.TrimSpace(body.FromAddr)
	body.Subject = strings.TrimSpace(body.Subject)
	if body.FromAddr == "" || len(body.ToAddrs) == 0 || body.BodyText == "" {
		return plaintextDispatchResult{}, plainErr(http.StatusBadRequest, "from_addr, to_addrs, body_text required")
	}
	if _, perr := mail.ParseAddress(body.FromAddr); perr != nil {
		return plaintextDispatchResult{}, plainErr(http.StatusBadRequest, "invalid from_addr")
	}
	clean := make([]string, 0, len(body.ToAddrs))
	for _, a := range body.ToAddrs {
		a = strings.TrimSpace(a)
		if a == "" {
			continue
		}
		if _, perr := mail.ParseAddress(a); perr != nil {
			return plaintextDispatchResult{}, plainErr(http.StatusBadRequest, "invalid to_addr: "+a)
		}
		clean = append(clean, a)
	}
	if len(clean) == 0 {
		return plaintextDispatchResult{}, plainErr(http.StatusBadRequest, "to_addrs required")
	}
	defer wipeAttachments(body.Attachments)
	rfc822, headerSummary, err := buildRFC5322(body.FromAddr, clean, body.Subject, body.BodyText, body.Attachments)
	if err != nil {
		return plaintextDispatchResult{}, fmt.Errorf("build rfc5322: %w", err)
	}
	defer wipeBuf(rfc822)
	var senderIdentity *mailmeta.IdentityKey
	if s.mailmeta != nil {
		senderIdentity, err = s.mailmeta.IdentityForUserEmail(ctx, userID, body.FromAddr)
		switch {
		case errors.Is(err, mailmeta.ErrNotFound):
			senderIdentity = nil
		case err != nil:
			return plaintextDispatchResult{}, fmt.Errorf("sender identity lookup: %w", err)
		}
	}
	localRecipients, externalRecipients, err := s.partitionLocalRecipients(ctx, clean)
	if err != nil {
		return plaintextDispatchResult{}, err
	}
	if len(externalRecipients) > 0 && s.relayKey == nil {
		return plaintextDispatchResult{}, plainErr(http.StatusServiceUnavailable, "plaintext outbound disabled (set ELVISH_RELAY_KEY_PATH)")
	}
	res := plaintextDispatchResult{}
	if len(localRecipients) > 0 {
		if s.scylla == nil {
			return plaintextDispatchResult{}, fmt.Errorf("local mail delivery unavailable")
		}
		pipe := mailpipe.New(s.blob, s.scylla, s.mailmeta, s.log)
		pipe.Telemetry = s.telemetry
		for _, recipient := range localRecipients {
			recipientIdentity, err := s.mailmeta.IdentityForEmail(ctx, recipient)
			if err != nil {
				return plaintextDispatchResult{}, fmt.Errorf("local recipient lookup %s: %w", recipient, err)
			}
			msg, err := pipe.IngestInternalPlaintextWithHeader(
				ctx,
				body.FromAddr,
				recipient,
				clean,
				append([]byte(nil), rfc822...),
				headerSummary,
			)
			if err != nil {
				return plaintextDispatchResult{}, fmt.Errorf("local delivery %s: %w", recipient, err)
			}
			res.LocalMessageIDs = append(res.LocalMessageIDs, msg.MessageID)
			if senderIdentity != nil {
				if err := s.mailmeta.AdvanceIdentityVisibilityOnLocalSend(ctx, senderIdentity, recipientIdentity, headerSummary.Date); err != nil {
					s.log.Warn("identity visibility advance", "sender_fp", senderIdentity.Fingerprint, "recipient_fp", recipientIdentity.Fingerprint, "err", err)
				}
			}
		}
	}
	if len(externalRecipients) == 0 {
		return res, nil
	}

	cipher, err := s.relayKey.Wrap(rfc822)
	if err != nil {
		return plaintextDispatchResult{}, fmt.Errorf("relay wrap: %w", err)
	}

	id := uuid.New()
	key := blobstore.OutboxKey(userID.String(), id.String())
	if err := s.blob.Put(ctx, key, cipher, "application/pgp-encrypted"); err != nil {
		return plaintextDispatchResult{}, fmt.Errorf("blob put: %w", err)
	}
	rcptSummary := strings.Join(externalRecipients, " ")
	rowID, err := s.mailmeta.InsertOutboxMeta(ctx, userID, mailmeta.OutboxKindPlaintextRelay, key, int64(len(cipher)), rcptSummary, opts.Source, opts.AdminRunID, nil)
	if err != nil {
		_ = s.blob.Delete(ctx, key)
		return plaintextDispatchResult{}, fmt.Errorf("outbox insert: %w", err)
	}
	res.OutboxIDs = append(res.OutboxIDs, rowID)
	return res, nil
}

func (s *Server) partitionLocalRecipients(ctx context.Context, recipients []string) ([]string, []string, error) {
	return partitionRecipientsByLocality(recipients, func(rcpt string) (bool, error) {
		if s.mailmeta == nil {
			return false, nil
		}
		if _, err := s.mailmeta.IdentityForEmail(ctx, rcpt); err == nil {
			return true, nil
		} else if errors.Is(err, mailmeta.ErrNotFound) {
			return false, nil
		} else {
			return false, fmt.Errorf("local recipient lookup %s: %w", rcpt, err)
		}
	})
}

func partitionRecipientsByLocality(recipients []string, isLocal func(string) (bool, error)) ([]string, []string, error) {
	localRecipients := make([]string, 0, len(recipients))
	externalRecipients := make([]string, 0, len(recipients))
	for _, recipient := range recipients {
		rcpt := strings.ToLower(strings.TrimSpace(recipient))
		if rcpt == "" {
			continue
		}
		local, err := isLocal(rcpt)
		if err != nil {
			return nil, nil, err
		}
		if local {
			localRecipients = append(localRecipients, rcpt)
			continue
		}
		externalRecipients = append(externalRecipients, rcpt)
	}
	return localRecipients, externalRecipients, nil
}

// plainSubmitError carries an HTTP status code through submitPlaintextOutbox.
type plainSubmitError struct {
	Status int
	Msg    string
}

func (e *plainSubmitError) Error() string { return e.Msg }

func plainErr(status int, msg string) error { return &plainSubmitError{Status: status, Msg: msg} }

func (s *Server) handlePlainSubmitErr(w http.ResponseWriter, err error) {
	var pe *plainSubmitError
	if errors.As(err, &pe) {
		s.writeErr(w, pe.Status, pe.Msg)
		return
	}
	s.writeErrAPIInternal(w, "outbox-plain", err)
}

// buildRFC5322 produces a valid RFC 5322 message and an encrypted header summary.
func buildRFC5322(from string, to []string, subject, bodyText string, attachments []plaintextAttachment) ([]byte, mailpipe.HeaderSummary, error) {
	var buf bytes.Buffer
	id := messageID(from)
	headerSummary := mailpipe.HeaderSummary{
		Subject:     subject,
		From:        from,
		To:          append([]string(nil), to...),
		ThreadID:    "<" + id + ">",
		Date:        time.Now().UTC(),
		Attachments: attachmentSummaries(attachments),
	}
	fmt.Fprintf(&buf, "Message-ID: <%s>\r\n", id)
	fmt.Fprintf(&buf, "Date: %s\r\n", headerSummary.Date.Format(time.RFC1123Z))
	fmt.Fprintf(&buf, "From: %s\r\n", from)
	fmt.Fprintf(&buf, "To: %s\r\n", strings.Join(to, ", "))
	if subject != "" {
		fmt.Fprintf(&buf, "Subject: %s\r\n", subject)
	}
	fmt.Fprintf(&buf, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&buf, "X-Elvish-Send-Mode: plaintext-relay\r\n")
	if len(attachments) == 0 {
		fmt.Fprintf(&buf, "Content-Type: text/plain; charset=utf-8\r\n")
		fmt.Fprintf(&buf, "Content-Transfer-Encoding: 8bit\r\n")
		buf.WriteString("\r\n")
		writeBodyLines(&buf, bodyText)
		return buf.Bytes(), headerSummary, nil
	}
	mw := multipart.NewWriter(&buf)
	fmt.Fprintf(&buf, "Content-Type: multipart/mixed; boundary=%q\r\n", mw.Boundary())
	buf.WriteString("\r\n")
	textHdr := textproto.MIMEHeader{}
	textHdr.Set("Content-Type", "text/plain; charset=utf-8")
	textHdr.Set("Content-Transfer-Encoding", "8bit")
	textPart, err := mw.CreatePart(textHdr)
	if err != nil {
		return nil, mailpipe.HeaderSummary{}, err
	}
	writeBodyLines(textPart, bodyText)
	for _, attachment := range attachments {
		name := sanitizeAttachmentName(attachment.FileName)
		contentType := sanitizeContentType(attachment.ContentType)
		partHdr := textproto.MIMEHeader{}
		partHdr.Set("Content-Type", fmt.Sprintf("%s; name=%q", contentType, name))
		partHdr.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", name))
		partHdr.Set("Content-Transfer-Encoding", "base64")
		part, err := mw.CreatePart(partHdr)
		if err != nil {
			return nil, mailpipe.HeaderSummary{}, err
		}
		if err := writeBase64Lines(part, attachment.Data); err != nil {
			return nil, mailpipe.HeaderSummary{}, err
		}
	}
	if err := mw.Close(); err != nil {
		return nil, mailpipe.HeaderSummary{}, err
	}
	return buf.Bytes(), headerSummary, nil
}

// messageID returns a unique <local@domain>-style ID from the sender address.
func messageID(from string) string {
	addr, err := mail.ParseAddress(from)
	domain := "elvish.local"
	if err == nil && addr != nil {
		if at := strings.LastIndex(addr.Address, "@"); at >= 0 {
			domain = addr.Address[at+1:]
		}
	}
	var buf [12]byte
	_, _ = rand.Read(buf[:])
	return fmt.Sprintf("%s.%s@%s", time.Now().UTC().Format("20060102T150405Z"), hex.EncodeToString(buf[:]), domain)
}

// wipeBuf zeros a buffer in place; used to minimize the cleartext window during plaintext submission.
func wipeBuf(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

func wipeAttachments(attachments []plaintextAttachment) {
	for i := range attachments {
		wipeBuf(attachments[i].Data)
	}
}

func attachmentSummaries(attachments []plaintextAttachment) []mailpipe.AttachmentSummary {
	if len(attachments) == 0 {
		return nil
	}
	out := make([]mailpipe.AttachmentSummary, 0, len(attachments))
	for _, attachment := range attachments {
		out = append(out, mailpipe.AttachmentSummary{
			FileName:    sanitizeAttachmentName(attachment.FileName),
			ContentType: sanitizeContentType(attachment.ContentType),
			SizeBytes:   int64(len(attachment.Data)),
		})
	}
	return out
}

func sanitizeAttachmentName(name string) string {
	name = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(name, "\r", ""), "\n", ""))
	if name == "" {
		return "attachment.bin"
	}
	return name
}

func sanitizeContentType(contentType string) string {
	contentType = strings.TrimSpace(strings.ToLower(contentType))
	if contentType == "" || strings.ContainsAny(contentType, "\r\n") {
		return "application/octet-stream"
	}
	return contentType
}

func writeBodyLines(w io.Writer, bodyText string) {
	for _, line := range strings.Split(strings.ReplaceAll(bodyText, "\r\n", "\n"), "\n") {
		if strings.HasPrefix(line, ".") {
			_, _ = io.WriteString(w, ".")
		}
		_, _ = io.WriteString(w, line)
		_, _ = io.WriteString(w, "\r\n")
	}
}

func writeBase64Lines(w io.Writer, data []byte) error {
	encoded := base64.StdEncoding.EncodeToString(data)
	for len(encoded) > 76 {
		if _, err := io.WriteString(w, encoded[:76]+"\r\n"); err != nil {
			return err
		}
		encoded = encoded[76:]
	}
	if encoded != "" {
		if _, err := io.WriteString(w, encoded+"\r\n"); err != nil {
			return err
		}
	}
	return nil
}
