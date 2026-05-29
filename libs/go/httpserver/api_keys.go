package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
	"strings"

	"elvish/libs/go/keyserver"
	"elvish/libs/go/mailmeta"
	"elvish/libs/go/mailutil"
	"elvish/libs/go/models"
	"elvish/libs/go/openpgp"
)

// handleKeysAPI dispatches /api/v1/keys/* routes:
//   - lookup?email=... — resolver chain (local identity → cache → WKD → Proton/HKPS)
//   - contacts          — list/save/get the user's address-book entries (cached pubkeys)
func (s *Server) handleKeysAPI(w http.ResponseWriter, r *http.Request, p string) {
	rest := strings.TrimPrefix(p, "v1/keys")
	rest = strings.TrimPrefix(rest, "/")
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	switch {
	case rest == "lookup":
		if s.resolver == nil {
			s.writeErr(w, http.StatusServiceUnavailable, "keyserver resolver not configured")
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if !s.rateLimitKey(w, r, "keys_lookup", u.ID.String(), rateLimitKeysLookupPerHour, rateLimitKeysLookupWindow) {
			return
		}
		s.apiKeysLookup(w, r)
	case rest == "contacts":
		if s.mailmeta == nil {
			s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem not configured")
			return
		}
		switch r.Method {
		case http.MethodGet:
			s.apiContactsList(w, r, u)
		case http.MethodPost:
			s.apiContactsPut(w, r, u)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case strings.HasPrefix(rest, "contacts/"):
		if s.mailmeta == nil {
			s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem not configured")
			return
		}
		email := strings.TrimSpace(strings.TrimPrefix(rest, "contacts/"))
		if email == "" {
			http.NotFound(w, r)
			return
		}
		switch r.Method {
		case http.MethodGet:
			s.apiContactsGet(w, r, u, email)
		case http.MethodDelete:
			s.apiContactsDelete(w, r, u, email)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) apiKeysLookup(w http.ResponseWriter, r *http.Request) {
	emailRaw := strings.TrimSpace(r.URL.Query().Get("email"))
	if emailRaw == "" {
		s.writeErr(w, http.StatusBadRequest, "email required")
		return
	}
	email, err := mailutil.ParseMailbox(emailRaw)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid email")
		return
	}
	hit, err := s.resolver.Lookup(r.Context(), email)
	if err != nil {
		if errors.Is(err, keyserver.ErrNotFound) {
			s.writeJSON(w, http.StatusNotFound, map[string]any{"error": "not_found", "email": email})
			return
		}
		s.writeErrAPIInternal(w, "keyserver lookup", err)
		return
	}
	s.writeJSON(w, http.StatusOK, lookupKeyJSON(hit))
}

func lookupKeyJSON(hit *keyserver.KeyHit) map[string]any {
	if hit == nil {
		return map[string]any{}
	}
	return map[string]any{
		"email":                 hit.Email,
		"fingerprint":           hit.Fingerprint,
		"armored":               hit.Armored,
		"armored_public":        hit.Armored,
		"source":                hit.Source,
		"fetched_at":            hit.FetchedAt,
		"expires_at":            hit.ExpiresAt,
		"verified_uid_match":    hit.VerifiedUIDMatch,
		"proton_kt_state":       hit.ProtonKTState,
		"address_keys_verified": hit.AddressKeysVerified,
	}
}

// contactPutBody is the user-supplied address-book entry. The server parses the
// armored block to extract a fingerprint and stores the row through mailmeta.
type contactPutBody struct {
	Email         string `json:"email"`
	ArmoredPublic string `json:"armored_public"`
	Source        string `json:"source"`
	// Trusted defaults to true when omitted (manual / compose saves).
	Trusted *bool `json:"trusted,omitempty"`
}

func (s *Server) apiContactsPut(w http.ResponseWriter, r *http.Request, u *models.User) {
	var body contactPutBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	if body.Email == "" || strings.TrimSpace(body.ArmoredPublic) == "" {
		s.writeErr(w, http.StatusBadRequest, "email and armored_public required")
		return
	}
	if _, perr := mail.ParseAddress(body.Email); perr != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid email")
		return
	}
	meta, err := openpgp.ParseArmoredPublicKeyMeta(body.ArmoredPublic)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid armored public key")
		return
	}
	source := strings.TrimSpace(body.Source)
	if source == "" {
		source = "manual"
	}
	markTrusted := body.Trusted == nil || *body.Trusted
	if err := s.mailmeta.UpsertUserContactKey(r.Context(), u.ID, body.Email, meta.FullKeyID, body.ArmoredPublic, source, markTrusted); err != nil {
		s.writeErrAPIInternal(w, "contact put", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "fingerprint": meta.FullKeyID, "trusted": markTrusted})
}

func (s *Server) apiContactsGet(w http.ResponseWriter, r *http.Request, u *models.User, email string) {
	email = strings.ToLower(email)
	if _, perr := mail.ParseAddress(email); perr != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid email")
		return
	}
	row, err := s.mailmeta.GetUserContactKey(r.Context(), u.ID, email)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		s.writeErrAPIInternal(w, "contact get", err)
		return
	}
	s.writeJSON(w, http.StatusOK, userContactJSON(row))
}

func (s *Server) apiContactsDelete(w http.ResponseWriter, r *http.Request, u *models.User, email string) {
	email = strings.ToLower(email)
	if _, perr := mail.ParseAddress(email); perr != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid email")
		return
	}
	fp := strings.TrimSpace(r.URL.Query().Get("fingerprint"))
	var err error
	if fp != "" {
		err = s.mailmeta.DeleteUserContactKey(r.Context(), u.ID, email, fp)
	} else {
		err = s.mailmeta.DeleteUserContactKeysByEmail(r.Context(), u.ID, email)
	}
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		s.writeErrAPIInternal(w, "contact delete", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) apiContactsList(w http.ResponseWriter, r *http.Request, u *models.User) {
	rows, err := s.mailmeta.ListUserContactKeys(r.Context(), u.ID, 100)
	if err != nil {
		s.writeErrAPIInternal(w, "contact list", err)
		return
	}
	trustedOnly := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("trusted"))) == "1" ||
		strings.TrimSpace(strings.ToLower(r.URL.Query().Get("trusted"))) == "true"
	out := make([]map[string]any, 0, len(rows))
	for _, k := range rows {
		if trustedOnly && k.TrustedAt == nil {
			continue
		}
		out = append(out, userContactJSON(&k))
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"contacts": out})
}

func userContactJSON(k *mailmeta.UserContactKey) map[string]any {
	m := map[string]any{
		"email":          k.Email,
		"fingerprint":    k.Fingerprint,
		"armored_public": k.ArmoredPublic,
		"source":         k.Source,
		"trusted":        k.TrustedAt != nil,
		"created_at":     k.CreatedAt,
		"updated_at":     k.UpdatedAt,
	}
	if k.TrustedAt != nil {
		m["trusted_at"] = k.TrustedAt.UTC()
	}
	return m
}
