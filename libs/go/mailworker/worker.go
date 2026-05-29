// Package mailworker drains mail_outbox state rows; payload bytes live in object storage.
//
// Each tick:
//  1. Reset stuck "sending" rows back to "pending" (recovery).
//  2. Lease up to N rows whose next_attempt_at <= now().
//  3. For each leased row:
//     a. Get the ciphertext payload from blobstore.
//     b. Group recipients by domain; iterate in order.
//     c. Per domain: lookup MX → STARTTLS → MAIL/RCPT/DATA via internal/smtp/client.
//     d. DKIM-sign the outbound payload via internal/dkim before sending.
//     e. Classify SMTP errors as Permanent (5xx) vs Transient (4xx + connect errors).
//     Permanent → mail_bounces row + status=failed.
//     Transient → next_attempt_at += exponential backoff with jitter.
//  4. On success: status=sent + scyllastore.AppendEvent(kind="sent").
package mailworker

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"math/rand"
	"net"
	"net/mail"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"elvish/libs/go/blobstore"
	"elvish/libs/go/dkim"
	"elvish/libs/go/mailmeta"
	"elvish/libs/go/mailpipe"
	"elvish/libs/go/mailutil"
	vopenpgp "elvish/libs/go/openpgp"
	"elvish/libs/go/relaykey"
	"elvish/libs/go/scyllastore"
	smtpclient "elvish/libs/go/smtp/client"
	"elvish/libs/go/smtp/wire"
	"elvish/libs/go/telemetry"
)

const maxAttempts = 8

// Config controls worker behaviour.
type Config struct {
	Hostname        string
	DKIMSelector    string
	DKIMSigner      *dkim.Signer
	DKIMDomain      string
	ClientTLSConfig *tls.Config
	Logger          *slog.Logger
	Interval        time.Duration
	BatchSize       int

	// RelayKey unwraps OutboxKindPlaintextRelay payloads in memory just before
	// SMTP DATA. Required only for Mode C; if nil, plaintext_relay rows fail
	// permanently with a clear "relay not configured" error.
	RelayKey *relaykey.KeyPair

	Telemetry *telemetry.Service

	// DKIMDomainsDir holds per-custom-domain private keys (PEM), one file per domain (see httpserver customDomainDKIMKeyBasename).
	DKIMDomainsDir string
}

// Worker holds dependencies for one outbound delivery worker.
type Worker struct {
	cfg          Config
	mu           sync.RWMutex
	relayKey     *relaykey.KeyPair
	dkimSigner   *dkim.Signer
	dkimSelector string
	dkimDomain   string
	dkimSignMu   sync.Mutex
	dkimSigners  map[string]*dkim.Signer
	meta         *mailmeta.Store
	scy          *scyllastore.Store
	blob         *blobstore.Store
}

// New returns a configured worker. nil dependencies disable Start.
func New(cfg Config, meta *mailmeta.Store, scy *scyllastore.Store, blob *blobstore.Store) *Worker {
	if cfg.Interval <= 0 {
		cfg.Interval = 3 * time.Second
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 10
	}
	return &Worker{
		cfg:          cfg,
		relayKey:     cfg.RelayKey,
		dkimSigner:   cfg.DKIMSigner,
		dkimSelector: cfg.DKIMSelector,
		dkimDomain:   cfg.DKIMDomain,
		dkimSigners:  map[string]*dkim.Signer{},
		meta:         meta,
		scy:          scy,
		blob:         blob,
	}
}

// SetRelayKey hot-swaps the relay key used for plaintext_relay unwraps.
func (w *Worker) SetRelayKey(kp *relaykey.KeyPair) {
	if w == nil {
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	w.relayKey = kp
	w.cfg.RelayKey = kp
}

// SetDKIM hot-swaps DKIM signer settings used for outbound sends.
func (w *Worker) SetDKIM(selector, domain string, signer *dkim.Signer) {
	if w == nil {
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	w.dkimSelector = strings.ToLower(strings.TrimSpace(selector))
	w.dkimDomain = strings.ToLower(strings.TrimSpace(domain))
	w.dkimSigner = signer
	w.cfg.DKIMSelector = w.dkimSelector
	w.cfg.DKIMDomain = w.dkimDomain
	w.cfg.DKIMSigner = signer
}

func (w *Worker) cryptoSnapshot() (*relaykey.KeyPair, *dkim.Signer, string, string) {
	if w == nil {
		return nil, nil, "", ""
	}
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.relayKey, w.dkimSigner, w.dkimSelector, w.dkimDomain
}

func (w *Worker) platformDKIM() (*dkim.Signer, string, string) {
	if w == nil {
		return nil, "", ""
	}
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.dkimSigner, w.dkimSelector, w.dkimDomain
}

func (w *Worker) resolveDKIM(ctx context.Context, from string) (*dkim.Signer, string, string) {
	dom := domainFromFromAddress(from)
	ps, psel, pdom := w.platformDKIM()
	if dom == "" {
		return ps, psel, pdom
	}
	if w.meta != nil && strings.TrimSpace(w.cfg.DKIMDomainsDir) != "" {
		sel, ref, err := w.meta.GetDomainDKIMByName(ctx, dom)
		if err == nil && ref != "" && sel != "" {
			safeRef := filepath.Base(strings.TrimSpace(ref))
			want := strings.TrimSpace(strings.ToLower(dom)) + ".pem"
			if safeRef == ref && safeRef == want {
				if sg := w.cachedDomainSigner(dom, safeRef); sg != nil {
					return sg, strings.TrimSpace(strings.ToLower(sel)), dom
				}
			}
		}
	}
	if ps != nil && psel != "" && pdom != "" && strings.EqualFold(dom, pdom) {
		return ps, psel, pdom
	}
	return nil, "", ""
}

func (w *Worker) cachedDomainSigner(domain, ref string) *dkim.Signer {
	if w == nil {
		return nil
	}
	key := domain + "\x00" + ref
	w.dkimSignMu.Lock()
	defer w.dkimSignMu.Unlock()
	if w.dkimSigners == nil {
		w.dkimSigners = map[string]*dkim.Signer{}
	}
	if s, ok := w.dkimSigners[key]; ok {
		return s
	}
	path := filepath.Join(w.cfg.DKIMDomainsDir, ref)
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	sg, err := dkim.NewRSASignerFromPEM(raw)
	if err != nil {
		return nil
	}
	w.dkimSigners[key] = sg
	return sg
}

func domainFromFromAddress(from string) string {
	from = strings.TrimSpace(from)
	if from == "" {
		return ""
	}
	if parsed, err := mail.ParseAddress(from); err == nil && parsed != nil {
		from = strings.ToLower(strings.TrimSpace(parsed.Address))
	} else {
		from = strings.ToLower(from)
	}
	at := strings.LastIndex(from, "@")
	if at <= 0 || at == len(from)-1 {
		return ""
	}
	return from[at+1:]
}

// Start runs the worker loop until ctx is cancelled.
func (w *Worker) Start(ctx context.Context) {
	if w.meta == nil || w.blob == nil {
		return
	}
	go func() {
		t := time.NewTicker(w.cfg.Interval)
		defer t.Stop()
		w.runOnce(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				w.runOnce(ctx)
			}
		}
	}()
}

func (w *Worker) runOnce(ctx context.Context) {
	startedAt := time.Now()
	if err := w.meta.RecoverStuckSending(ctx, 15*time.Minute); err != nil && w.cfg.Logger != nil {
		w.cfg.Logger.Warn("mailworker recover stuck", "err", err)
	}
	rows, err := w.meta.LeasePendingOutbox(ctx, w.cfg.BatchSize)
	if err != nil {
		if w.cfg.Logger != nil {
			w.cfg.Logger.Warn("mailworker lease", "err", err)
		}
		w.recordJob(ctx, err, startedAt)
		return
	}
	w.recordQueueHealth(ctx)
	for _, row := range rows {
		w.deliver(ctx, row)
	}
	w.recordJob(ctx, nil, startedAt)
}

func (w *Worker) deliver(ctx context.Context, row mailmeta.OutboxRow) {
	startedAt := time.Now()
	blobStartedAt := time.Now()
	payload, err := w.blob.Get(ctx, row.PayloadBlobRef)
	w.recordDependency(ctx, "blob_get", err == nil, blobStartedAt)
	if err != nil {
		w.failTransient(ctx, row.ID, 0, fmt.Sprintf("blob get: %v", err))
		w.recordDelivery(ctx, "transient_fail", startedAt)
		return
	}
	rawRcpt := strings.Fields(strings.ReplaceAll(row.RecipientSummary, ",", " "))
	rcpt, err := mailutil.ParseMailboxList(rawRcpt)
	if err != nil {
		w.failPermanent(ctx, row.ID, 553, "invalid recipients in outbox row")
		w.recordDelivery(ctx, "permanent_fail", startedAt)
		return
	}
	relayKey, _, _, _ := w.cryptoSnapshot()
	from := ""
	switch row.Kind {
	case "", mailmeta.OutboxKindPGP:
		payload, from, err = preparePGPOutboundPayload(row, rcpt, payload, startedAt)
		if err != nil {
			w.failPermanent(ctx, row.ID, 554, fmt.Sprintf("prepare pgp payload: %v", err))
			w.recordDelivery(ctx, "permanent_fail", startedAt)
			return
		}
	case mailmeta.OutboxKindPlaintextRelay:
		if relayKey == nil {
			w.failPermanent(ctx, row.ID, 554, "relay key not configured (set ELVISH_RELAY_KEY_PATH)")
			w.recordDelivery(ctx, "permanent_fail", startedAt)
			return
		}
		plain, perr := relayKey.Unwrap(payload)
		if perr != nil {
			w.failPermanent(ctx, row.ID, 554, fmt.Sprintf("relay unwrap: %v", perr))
			w.recordDelivery(ctx, "permanent_fail", startedAt)
			return
		}
		// Replace the at-rest ciphertext with the in-memory plaintext for transmission.
		// The outer 'payload' variable is reassigned; the previous slice is GC-collected.
		// We explicitly wipe at the end of deliver via defer to minimize the cleartext window.
		wipeBefore := payload
		payload = plain
		from = extractFromHeader(payload)
		defer wipeBytes(wipeBefore)
		defer wipeBytes(payload)
	default:
		w.failPermanent(ctx, row.ID, 554, fmt.Sprintf("unknown outbox kind %q", row.Kind))
		w.recordDelivery(ctx, "permanent_fail", startedAt)
		return
	}
	if from == "" {
		from = extractFromHeader(payload)
	}
	if from == "" {
		w.failPermanent(ctx, row.ID, 554, "missing From address")
		w.recordDelivery(ctx, "permanent_fail", startedAt)
		return
	}
	dkimSigner, dkimSelector, dkimDomain := w.resolveDKIM(ctx, from)
	if dkimSigner != nil && dkimDomain != "" && dkimSelector != "" {
		signed, err := dkim.SignAndPrepend(dkimSigner, dkim.Options{
			Domain:   dkimDomain,
			Selector: dkimSelector,
		}, payload)
		if err != nil {
			w.failTransient(ctx, row.ID, 0, fmt.Sprintf("dkim sign: %v", err))
			w.recordDelivery(ctx, "transient_fail", startedAt)
			return
		}
		payload = signed
	}
	domains := groupByDomain(rcpt)
	for domain, addrs := range domains {
		if err := w.deliverDomain(ctx, domain, from, addrs, payload); err != nil {
			var serr *wire.SMTPError
			if errors.As(err, &serr) {
				if serr.IsPermanent() {
					for _, a := range addrs {
						_ = w.meta.InsertBounce(ctx, mailmeta.Bounce{OutboxID: row.ID, Recipient: a, Code: serr.Code, Reason: serr.Message})
					}
					w.failPermanent(ctx, row.ID, serr.Code, serr.Message)
					w.recordDelivery(ctx, "permanent_fail", startedAt)
					return
				}
			}
			w.failTransient(ctx, row.ID, 0, err.Error())
			w.recordDelivery(ctx, "transient_fail", startedAt)
			return
		}
	}
	if err := w.meta.MarkOutboxSent(ctx, row.ID, 250); err != nil && w.cfg.Logger != nil {
		w.cfg.Logger.Error("mailworker mark sent", "id", row.ID, "err", err)
	}
	if row.SentCopyBodyBlobRef != "" && len(row.SentCopyHeaderCiphertext) > 0 && row.SentCopyMessageID == uuid.Nil {
		if err := w.persistSentCopy(ctx, row, rcpt); err != nil && w.cfg.Logger != nil {
			w.cfg.Logger.Error("mailworker persist sent copy", "id", row.ID, "err", err)
		}
	}
	if w.scy != nil {
		_ = w.scy.AppendEvent(ctx, row.UserID, "sent", uuid.UUID{}, fmt.Sprintf("outbox=%s; recipients=%d", row.ID, len(rcpt)))
	}
	w.recordDelivery(ctx, "success", startedAt)
}

func preparePGPOutboundPayload(row mailmeta.OutboxRow, rcpt []string, payload []byte, now time.Time) ([]byte, string, error) {
	from := normalizeMailbox(row.SentCopyFromAddr)
	if looksLikeRFC822Message(payload) {
		if from == "" {
			from = extractFromHeader(payload)
		}
		if from == "" {
			return nil, "", errors.New("missing sender address")
		}
		return payload, from, nil
	}
	if from == "" {
		return nil, "", errors.New("missing sender address")
	}
	wrapped, err := buildPGPMIMEMessage(from, rcpt, payload, now)
	if err != nil {
		return nil, "", err
	}
	return wrapped, from, nil
}

func (w *Worker) persistSentCopy(ctx context.Context, row mailmeta.OutboxRow, rcpt []string) error {
	if w.meta == nil || w.blob == nil || w.scy == nil {
		return errors.New("mailworker: sent copy dependencies unavailable")
	}
	payload, err := w.blob.Get(ctx, row.SentCopyBodyBlobRef)
	if err != nil {
		return fmt.Errorf("sent copy blob get: %w", err)
	}
	pipe := mailpipe.New(w.blob, w.scy, w.meta, w.cfg.Logger)
	pipe.Telemetry = w.cfg.Telemetry
	res, err := pipe.IngestClientSent(ctx, row.SentCopyFromAddr, row.SentCopyHeaderCiphertext, payload, row.SentCopyFromAddr, rcpt)
	if err != nil {
		return fmt.Errorf("sent copy ingest: %w", err)
	}
	if err := w.meta.RecordSentCopy(ctx, row.ID, res.MessageID); err != nil {
		return fmt.Errorf("record sent copy: %w", err)
	}
	if err := w.blob.Delete(ctx, row.SentCopyBodyBlobRef); err != nil && !errors.Is(err, blobstore.ErrNotFound) {
		return fmt.Errorf("delete sent copy staging blob: %w", err)
	}
	return nil
}

func (w *Worker) deliverDomain(ctx context.Context, domain, from string, rcpt []string, payload []byte) error {
	lookupStartedAt := time.Now()
	hosts, err := smtpclient.LookupMX(ctx, domain)
	w.recordDependency(ctx, "mx_lookup", err == nil || len(hosts) > 0, lookupStartedAt)
	if err != nil && len(hosts) == 0 {
		return fmt.Errorf("mx lookup: %w", err)
	}
	var lastErr error
	for _, h := range hosts {
		addr := net.JoinHostPort(h, "25")
		connectStartedAt := time.Now()
		c, derr := smtpclient.Dial(ctx, addr, smtpclient.DialOptions{
			Hostname:    w.cfg.Hostname,
			TLSConfig:   w.cfg.ClientTLSConfig,
			UseSTARTTLS: true,
		})
		w.recordDependency(ctx, "smtp_connect", derr == nil, connectStartedAt)
		if derr != nil {
			lastErr = derr
			continue
		}
		mailStartedAt := time.Now()
		if err := c.Mail(from); err != nil {
			w.recordDependency(ctx, "smtp_mail", false, mailStartedAt)
			_ = c.Close()
			lastErr = err
			continue
		}
		w.recordDependency(ctx, "smtp_mail", true, mailStartedAt)
		var permFault *wire.SMTPError
		var rcptErr error
		for _, to := range rcpt {
			rcptStartedAt := time.Now()
			_, err := c.Rcpt(to)
			w.recordDependency(ctx, "smtp_rcpt", err == nil, rcptStartedAt)
			if err != nil {
				rcptErr = err
				if isSMTP(err, 5) {
					permFault = &wire.SMTPError{Code: 550, Message: err.Error()}
				}
				break
			}
		}
		if rcptErr != nil {
			_ = c.Close()
			if permFault != nil {
				return permFault
			}
			lastErr = rcptErr
			continue
		}
		dataStartedAt := time.Now()
		code, msg, err := c.Data(payload)
		w.recordDependency(ctx, "smtp_data", err == nil && code/100 == 2, dataStartedAt)
		_ = c.Quit()
		_ = c.Close()
		if err != nil {
			if isSMTPCodePermanent(code) {
				return &wire.SMTPError{Code: code, Message: msg}
			}
			lastErr = err
			continue
		}
		if code/100 == 2 {
			return nil
		}
		if isSMTPCodePermanent(code) {
			return &wire.SMTPError{Code: code, Message: msg}
		}
		lastErr = fmt.Errorf("smtp data %d: %s", code, msg)
	}
	if lastErr == nil {
		lastErr = errors.New("no MX hosts available")
	}
	return lastErr
}

func isSMTP(err error, hundreds int) bool {
	if err == nil {
		return false
	}
	var serr *wire.SMTPError
	if errors.As(err, &serr) {
		return serr.Code/100 == hundreds
	}
	return false
}

func isSMTPCodePermanent(code int) bool {
	return code/100 == 5
}

func (w *Worker) failTransient(ctx context.Context, id uuid.UUID, code int, msg string) {
	if err := w.meta.MarkOutboxFailed(ctx, id, code, msg, true); err != nil && w.cfg.Logger != nil {
		w.cfg.Logger.Error("mailworker mark transient", "id", id, "err", err)
	}
}

func (w *Worker) failPermanent(ctx context.Context, id uuid.UUID, code int, msg string) {
	if err := w.meta.MarkOutboxFailed(ctx, id, code, msg, false); err != nil && w.cfg.Logger != nil {
		w.cfg.Logger.Error("mailworker mark permanent", "id", id, "err", err)
	}
}

func (w *Worker) recordDelivery(ctx context.Context, result string, startedAt time.Time) {
	if w == nil || w.cfg.Telemetry == nil {
		return
	}
	if err := w.cfg.Telemetry.RecordMailDelivery(ctx, result, time.Since(startedAt)); err != nil && w.cfg.Logger != nil {
		w.cfg.Logger.Warn("mailworker telemetry delivery", "err", err)
	}
}

func (w *Worker) recordJob(ctx context.Context, runErr error, startedAt time.Time) {
	if w == nil || w.cfg.Telemetry == nil {
		return
	}
	if err := w.cfg.Telemetry.RecordJobRun(ctx, "mailworker", runErr, time.Since(startedAt)); err != nil && w.cfg.Logger != nil {
		w.cfg.Logger.Warn("mailworker telemetry job", "err", err)
	}
}

func (w *Worker) recordDependency(ctx context.Context, operation string, success bool, startedAt time.Time) {
	if w == nil || w.cfg.Telemetry == nil {
		return
	}
	if err := w.cfg.Telemetry.RecordDependencyPerf(ctx, "mailworker", operation, "background", success, time.Since(startedAt)); err != nil && w.cfg.Logger != nil {
		w.cfg.Logger.Warn("mailworker telemetry dependency", "err", err, "operation", operation)
	}
}

func (w *Worker) recordQueueHealth(ctx context.Context) {
	if w == nil || w.cfg.Telemetry == nil || w.meta == nil {
		return
	}
	stats, err := w.meta.OutboxStats(ctx)
	if err != nil {
		if w.cfg.Logger != nil {
			w.cfg.Logger.Warn("mailworker outbox stats", "err", err)
		}
		return
	}
	if err := w.cfg.Telemetry.RecordQueueHealth(ctx, "mail_outbox", int(stats["pending"])); err != nil && w.cfg.Logger != nil {
		w.cfg.Logger.Warn("mailworker telemetry queue", "err", err)
	}
}

func groupByDomain(rcpt []string) map[string][]string {
	out := map[string][]string{}
	for _, a := range rcpt {
		at := strings.LastIndex(a, "@")
		if at <= 0 || at == len(a)-1 {
			continue
		}
		d := strings.ToLower(strings.TrimSpace(a[at+1:]))
		out[d] = append(out[d], a)
	}
	return out
}

func looksLikeRFC822Message(payload []byte) bool {
	idx := bytes.Index(payload, []byte("\r\n\r\n"))
	normalized := payload
	if idx < 0 {
		idx = bytes.Index(payload, []byte("\n\n"))
		if idx < 0 {
			return false
		}
		normalized = bytes.ReplaceAll(payload, []byte("\n"), []byte("\r\n"))
	}
	msg, err := mail.ReadMessage(bytes.NewReader(normalized))
	if err != nil {
		return false
	}
	return strings.TrimSpace(msg.Header.Get("From")) != ""
}

func buildPGPMIMEMessage(from string, rcpt []string, payload []byte, now time.Time) ([]byte, error) {
	if now.IsZero() {
		now = time.Now().UTC()
	}
	fromAddr, err := mailutil.ParseMailbox(from)
	if err != nil {
		return nil, fmt.Errorf("from: %w", err)
	}
	cleanRcpt, err := mailutil.ParseMailboxList(rcpt)
	if err != nil {
		return nil, fmt.Errorf("recipients: %w", err)
	}
	boundary := "=_elvish_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	messageID := buildMessageID(fromAddr, now)

	var buf strings.Builder
	buf.WriteString("Message-ID: <")
	buf.WriteString(messageID)
	buf.WriteString(">\r\n")
	buf.WriteString("Date: ")
	buf.WriteString(now.Format(time.RFC1123Z))
	buf.WriteString("\r\n")
	buf.WriteString("From: ")
	buf.WriteString(fromAddr)
	buf.WriteString("\r\n")
	buf.WriteString("To: ")
	buf.WriteString(strings.Join(cleanRcpt, ", "))
	buf.WriteString("\r\n")
	// Keep the exposed subject opaque; compatible MUAs can recover the real
	// subject from the encrypted payload's protected headers.
	buf.WriteString("Subject: ...\r\n")
	buf.WriteString("MIME-Version: 1.0\r\n")
	buf.WriteString("Content-Type: multipart/encrypted; protocol=\"application/pgp-encrypted\"; boundary=\"")
	buf.WriteString(boundary)
	buf.WriteString("\"\r\n")
	buf.WriteString("\r\n")
	buf.WriteString("This is an OpenPGP/MIME encrypted message.\r\n")
	buf.WriteString("--")
	buf.WriteString(boundary)
	buf.WriteString("\r\n")
	buf.WriteString("Content-Type: application/pgp-encrypted\r\n")
	buf.WriteString("Content-Description: PGP/MIME version identification\r\n")
	buf.WriteString("\r\n")
	buf.WriteString("Version: 1\r\n")
	buf.WriteString("--")
	buf.WriteString(boundary)
	buf.WriteString("\r\n")

	switch vopenpgp.Sniff(payload) {
	case vopenpgp.BodyArmoredMessage:
		buf.WriteString("Content-Type: application/octet-stream; name=\"encrypted.asc\"\r\n")
		buf.WriteString("Content-Disposition: inline; filename=\"encrypted.asc\"\r\n")
		buf.WriteString("Content-Transfer-Encoding: 7bit\r\n")
		buf.WriteString("\r\n")
		buf.WriteString(normalizeCRLFString(string(payload)))
	default:
		buf.WriteString("Content-Type: application/octet-stream; name=\"encrypted.pgp\"\r\n")
		buf.WriteString("Content-Disposition: inline; filename=\"encrypted.pgp\"\r\n")
		buf.WriteString("Content-Transfer-Encoding: base64\r\n")
		buf.WriteString("\r\n")
		writeBase64CRLF(&buf, payload)
	}

	if !strings.HasSuffix(buf.String(), "\r\n") {
		buf.WriteString("\r\n")
	}
	buf.WriteString("--")
	buf.WriteString(boundary)
	buf.WriteString("--\r\n")
	return []byte(buf.String()), nil
}

func buildMessageID(from string, now time.Time) string {
	domain := "elvish.local"
	if addr, err := mail.ParseAddress(from); err == nil && addr != nil {
		if at := strings.LastIndex(addr.Address, "@"); at >= 0 && at < len(addr.Address)-1 {
			domain = strings.ToLower(addr.Address[at+1:])
		}
	}
	return now.UTC().Format("20060102T150405Z") + "." + strings.ReplaceAll(uuid.NewString(), "-", "") + "@" + domain
}

func normalizeMailbox(addr string) string {
	addr = strings.TrimSpace(addr)
	if addr == "" {
		return ""
	}
	if parsed, err := mail.ParseAddress(addr); err == nil && parsed != nil {
		return strings.ToLower(strings.TrimSpace(parsed.Address))
	}
	return strings.ToLower(addr)
}

func normalizeCRLFString(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	s = strings.ReplaceAll(s, "\n", "\r\n")
	return s
}

func writeBase64CRLF(buf *strings.Builder, data []byte) {
	encoded := base64.StdEncoding.EncodeToString(data)
	for len(encoded) > 76 {
		buf.WriteString(encoded[:76])
		buf.WriteString("\r\n")
		encoded = encoded[76:]
	}
	if encoded != "" {
		buf.WriteString(encoded)
		buf.WriteString("\r\n")
	}
}

func extractFromHeader(payload []byte) string {
	idx := indexHeader(payload, "From:")
	if idx < 0 {
		return ""
	}
	end := indexCRLF(payload[idx:])
	if end < 0 {
		return ""
	}
	val := string(payload[idx+5 : idx+end])
	val = strings.TrimSpace(val)
	if lt := strings.IndexByte(val, '<'); lt >= 0 {
		gt := strings.IndexByte(val[lt:], '>')
		if gt > 0 {
			return strings.ToLower(strings.TrimSpace(val[lt+1 : lt+gt]))
		}
	}
	return strings.ToLower(val)
}

func indexHeader(payload []byte, name string) int {
	lower := strings.ToLower(string(payload))
	target := strings.ToLower(name)
	idx := strings.Index(lower, "\r\n"+target)
	if idx == 0 {
		return 0
	}
	if idx > 0 {
		return idx + 2
	}
	if strings.HasPrefix(lower, target) {
		return 0
	}
	return -1
}

func indexCRLF(b []byte) int {
	for i := 0; i+1 < len(b); i++ {
		if b[i] == '\r' && b[i+1] == '\n' {
			return i
		}
	}
	return -1
}

// jitterBackoff returns a backoff duration with ±25% jitter.
func jitterBackoff(d time.Duration) time.Duration {
	jitter := time.Duration(rand.Int63n(int64(d/2))) - d/4
	return d + jitter
}

// wipeBytes zeros a buffer in place. Used to minimize the in-memory plaintext
// window after we Unwrap a plaintext_relay payload for SMTP DATA.
func wipeBytes(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

// enforce import retention
var _ = jitterBackoff
var _ = maxAttempts
