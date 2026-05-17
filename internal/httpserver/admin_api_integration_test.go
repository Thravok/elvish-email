package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
	"golang.org/x/crypto/bcrypt"

	"elvish/internal/db"
	"elvish/internal/store"
)

func testRepoRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller")
	}
	dir := filepath.Dir(file)
	for i := 0; i < 12; i++ {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	t.Fatal("go.mod not found above", file)
	return ""
}

// TestAdminUptimeAPIIntegration exercises GET /api/admin/uptime with a real Valkey session and SQL user.
// Requires Docker. Enable with ELVISH_INTEGRATION_DB=1 (same gate as other container-backed tests).
func TestAdminUptimeAPIIntegration(t *testing.T) {
	if os.Getenv("ELVISH_INTEGRATION_DB") == "" {
		t.Skip("set ELVISH_INTEGRATION_DB=1 and ensure Docker is running")
	}
	ctx := context.Background()

	crReq := testcontainers.ContainerRequest{
		Image:        "cockroachdb/cockroach:v24.3.3",
		ExposedPorts: []string{"26257/tcp"},
		Cmd:          []string{"start-single-node", "--insecure"},
		WaitingFor:   wait.ForListeningPort("26257/tcp").WithStartupTimeout(3 * time.Minute),
	}
	cr, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: crReq,
		Started:          true,
	})
	if err != nil {
		t.Fatalf("cockroach: %v", err)
	}
	t.Cleanup(func() { _ = cr.Terminate(context.Background()) })

	redisReq := testcontainers.ContainerRequest{
		Image:        "redis:7-alpine",
		ExposedPorts: []string{"6379/tcp"},
		WaitingFor:   wait.ForListeningPort("6379/tcp").WithStartupTimeout(90 * time.Second),
	}
	rdb, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: redisReq,
		Started:          true,
	})
	if err != nil {
		t.Fatalf("redis: %v", err)
	}
	t.Cleanup(func() { _ = rdb.Terminate(context.Background()) })

	host, err := cr.Host(ctx)
	if err != nil {
		t.Fatal(err)
	}
	crPort, err := cr.MappedPort(ctx, "26257")
	if err != nil {
		t.Fatal(err)
	}
	dsn := fmt.Sprintf("postgres://root@%s:%s/defaultdb?sslmode=disable", host, crPort.Port())

	rhost, err := rdb.Host(ctx)
	if err != nil {
		t.Fatal(err)
	}
	rport, err := rdb.MappedPort(ctx, "6379")
	if err != nil {
		t.Fatal(err)
	}
	valkeyAddr := fmt.Sprintf("%s:%s", rhost, rport.Port())

	bundle, err := db.Open(db.Config{CockroachDSN: dsn, ValkeyAddr: valkeyAddr})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = bundle.Close(context.Background())
	})
	if err := db.RunMigrations(ctx, bundle.Pool()); err != nil {
		t.Fatalf("migrations: %v", err)
	}

	st := store.New(bundle.Pool())
	hash, err := bcrypt.GenerateFromPassword([]byte("adminpass1234567890"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	admin, err := st.CreateUser(ctx, "adminapi@example.com", "Admin API", string(hash), true)
	if err != nil {
		t.Fatalf("create admin: %v", err)
	}

	srv, err := New(Options{Root: testRepoRoot(t), CookieSecure: false}, bundle)
	if err != nil {
		t.Fatalf("httpserver: %v", err)
	}

	tok, err := srv.sessions.Create(ctx, admin.ID, admin.Email)
	if err != nil {
		t.Fatalf("session: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/uptime", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok})
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("admin uptime: status %d body %s", rec.Code, rec.Body.String())
	}

	user, err := st.CreateUser(ctx, "plain@example.com", "Plain", string(hash), false)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	tok2, err := srv.sessions.Create(ctx, user.ID, user.Email)
	if err != nil {
		t.Fatalf("session2: %v", err)
	}
	req2 := httptest.NewRequest(http.MethodGet, "/api/admin/uptime", nil)
	req2.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok2})
	rec2 := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusForbidden {
		t.Fatalf("non-admin: want 403 got %d %s", rec2.Code, rec2.Body.String())
	}
}
