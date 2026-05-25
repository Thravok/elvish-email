package httpserver

import (
	"context"
	"time"

	"elvish/internal/config"
)

func (s *Server) contentCacheTTL() time.Duration {
	ctx := context.Background()
	st, err := s.loadPlatformSettings(ctx)
	if err != nil || st == nil {
		return 10 * time.Second
	}
	sec := st.ContentCacheSec
	if sec <= 0 {
		return 0
	}
	return time.Duration(sec) * time.Second
}

// invalidateContentCache clears cached site config and posts (after admin mutations).
func (s *Server) invalidateContentCache() {
	s.contentMu.Lock()
	defer s.contentMu.Unlock()
	s.cachedHome = nil
	s.cachedHomeExp = time.Time{}
	s.cachedPosts = nil
	s.cachedPostsExp = time.Time{}
}

func clearNavInactive(h *config.Home) {
	for i := range h.Nav {
		h.Nav[i].Active = false
	}
}

// cloneHomeForRender returns a shallow copy with an independent Nav slice so
// setNavActive cannot mutate the shared cached Home.
func cloneHomeForRender(h *config.Home) *config.Home {
	if h == nil {
		return nil
	}
	out := *h
	out.Nav = append([]config.NavLink(nil), h.Nav...)
	return &out
}
