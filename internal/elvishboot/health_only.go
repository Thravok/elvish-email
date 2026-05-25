package elvishboot

import (
	"net/http"
)

// healthOnlyHandler serves /api/healthz for MTA optional HTTP probes without exposing the full API surface.
func healthOnlyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/api/healthz" {
			w.Header().Set("Cache-Control", "no-store")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
			return
		}
		http.NotFound(w, r)
	})
}
