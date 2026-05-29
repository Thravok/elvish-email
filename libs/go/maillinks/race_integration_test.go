package maillinks_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"elvish/libs/go/db"
	"elvish/libs/go/maillinks"
)

// TestConsumeViewRace verifies that under heavy concurrency exactly max_views
// callers see a successful ConsumeView; the rest see ErrBurned. This is the
// invariant the protected-link "burn after N reads" feature relies on, and the
// only thing protecting senders from a misbehaving recipient client.
//
// Gated behind ELVISH_INTEGRATION_DB=1 because it spins a CockroachDB container.
func TestConsumeViewRace(t *testing.T) {
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
	host, _ := cr.Host(ctx)
	port, _ := cr.MappedPort(ctx, "26257")
	dsn := fmt.Sprintf("postgres://root@%s:%s/defaultdb?sslmode=disable", host, port.Port())

	bundle, err := db.Open(db.Config{CockroachDSN: dsn})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = bundle.Close(context.Background()) })

	if err := db.RunMigrations(ctx, bundle.Pool()); err != nil {
		t.Fatalf("migrations: %v", err)
	}

	// Need a row in users for the FK.
	userID := uuid.New()
	if _, err := bundle.Pool().Exec(ctx, `INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)`,
		userID, "race@test.local", "race", "x"); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	store := maillinks.New(bundle.Pool())
	row, err := store.Create(ctx, maillinks.CreateInput{
		UserID:        userID,
		BlobRef:       "secure-link/test.enc",
		BodySizeBytes: 64,
		KDF:           "pbkdf2-sha256-600k",
		KDFSalt:       []byte("0123456789abcdef"),
		KDFParamsJSON: `{"iterations":600000}`,
		WrappedMsgKey: []byte("00000000000000000000000000000000aaaaaaaaaaaaaaaa"),
		TTL:           time.Hour,
		MaxViews:      5,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	const goroutines = 20
	var wg sync.WaitGroup
	var ok, burned int
	var mu sync.Mutex
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := store.ConsumeView(ctx, row.Token)
			mu.Lock()
			defer mu.Unlock()
			if err == nil && res != nil {
				ok++
			} else if errors.Is(err, maillinks.ErrBurned) {
				burned++
			} else {
				t.Errorf("unexpected err: %v", err)
			}
		}()
	}
	wg.Wait()
	if ok != 5 || burned != goroutines-5 {
		t.Fatalf("race outcome: ok=%d burned=%d (want ok=5 burned=%d)", ok, burned, goroutines-5)
	}
	final, err := store.Get(ctx, row.Token)
	if err != nil {
		t.Fatalf("final get: %v", err)
	}
	if final.BurnedAt == nil {
		t.Errorf("burned_at not set after max_views reached")
	}
}

// silence unused import warning when integration is skipped.
var _ = filepath.Clean
var _ = runtime.GOOS
var _ = pgxpool.Config{}
