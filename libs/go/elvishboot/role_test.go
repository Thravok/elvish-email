package elvishboot

import (
	"testing"
)

func TestComponentsForRole(t *testing.T) {
	t.Setenv("ELVISH_HTTP_ENABLED", "")
	t.Setenv("ELVISH_COMPONENT", "")
	t.Setenv("ELVISH_MONOLITH", "")

	api := componentsForRole(RoleAPI)
	if !api.HTTP || api.SMTP || api.MailWorker || api.BackgroundJobs || !api.RunMigrations {
		t.Fatalf("api: %+v", api)
	}

	mta := componentsForRole(RoleMTA)
	if mta.HTTP || !mta.SMTP || mta.MailWorker || mta.BackgroundJobs || mta.RunMigrations {
		t.Fatalf("mta default: %+v", mta)
	}

	t.Setenv("ELVISH_HTTP_ENABLED", "1")
	mtaHTTP := componentsForRole(RoleMTA)
	if !mtaHTTP.HTTP {
		t.Fatal("mta expected HTTP when ELVISH_HTTP_ENABLED=1")
	}

	worker := componentsForRole(RoleWorker)
	if worker.HTTP || worker.SMTP || !worker.MailWorker || !worker.BackgroundJobs || worker.RunMigrations {
		t.Fatalf("worker: %+v", worker)
	}

	t.Setenv("ELVISH_MONOLITH", "1")
	mono := componentsForRole(RoleAPI)
	if !mono.HTTP || !mono.SMTP || !mono.MailWorker || !mono.BackgroundJobs || !mono.RunMigrations {
		t.Fatalf("api monolith: %+v", mono)
	}
}

func TestValidateRoleEnv(t *testing.T) {
	t.Setenv("ELVISH_COMPONENT", "all")
	if err := validateRoleEnv(RoleAPI); err == nil {
		t.Fatal("expected error for all")
	}

	t.Setenv("ELVISH_COMPONENT", "api,mta")
	if err := validateRoleEnv(RoleAPI); err == nil {
		t.Fatal("expected error for combined roles")
	}

	t.Setenv("ELVISH_COMPONENT", "mta")
	if err := validateRoleEnv(RoleAPI); err == nil {
		t.Fatal("expected mismatch error")
	}

	t.Setenv("ELVISH_COMPONENT", "api")
	if err := validateRoleEnv(RoleAPI); err != nil {
		t.Fatalf("expected ok: %v", err)
	}
}
