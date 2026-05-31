package httpserver

import (
	"context"
	"encoding/base64"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"elvish/internal/mailmeta"
	"elvish/internal/models"
)

func newTestHTTPServer() *Server {
	return &Server{
		log: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

func TestHandleAdminSystemMailAPIRequiresAuth(t *testing.T) {
	t.Parallel()
	s := newTestHTTPServer()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/system-mail/preview", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()

	s.handleAdminSystemMailAPI(rec, req, "/preview")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandleAdminTestAPIRequiresAuth(t *testing.T) {
	t.Parallel()
	s := newTestHTTPServer()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/test/readiness", nil)
	rec := httptest.NewRecorder()

	s.handleAdminTestAPI(rec, req, "/readiness")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandleAdminTestPreviewRequiresAuth(t *testing.T) {
	t.Parallel()
	s := newTestHTTPServer()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/test/preview", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()

	s.handleAdminTestAPI(rec, req, "/preview")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandleAdminTestSendRequiresAuth(t *testing.T) {
	t.Parallel()
	s := newTestHTTPServer()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/test/send", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()

	s.handleAdminTestAPI(rec, req, "/send")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandleAdminDomainsAPIRequiresAuth(t *testing.T) {
	t.Parallel()
	s := newTestHTTPServer()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/domains", strings.NewReader(`{"domain":"example.com","owner_email":"admin@example.com"}`))
	rec := httptest.NewRecorder()

	s.handleAdminDomainsAPI(rec, req, "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandleAdminTestKeyMaterialRequiresAuth(t *testing.T) {
	t.Parallel()
	s := newTestHTTPServer()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/test/key-material", nil)
	rec := httptest.NewRecorder()

	s.handleAdminTestAPI(rec, req, "/key-material")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandleAdminTestAuthPostureRequiresAuth(t *testing.T) {
	t.Parallel()
	s := newTestHTTPServer()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/test/auth-posture", nil)
	rec := httptest.NewRecorder()

	s.handleAdminTestAPI(rec, req, "/auth-posture")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandleAdminTestPrivacyPostureRequiresAuth(t *testing.T) {
	t.Parallel()
	s := newTestHTTPServer()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/test/privacy-posture", nil)
	rec := httptest.NewRecorder()

	s.handleAdminTestAPI(rec, req, "/privacy-posture")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestValidateAdminFromAddr(t *testing.T) {
	t.Parallel()
	domains := []adminSenderDomainOption{
		{Domain: "example.com", Verified: true, Source: "platform"},
	}
	if err := validateAdminFromAddr("announcements@example.com", domains); err != nil {
		t.Fatalf("expected verified sender to pass: %v", err)
	}
	if err := validateAdminFromAddr("Team <announcements@example.com>", domains); err == nil {
		t.Fatal("expected display-name sender to fail")
	}
	if err := validateAdminFromAddr("announcements@other.test", domains); err == nil {
		t.Fatal("expected unverified domain to fail")
	}
}

func TestUserPlaintextRelayDisabledHelper(t *testing.T) {
	t.Parallel()
	s := newTestHTTPServer()
	if !s.userPlaintextRelayDisabled() {
		t.Fatal("expected user plaintext relay to be disabled")
	}
}

func TestFilterActiveUsers(t *testing.T) {
	t.Parallel()
	users := []models.User{
		{Email: "active@example.com", PasswordHash: "bcrypt$hash"},
		{Email: "disabled@example.com", PasswordHash: "$disabled$"},
	}
	active := filterActiveUsers(users)
	if len(active) != 1 {
		t.Fatalf("len(active) = %d want 1", len(active))
	}
	if active[0].Email != "active@example.com" {
		t.Fatalf("active[0].Email = %q", active[0].Email)
	}
}

func TestAdminDomainReady(t *testing.T) {
	t.Parallel()
	if !adminDomainReady(mailmeta.AdminDomain{
		Status:        "active",
		SPFVerified:   true,
		DKIMVerified:  true,
		DMARCVerified: true,
	}) {
		t.Fatal("expected active verified domain to be ready")
	}
	if !adminDomainReady(mailmeta.AdminDomain{
		Status:        "verified",
		SPFVerified:   true,
		DKIMVerified:  true,
		DMARCVerified: true,
	}) {
		t.Fatal("expected legacy verified status to be ready")
	}
	if adminDomainReady(mailmeta.AdminDomain{
		Status:        "pending",
		SPFVerified:   true,
		DKIMVerified:  true,
		DMARCVerified: true,
	}) {
		t.Fatal("pending domain should not be ready")
	}
}

func TestAdminSenderDomainOptionsIncludesEffectivePlatformDomain(t *testing.T) {
	t.Parallel()
	s := newTestHTTPServer()

	domains, err := s.adminSenderDomainOptions(context.Background())
	if err != nil {
		t.Fatalf("adminSenderDomainOptions: %v", err)
	}
	if len(domains) == 0 {
		t.Fatal("expected at least one sender domain")
	}
	if domains[0].Domain != defaultSignupMailDomain {
		t.Fatalf("domains[0].Domain = %q want %q", domains[0].Domain, defaultSignupMailDomain)
	}
	if domains[0].Source != "platform" {
		t.Fatalf("domains[0].Source = %q want platform", domains[0].Source)
	}
	if !domains[0].IsDefault {
		t.Fatal("expected effective platform domain to be marked default")
	}
}

func TestNormalizeDKIMSelector(t *testing.T) {
	t.Parallel()
	got, err := normalizeDKIMSelector("")
	if err != nil {
		t.Fatalf("normalizeDKIMSelector empty: %v", err)
	}
	if got != "mail" {
		t.Fatalf("normalizeDKIMSelector empty = %q want mail", got)
	}
	got, err = normalizeDKIMSelector("SMTP")
	if err != nil {
		t.Fatalf("normalizeDKIMSelector SMTP: %v", err)
	}
	if got != "smtp" {
		t.Fatalf("normalizeDKIMSelector SMTP = %q want smtp", got)
	}
	if _, err := normalizeDKIMSelector("bad selector"); err == nil {
		t.Fatal("expected invalid selector to fail")
	}
}

func TestNormalizeDKIMDomain(t *testing.T) {
	t.Parallel()
	got, err := normalizeDKIMDomain("Mail.Example.com.")
	if err != nil {
		t.Fatalf("normalizeDKIMDomain: %v", err)
	}
	if got != "mail.example.com" {
		t.Fatalf("normalizeDKIMDomain = %q want mail.example.com", got)
	}
	got, err = normalizeDKIMDomain("")
	if err != nil {
		t.Fatalf("normalizeDKIMDomain empty: %v", err)
	}
	if got != "" {
		t.Fatalf("normalizeDKIMDomain empty = %q want empty", got)
	}
	if _, err := normalizeDKIMDomain("not_a_domain"); err == nil {
		t.Fatal("expected invalid domain to fail")
	}
}

func TestMatchTXTExact(t *testing.T) {
	t.Parallel()
	if !matchTXTExact([]string{`v=DKIM1; k=rsa; p=ABC 123`}, `v=DKIM1;k=rsa;p=ABC123`) {
		t.Fatal("expected normalized TXT values to match")
	}
	if matchTXTExact([]string{`v=DKIM1; k=rsa; p=XYZ`}, `v=DKIM1; k=rsa; p=ABC`) {
		t.Fatal("expected different TXT values not to match")
	}
}

func TestValidateProtectedLinkFields(t *testing.T) {
	t.Parallel()

	body := &adminTestProtectedLinkBody{
		KDF:               "pbkdf2-sha256",
		KDFSaltB64:        base64.StdEncoding.EncodeToString([]byte("12345678")),
		KDFParamsJSON:     `{"iterations":600000}`,
		WrappedMsgKeyB64:  base64.StdEncoding.EncodeToString([]byte(strings.Repeat("w", 32))),
		BodyCiphertextB64: base64.StdEncoding.EncodeToString([]byte(strings.Repeat("c", 16))),
		TTLSeconds:        3600,
		MaxViews:          3,
	}
	if err := validateProtectedLinkFields(body); err != nil {
		t.Fatalf("validateProtectedLinkFields: %v", err)
	}
	if got := body.KDFParamsJSON; got == "" {
		t.Fatal("expected kdf params to remain populated")
	}
}
