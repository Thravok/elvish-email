package httpserver

import (
	"net/http"
)

// apiBillingStatus returns whether paid API features are enabled for the current user.
func (s *Server) apiBillingStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	u, _ := s.userFromRequest(r)
	s.writeJSON(w, http.StatusOK, map[string]any{
		"paid": s.paidFeaturesEnabled(r.Context(), u),
	})
}
