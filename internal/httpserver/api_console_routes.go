package httpserver

import (
	"net/http"
	"strings"
)

// RoutePlatformConsoleAPI dispatches /api/console/* to the same handlers as legacy /api/admin/*.
func (s *Server) RoutePlatformConsoleAPI(w http.ResponseWriter, r *http.Request, subpath string) {
	p := strings.TrimPrefix(subpath, "/")
	p = strings.TrimSuffix(p, "/")
	switch {
	case p == "uptime" && r.Method == http.MethodGet:
		s.apiAdminUptimeGet(w, r)
	case p == "uptime" && r.Method == http.MethodPost:
		s.apiAdminUptimePost(w, r)
	case p == "uptime/test-probe" && r.Method == http.MethodPost:
		s.apiAdminUptimeTestProbe(w, r)
	case p == "uptime/runs" && r.Method == http.MethodDelete:
		s.apiAdminUptimeDeleteRuns(w, r)
	case p == "telemetry" && r.Method == http.MethodGet:
		s.apiAdminTelemetryGet(w, r)
	case p == "telemetry" && r.Method == http.MethodPost:
		s.apiAdminTelemetryPost(w, r)
	case p == "telemetry/export" && r.Method == http.MethodPost:
		s.apiAdminTelemetryExport(w, r)
	case p == "auth-captcha" && r.Method == http.MethodGet:
		s.apiAdminAuthCaptchaGet(w, r)
	case p == "auth-captcha" && r.Method == http.MethodPost:
		s.apiAdminAuthCaptchaPost(w, r)
	case p == "performance" && r.Method == http.MethodGet:
		s.apiAdminPerformanceGet(w, r)
	case p == "performance/export" && r.Method == http.MethodPost:
		s.apiAdminPerformanceExport(w, r)
	case p == "site/home" && r.Method == http.MethodPut:
		s.apiAdminSiteHomePut(w, r)
	case strings.HasPrefix(p, "users"):
		s.handleAdminUsersAPI(w, r, strings.TrimPrefix(p, "users"))
	case strings.HasPrefix(p, "outbox"):
		s.handleAdminOutboxAPI(w, r, strings.TrimPrefix(p, "outbox"))
	case strings.HasPrefix(p, "domains"):
		s.handleAdminDomainsAPI(w, r, strings.TrimPrefix(p, "domains"))
	case strings.HasPrefix(p, "test"):
		s.handleAdminTestAPI(w, r, strings.TrimPrefix(p, "test"))
	case strings.HasPrefix(p, "system-mail"):
		s.handleAdminSystemMailAPI(w, r, strings.TrimPrefix(p, "system-mail"))
	case p == "pgp/keys" && r.Method == http.MethodPost:
		s.apiPGPUpload(w, r)
	case p == "migrate/posts" && r.Method == http.MethodPost:
		s.apiMigratePosts(w, r)
	case p == "posts" && r.Method == http.MethodGet:
		s.apiPostsList(w, r)
	case p == "posts" && r.Method == http.MethodPost:
		s.apiPostUpsert(w, r)
	case p == "bootstrap.json" && r.Method == http.MethodGet:
		s.apiBootstrap(w, r)
	default:
		http.NotFound(w, r)
	}
}
