package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
	"github.com/ProtonMail/go-crypto/openpgp/packet"

	"elvish/internal/keyserver"
	"elvish/internal/mailmeta"
	"elvish/internal/models"
	"elvish/internal/store"
)

func testArmoredPublicFixture(t *testing.T, uidEmail string) string {
	t.Helper()
	cfg := &packet.Config{Algorithm: packet.PubKeyAlgoEdDSA}
	ent, err := pgpcrypto.NewEntity("Fixture", "Key", uidEmail, cfg)
	if err != nil {
		t.Fatalf("NewEntity: %v", err)
	}
	var buf bytes.Buffer
	aw, err := armor.Encode(&buf, "PGP PUBLIC KEY BLOCK", nil)
	if err != nil {
		t.Fatalf("armor encode: %v", err)
	}
	if err := ent.Serialize(aw); err != nil {
		_ = aw.Close()
		t.Fatalf("serialize: %v", err)
	}
	if err := aw.Close(); err != nil {
		t.Fatalf("armor close: %v", err)
	}
	return buf.String()
}

func TestAPIKeysLookupReturnsArmoredPublicAlias(t *testing.T) {
	src := keyserver.NewMockSource("wkd_advanced")
	src.Set("alice@example.com", "FINGERPRINT123", "-----BEGIN PGP PUBLIC KEY BLOCK-----\nTEST\n-----END PGP PUBLIC KEY BLOCK-----")

	s := &Server{
		log:      slog.New(slog.NewTextHandler(io.Discard, nil)),
		resolver: &keyserver.Resolver{Sources: []keyserver.Source{src}, OpTimeout: time.Second},
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/keys/lookup?email=alice@example.com", nil)
	rec := httptest.NewRecorder()

	s.apiKeysLookup(rec, req, &models.User{ID: uuid.New()})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode json: %v", err)
	}

	if got := body["armored_public"]; got != body["armored"] {
		t.Fatalf("armored_public = %v, armored = %v", got, body["armored"])
	}
	if got := body["fingerprint"]; got != "FINGERPRINT123" {
		t.Fatalf("fingerprint = %v", got)
	}
}

func TestAPIUserContactsPutGetDeleteIntegration(t *testing.T) {
	ctx := context.Background()
	bundle := openAccountDeleteTestBundle(t, false)
	st := store.New(bundle.Pool())
	mm := mailmeta.New(bundle.Pool())
	user, err := st.CreateUser(ctx, "contact-api-owner@example.com", "Owner", "x", false)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, bundle)
	if err != nil {
		t.Fatalf("httpserver: %v", err)
	}
	srv.WithMail(mm, nil, nil, nil, "")

	peerEmail := "peer-contact@example.com"
	pub := testArmoredPublicFixture(t, peerEmail)
	putBody, err := json.Marshal(map[string]any{
		"email":          peerEmail,
		"armored_public": pub,
		"source":         "integration",
		"trusted":        true,
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/keys/contacts", bytes.NewReader(putBody))
	req.Header.Set("Content-Type", "application/json")
	srv.apiContactsPut(rec, req, user)
	if rec.Code != http.StatusOK {
		t.Fatalf("put status = %d body=%s", rec.Code, rec.Body.String())
	}

	recG := httptest.NewRecorder()
	reqG := httptest.NewRequest(http.MethodGet, "/api/v1/keys/contacts/"+peerEmail, nil)
	srv.apiContactsGet(recG, reqG, user, peerEmail)
	if recG.Code != http.StatusOK {
		t.Fatalf("get status = %d body=%s", recG.Code, recG.Body.String())
	}
	var got map[string]any
	if err := json.Unmarshal(recG.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode get: %v", err)
	}
	if got["email"] != peerEmail {
		t.Fatalf("email = %v", got["email"])
	}
	if got["trusted"] != true {
		t.Fatalf("trusted = %v", got["trusted"])
	}
	fp, _ := got["fingerprint"].(string)
	if fp == "" {
		t.Fatalf("missing fingerprint in %v", got)
	}

	recL := httptest.NewRecorder()
	reqL := httptest.NewRequest(http.MethodGet, "/api/v1/keys/contacts", nil)
	srv.apiContactsList(recL, reqL, user)
	if recL.Code != http.StatusOK {
		t.Fatalf("list status = %d", recL.Code)
	}
	var listBody struct {
		Contacts []map[string]any `json:"contacts"`
	}
	if err := json.Unmarshal(recL.Body.Bytes(), &listBody); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(listBody.Contacts) != 1 {
		t.Fatalf("len(contacts) = %d want 1", len(listBody.Contacts))
	}

	recD := httptest.NewRecorder()
	reqD := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/v1/keys/contacts/%s?fingerprint=%s", peerEmail, fp), nil)
	srv.apiContactsDelete(recD, reqD, user, peerEmail)
	if recD.Code != http.StatusOK {
		t.Fatalf("delete status = %d body=%s", recD.Code, recD.Body.String())
	}

	recG2 := httptest.NewRecorder()
	reqG2 := httptest.NewRequest(http.MethodGet, "/api/v1/keys/contacts/"+peerEmail, nil)
	srv.apiContactsGet(recG2, reqG2, user, peerEmail)
	if recG2.Code != http.StatusNotFound {
		t.Fatalf("after delete get status = %d want 404", recG2.Code)
	}
}
