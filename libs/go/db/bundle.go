package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Bundle holds shared database clients. Call Health and Close from process lifecycle hooks.
type Bundle struct {
	pool  *pgxpool.Pool
	redis *redis.Client
	cfg   Config
}

// Open connects to configured backends. Components with empty config are left nil.
func Open(cfg Config) (*Bundle, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	b := &Bundle{cfg: cfg}

	if cfg.CockroachDSN != "" {
		pctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		pool, err := pgxpool.New(pctx, cfg.CockroachDSN)
		if err != nil {
			return nil, fmt.Errorf("db cockroach connect: %w", err)
		}
		b.pool = pool
	}

	if cfg.ValkeyAddr != "" {
		b.redis = redis.NewClient(&redis.Options{
			Addr:         cfg.ValkeyAddr,
			Password:     cfg.ValkeyPassword,
			DB:           cfg.ValkeyDB,
			DialTimeout:  5 * time.Second,
			ReadTimeout:  defaultOpTimeout,
			WriteTimeout: defaultOpTimeout,
		})
	}

	return b, nil
}

// Pool returns the Cockroach/Postgres connection pool, or nil if not configured.
func (b *Bundle) Pool() *pgxpool.Pool {
	if b == nil {
		return nil
	}
	return b.pool
}

// Valkey returns the Redis-protocol client (Valkey-compatible), or nil if not configured.
func (b *Bundle) Valkey() *redis.Client {
	if b == nil {
		return nil
	}
	return b.redis
}

// Health pings each configured backend. Fails fast on the first error.
func (b *Bundle) Health(ctx context.Context) error {
	if b == nil {
		return errors.New("db: nil bundle")
	}
	if b.pool != nil {
		pctx, cancel := context.WithTimeout(ctx, defaultOpTimeout)
		defer cancel()
		var one int
		if err := b.pool.QueryRow(pctx, "SELECT 1").Scan(&one); err != nil {
			return fmt.Errorf("cockroach: %w", err)
		}
	}
	if b.redis != nil {
		pctx, cancel := context.WithTimeout(ctx, defaultOpTimeout)
		defer cancel()
		if err := b.redis.Ping(pctx).Err(); err != nil {
			return fmt.Errorf("valkey ping: %w", err)
		}
	}
	return nil
}

// Close releases resources for all configured clients.
func (b *Bundle) Close(ctx context.Context) error {
	if b == nil {
		return nil
	}
	var errs []error
	if b.pool != nil {
		b.pool.Close()
		b.pool = nil
	}
	if b.redis != nil {
		if err := b.redis.Close(); err != nil {
			errs = append(errs, fmt.Errorf("valkey close: %w", err))
		}
		b.redis = nil
	}
	_ = ctx
	return errors.Join(errs...)
}
