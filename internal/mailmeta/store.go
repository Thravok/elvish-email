package mailmeta

import (
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound indicates a missing row.
var ErrNotFound = errors.New("mailmeta: not found")

// Store wraps the Cockroach connection pool.
type Store struct {
	pool *pgxpool.Pool
}

// New constructs a Store. pool must not be nil.
func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Pool exposes the underlying pool for tests and shared transactions.
func (s *Store) Pool() *pgxpool.Pool {
	if s == nil {
		return nil
	}
	return s.pool
}
