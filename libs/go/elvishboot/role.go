package elvishboot

import (
	"fmt"
	"os"
	"strings"
)

// Role is the mandatory deployment role for this process (one role per binary).
type Role int

const (
	RoleAPI Role = iota
	RoleMTA
	RoleWorker
)

// String returns the canonical role name.
func (r Role) String() string {
	switch r {
	case RoleAPI:
		return "api"
	case RoleMTA:
		return "mta"
	case RoleWorker:
		return "worker"
	default:
		return "unknown"
	}
}

// Flags are process flags shared by all role binaries.
type Flags struct {
	Addr        string
	Root        string
	MigrateOnly bool
}

type deploymentComponents struct {
	HTTP           bool
	SMTP           bool
	MailWorker     bool
	BackgroundJobs bool
	RunMigrations  bool
}

func envTruthy(key string) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	return v == "1" || v == "true" || v == "yes"
}

func validateRoleEnv(role Role) error {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv("ELVISH_COMPONENT")))
	if raw == "" {
		return nil
	}
	if raw == "all" {
		return fmt.Errorf("ELVISH_COMPONENT=all is removed; run elvishapi, elvishmta, or elvishworker instead")
	}
	if strings.Contains(raw, ",") {
		return fmt.Errorf("ELVISH_COMPONENT must be a single role, not %q", raw)
	}
	if raw != role.String() {
		return fmt.Errorf("binary role is %s but ELVISH_COMPONENT=%q", role.String(), raw)
	}
	return nil
}

func monolithEnabled() bool {
	return envTruthy("ELVISH_MONOLITH")
}

func componentsForRole(role Role) deploymentComponents {
	switch role {
	case RoleAPI:
		if monolithEnabled() {
			return deploymentComponents{
				HTTP: true, SMTP: true, MailWorker: true,
				BackgroundJobs: true, RunMigrations: true,
			}
		}
		return deploymentComponents{
			HTTP: true, SMTP: false, MailWorker: false,
			BackgroundJobs: false, RunMigrations: true,
		}
	case RoleMTA:
		return deploymentComponents{
			HTTP: envTruthy("ELVISH_HTTP_ENABLED"), SMTP: true,
			MailWorker: false, BackgroundJobs: false, RunMigrations: false,
		}
	case RoleWorker:
		return deploymentComponents{
			HTTP: false, SMTP: false, MailWorker: true,
			BackgroundJobs: true, RunMigrations: false,
		}
	default:
		panic("elvishboot: invalid role")
	}
}
