package httpserver

import (
	"os"
	"strings"

	"elvish/internal/models"
)

func (s *Server) paidFeaturesEnabled(u *models.User) bool {
	if u != nil && u.IsAdmin {
		return true
	}
	return strings.TrimSpace(os.Getenv("ELVISH_PAID_FEATURES")) == "true"
}
