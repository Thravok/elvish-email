package httpserver

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/blobstore"
	"elvish/internal/maillinks"
)

// ---- AUTHED: POST /api/v1/mail/protected-links --------------------------

// protectedLinkCreateBody is the sender-supplied submission.
//
// kdf_salt_b64, kdf_params_json, wrapped_msg_key_b64, and body_ciphertext_b64
// are produced entirely client-side from a sender-chosen password (see
// static/mail/compose.jsx). The server never sees the password.
type protectedLinkCreateBody struct {
	SubjectHint       string   `json:"subject_hint"`
	RecipientEmails   []string `json:"recipient_emails"`
	NotifyRecipients  bool     `json:"notify_recipients"` // when true, send a notification email via outbox-plain
	NotifyFromAddr    string   `json:"notify_from_addr"`  // sender alias used in the notification message
	TTLSeconds        int64    `json:"ttl_seconds"`
	MaxViews          int64    `json:"max_views"`
	KDF               string   `json:"kdf"`
	KDFSaltB64        string   `json:"kdf_salt_b64"`
	KDFParamsJSON     string   `json:"kdf_params_json"`
	WrappedMsgKeyB64  string   `json:"wrapped_msg_key_b64"`
	BodyCiphertextB64 string   `json:"body_ciphertext_b64"`
}

func (s *Server) routeProtectedLinksAuthored(w http.ResponseWriter, r *http.Request, userID uuid.UUID, parts []string) {
	if len(parts) > 0 {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.mailLinks == nil || s.blob == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "protected-link mode not configured")
		return
	}
	var body protectedLinkCreateBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 8<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	body.KDF = strings.ToLower(strings.TrimSpace(body.KDF))
	switch body.KDF {
	case "argon2id", "pbkdf2-sha256", "pbkdf2-sha256-600k":
	default:
		s.writeErr(w, http.StatusBadRequest, "kdf must be argon2id or pbkdf2-sha256[-600k]")
		return
	}
	salt, err := base64.StdEncoding.DecodeString(body.KDFSaltB64)
	if err != nil || len(salt) < 8 {
		s.writeErr(w, http.StatusBadRequest, "invalid kdf_salt_b64")
		return
	}
	wrapped, err := base64.StdEncoding.DecodeString(body.WrappedMsgKeyB64)
	if err != nil || len(wrapped) < 32 {
		s.writeErr(w, http.StatusBadRequest, "invalid wrapped_msg_key_b64")
		return
	}
	cipher, err := base64.StdEncoding.DecodeString(body.BodyCiphertextB64)
	if err != nil || len(cipher) < 16 {
		s.writeErr(w, http.StatusBadRequest, "invalid body_ciphertext_b64")
		return
	}
	if body.KDFParamsJSON == "" {
		body.KDFParamsJSON = "{}"
	}
	if !json.Valid([]byte(body.KDFParamsJSON)) {
		s.writeErr(w, http.StatusBadRequest, "kdf_params_json must be JSON")
		return
	}
	ttl := time.Duration(body.TTLSeconds) * time.Second
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}
	if ttl > 30*24*time.Hour {
		s.writeErr(w, http.StatusBadRequest, "ttl_seconds may not exceed 30 days")
		return
	}
	if body.MaxViews < 0 || body.MaxViews > 1000 {
		s.writeErr(w, http.StatusBadRequest, "max_views out of range")
		return
	}
	clean := make([]string, 0, len(body.RecipientEmails))
	for _, a := range body.RecipientEmails {
		a = strings.TrimSpace(a)
		if a == "" {
			continue
		}
		if _, perr := mail.ParseAddress(a); perr != nil {
			s.writeErr(w, http.StatusBadRequest, "invalid recipient: "+a)
			return
		}
		clean = append(clean, a)
	}

	// Allocate token first so the blob path embeds it.
	token, err := maillinks.NewToken()
	if err != nil {
		s.writeErrAPIInternal(w, "protected-link token", err)
		return
	}
	key := blobstore.ProtectedLinkKey(token)
	if err := s.blob.Put(r.Context(), key, cipher, "application/octet-stream"); err != nil {
		s.writeErrAPIInternal(w, "protected-link blob put", err)
		return
	}
	row, err := s.mailLinks.Create(r.Context(), maillinks.CreateInput{
		UserID:           userID,
		BlobRef:          key,
		BodySizeBytes:    int64(len(cipher)),
		RecipientSummary: strings.Join(clean, ", "),
		SubjectHint:      strings.TrimSpace(body.SubjectHint),
		KDF:              body.KDF,
		KDFSalt:          salt,
		KDFParamsJSON:    body.KDFParamsJSON,
		WrappedMsgKey:    wrapped,
		TTL:              ttl,
		MaxViews:         body.MaxViews,
	})
	if err != nil {
		// Best-effort cleanup of the orphan blob.
		_ = s.blob.Delete(r.Context(), key)
		s.writeErrAPIInternal(w, "protected-link create", err)
		return
	}
	// Re-stamp token with the one the store actually inserted (paranoia).
	token = row.Token
	url := s.protectedLinkURL(r, token)

	// Optionally fan out a notification mail (Mode B is useless without it for non-Elvish recipients).
	notifyOK := false
	if body.NotifyRecipients && len(clean) > 0 {
		fromAddr := strings.TrimSpace(body.NotifyFromAddr)
		if fromAddr == "" {
			if s.mailDomain != "" {
				fromAddr = "no-reply@" + s.mailDomain
			} else {
				fromAddr = "no-reply@elvish.local"
			}
		}
		notice := buildProtectedLinkNotice(body.SubjectHint, fromAddr, url, row.ExpiresAt, row.MaxViews)
		notice.ToAddrs = clean
		_, nerr := s.submitPlaintextOutboxWithContext(r.Context(), userID, *notice, outboxSubmitOpts{
			Source: "protected_link_notice",
		})
		if nerr != nil && s.log != nil {
			s.log.Warn("protected-link notice", "err", nerr)
		}
		notifyOK = nerr == nil
	}

	s.writeJSON(w, http.StatusCreated, map[string]any{
		"token":       token,
		"url":         url,
		"expires_at":  row.ExpiresAt.UTC().Format(time.RFC3339Nano),
		"max_views":   row.MaxViews,
		"notify_sent": notifyOK,
	})
}

func (s *Server) protectedLinkURL(r *http.Request, token string) string {
	base := s.publicBaseURL
	if base == "" {
		scheme := "http"
		if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
			scheme = "https"
		}
		host := r.Host
		base = fmt.Sprintf("%s://%s", scheme, host)
	}
	return strings.TrimRight(base, "/") + "/m/" + token
}

// buildProtectedLinkNotice produces the user-facing email body that contains the link.
// The password is NEVER included; the sender shares it out-of-band.
func buildProtectedLinkNotice(subjectHint, fromAddr, url string, expiresAt time.Time, maxViews int64) *outboxPlainBody {
	subj := strings.TrimSpace(subjectHint)
	if subj == "" {
		subj = "You have an encrypted message"
	}
	var sb strings.Builder
	sb.WriteString("You have received an encrypted message from " + fromAddr + ".\n\n")
	sb.WriteString("Open it here:\n  " + url + "\n\n")
	sb.WriteString("The sender will share the password with you separately.\n")
	sb.WriteString("This link expires at " + expiresAt.UTC().Format(time.RFC1123) + ".\n")
	if maxViews > 0 {
		sb.WriteString(fmt.Sprintf("It can be opened up to %d time(s).\n", maxViews))
	}
	sb.WriteString("\n--\nElvish encrypted mail.\n")
	return &outboxPlainBody{
		FromAddr: fromAddr,
		Subject:  subj,
		BodyText: sb.String(),
		// Recipients are filled in by the caller (we don't have them in this builder; passed in CreateInput already).
	}
}

// ---- PUBLIC: /api/v1/protected-links/{token}/{meta|open} -----------------

// handleProtectedLinksPublicAPI handles GET .../meta and POST .../open.
// These are unauthenticated and rate-limited per IP via the existing Valkey limiter.
func (s *Server) handleProtectedLinksPublicAPI(w http.ResponseWriter, r *http.Request, p string) {
	if s.mailLinks == nil || s.blob == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "protected-link mode not configured")
		return
	}
	rest := strings.TrimPrefix(p, "v1/protected-links")
	rest = strings.TrimPrefix(rest, "/")
	parts := strings.Split(rest, "/")
	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}
	token, action := parts[0], parts[1]
	if !maillinks.ValidateToken(token) {
		http.NotFound(w, r)
		return
	}
	// Per-IP rate limit. 60 per hour for meta (lookups), 12 per hour for open
	// (the latter is the actual decryption attempt window — slow it down hard).
	switch action {
	case "meta":
		if !s.rateLimitOK(w, r, "protected_link_meta", 60, time.Hour) {
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		s.protectedLinkMeta(w, r, token)
	case "open":
		if !s.rateLimitOK(w, r, "protected_link_open", 12, time.Hour) {
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		s.protectedLinkOpen(w, r, token)
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) protectedLinkMeta(w http.ResponseWriter, r *http.Request, token string) {
	row, err := s.mailLinks.Get(r.Context(), token)
	if err != nil {
		if errors.Is(err, maillinks.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		s.writeErrAPIInternal(w, "protected-link get", err)
		return
	}
	expired := row.BurnedAt != nil || time.Now().After(row.ExpiresAt) || (row.MaxViews > 0 && row.Views >= row.MaxViews)
	out := map[string]any{
		"kdf":             row.KDF,
		"kdf_salt_b64":    base64.StdEncoding.EncodeToString(row.KDFSalt),
		"kdf_params_json": json.RawMessage(row.KDFParamsJSON),
		"subject_hint":    row.SubjectHint,
		"expires_at":      row.ExpiresAt.UTC().Format(time.RFC3339Nano),
		"max_views":       row.MaxViews,
		"views":           row.Views,
		"expired":         expired,
	}
	if row.MaxViews > 0 {
		remaining := row.MaxViews - row.Views
		if remaining < 0 {
			remaining = 0
		}
		out["views_remaining"] = remaining
	}
	w.Header().Set("Cache-Control", "no-store")
	s.writeJSON(w, http.StatusOK, out)
}

func (s *Server) protectedLinkOpen(w http.ResponseWriter, r *http.Request, token string) {
	res, err := s.mailLinks.ConsumeView(r.Context(), token)
	if err != nil {
		switch {
		case errors.Is(err, maillinks.ErrNotFound):
			http.NotFound(w, r)
		case errors.Is(err, maillinks.ErrBurned):
			s.writeErr(w, http.StatusGone, "link expired or all views consumed")
		default:
			s.writeErrAPIInternal(w, "protected-link consume", err)
		}
		return
	}
	cipher, err := s.blob.Get(r.Context(), res.Row.BlobRef)
	if err != nil {
		s.writeErrAPIInternal(w, "protected-link blob", err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	out := map[string]any{
		"wrapped_msg_key_b64": base64.StdEncoding.EncodeToString(res.Row.WrappedMsgKey),
		"ciphertext_b64":      base64.StdEncoding.EncodeToString(cipher),
		"kdf":                 res.Row.KDF,
		"kdf_salt_b64":        base64.StdEncoding.EncodeToString(res.Row.KDFSalt),
		"kdf_params_json":     json.RawMessage(res.Row.KDFParamsJSON),
		"max_views":           res.Row.MaxViews,
		"views":               res.Row.Views,
		"views_remaining":     res.ViewsRemaining,
		"burned":              res.Burned,
	}
	s.writeJSON(w, http.StatusOK, out)
}
