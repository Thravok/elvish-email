package httpserver

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"

	"elvish/libs/go/dkim"
	"elvish/libs/go/mailmeta"
	"elvish/libs/go/store"
)

type fakeDNSResolver struct {
	txt map[string][]string
	mx  map[string][]*net.MX
}

func (f fakeDNSResolver) LookupTXT(_ context.Context, name string) ([]string, error) {
	return append([]string{}, f.txt[strings.ToLower(strings.TrimSpace(name))]...), nil
}

func (f fakeDNSResolver) LookupMX(_ context.Context, name string) ([]*net.MX, error) {
	rows := f.mx[strings.ToLower(strings.TrimSpace(name))]
	out := make([]*net.MX, 0, len(rows))
	for _, row := range rows {
		if row == nil {
			continue
		}
		copyRow := *row
		out = append(out, &copyRow)
	}
	return out, nil
}

func TestAPICustomDomainsAddRejectsInvalidDomain(t *testing.T) {
	t.Parallel()

	srv := newTestHTTPServer()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/custom-domains", strings.NewReader(`{"domain":"not_a_domain"}`))
	rec := httptest.NewRecorder()

	srv.apiCustomDomainsAdd(rec, req, uuid.New())

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "valid DNS name") {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestAPICustomDomainsAddRejectsReservedDomainIntegration(t *testing.T) {
	ctx := context.Background()
	bundle := openAccountDeleteTestBundle(t, false)
	st := store.New(bundle.Pool())
	mm := mailmeta.New(bundle.Pool())
	user, err := st.CreateUser(ctx, "reserved-owner@example.com", "Reserved Owner", "x", false)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := st.ReserveDeletedAddresses(ctx, []store.DeletedAddressReservation{
		{Address: "reserved.test", AddressKind: "custom_domain"},
	}); err != nil {
		t.Fatalf("reserve deleted addresses: %v", err)
	}

	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, bundle)
	if err != nil {
		t.Fatalf("httpserver: %v", err)
	}
	srv.WithMail(mm, nil, nil, nil, "")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/custom-domains", strings.NewReader(`{"domain":"reserved.test"}`))
	rec := httptest.NewRecorder()

	srv.apiCustomDomainsAdd(rec, req, user.ID)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "reserved after account deletion") {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestAPICustomDomainsVerifyMarksReadyDomainActiveIntegration(t *testing.T) {
	ctx := context.Background()
	bundle := openAccountDeleteTestBundle(t, false)
	st := store.New(bundle.Pool())
	mm := mailmeta.New(bundle.Pool())
	user, err := st.CreateUser(ctx, "dns-owner@example.com", "DNS Owner", "x", true)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, bundle)
	if err != nil {
		t.Fatalf("httpserver: %v", err)
	}
	srv.WithMail(mm, nil, nil, nil, "")

	const (
		domain = "ready.test"
		host   = "_elvish-verify.ready.test"
		value  = "elvish-domain-verify=test-token"
	)
	if err := mm.InsertOwnedDomain(ctx, user.ID, domain, host, value); err != nil {
		t.Fatalf("InsertOwnedDomain: %v", err)
	}
	if err := srv.ensureCustomDomainDKIM(ctx, user.ID, domain); err != nil {
		t.Fatalf("ensureCustomDomainDKIM: %v", err)
	}
	pemPath := filepath.Join(srv.root, "data", "dkim", "domains", domain+".pem")
	pemBytes, err := os.ReadFile(pemPath)
	if err != nil {
		t.Fatalf("read domain dkim pem: %v", err)
	}
	signer, err := dkim.NewRSASignerFromPEM(pemBytes)
	if err != nil {
		t.Fatalf("NewRSASignerFromPEM: %v", err)
	}
	dkimTXT, err := dkim.PublicKeyTXT(signer)
	if err != nil {
		t.Fatalf("PublicKeyTXT: %v", err)
	}
	origResolver := systemDNSResolver
	systemDNSResolver = fakeDNSResolver{
		txt: map[string][]string{
			host:                        {value},
			domain:                      {"v=spf1 include:mail.elvish.test -all"},
			"_dmarc." + domain:          {"v=DMARC1; p=none"},
			"mail._domainkey." + domain: {dkimTXT},
		},
		mx: map[string][]*net.MX{
			domain: {{Host: "mx.elvish.test.", Pref: 10}},
		},
	}
	defer func() { systemDNSResolver = origResolver }()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/custom-domains/"+domain+"/verify", nil)
	rec := httptest.NewRecorder()

	srv.apiCustomDomainsVerify(rec, req, user.ID, domain)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var body struct {
		Status            string `json:"status"`
		Ready             bool   `json:"ready"`
		OwnershipVerified bool   `json:"ownership_verified"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Status != "active" {
		t.Fatalf("status = %q want active", body.Status)
	}
	if !body.Ready || !body.OwnershipVerified {
		t.Fatalf("ready=%v ownership_verified=%v", body.Ready, body.OwnershipVerified)
	}

	rows, err := mm.ListOwnedDomains(ctx, user.ID)
	if err != nil {
		t.Fatalf("ListOwnedDomains: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("len(rows) = %d want 1", len(rows))
	}
	if rows[0].Status != "active" {
		t.Fatalf("rows[0].Status = %q want active", rows[0].Status)
	}
}

func TestAPICustomDomainsCatchallRejectsInactiveIdentityIntegration(t *testing.T) {
	ctx := context.Background()
	bundle := openAccountDeleteTestBundle(t, false)
	st := store.New(bundle.Pool())
	mm := mailmeta.New(bundle.Pool())
	user, err := st.CreateUser(ctx, "catchall-owner@example.com", "Catchall Owner", "x", false)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, bundle)
	if err != nil {
		t.Fatalf("httpserver: %v", err)
	}
	srv.WithMail(mm, nil, nil, nil, "")

	if err := mm.InsertOwnedDomain(ctx, user.ID, "catchall.test", "_elvish-verify.catchall.test", "elvish-domain-verify=catchall"); err != nil {
		t.Fatalf("InsertOwnedDomain: %v", err)
	}
	if err := mm.InsertIdentityKey(ctx, mailmeta.IdentityKey{
		UserID:        user.ID,
		Email:         "inactive@catchall.test",
		Fingerprint:   "ABCDEF0123456789",
		KeyIDLong:     "ABCDEF0123456789",
		ArmoredPublic: "public",
		PrimaryUID:    "inactive@catchall.test",
		Algorithm:     "openpgp-ecc-curve25519",
		Bits:          255,
		IsActive:      false,
	}, []byte("wrapped-secret")); err != nil {
		t.Fatalf("InsertIdentityKey: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/api/v1/custom-domains/catchall.test/catchall", strings.NewReader(`{"identity_fingerprint":"ABCDEF0123456789"}`))
	rec := httptest.NewRecorder()

	srv.apiCustomDomainsCatchall(rec, req, user.ID, "catchall.test")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "identity must be active") {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestPerDomainDKIMPublicTXTDiffersIntegration(t *testing.T) {
	ctx := context.Background()
	bundle := openAccountDeleteTestBundle(t, false)
	st := store.New(bundle.Pool())
	mm := mailmeta.New(bundle.Pool())
	user, err := st.CreateUser(ctx, "two-dom@example.com", "Two Dom", "x", true)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, bundle)
	if err != nil {
		t.Fatalf("httpserver: %v", err)
	}
	srv.WithMail(mm, nil, nil, nil, "")
	for _, dom := range []string{"alpha.e2e.test", "beta.e2e.test"} {
		if err := mm.InsertOwnedDomain(ctx, user.ID, dom, "_elvish-verify."+dom, "elvish-domain-verify=t"); err != nil {
			t.Fatalf("InsertOwnedDomain %s: %v", dom, err)
		}
		if err := srv.ensureCustomDomainDKIM(ctx, user.ID, dom); err != nil {
			t.Fatalf("ensure %s: %v", dom, err)
		}
	}
	a := srv.dkimKeyStatusForDomain(ctx, "alpha.e2e.test").PublicTXT
	b := srv.dkimKeyStatusForDomain(ctx, "beta.e2e.test").PublicTXT
	if a == "" || b == "" {
		t.Fatalf("empty public txt a=%q b=%q", a, b)
	}
	if a == b {
		t.Fatalf("expected distinct DKIM TXT for two domains")
	}
}
