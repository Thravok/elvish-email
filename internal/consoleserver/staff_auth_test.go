package consoleserver

import (
	"testing"

	"elvish/internal/models"
)

func TestRoleAtLeast(t *testing.T) {
	t.Parallel()
	if !roleAtLeast(models.StaffRoleSuperAdmin, models.StaffRoleOperator) {
		t.Fatal("super_admin should satisfy operator")
	}
	if roleAtLeast(models.StaffRoleSupportAgent, models.StaffRoleOperator) {
		t.Fatal("support_agent should not satisfy operator")
	}
	if !roleAtLeast(models.StaffRoleSupportAgent, models.StaffRoleSupportAgent) {
		t.Fatal("support_agent should satisfy support_agent")
	}
}
