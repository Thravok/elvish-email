package keyserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"elvish/internal/mailmeta"
)

// CockroachStore is the persistent cache (mailmeta.Store).
type CockroachStore interface {
	GetContactKey(ctx context.Context, email string) (*mailmeta.ContactKey, error)
	PutContactKey(ctx context.Context, k mailmeta.ContactKey) error
}

// IdentityLookup resolves a local user identity (for the "local" source).
type IdentityLookup interface {
	IdentityForEmail(ctx context.Context, email string) (*mailmeta.IdentityKey, error)
}

// Cache wraps Valkey (negative cache) + Cockroach (positive cache).
type Cache struct {
	Valkey  *redis.Client
	Persist CockroachStore
	NegTTL  time.Duration // negative cache TTL (default 5m)
	PosTTL  time.Duration // positive cache TTL (default 24h)
	prefix  string
}

// NewCache returns a Cache with sane defaults.
func NewCache(v *redis.Client, persist CockroachStore) *Cache {
	return &Cache{Valkey: v, Persist: persist, NegTTL: 5 * time.Minute, PosTTL: 24 * time.Hour, prefix: "elvish:keysrv:"}
}

// Get returns a cached hit for email or ErrNotFound when nothing valid is cached.
// Negative cache hits return a sentinel via ErrCachedMiss.
var ErrCachedMiss = errors.New("keyserver: cached miss")

// Get checks the Cockroach positive cache then the Valkey negative cache.
func (c *Cache) Get(ctx context.Context, email string) (*KeyHit, error) {
	if c == nil {
		return nil, ErrNotFound
	}
	email = strings.ToLower(strings.TrimSpace(email))
	if c.Persist != nil {
		row, err := c.Persist.GetContactKey(ctx, email)
		if err == nil && row != nil {
			return &KeyHit{
				Email:            row.Email,
				Fingerprint:      row.Fingerprint,
				Armored:          row.ArmoredPublic,
				Source:           row.Source,
				FetchedAt:        row.FetchedAt,
				ExpiresAt:        row.ExpiresAt,
				VerifiedUIDMatch: row.VerifiedUIDMatch,
				ProtonKTState:    row.ProtonKTState,
			}, nil
		}
	}
	if c.Valkey != nil {
		key := c.prefix + "neg:" + email
		v, err := c.Valkey.Get(ctx, key).Result()
		if err == nil && v == "1" {
			return nil, ErrCachedMiss
		}
	}
	return nil, ErrNotFound
}

// Put stores a positive hit in Cockroach and clears any negative entry in Valkey.
func (c *Cache) Put(ctx context.Context, hit *KeyHit) error {
	if c == nil || hit == nil {
		return nil
	}
	if c.Persist != nil {
		expires := hit.ExpiresAt
		if expires.IsZero() {
			expires = time.Now().UTC().Add(c.PosTTL)
		}
		if err := c.Persist.PutContactKey(ctx, mailmeta.ContactKey{
			Email:            strings.ToLower(strings.TrimSpace(hit.Email)),
			Fingerprint:      hit.Fingerprint,
			ArmoredPublic:    hit.Armored,
			Source:           hit.Source,
			ExpiresAt:        expires,
			VerifiedUIDMatch: hit.VerifiedUIDMatch,
			ProtonKTState:    hit.ProtonKTState,
		}); err != nil {
			return fmt.Errorf("contact key persist: %w", err)
		}
	}
	if c.Valkey != nil {
		_ = c.Valkey.Del(ctx, c.prefix+"neg:"+strings.ToLower(strings.TrimSpace(hit.Email))).Err()
	}
	return nil
}

// PutMiss records a negative cache entry in Valkey only.
func (c *Cache) PutMiss(ctx context.Context, email string) error {
	if c == nil || c.Valkey == nil {
		return nil
	}
	email = strings.ToLower(strings.TrimSpace(email))
	return c.Valkey.Set(ctx, c.prefix+"neg:"+email, "1", c.NegTTL).Err()
}

// MarshalNeg is exported for tests / debugging.
func (c *Cache) MarshalNeg(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	out, _ := json.Marshal(map[string]any{"len": len(b)})
	return string(out)
}
