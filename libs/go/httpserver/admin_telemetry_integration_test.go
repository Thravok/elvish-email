package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
	"golang.org/x/crypto/bcrypt"

	"elvish/libs/go/db"
	"elvish/libs/go/models"
	"elvish/libs/go/store"
	"elvish/libs/go/telemetry"
)

// TestAdminTelemetryAPIIntegration exercises the telemetry settings, readback, and export endpoints.
// Requires Docker. Enable with ELVISH_INTEGRATION_DB=1.
func TestAdminTelemetryAPIIntegration(t *testing.T) {
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
	admin, err := st.CreateUser(ctx, "telemetry-admin@example.com", "Telemetry Admin", string(hash), true)
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

	saveBody := bytes.NewBufferString(`{"enabled":true,"retention_days":14,"export_enabled":true}`)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/telemetry", saveBody)
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok})
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("save telemetry: status %d body %s", rec.Code, rec.Body.String())
	}

	if err := srv.Telemetry().Record(ctx, telemetry.Event{
		MetricName:  telemetry.MetricJobRun,
		FeatureArea: "uptime",
		Result:      "success",
		StatusClass: "none",
		Transport:   "background",
		Duration:    2 * time.Second,
	}); err != nil {
		t.Fatalf("seed telemetry: %v", err)
	}
	if err := srv.Telemetry().RecordFrontendPerf(ctx, "admin_ui", "page_boot", true, 320*time.Millisecond); err != nil {
		t.Fatalf("seed frontend perf: %v", err)
	}
	if err := srv.Telemetry().RecordDependencyPerf(ctx, "mailworker", "smtp_connect", "background", true, 900*time.Millisecond); err != nil {
		t.Fatalf("seed dependency perf: %v", err)
	}
	if err := srv.Telemetry().RecordQueueHealth(ctx, "mail_outbox", 23); err != nil {
		t.Fatalf("seed queue health: %v", err)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/admin/telemetry", nil)
	getReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok})
	getRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("get telemetry: status %d body %s", getRec.Code, getRec.Body.String())
	}
	var getPayload struct {
		Settings models.TelemetrySettingsDoc `json:"settings"`
		Recent   []models.TelemetryRollupRow `json:"recent"`
	}
	if err := json.Unmarshal(getRec.Body.Bytes(), &getPayload); err != nil {
		t.Fatalf("decode get: %v", err)
	}
	if !getPayload.Settings.Enabled {
		t.Fatalf("telemetry settings not enabled in readback: %+v", getPayload.Settings)
	}
	if len(getPayload.Recent) == 0 {
		t.Fatal("expected at least one recent telemetry rollup")
	}

	exportReq := httptest.NewRequest(http.MethodPost, "/api/admin/telemetry/export", bytes.NewBufferString(`{"days":7}`))
	exportReq.Header.Set("Content-Type", "application/json")
	exportReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok})
	exportRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(exportRec, exportReq)
	if exportRec.Code != http.StatusOK {
		t.Fatalf("export telemetry: status %d body %s", exportRec.Code, exportRec.Body.String())
	}
	if cd := exportRec.Header().Get("Content-Disposition"); !strings.Contains(cd, "elvish-telemetry-export-") {
		t.Fatalf("missing export filename header: %q", cd)
	}
	var exportDoc models.TelemetryExportDoc
	if err := json.Unmarshal(exportRec.Body.Bytes(), &exportDoc); err != nil {
		t.Fatalf("decode export: %v", err)
	}
	if len(exportDoc.Rollups) == 0 {
		t.Fatal("expected export to include rollups")
	}

	perfReq := httptest.NewRequest(http.MethodGet, "/api/admin/performance?days=7", nil)
	perfReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok})
	perfRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(perfRec, perfReq)
	if perfRec.Code != http.StatusOK {
		t.Fatalf("get performance: status %d body %s", perfRec.Code, perfRec.Body.String())
	}
	var perfPayload struct {
		Overview       models.PerformanceOverview                `json:"overview"`
		Hotspots       []models.PerformanceHotspot               `json:"hotspots"`
		Summary        []models.TelemetrySummaryRow              `json:"summary"`
		LatencySummary []models.TelemetryLatencyBucketSummaryRow `json:"latency_summary"`
	}
	if err := json.Unmarshal(perfRec.Body.Bytes(), &perfPayload); err != nil {
		t.Fatalf("decode performance get: %v", err)
	}
	if perfPayload.Overview.TotalCount == 0 {
		t.Fatalf("expected performance overview totals, got %+v", perfPayload.Overview)
	}
	if len(perfPayload.Summary) == 0 {
		t.Fatal("expected performance summary rows")
	}
	if len(perfPayload.LatencySummary) == 0 {
		t.Fatal("expected performance latency summary rows")
	}

	perfExportReq := httptest.NewRequest(http.MethodPost, "/api/admin/performance/export", bytes.NewBufferString(`{"days":7}`))
	perfExportReq.Header.Set("Content-Type", "application/json")
	perfExportReq.AddCookie(&http.Cookie{Name: sessionCookie, Value: tok})
	perfExportRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(perfExportRec, perfExportReq)
	if perfExportRec.Code != http.StatusOK {
		t.Fatalf("export performance: status %d body %s", perfExportRec.Code, perfExportRec.Body.String())
	}
	if cd := perfExportRec.Header().Get("Content-Disposition"); !strings.Contains(cd, "elvish-performance-export-") {
		t.Fatalf("missing performance export filename header: %q", cd)
	}
	var perfExport models.PerformanceExportDoc
	if err := json.Unmarshal(perfExportRec.Body.Bytes(), &perfExport); err != nil {
		t.Fatalf("decode performance export: %v", err)
	}
	if perfExport.SchemaVersion != models.PerformanceExportSchemaV1 {
		t.Fatalf("unexpected performance export schema version: %q", perfExport.SchemaVersion)
	}
	if len(perfExport.LatencySummary) == 0 {
		t.Fatal("expected performance export latency summary rows")
	}
}
