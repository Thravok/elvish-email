package httpserver

import (
	"os"
	"strconv"
	"strings"
	"time"

	"elvish/internal/config"
)

// contentCacheTTL returns the in-process cache lifetime for loadHome/loadPosts.
// ELVISH_CONTENT_CACHE_SEC unset defaults to 10 seconds; 0 or negative disables caching.
func (s *Server) contentCacheTTL() time.Duration {
	v := strings.TrimSpace(os.Getenv("ELVISH_CONTENT_CACHE_SEC"))
	if v == "" {
		return 10 * time.Second
	}
	sec, err := strconv.Atoi(v)
	if err != nil {
		return 10 * time.Second
	}
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
