package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"elvish/libs/go/mailmeta"
	"elvish/libs/go/store"
)

// TestMailDomainSharingAndIdentityValidationIntegration covers share_mode transitions,
// admin PATCH /api/admin/domains/{domain}/sharing, and validateIdentityMailboxEmailForUser
// (same gate as POST /api/v1/identities for custom domains). Requires Docker + ELVISH_INTEGRATION_DB=1.
func TestMailDomainSharingAndIdentityValidationIntegration(t *testing.T) {
	ctx := context.Background()
	bundle := openAccountDeleteTestBundle(t, true)
	st := store.New(bundle.Pool())
	mm := mailmeta.New(bundle.Pool())

	hash, err := bcrypt.GenerateFromPassword([]byte("pw1234567890123456"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	owner, err := st.CreateUser(ctx, "owner-sharing@example.com", "Owner", string(hash), false)
	if err != nil {
		t.Fatalf("create owner: %v", err)
	}
	alice, err := st.CreateUser(ctx, "alice-sharing@example.com", "Alice", string(hash), false)
	if err != nil {
		t.Fatalf("create alice: %v", err)
	}
	bob, err := st.CreateUser(ctx, "bob-sharing@example.com", "Bob", string(hash), false)
	if err != nil {
		t.Fatalf("create bob: %v", err)
	}
	adminUser, err := st.CreateUser(ctx, "admin-sharing@example.com", "Admin", string(hash), true)
	if err != nil {
		t.Fatalf("create admin: %v", err)
	}

	const dom = "share.example"
	host := "_elvish-verify." + dom
	val := "elvish-domain-verify=tok"
	if err := mm.InsertOwnedDomain(ctx, owner.ID, dom, host, val); err != nil {
		t.Fatalf("InsertOwnedDomain: %v", err)
	}
	if _, err := bundle.Pool().Exec(ctx, `UPDATE mail_domains SET status = 'active', mx_verified = true, share_mode = 'owner_only' WHERE domain = $1`, dom); err != nil {
		t.Fatalf("activate domain: %v", err)
	}

	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, bundle)
	if err != nil {
		t.Fatalf("New server: %v", err)
	}
	srv.WithMail(mm, nil, nil, nil, "")

	if err := srv.validateIdentityMailboxEmailForUser(ctx, alice.ID, "alice@"+dom, nil); err == nil {
		t.Fatal("expected rejection for owner_only shared domain")
	}

	adminTok, err := srv.sessions.Create(ctx, adminUser.ID, adminUser.Email)
	if err != nil {
		t.Fatalf("admin session: %v", err)
	}

	patch := func(body map[string]any) *httptest.ResponseRecorder {
		t.Helper()
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(http.MethodPatch, "/api/admin/domains/"+dom+"/sharing", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: adminTok})
		rec := httptest.NewRecorder()
		srv.Handler().ServeHTTP(rec, req)
		return rec
	}

	rec := patch(map[string]any{"share_mode": "all_verified_users", "allowlist_user_ids": []string{}})
	if rec.Code != http.StatusOK {
		t.Fatalf("patch all_verified_users: %d %s", rec.Code, rec.Body.String())
	}

	if err := srv.validateIdentityMailboxEmailForUser(ctx, alice.ID, "alice@"+dom, nil); err != nil {
		t.Fatalf("alice after all_verified_users: %v", err)
	}

	rec2 := patch(map[string]any{"share_mode": "allowlist", "allowlist_user_ids": []string{alice.ID.String()}})
	if rec2.Code != http.StatusOK {
		t.Fatalf("patch allowlist: %d %s", rec2.Code, rec2.Body.String())
	}
	if err := srv.validateIdentityMailboxEmailForUser(ctx, alice.ID, "alice@"+dom, nil); err != nil {
		t.Fatalf("alice on allowlist: %v", err)
	}
	if err := srv.validateIdentityMailboxEmailForUser(ctx, bob.ID, "bob@"+dom, nil); err == nil {
		t.Fatal("expected bob rejected when not on allowlist")
	}

	if _, err := bundle.Pool().Exec(ctx, `UPDATE mail_domains SET mx_verified = false WHERE domain = $1`, dom); err != nil {
		t.Fatal(err)
	}
	if err := srv.validateIdentityMailboxEmailForUser(ctx, alice.ID, "alice@"+dom, nil); err == nil {
		t.Fatal("expected rejection when MX is not verified")
	}
}
