// Package consoleapi exposes Console platform operator HTTP handlers.
// Handlers delegate to httpserver admin implementations with staff context auth.
package consoleapi

import (
	"net/http"
	"strings"

	"elvish/internal/httpserver"
	"elvish/internal/models"
)

// Platform routes operator APIs for authenticated Console staff.
type Platform struct {
	Srv *httpserver.Server
}

// Handle dispatches /api/console/* after staff auth is attached to the request context.
func (p *Platform) Handle(w http.ResponseWriter, r *http.Request) {
	if p == nil || p.Srv == nil {
		http.Error(w, "console unavailable", http.StatusServiceUnavailable)
		return
	}
	sub := strings.TrimPrefix(r.URL.Path, "/api/console")
	if sub == "" {
		sub = "/"
	}
	p.Srv.RoutePlatformConsoleAPI(w, r, sub)
}

// RequireStaffRole validates the staff user in context meets minRole.
func RequireStaffRole(w http.ResponseWriter, r *http.Request, minRole models.StaffRole) (*models.StaffUser, bool) {
	st, ok := httpserver.StaffFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusUnauthorized, "login required")
		return nil, false
	}
	if st.DisabledAt != nil {
		writeErr(w, http.StatusForbidden, "staff account disabled")
		return nil, false
	}
	if !roleAtLeast(st.Role, minRole) {
		writeErr(w, http.StatusForbidden, "insufficient role")
		return nil, false
	}
	return st, true
}

func roleAtLeast(role, min models.StaffRole) bool {
	order := map[models.StaffRole]int{
		models.StaffRoleSupportAgent: 1,
		models.StaffRoleOperator:       2,
		models.StaffRoleSuperAdmin:     3,
	}
	return order[role] >= order[min]
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":` + jsonString(msg) + `}`))
}

func jsonString(s string) string {
	b, _ := jsonMarshal(s)
	return string(b)
}

func jsonMarshal(s string) ([]byte, error) {
	return []byte(`"` + strings.ReplaceAll(strings.ReplaceAll(s, `\`, `\\`), `"`, `\"`) + `"`), nil
}
