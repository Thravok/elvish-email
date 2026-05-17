// Package toolcalls stores per-tool launch counts in Valkey (Redis protocol).
package toolcalls

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const keyPrefix = "elvish:toolopen:v1:"

// Store increments and reads counters keyed by tool slug.
type Store struct {
	r *redis.Client
}

// New returns a counter store, or nil when Valkey is not configured.
func New(r *redis.Client) *Store {
	if r == nil {
		return nil
	}
	return &Store{r: r}
}

func (s *Store) key(slug string) string {
	return keyPrefix + strings.ToLower(strings.TrimSpace(slug))
}

// Incr increments the open counter for slug and returns the new value.
func (s *Store) Incr(ctx context.Context, slug string) (int64, error) {
	if s == nil || s.r == nil {
		return 0, fmt.Errorf("toolcalls: no backend")
	}
	pctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	n, err := s.r.Incr(pctx, s.key(slug)).Result()
	if err != nil {
		return 0, err
	}
	return n, nil
}

// GetMany returns current counts for each slug (missing keys count as 0).
func (s *Store) GetMany(ctx context.Context, slugs []string) (map[string]int64, error) {
	out := make(map[string]int64, len(slugs))
	if s == nil || s.r == nil || len(slugs) == 0 {
		return out, nil
	}
	pctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	keys := make([]string, len(slugs))
	for i, slug := range slugs {
		keys[i] = s.key(slug)
	}
	vals, err := s.r.MGet(pctx, keys...).Result()
	if err != nil {
		return nil, err
	}
	for i, slug := range slugs {
		out[slug] = 0
		if i >= len(vals) || vals[i] == nil {
			continue
		}
		switch v := vals[i].(type) {
		case string:
			n, err := strconv.ParseInt(v, 10, 64)
			if err == nil {
				out[slug] = n
			}
		}
	}
	return out, nil
}
