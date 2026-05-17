// Package db wires CockroachDB/Postgres (pgx pool, SQL migrations) and Valkey (Redis protocol)
// for sessions, rate limits, and uptime snapshots.
//
// Durable site data (users, posts, keys, mail) lives in SQL. Valkey holds ephemeral TTL-backed state.

package db
