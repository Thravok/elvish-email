package mailpipe

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"mime"
	"net/mail"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/blobstore"
	"elvish/internal/mailmeta"
	vopenpgp "elvish/internal/openpgp"
	"elvish/internal/scyllastore"
	"elvish/internal/telemetry"
)

// Pipe owns dependencies for the mailpipe orchestrator.
type Pipe struct {
	Blob      *blobstore.Store
	Scylla    *scyllastore.Store
	Meta      *mailmeta.Store
	Logger    *slog.Logger
	Telemetry *telemetry.Service
	MaxSize   int
}

// New constructs a Pipe with sane defaults.
func New(blob *blobstore.Store, scy *scyllastore.Store, meta *mailmeta.Store, lg *slog.Logger) *Pipe {
	return &Pipe{Blob: blob, Scylla: scy, Meta: meta, Logger: lg, MaxSize: 26 << 20}
}

func (p *Pipe) maxSize() int {
	if p != nil && p.MaxSize > 0 {
		return p.MaxSize
	}
	return 26 << 20
}

func (p *Pipe) checkBodySize(raw []byte) error {
	if len(raw) > p.maxSize() {
		return fmt.Errorf("mailpipe: message exceeds max size (%d bytes)", p.maxSize())
	}
	return nil
}

// IngestResult is the outcome of a successful Ingest call.
type IngestResult struct {
	UserID      uuid.UUID
	MessageID   uuid.UUID
	Folder      string
	BodyBlobRef string
	Provenance  string
	SizeBytes   int64
	// Dropped is true when the message was accepted but intentionally not stored
	// (ingest-time filter with delete / block). No blob or mailbox rows are written.
	Dropped bool
}

func (p *Pipe) ingestPlaintext(ctx context.Context, source, fromAddr, recipient string, rcpt []string, rawBody []byte) (*IngestResult, error) {
	startedAt := time.Now()
	defer wipe(rawBody)
	rec, err := p.recipientIdentity(ctx, recipient)
	if err != nil {
		p.recordTelemetry(ctx, source, startedAt, err)
		return nil, err
	}
	headers := extractHeaders(rawBody)
	headers = completeHeaderSummary(headers, fromAddr, rcpt)
	dec, err := p.evalIngestPrivacyFilters(ctx, rec.UserID, fromAddr, recipient, rawBody, headers)
	if err != nil {
		p.recordTelemetry(ctx, source, startedAt, err)
		return nil, err
	}
	if dec.Drop {
		p.recordTelemetry(ctx, source, startedAt, nil)
		return &IngestResult{UserID: rec.UserID, Dropped: true}, nil
	}
	targetFolder := mailmeta.FolderInbox
	if dec.TargetFolder != "" {
		targetFolder = dec.TargetFolder
	}
	provenance, ciphertext, err := p.materialize(rawBody, rec.ArmoredPublic)
	if err != nil {
		p.recordTelemetry(ctx, source, startedAt, err)
		return nil, err
	}
	headerCT, err := vopenpgp.Encrypt(rec.ArmoredPublic, headers.toJSON())
	if err != nil {
		p.recordTelemetry(ctx, source, startedAt, err)
		return nil, fmt.Errorf("mailpipe: encrypt header: %w", err)
	}
	res, err := p.persist(ctx, rec.UserID, targetFolder, ciphertext, headerCT, provenance, source, headers, fromAddr, rcpt)
	if err != nil {
		p.recordTelemetry(ctx, source, startedAt, err)
		return nil, err
	}
	p.recordTelemetry(ctx, source, startedAt, nil)
	return res, nil
}

// IngestExternal accepts an inbound external SMTP message.
//
// Plaintext SMTP is gateway-encrypted to the recipient identity before
// persisting. Already-encrypted PGP payloads are stored as-is and the manifest
// records "already_encrypted" provenance.
func (p *Pipe) IngestExternal(ctx context.Context, fromAddr string, recipient string, rawBody []byte) (*IngestResult, error) {
	if err := p.checkBodySize(rawBody); err != nil {
		return nil, err
	}
	switch kind := vopenpgp.Sniff(rawBody); kind {
	case vopenpgp.BodyArmoredMessage, vopenpgp.BodyBinaryPGP, vopenpgp.BodyPGPMIME:
	default:
		return p.ingestPlaintext(ctx, mailmeta.SourceSMTPInbound, fromAddr, recipient, []string{recipient}, rawBody)
	}

	startedAt := time.Now()
	defer wipe(rawBody)
	rec, err := p.recipientIdentity(ctx, recipient)
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceSMTPInbound, startedAt, err)
		return nil, err
	}
	headers := completeHeaderSummary(extractHeaders(rawBody), fromAddr, []string{recipient})
	dec, err := p.evalIngestPrivacyFilters(ctx, rec.UserID, fromAddr, recipient, rawBody, headers)
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceSMTPInbound, startedAt, err)
		return nil, err
	}
	if dec.Drop {
		p.recordTelemetry(ctx, mailmeta.SourceSMTPInbound, startedAt, nil)
		return &IngestResult{UserID: rec.UserID, Dropped: true}, nil
	}
	targetFolder := mailmeta.FolderInbox
	if dec.TargetFolder != "" {
		targetFolder = dec.TargetFolder
	}
	headerCT, err := vopenpgp.Encrypt(rec.ArmoredPublic, headers.toJSON())
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceSMTPInbound, startedAt, err)
		return nil, fmt.Errorf("mailpipe: encrypt header: %w", err)
	}
	res, err := p.persist(
		ctx,
		rec.UserID,
		targetFolder,
		append([]byte(nil), rawBody...),
		headerCT,
		mailmeta.ProvenanceAlreadyEncrypted,
		mailmeta.SourceSMTPInbound,
		headers,
		fromAddr,
		[]string{recipient},
	)
	p.recordTelemetry(ctx, mailmeta.SourceSMTPInbound, startedAt, err)
	return res, err
}

// IngestSubmission stores the sender's outbound copy in the sender's sent folder.
// The body is PGP-encrypted to the sender's own identity (so they can re-read it).
func (p *Pipe) IngestSubmission(ctx context.Context, principalEmail, fromAddr string, rcpt []string, rawBody []byte) (*IngestResult, error) {
	if err := p.checkBodySize(rawBody); err != nil {
		return nil, err
	}
	startedAt := time.Now()
	defer wipe(rawBody)
	sender, err := p.recipientIdentity(ctx, principalEmail)
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceSMTPSubmission, startedAt, err)
		return nil, fmt.Errorf("mailpipe: principal identity: %w", err)
	}
	provenance, ciphertext, err := p.materialize(rawBody, sender.ArmoredPublic)
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceSMTPSubmission, startedAt, err)
		return nil, err
	}
	headers := extractHeaders(rawBody)
	headerCT, err := vopenpgp.Encrypt(sender.ArmoredPublic, headers.toJSON())
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceSMTPSubmission, startedAt, err)
		return nil, err
	}
	res, err := p.persist(ctx, sender.UserID, mailmeta.FolderSent, ciphertext, headerCT, provenance, mailmeta.SourceSMTPSubmission, headers, fromAddr, rcpt)
	p.recordTelemetry(ctx, mailmeta.SourceSMTPSubmission, startedAt, err)
	return res, err
}

// IngestInternal stores a message that arrived as PGP ciphertext from the API (client-encrypted).
// rawCipher is treated as the body blob (no re-encryption).
func (p *Pipe) IngestInternal(ctx context.Context, recipient string, headerCiphertext, rawCipher []byte, fromAddr string, rcpt []string) (*IngestResult, error) {
	if err := p.checkBodySize(rawCipher); err != nil {
		return nil, err
	}
	startedAt := time.Now()
	rec, err := p.recipientIdentity(ctx, recipient)
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceAPIClient, startedAt, err)
		return nil, err
	}
	if vopenpgp.Sniff(rawCipher) == vopenpgp.BodyCleartext {
		err := errors.New("mailpipe: IngestInternal requires ciphertext body")
		p.recordTelemetry(ctx, mailmeta.SourceAPIClient, startedAt, err)
		return nil, err
	}
	headers := HeaderSummary{}
	res, err := p.persist(ctx, rec.UserID, mailmeta.FolderInbox, rawCipher, headerCiphertext, mailmeta.ProvenanceClientEncrypted, mailmeta.SourceAPIClient, headers, fromAddr, rcpt)
	p.recordTelemetry(ctx, mailmeta.SourceAPIClient, startedAt, err)
	return res, err
}

// IngestClientSent stores a sender-authored ciphertext copy in the sender's sent folder.
func (p *Pipe) IngestClientSent(ctx context.Context, principalEmail string, headerCiphertext, rawCipher []byte, fromAddr string, rcpt []string) (*IngestResult, error) {
	if err := p.checkBodySize(rawCipher); err != nil {
		return nil, err
	}
	startedAt := time.Now()
	sender, err := p.recipientIdentity(ctx, principalEmail)
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceAPIClient, startedAt, err)
		return nil, err
	}
	if vopenpgp.Sniff(rawCipher) == vopenpgp.BodyCleartext {
		err := errors.New("mailpipe: IngestClientSent requires ciphertext body")
		p.recordTelemetry(ctx, mailmeta.SourceAPIClient, startedAt, err)
		return nil, err
	}
	headers := HeaderSummary{}
	res, err := p.persist(ctx, sender.UserID, mailmeta.FolderSent, rawCipher, headerCiphertext, mailmeta.ProvenanceClientEncrypted, mailmeta.SourceAPIClient, headers, fromAddr, rcpt)
	p.recordTelemetry(ctx, mailmeta.SourceAPIClient, startedAt, err)
	return res, err
}

// IngestInternalPlaintext stores a plaintext message generated inside Elvish for one
// resolved local recipient. The body is gateway-encrypted to the recipient's key
// before persisting, so it never needs external SMTP.
func (p *Pipe) IngestInternalPlaintext(ctx context.Context, fromAddr, recipient string, rcpt []string, rawBody []byte) (*IngestResult, error) {
	return p.IngestInternalPlaintextWithHeader(ctx, fromAddr, recipient, rcpt, rawBody, extractHeaders(rawBody))
}

// IngestInternalPlaintextWithHeader stores a plaintext server-authored message
// and persists the caller-provided header summary for encrypted mailbox metadata.
func (p *Pipe) IngestInternalPlaintextWithHeader(ctx context.Context, fromAddr, recipient string, rcpt []string, rawBody []byte, headers HeaderSummary) (*IngestResult, error) {
	startedAt := time.Now()
	defer wipe(rawBody)
	rec, err := p.recipientIdentity(ctx, recipient)
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceInternal, startedAt, err)
		return nil, err
	}
	provenance, ciphertext, err := p.materialize(rawBody, rec.ArmoredPublic)
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceInternal, startedAt, err)
		return nil, err
	}
	headerCT, err := vopenpgp.Encrypt(rec.ArmoredPublic, headers.toJSON())
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceInternal, startedAt, err)
		return nil, fmt.Errorf("mailpipe: encrypt header: %w", err)
	}
	res, err := p.persist(ctx, rec.UserID, mailmeta.FolderInbox, ciphertext, headerCT, provenance, mailmeta.SourceInternal, headers, fromAddr, rcpt)
	if err != nil {
		p.recordTelemetry(ctx, mailmeta.SourceInternal, startedAt, err)
		return nil, err
	}
	p.recordTelemetry(ctx, mailmeta.SourceInternal, startedAt, nil)
	return res, nil
}

// recipientIdentity resolves an email to the active local mailbox identity row.
func (p *Pipe) recipientIdentity(ctx context.Context, email string) (*mailmeta.IdentityKey, error) {
	if p == nil || p.Meta == nil {
		return nil, errors.New("mailpipe: nil meta store")
	}
	em := strings.ToLower(strings.TrimSpace(email))
	if em == "" {
		return nil, errors.New("mailpipe: empty recipient")
	}
	id, err := p.Meta.IdentityForEmail(ctx, em)
	if err != nil {
		return nil, fmt.Errorf("mailpipe: identity lookup %s: %w", em, err)
	}
	return id, nil
}

// materialize decides the ciphertext + provenance based on the inbound body kind.
func (p *Pipe) materialize(rawBody []byte, recipientPub string) (provenance string, ciphertext []byte, err error) {
	kind := vopenpgp.Sniff(rawBody)
	switch kind {
	case vopenpgp.BodyArmoredMessage, vopenpgp.BodyBinaryPGP:
		return mailmeta.ProvenanceSenderPGPMime, append([]byte(nil), rawBody...), nil
	case vopenpgp.BodyPGPMIME:
		return mailmeta.ProvenanceSenderPGPMime, append([]byte(nil), rawBody...), nil
	default:
		ct, err := vopenpgp.Encrypt(recipientPub, rawBody)
		if err != nil {
			return "", nil, fmt.Errorf("mailpipe: gateway encrypt: %w", err)
		}
		return mailmeta.ProvenanceSMTPGatewayEncrypted, ct, nil
	}
}

// persist writes the body blob, manifest row, mailbox row, opt-in projection, ledger row.
// On any error after the blob upload it issues compensating deletes.
func (p *Pipe) persist(
	ctx context.Context,
	userID uuid.UUID, folder string,
	bodyCiphertext, headerCiphertext []byte,
	provenance, source string,
	headers HeaderSummary,
	fromAddr string, rcpt []string,
) (*IngestResult, error) {
	if p.Blob == nil || p.Scylla == nil || p.Meta == nil {
		return nil, errors.New("mailpipe: missing dependencies")
	}
	messageID := uuid.New()
	bodyKey := blobstore.MailBodyKey(userID.String(), messageID.String())
	if err := p.Blob.Put(ctx, bodyKey, bodyCiphertext, "application/pgp-encrypted"); err != nil {
		return nil, fmt.Errorf("mailpipe: blob put: %w", err)
	}
	manifest := scyllastore.Manifest{
		MessageID:        messageID,
		UserID:           userID,
		Folder:           folder,
		BodyBlobRef:      bodyKey,
		BodySizeBytes:    int64(len(bodyCiphertext)),
		HeaderCiphertext: headerCiphertext,
		Provenance:       provenance,
		Source:           source,
		HasAttachments:   len(headers.Attachments) > 0,
		CreatedAt:        time.Now().UTC(),
	}
	if err := p.Scylla.InsertManifest(ctx, manifest); err != nil {
		_ = p.Blob.Delete(ctx, bodyKey)
		return nil, fmt.Errorf("mailpipe: manifest insert: %w", err)
	}
	opt := scyllastore.OptInMetadata{
		Subject:  headers.Subject,
		FromAddr: fromAddr,
		ToAddrs:  append([]string(nil), rcpt...),
		SentAt:   headers.Date,
		ThreadID: headers.ThreadID,
	}
	if err := p.Scylla.SetOptInMetadata(ctx, userID, messageID, opt); err != nil {
		_ = p.Scylla.DeleteManifest(ctx, userID, folder, manifest.CreatedAt, messageID)
		_ = p.Blob.Delete(ctx, bodyKey)
		return nil, fmt.Errorf("mailpipe: opt-in metadata: %w", err)
	}
	if err := p.Meta.AppendIngestLedger(ctx, mailmeta.IngestLedger{
		UserID: userID, MessageID: messageID, Source: source, Provenance: provenance, BodyBlobRef: bodyKey,
	}); err != nil {
		_ = p.Scylla.DeleteOptInMetadata(ctx, userID, messageID)
		_ = p.Scylla.DeleteManifest(ctx, userID, folder, manifest.CreatedAt, messageID)
		_ = p.Blob.Delete(ctx, bodyKey)
		return nil, fmt.Errorf("mailpipe: ledger append: %w", err)
	}
	if err := p.Meta.EnsureDefaultFolderRetention(ctx, userID); err != nil {
		_ = p.Scylla.DeleteOptInMetadata(ctx, userID, messageID)
		_ = p.Scylla.DeleteManifest(ctx, userID, folder, manifest.CreatedAt, messageID)
		_ = p.Blob.Delete(ctx, bodyKey)
		return nil, fmt.Errorf("mailpipe: ensure folder retention: %w", err)
	}
	if err := p.Meta.UpsertMessageLifecycle(ctx, mailmeta.MessageLifecycle{
		UserID:          userID,
		MessageID:       messageID,
		CurrentFolder:   folder,
		FolderEnteredAt: manifest.CreatedAt,
	}); err != nil {
		_ = p.Scylla.DeleteOptInMetadata(ctx, userID, messageID)
		_ = p.Scylla.DeleteManifest(ctx, userID, folder, manifest.CreatedAt, messageID)
		_ = p.Blob.Delete(ctx, bodyKey)
		return nil, fmt.Errorf("mailpipe: lifecycle append: %w", err)
	}
	if err := p.Scylla.AppendEvent(ctx, userID, "ingest", messageID, fingerprint(bodyCiphertext)); err != nil && p.Logger != nil {
		p.Logger.Warn("mailpipe: event append", "err", err, "message", messageID)
	}
	return &IngestResult{
		UserID:      userID,
		MessageID:   messageID,
		Folder:      folder,
		BodyBlobRef: bodyKey,
		Provenance:  provenance,
		SizeBytes:   int64(len(bodyCiphertext)),
	}, nil
}

// fingerprint returns a short hex prefix of the SHA256 of the ciphertext for audit linking.
func fingerprint(b []byte) string {
	h := sha256.Sum256(b)
	hex := "0123456789abcdef"
	out := make([]byte, 16)
	for i := 0; i < 8; i++ {
		out[i*2] = hex[h[i]>>4]
		out[i*2+1] = hex[h[i]&0xF]
	}
	return string(out)
}

func (p *Pipe) recordTelemetry(ctx context.Context, source string, startedAt time.Time, ingestErr error) {
	if p == nil || p.Telemetry == nil {
		return
	}
	if err := p.Telemetry.RecordMailIngest(ctx, source, ingestErr, time.Since(startedAt)); err != nil && p.Logger != nil {
		p.Logger.Warn("mailpipe telemetry", "err", err)
	}
}

// wipe overwrites the buffer with zeros (best-effort plaintext erasure).
func wipe(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

// AttachmentSummary is lightweight encrypted mailbox metadata for an attachment.
type AttachmentSummary struct {
	FileName    string `json:"file_name"`
	ContentType string `json:"content_type,omitempty"`
	SizeBytes   int64  `json:"size_bytes,omitempty"`
}

// HeaderSummary is the encrypted mailbox metadata persisted alongside a message.
type HeaderSummary struct {
	Subject     string              `json:"subject,omitempty"`
	From        string              `json:"from,omitempty"`
	To          []string            `json:"to,omitempty"`
	Cc          []string            `json:"cc,omitempty"`
	Date        time.Time           `json:"date,omitempty"`
	ThreadID    string              `json:"thread_id,omitempty"`
	Attachments []AttachmentSummary `json:"attachments,omitempty"`
}

func (h HeaderSummary) toJSON() []byte {
	b, _ := json.Marshal(h)
	return b
}

// threadIDFromMessageHeaders picks a stable conversation id for opt-in metadata:
// first id in References (thread root), else first in In-Reply-To, else this message's Message-ID.
func threadIDFromMessageHeaders(msg *mail.Message) string {
	if msg == nil {
		return ""
	}
	if refs := strings.TrimSpace(msg.Header.Get("References")); refs != "" {
		if id := firstMessageIDInField(refs); id != "" {
			return id
		}
	}
	if irt := strings.TrimSpace(msg.Header.Get("In-Reply-To")); irt != "" {
		if id := firstMessageIDInField(irt); id != "" {
			return id
		}
	}
	return strings.TrimSpace(msg.Header.Get("Message-ID"))
}

// firstMessageIDInField returns the first angle-bracket message-id token in a References or In-Reply-To value.
func firstMessageIDInField(s string) string {
	s = strings.ReplaceAll(s, "\r\n", " ")
	s = strings.ReplaceAll(s, "\n", " ")
	for _, tok := range strings.Fields(s) {
		tok = strings.TrimSpace(tok)
		if len(tok) < 3 || tok[0] != '<' {
			continue
		}
		if close := strings.Index(tok, ">"); close > 1 {
			return tok[:close+1]
		}
	}
	return ""
}

// decodeHeaderMIMEWords replaces RFC 2047 encoded-words in a header field (Subject, From display name, etc.).
func decodeHeaderMIMEWords(s string) string {
	s = strings.TrimSpace(s)
	if s == "" || !strings.Contains(s, "=?") {
		return s
	}
	dec, err := new(mime.WordDecoder).DecodeHeader(s)
	if err != nil {
		return s
	}
	dec = strings.TrimSpace(dec)
	if dec == "" {
		return s
	}
	return dec
}

func extractHeaders(rawBody []byte) HeaderSummary {
	hb := rawBody
	if len(hb) > 96<<10 {
		hb = hb[:96<<10]
	}
	msg, err := mail.ReadMessage(bytes.NewReader(hb))
	if err != nil {
		return HeaderSummary{}
	}
	hs := HeaderSummary{
		Subject:  decodeHeaderMIMEWords(msg.Header.Get("Subject")),
		From:     decodeHeaderMIMEWords(msg.Header.Get("From")),
		ThreadID: threadIDFromMessageHeaders(msg),
	}
	if d, err := mail.ParseDate(msg.Header.Get("Date")); err == nil {
		hs.Date = d.UTC()
	}
	if to := msg.Header.Get("To"); to != "" {
		if addrs, err := mail.ParseAddressList(to); err == nil {
			for _, a := range addrs {
				hs.To = append(hs.To, strings.ToLower(a.Address))
			}
		}
	}
	if cc := msg.Header.Get("Cc"); cc != "" {
		if addrs, err := mail.ParseAddressList(cc); err == nil {
			for _, a := range addrs {
				hs.Cc = append(hs.Cc, strings.ToLower(a.Address))
			}
		}
	}
	return hs
}

func completeHeaderSummary(h HeaderSummary, fromAddr string, rcpt []string) HeaderSummary {
	if strings.TrimSpace(h.From) == "" {
		h.From = strings.TrimSpace(fromAddr)
	}
	if len(h.To) == 0 {
		for _, addr := range rcpt {
			addr = strings.ToLower(strings.TrimSpace(addr))
			if addr == "" {
				continue
			}
			h.To = append(h.To, addr)
		}
	}
	return h
}
