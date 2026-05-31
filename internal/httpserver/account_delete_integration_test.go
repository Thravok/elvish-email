package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
	"golang.org/x/crypto/bcrypt"

	"elvish/internal/db"
	"elvish/internal/store"
)

func openAccountDeleteTestBundle(t *testing.T, withValkey bool) *db.Bundle {
	t.Helper()
	if os.Getenv("ELVISH_INTEGRATION_DB") == "" {
		t.Skip("set ELVISH_INTEGRATION_DB=1 and ensure Docker is running")
	}
	ctx := context.Background()
	cr, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "cockroachdb/cockroach:v24.3.3",
			ExposedPorts: []string{"26257/tcp"},
			Cmd:          []string{"start-single-node", "--insecure"},
			WaitingFor:   wait.ForListeningPort("26257/tcp").WithStartupTimeout(3 * time.Minute),
		},
		Started: true,
	})
	if err != nil {
		t.Fatalf("cockroach: %v", err)
	}
	t.Cleanup(func() { _ = cr.Terminate(context.Background()) })

	host, err := cr.Host(ctx)
	if err != nil {
		t.Fatal(err)
	}
	crPort, err := cr.MappedPort(ctx, "26257")
	if err != nil {
		t.Fatal(err)
	}
	cfg := db.Config{
		CockroachDSN: fmt.Sprintf("postgres://root@%s:%s/defaultdb?sslmode=disable", host, crPort.Port()),
	}

	if withValkey {
		rdb, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
			ContainerRequest: testcontainers.ContainerRequest{
				Image:        "redis:7-alpine",
				ExposedPorts: []string{"6379/tcp"},
				WaitingFor:   wait.ForListeningPort("6379/tcp").WithStartupTimeout(90 * time.Second),
			},
			Started: true,
		})
		if err != nil {
			t.Fatalf("redis: %v", err)
		}
		t.Cleanup(func() { _ = rdb.Terminate(context.Background()) })
		rhost, err := rdb.Host(ctx)
		if err != nil {
			t.Fatal(err)
		}
		rport, err := rdb.MappedPort(ctx, "6379")
		if err != nil {
			t.Fatal(err)
		}
		cfg.ValkeyAddr = fmt.Sprintf("%s:%s", rhost, rport.Port())
	}

	bundle, err := db.Open(cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = bundle.Close(context.Background()) })
	if err := db.RunMigrations(ctx, bundle.Pool()); err != nil {
		t.Fatalf("migrations: %v", err)
	}
	return bundle
}

func TestAccountDeletePolicyAPIIntegration(t *testing.T) {
	ctx := context.Background()
	bundle := openAccountDeleteTestBundle(t, true)
	st := store.New(bundle.Pool())
	hash, err := bcrypt.GenerateFromPassword([]byte("dangerpass1234567890"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	user, err := st.CreateUser(ctx, "danger@example.com", "Danger", string(hash), false)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	oldActivity := time.Now().UTC().Add(-24 * time.Hour)
	if err := st.UpdateUserLastActivity(ctx, user.ID, oldActivity); err != nil {
		t.Fatalf("seed last activity: %v", err)
	}

	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, bundle)
	if err != nil {
		t.Fatalf("httpserver: %v", err)
	}
	tok, err := srv.sessions.Create(ctx, user.ID, user.Email)
	if err != nil {
		t.Fatalf("session: %v", err)
	}

	putReq := httptest.NewRequest(http.MethodPut, "/api/v1/account/delete-policy", bytes.NewBufferString(`{"enabled":true,"value":6,"unit":"months"}`))
	putReq.Header.Set("Content-Type", "application/json")
	putReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok})
	putRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(putRec, putReq)
	if putRec.Code != http.StatusOK {
		t.Fatalf("put delete policy: status %d body %s", putRec.Code, putRec.Body.String())
	}

	var putBody map[string]any
	if err := json.Unmarshal(putRec.Body.Bytes(), &putBody); err != nil {
		t.Fatalf("decode put delete policy: %v", err)
	}
	policy, _ := putBody["policy"].(map[string]any)
	if policy["unit"] != "months" {
		t.Fatalf("policy unit = %v", policy["unit"])
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/account/delete-policy", nil)
	getReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok})
	getRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("get delete policy: status %d body %s", getRec.Code, getRec.Body.String())
	}

	fresh, err := st.UserLifecycleByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if fresh.InactivityDeleteValue != 6 || fresh.InactivityDeleteUnit != store.InactivityDeleteUnitMonths {
		t.Fatalf("unexpected policy after api save: %+v", fresh)
	}
	now := time.Now().UTC()
	if y1, m1, d1 := fresh.LastActivityAt.UTC().Date(); y1 != now.Year() || m1 != now.Month() || d1 != now.Day() {
		t.Fatalf("expected last activity day to be updated to today, got %s", fresh.LastActivityAt)
	}

	if err := st.ScheduleUserDeletion(ctx, user.ID, time.Now().UTC().Add(7*24*time.Hour), "user_requested"); err != nil {
		t.Fatalf("schedule delete: %v", err)
	}
	cancelReq := httptest.NewRequest(http.MethodPost, "/api/auth/account-delete/cancel", nil)
	cancelReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok})
	cancelRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(cancelRec, cancelReq)
	if cancelRec.Code != http.StatusOK {
		t.Fatalf("cancel scheduled delete: status %d body %s", cancelRec.Code, cancelRec.Body.String())
	}
	fresh, err = st.UserLifecycleByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("reload canceled user: %v", err)
	}
	if fresh.ScheduledDeleteAt != nil {
		t.Fatalf("expected scheduled delete to be cleared, got %v", fresh.ScheduledDeleteAt)
	}
}

func TestAccountDeletionSweepReservesDeletedAddress(t *testing.T) {
	ctx := context.Background()
	bundle := openAccountDeleteTestBundle(t, false)
	st := store.New(bundle.Pool())
	userA, err := st.CreateUser(ctx, "scheduled-delete@example.com", "Scheduled", "x", false)
	if err != nil {
		t.Fatalf("create scheduled user: %v", err)
	}
	userB, err := st.CreateUser(ctx, "inactive-delete@example.com", "Inactive", "x", false)
	if err != nil {
		t.Fatalf("create inactive user: %v", err)
	}
	if err := st.ScheduleUserDeletion(ctx, userA.ID, time.Now().UTC().Add(-time.Hour), "user_requested"); err != nil {
		t.Fatalf("schedule delete userA: %v", err)
	}
	if err := st.UpdateUserLastActivity(ctx, userB.ID, time.Now().UTC().Add(-48*time.Hour)); err != nil {
		t.Fatalf("seed activity userB: %v", err)
	}
	if err := st.SetUserInactivityDeletion(ctx, userB.ID, 1, store.InactivityDeleteUnitDays); err != nil {
		t.Fatalf("set inactivity userB: %v", err)
	}

	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, bundle)
	if err != nil {
		t.Fatalf("httpserver: %v", err)
	}
	if err := srv.runAccountDeletionSweep(ctx, 10); err != nil {
		t.Fatalf("run deletion sweep: %v", err)
	}

	if _, err := st.UserByEmail(ctx, userA.Email); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("scheduled user lookup err = %v want ErrNotFound", err)
	}
	if _, err := st.UserByEmail(ctx, userB.Email); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("inactive user lookup err = %v want ErrNotFound", err)
	}
	for _, email := range []string{userA.Email, userB.Email} {
		reserved, err := st.IsDeletedAddressReserved(ctx, email)
		if err != nil {
			t.Fatalf("reservation check %s: %v", email, err)
		}
		if !reserved {
			t.Fatalf("expected %s to be reserved after sweep", email)
		}
	}
}
