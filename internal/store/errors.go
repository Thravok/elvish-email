package store

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("store: not found")

// IsDuplicateKey reports whether err is a unique violation (Postgres 23505 / Cockroach).
func IsDuplicateKey(err error) bool {
	if err == nil {
		return false
	}
	var e *pgconn.PgError
	if errors.As(err, &e) && e.Code == "23505" {
		return true
	}
	return false
}
