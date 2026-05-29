package mailmeta

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"elvish/libs/go/db"
)

func TestIdentityForEmail_ResolvesAliasBeforeCatchall(t *testing.T) {
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

	store := New(bundle.Pool())
	userID := uuid.New()
	if _, err := bundle.Pool().Exec(ctx, `INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)`,
		userID, "owner@elvish.local", "Owner", "x"); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	if _, err := bundle.Pool().Exec(ctx, `INSERT INTO user_identity_keys
		(id, user_id, email, fingerprint, key_id_long, armored_public, primary_uid, algorithm, bits, is_default, is_active, revocation_certificate, created_at)
		VALUES
		($1, $2, 'owner@elvish.local', 'FP-EXACT', 'FP-EXACT', 'PUB-EXACT', 'owner@elvish.local', 'ed25519', 256, true, true, '', now()),
		($3, $2, 'alias-target@custom.test', 'FP-ALIAS', 'FP-ALIAS', 'PUB-ALIAS', 'alias-target@custom.test', 'ed25519', 256, false, true, '', now()),
		($4, $2, 'catchall@custom.test', 'FP-CATCH', 'FP-CATCH', 'PUB-CATCH', 'catchall@custom.test', 'ed25519', 256, false, true, '', now())`,
		uuid.New(), userID, uuid.New(), uuid.New()); err != nil {
		t.Fatalf("seed identities: %v", err)
	}
	if _, err := bundle.Pool().Exec(ctx, `INSERT INTO mail_aliases (user_id, email, identity_fingerprint, is_default, is_active, created_at)
		VALUES ($1, $2, $3, true, true, now())`,
		userID, "team@custom.test", "FP-ALIAS"); err != nil {
		t.Fatalf("seed alias: %v", err)
	}
	if _, err := bundle.Pool().Exec(ctx, `INSERT INTO mail_domains
		(domain, owner_user_id, dkim_selector, dkim_key_id, mx_target, status, created_at, mx_verified, spf_verified, dkim_verified, dmarc_verified, verification_txt_host, verification_txt_value, catchall_identity_fp)
		VALUES ($1, $2, '', '', '', 'active', now(), true, true, true, true, '', '', $3)`,
		"custom.test", userID, "FP-CATCH"); err != nil {
		t.Fatalf("seed domain: %v", err)
	}

	exact, err := store.IdentityForEmail(ctx, "owner@elvish.local")
	if err != nil {
		t.Fatalf("exact lookup: %v", err)
	}
	if exact.Fingerprint != "FP-EXACT" {
		t.Fatalf("exact fingerprint = %q want FP-EXACT", exact.Fingerprint)
	}

	alias, err := store.IdentityForEmail(ctx, "team@custom.test")
	if err != nil {
		t.Fatalf("alias lookup: %v", err)
	}
	if alias.Fingerprint != "FP-ALIAS" {
		t.Fatalf("alias fingerprint = %q want FP-ALIAS", alias.Fingerprint)
	}

	catchall, err := store.IdentityForEmail(ctx, "unknown@custom.test")
	if err != nil {
		t.Fatalf("catchall lookup: %v", err)
	}
	if catchall.Fingerprint != "FP-CATCH" {
		t.Fatalf("catchall fingerprint = %q want FP-CATCH", catchall.Fingerprint)
	}

	_, err = store.IdentityForEmail(ctx, "nobody@example.net")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing lookup err = %v want ErrNotFound", err)
	}
}
