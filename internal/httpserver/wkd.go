package httpserver

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"strings"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"

	"elvish/internal/mailmeta"
	vopenpgp "elvish/internal/openpgp"
)

var _ = mailmeta.AllowedConsentFields // keep package import alive across edits

// handleWKD serves Web Key Directory routes (RFC draft-koch-openpgp-webkey-service):
//
//	GET /.well-known/openpgpkey/policy           — empty file (presence indicates direct method)
//	GET /.well-known/openpgpkey/hu/{hash}        — direct method
//	GET /.well-known/openpgpkey/{domain}/policy  — advanced method
//	GET /.well-known/openpgpkey/{domain}/hu/{hash}
//
// Keys are returned as binary OpenPGP packets (per draft, no armor) because a recipient who
// already finds us via WKD URL knows it's a key. Gated per-user via user_mail_settings.wkd_publish.
func (s *Server) handleWKD(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	p := strings.TrimPrefix(r.URL.Path, "/.well-known/openpgpkey")
	p = strings.Trim(p, "/")
	parts := strings.Split(p, "/")

	if len(parts) == 1 && parts[0] == "policy" {
		s.wkdPolicy(w)
		return
	}
	if len(parts) == 2 && parts[0] == "hu" {
		s.wkdServeKey(r.Context(), w, "", parts[1], r.URL.Query().Get("l"))
		return
	}
	if len(parts) == 2 && parts[1] == "policy" {
		s.wkdPolicy(w)
		return
	}
	if len(parts) == 3 && parts[1] == "hu" {
		s.wkdServeKey(r.Context(), w, parts[0], parts[2], r.URL.Query().Get("l"))
		return
	}
	http.NotFound(w, r)
}

func (s *Server) wkdPolicy(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	// Empty body is the spec-compliant policy file.
}

// wkdServeKey looks up the user identity by WKD hash and serves the binary key, gated by wkd_publish.
func (s *Server) wkdServeKey(ctx context.Context, w http.ResponseWriter, domain, wkdHash, hint string) {
	notFound := func() { http.Error(w, "404 not found", http.StatusNotFound) }
	if s.mailmeta == nil || s.store == nil {
		notFound()
		return
	}
	host := strings.ToLower(strings.TrimSpace(domain))
	if host == "" {
		host = s.EffectiveMailDomain()
	}
	if host == "" {
		notFound()
		return
	}
	wkdHash = strings.ToLower(strings.TrimSpace(wkdHash))
	if wkdHash == "" {
		notFound()
		return
	}
	email := s.lookupWKDEmail(ctx, host, wkdHash, hint)
	if email == "" {
		notFound()
		return
	}
	id, err := s.mailmeta.IdentityForEmail(ctx, email)
	if err != nil || id == nil {
		notFound()
		return
	}
	u, err := s.store.UserByEmail(ctx, email)
	if err != nil || u == nil {
		notFound()
		return
	}
	st, err := s.mailmeta.GetSettings(ctx, u.ID)
	if err != nil || !st.WKDPublish {
		notFound()
		return
	}
	binBody, err := armoredToBinary(id.ArmoredPublic)
	if err != nil {
		notFound()
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "public, max-age=600")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	_, _ = w.Write(binBody)
}

func (s *Server) lookupWKDEmail(ctx context.Context, domain, hash, hint string) string {
	if hint != "" {
		hintEmail := strings.ToLower(strings.TrimSpace(hint))
		if !strings.Contains(hintEmail, "@") {
			hintEmail = hintEmail + "@" + domain
		}
		if vopenpgp.WKDLocalPartHash(strings.SplitN(hintEmail, "@", 2)[0]) == hash {
			return hintEmail
		}
	}
	if s.mailmeta == nil {
		return ""
	}
	email, err := s.mailmeta.WKDReverseLookup(ctx, domain, hash)
	if err != nil {
		return ""
	}
	return email
}

var _ = errors.New // keep errors import alive

func armoredToBinary(armored string) ([]byte, error) {
	block, err := armor.Decode(strings.NewReader(armored))
	if err != nil {
		return nil, err
	}
	el, err := pgpcrypto.ReadKeyRing(block.Body)
	if err != nil {
		return nil, err
	}
	if len(el) == 0 {
		return nil, errors.New("empty keyring")
	}
	var buf bytes.Buffer
	if err := el[0].Serialize(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
