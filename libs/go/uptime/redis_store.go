package uptime

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const statsKeyPrefix = "elvish:uptime:stat:v1:"

// RedisStore reads and writes uptime snapshots in Valkey.
type RedisStore struct {
	r *redis.Client
}

// NewRedisStore returns a store backed by Valkey, or nil if r is nil.
func NewRedisStore(r *redis.Client) *RedisStore {
	if r == nil {
		return nil
	}
	return &RedisStore{r: r}
}

// GetSnapshot returns the latest snapshot, or nil if missing.
func (s *RedisStore) GetSnapshot(ctx context.Context) (*Snapshot, []byte, error) {
	if s == nil || s.r == nil {
		return nil, nil, fmt.Errorf("uptime: no valkey client")
	}
	pctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	b, err := s.r.Get(pctx, SnapshotKey).Bytes()
	if err == redis.Nil {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}
	snap, err := UnmarshalSnapshot(b)
	if err != nil {
		return nil, b, err
	}
	return snap, b, nil
}

// PushSnapshot updates per-target ok/fail hashes, writes SnapshotKey, and returns the snapshot.
func (s *RedisStore) PushSnapshot(ctx context.Context, results []ProbeResult) (*Snapshot, error) {
	if s == nil || s.r == nil {
		return nil, fmt.Errorf("uptime: no valkey client")
	}
	pctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	pipe := s.r.Pipeline()
	for i := range results {
		r := &results[i]
		field := "fail"
		if r.OK {
			field = "ok"
		}
		pipe.HIncrBy(pctx, statsKeyPrefix+r.ID, field, 1)
	}
	if _, err := pipe.Exec(pctx); err != nil {
		return nil, err
	}

	seen := make(map[string]struct{}, len(results))
	var ids []string
	for i := range results {
		id := results[i].ID
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}

	stats := make(map[string]StatsRollup, len(ids))
	for _, id := range ids {
		m, err := s.r.HGetAll(pctx, statsKeyPrefix+id).Result()
		if err != nil {
			return nil, err
		}
		var okN, failN int64
		if v, ok := m["ok"]; ok {
			n, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("uptime: parse ok counter for %q: %w", id, err)
			}
			okN = n
		}
		if v, ok := m["fail"]; ok {
			n, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("uptime: parse fail counter for %q: %w", id, err)
			}
			failN = n
		}
		total := okN + failN
		pct := 0.0
		if total > 0 {
			pct = float64(okN) * 100.0 / float64(total)
		}
		stats[id] = StatsRollup{OK: okN, Fail: failN, UptimePct: pct}
	}

	snap := &Snapshot{
		CheckedAt: RFC3339Time{Time: time.Now().UTC()},
		Targets:   results,
		Stats:     stats,
	}
	raw, err := MarshalSnapshot(snap)
	if err != nil {
		return nil, err
	}
	if err := s.r.Set(pctx, SnapshotKey, raw, 0).Err(); err != nil {
		return nil, err
	}
	return snap, nil
}

// SaveSnapshotJSON writes a full snapshot JSON to Valkey without incrementing counters.
func (s *RedisStore) SaveSnapshotJSON(ctx context.Context, snap *Snapshot) error {
	if s == nil || s.r == nil {
		return fmt.Errorf("uptime: no valkey client")
	}
	if snap == nil {
		return fmt.Errorf("uptime: nil snapshot")
	}
	pctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	raw, err := MarshalSnapshot(snap)
	if err != nil {
		return err
	}
	return s.r.Set(pctx, SnapshotKey, raw, 0).Err()
}
