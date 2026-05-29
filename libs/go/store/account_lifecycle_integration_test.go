package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"elvish/libs/go/db"
)

func openLifecycleTestStore(t *testing.T) (*Store, *db.Bundle) {
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
	port, err := cr.MappedPort(ctx, "26257")
	if err != nil {
		t.Fatal(err)
	}
	dsn := fmt.Sprintf("postgres://root@%s:%s/defaultdb?sslmode=disable", host, port.Port())

	bundle, err := db.Open(db.Config{CockroachDSN: dsn})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = bundle.Close(context.Background()) })
	if err := db.RunMigrations(ctx, bundle.Pool()); err != nil {
		t.Fatalf("migrations: %v", err)
	}
	return New(bundle.Pool()), bundle
}

func containsLifecycleUser(users []uuid.UUID, want uuid.UUID) bool {
	for _, userID := range users {
		if userID == want {
			return true
		}
	}
	return false
}

func TestAccountLifecycleStoreIntegration(t *testing.T) {
	ctx := context.Background()
	st, bundle := openLifecycleTestStore(t)

	user, err := st.CreateUser(ctx, "lifecycle@example.com", "Lifecycle", "x", false)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	oldActivity := time.Now().UTC().Add(-45 * 24 * time.Hour)
	if err := st.UpdateUserLastActivity(ctx, user.ID, oldActivity); err != nil {
		t.Fatalf("update activity: %v", err)
	}
	if err := st.SetUserInactivityDeletion(ctx, user.ID, 30, InactivityDeleteUnitDays); err != nil {
		t.Fatalf("set inactivity policy: %v", err)
	}
	pastDeleteAt := time.Now().UTC().Add(-time.Hour)
	if err := st.ScheduleUserDeletion(ctx, user.ID, pastDeleteAt, "user_requested"); err != nil {
		t.Fatalf("schedule delete: %v", err)
	}

	fresh, err := st.UserLifecycleByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("load lifecycle user: %v", err)
	}
	if fresh.LastActivityAt.Hour() != 0 || fresh.LastActivityAt.Minute() != 0 || fresh.LastActivityAt.Second() != 0 || fresh.LastActivityAt.Nanosecond() != 0 {
		t.Fatalf("expected normalized activity day, got %s", fresh.LastActivityAt)
	}
	if fresh.InactivityDeleteValue != 30 || fresh.InactivityDeleteUnit != InactivityDeleteUnitDays {
		t.Fatalf("unexpected inactivity policy: %+v", fresh)
	}
	if fresh.ScheduledDeleteAt == nil || !fresh.ScheduledDeleteAt.Equal(pastDeleteAt) {
		t.Fatalf("scheduled delete mismatch: %+v", fresh.ScheduledDeleteAt)
	}

	scheduled, err := st.ListUsersDueForScheduledDeletion(ctx, time.Now().UTC(), 10)
	if err != nil {
		t.Fatalf("list scheduled due: %v", err)
	}
	scheduledIDs := make([]uuid.UUID, 0, len(scheduled))
	for _, row := range scheduled {
		scheduledIDs = append(scheduledIDs, row.ID)
	}
	if !containsLifecycleUser(scheduledIDs, user.ID) {
		t.Fatalf("scheduled due users missing %s", user.ID)
	}

	inactive, err := st.ListUsersDueForInactivityDeletion(ctx, time.Now().UTC(), 10)
	if err != nil {
		t.Fatalf("list inactivity due: %v", err)
	}
	inactiveIDs := make([]uuid.UUID, 0, len(inactive))
	for _, row := range inactive {
		inactiveIDs = append(inactiveIDs, row.ID)
	}
	if !containsLifecycleUser(inactiveIDs, user.ID) {
		t.Fatalf("inactive due users missing %s", user.ID)
	}

	if err := st.ReserveDeletedAddresses(ctx, []DeletedAddressReservation{
		{Address: "lifecycle@example.com", AddressKind: "primary"},
		{Address: "example.test", AddressKind: "custom_domain"},
	}); err != nil {
		t.Fatalf("reserve deleted addresses: %v", err)
	}
	reserved, err := st.IsDeletedAddressReserved(ctx, "lifecycle@example.com")
	if err != nil {
		t.Fatalf("check reserved address: %v", err)
	}
	if !reserved {
		t.Fatal("expected lifecycle@example.com to be reserved")
	}
	domainReserved, err := st.IsDeletedDomainReserved(ctx, "example.test")
	if err != nil {
		t.Fatalf("check reserved domain: %v", err)
	}
	if !domainReserved {
		t.Fatal("expected example.test to be reserved")
	}

	if _, err := bundle.Pool().Exec(ctx, `UPDATE deleted_address_reservations SET expires_at = now() - interval '1 hour'`); err != nil {
		t.Fatalf("expire reservations: %v", err)
	}
	deleted, err := st.DeleteExpiredDeletedAddressReservations(ctx, time.Now().UTC())
	if err != nil {
		t.Fatalf("delete expired reservations: %v", err)
	}
	if deleted == 0 {
		t.Fatal("expected expired reservations to be removed")
	}
	reserved, err = st.IsDeletedAddressReserved(ctx, "lifecycle@example.com")
	if err != nil {
		t.Fatalf("recheck reserved address: %v", err)
	}
	if reserved {
		t.Fatal("expected expired reservation to be gone")
	}
}
