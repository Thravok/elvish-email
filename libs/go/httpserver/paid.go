package httpserver

import (
	"context"

	"elvish/libs/go/models"
)

func (s *Server) paidFeaturesEnabled(ctx context.Context, u *models.User) bool {
	if u != nil && u.IsAdmin {
		return true
	}
	st, err := s.loadPlatformSettings(ctx)
	if err != nil || st == nil {
		return false
	}
	return st.PaidFeaturesEnabled
}
