// Package ratelimit implements fixed-window counters in Valkey/Redis.
package ratelimit

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Limiter tracks per-window request counts using INCR + EXPIRE.
type Limiter struct {
	r      *redis.Client
	prefix string
}

// New returns a limiter backed by r, or nil if r is nil.
func New(r *redis.Client, keyPrefix string) *Limiter {
	if r == nil {
		return nil
	}
	if keyPrefix == "" {
		keyPrefix = "elvish:rl:"
	}
	return &Limiter{r: r, prefix: keyPrefix}
}

// Allow increments the counter for (name, id) in the current window and reports whether it is still under max.
func (l *Limiter) Allow(ctx context.Context, name, id string, max int64, window time.Duration) (bool, error) {
	if l == nil || l.r == nil {
		return true, nil
	}
	if max <= 0 || window <= 0 {
		return false, errors.New("ratelimit: invalid max or window")
	}
	sec := int64(window.Seconds())
	if sec < 1 {
		sec = 1
	}
	bucket := time.Now().UTC().Unix() / sec
	key := fmt.Sprintf("%s%s:%s:%d", l.prefix, name, id, bucket)
	n, err := l.r.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}
	if n == 1 {
		// Best-effort TTL refresh; allow decision already returned above.
		_ = l.r.Expire(ctx, key, window+10*time.Second).Err()
	}
	return n <= max, nil
}
