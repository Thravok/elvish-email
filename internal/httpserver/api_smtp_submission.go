package httpserver

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"elvish/internal/mailmeta"
)

// handleSMTPSubmissionAPI dispatches /api/v1/smtp-submission.
func (s *Server) handleSMTPSubmissionAPI(w http.ResponseWriter, r *http.Request, p string) {
	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem not configured")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if !s.paidFeaturesEnabled(u) {
		s.writeErr(w, http.StatusPaymentRequired, "paid subscription required")
		return
	}
	if !s.rateLimitMailUser(w, r, u.ID.String()) {
		return
	}
	rest := strings.TrimPrefix(p, "v1/smtp-submission")
	rest = strings.TrimPrefix(rest, "/")
	parts := strings.FieldsFunc(rest, func(c rune) bool { return c == '/' })

	if len(parts) == 0 {
		switch r.Method {
		case http.MethodGet:
			s.apiSMTPList(w, r, u.ID)
			return
		case http.MethodPost:
			s.apiSMTPCreate(w, r, u.ID)
			return
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
	}

	if len(parts) == 2 && parts[1] == "regenerate" {
		id, err := uuid.Parse(parts[0])
		if err != nil {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		s.apiSMTPRegenerate(w, r, u.ID, id)
		return
	}

	if len(parts) == 1 {
		id, err := uuid.Parse(parts[0])
		if err != nil {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodDelete {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		s.apiSMTPDelete(w, r, u.ID, id)
		return
	}

	http.NotFound(w, r)
}

func (s *Server) apiSMTPList(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	list, err := s.mailmeta.ListSMTPCredentials(r.Context(), userID)
	if err != nil {
		s.writeErrAPIInternal(w, "smtp list", err)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, c := range list {
		out = append(out, map[string]any{
			"id":                   c.ID.String(),
			"name":                 c.Name,
			"email":                c.IdentityEmail,
			"identity_email":       c.IdentityEmail,
			"identity_fingerprint": c.IdentityFingerprint,
			"username":             c.Username,
			"created_at":           c.CreatedAt,
		})
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"credentials": out})
}

type smtpCreateBody struct {
	Name                string `json:"name"`
	IdentityFingerprint string `json:"identity_fingerprint"`
}

func randomSMTPUsername() string {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "smtp_" + uuid.New().String()
	}
	return "smtp_" + strings.TrimRight(base64.RawURLEncoding.EncodeToString(b), "=")
}

func randomSMTPPassword() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return uuid.New().String() + uuid.New().String()
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func (s *Server) apiSMTPCreate(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var body smtpCreateBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		s.writeErr(w, http.StatusBadRequest, "name required")
		return
	}
	fp := strings.TrimSpace(strings.ToUpper(body.IdentityFingerprint))
	if fp == "" {
		s.writeErr(w, http.StatusBadRequest, "identity_fingerprint required")
		return
	}
	plainPass := randomSMTPPassword()
	user := randomSMTPUsername()
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPass), bcrypt.DefaultCost)
	if err != nil {
		s.writeErrAPIInternal(w, "smtp bcrypt", err)
		return
	}
	id, err := s.mailmeta.InsertSMTPCredential(r.Context(), userID, body.Name, fp, user, string(hash))
	if err != nil {
		s.writeErrAPIInternal(w, "smtp insert", err)
		return
	}
	s.writeJSON(w, http.StatusCreated, map[string]any{
		"credential": map[string]any{
			"id": id.String(), "name": body.Name, "username": user, "password": plainPass,
			"identity_fingerprint": fp,
		},
	})
}

func (s *Server) apiSMTPRegenerate(w http.ResponseWriter, r *http.Request, userID, credID uuid.UUID) {
	plainPass := randomSMTPPassword()
	user := randomSMTPUsername()
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPass), bcrypt.DefaultCost)
	if err != nil {
		s.writeErrAPIInternal(w, "smtp bcrypt", err)
		return
	}
	if err := s.mailmeta.UpdateSMTPCredentialPassword(r.Context(), userID, credID, user, string(hash)); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "credential not found")
			return
		}
		s.writeErrAPIInternal(w, "smtp regenerate", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"password": plainPass, "username": user})
}

func (s *Server) apiSMTPDelete(w http.ResponseWriter, r *http.Request, userID, credID uuid.UUID) {
	if err := s.mailmeta.DeleteSMTPCredential(r.Context(), userID, credID); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "credential not found")
			return
		}
		s.writeErrAPIInternal(w, "smtp delete", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
