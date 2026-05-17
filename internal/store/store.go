// Package store provides SQL persistence for the live Elvish server (CockroachDB / Postgres).
package store

import (
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store wraps a pgx pool for Elvish tables.
type Store struct {
	pool *pgxpool.Pool
}

// New returns a Store backed by pool (must be non-nil).
func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}
