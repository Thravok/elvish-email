package httpserver

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"elvish/internal/models"
)

type staffContextKey struct{}

// WithStaffContext attaches an authenticated staff user to the request context.
func WithStaffContext(r *http.Request, staff *models.StaffUser) *http.Request {
	if staff == nil {
		return r
	}
	ctx := context.WithValue(r.Context(), staffContextKey{}, staff)
	return r.WithContext(ctx)
}

// StaffFromContext returns the Console staff user when present.
func StaffFromContext(ctx context.Context) (*models.StaffUser, bool) {
	if ctx == nil {
		return nil, false
	}
	st, ok := ctx.Value(staffContextKey{}).(*models.StaffUser)
	return st, ok && st != nil
}

// staffRoleAtLeast reports whether role meets minRole for Console RBAC.
func staffRoleAtLeast(role models.StaffRole, minRole models.StaffRole) bool {
	order := map[models.StaffRole]int{
		models.StaffRoleSupportAgent: 1,
		models.StaffRoleOperator:       2,
		models.StaffRoleSuperAdmin:     3,
	}
	return order[role] >= order[minRole]
}

// staffIDFromContext returns actor staff id when authenticated via Console.
func staffIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	st, ok := StaffFromContext(ctx)
	if !ok {
		return uuid.Nil, false
	}
	return st.ID, true
}
