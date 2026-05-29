package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"elvish/libs/go/models"
	"elvish/libs/go/uptime"
)

func aggKey(id string) string {
	s := strings.TrimSpace(id)
	s = strings.ReplaceAll(s, ".", "_")
	s = strings.ReplaceAll(s, "$", "_")
	if s == "" {
		return "unknown"
	}
	return s
}

// GetUptimeSettings returns persisted settings or defaults when missing / error.
func (s *Store) GetUptimeSettings(ctx context.Context) (*models.UptimeSettingsDoc, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, enabled, interval, base_url, include_tools_from_home, endpoints FROM uptime_settings WHERE id = $1`
	var doc models.UptimeSettingsDoc
	var endpoints []byte
	err := s.pool.QueryRow(ctx, q, models.UptimeSettingsID).Scan(
		&doc.ID, &doc.Enabled, &doc.Interval, &doc.BaseURL, &doc.IncludeToolsFromHome, &endpoints,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.DefaultUptimeSettings(), nil
	}
	if err != nil {
		return models.DefaultUptimeSettings(), nil
	}
	if len(endpoints) > 0 && string(endpoints) != "null" {
		_ = json.Unmarshal(endpoints, &doc.Endpoints)
	}
	return &doc, nil
}

// SetUptimeSettings replaces the uptime configuration document.
func (s *Store) SetUptimeSettings(ctx context.Context, doc *models.UptimeSettingsDoc) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if doc == nil {
		return errors.New("store: nil uptime settings")
	}
	doc.ID = models.UptimeSettingsID
	b, err := json.Marshal(doc.Endpoints)
	if err != nil {
		return err
	}
	const q = `INSERT INTO uptime_settings (id, enabled, interval, base_url, include_tools_from_home, endpoints)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb)
		ON CONFLICT (id) DO UPDATE SET
			enabled = EXCLUDED.enabled,
			interval = EXCLUDED.interval,
			base_url = EXCLUDED.base_url,
			include_tools_from_home = EXCLUDED.include_tools_from_home,
			endpoints = EXCLUDED.endpoints`
	_, err = s.pool.Exec(ctx, q, doc.ID, doc.Enabled, doc.Interval, doc.BaseURL, doc.IncludeToolsFromHome, b)
	return err
}

// InsertUptimeRun appends one probe cycle to the log.
func (s *Store) InsertUptimeRun(ctx context.Context, at time.Time, results []uptime.ProbeResult) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	pts := make([]models.UptimeProbePoint, 0, len(results))
	for _, r := range results {
		pts = append(pts, models.UptimeProbePoint{
			ID: r.ID, URL: r.URL, Method: r.Method, OK: r.OK,
			StatusCode: r.StatusCode, LatencyMS: r.LatencyMS, Error: r.Error,
		})
	}
	b, err := json.Marshal(pts)
	if err != nil {
		return err
	}
	const q = `INSERT INTO uptime_runs (at, results) VALUES ($1, $2::jsonb)`
	_, err = s.pool.Exec(ctx, q, at, b)
	return err
}

// ListUptimeRuns returns recent probe cycles newest first.
func (s *Store) ListUptimeRuns(ctx context.Context, limit int64) ([]models.UptimeRunDoc, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	const q = `SELECT id, at, results FROM uptime_runs ORDER BY at DESC LIMIT $1`
	rows, err := s.pool.Query(ctx, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.UptimeRunDoc
	for rows.Next() {
		var d models.UptimeRunDoc
		var raw []byte
		if err := rows.Scan(&d.ID, &d.At, &raw); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &d.Results); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func uptimeAggDocForMonth(ym string, at time.Time, results []uptime.ProbeResult) *models.UptimeAggDoc {
	targets := make(map[string]models.UptimeAggPerTarget, len(results))
	for _, r := range results {
		k := aggKey(r.ID)
		pt := models.UptimeAggPerTarget{ID: r.ID}
		if r.OK {
			pt.OK = 1
		} else {
			pt.Fail = 1
		}
		targets[k] = pt
	}
	return &models.UptimeAggDoc{
		ID:        models.UptimeAggID,
		PeriodYM:  ym,
		StartedAt: at,
		UpdatedAt: at,
		Targets:   targets,
	}
}

// IncUptimeAggregate increments ok/fail counters per target for the UTC calendar month of at.
func (s *Store) IncUptimeAggregate(ctx context.Context, at time.Time, results []uptime.ProbeResult) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if len(results) == 0 {
		return nil
	}
	ym := at.UTC().Format("2006-01")

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var raw []byte
	var period string
	err = tx.QueryRow(ctx,
		`SELECT period_ym, targets FROM uptime_agg WHERE id = $1 FOR UPDATE`,
		models.UptimeAggID,
	).Scan(&period, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		doc := uptimeAggDocForMonth(ym, at, results)
		b, err := json.Marshal(doc.Targets)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO uptime_agg (id, period_ym, started_at, updated_at, targets) VALUES ($1,$2,$3,$4,$5::jsonb)`,
			doc.ID, doc.PeriodYM, doc.StartedAt, doc.UpdatedAt, b,
		)
		if err != nil {
			return err
		}
		return tx.Commit(ctx)
	}
	if err != nil {
		return err
	}

	targets := make(map[string]models.UptimeAggPerTarget)
	if len(raw) > 0 && string(raw) != "null" {
		if err := json.Unmarshal(raw, &targets); err != nil {
			return err
		}
	}
	if strings.TrimSpace(period) != ym {
		targets = make(map[string]models.UptimeAggPerTarget)
	}
	for _, r := range results {
		k := aggKey(r.ID)
		cur := targets[k]
		cur.ID = r.ID
		if r.OK {
			cur.OK++
		} else {
			cur.Fail++
		}
		targets[k] = cur
	}
	b, err := json.Marshal(targets)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx,
		`UPDATE uptime_agg SET period_ym = $2, updated_at = $3, targets = $4::jsonb WHERE id = $1`,
		models.UptimeAggID, ym, at, b,
	)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// GetUptimeAggDoc returns the aggregate document for the current stored month, or nil if none yet.
func (s *Store) GetUptimeAggDoc(ctx context.Context) (*models.UptimeAggDoc, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, period_ym, started_at, updated_at, targets FROM uptime_agg WHERE id = $1`
	var doc models.UptimeAggDoc
	var raw []byte
	err := s.pool.QueryRow(ctx, q, models.UptimeAggID).Scan(&doc.ID, &doc.PeriodYM, &doc.StartedAt, &doc.UpdatedAt, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(raw) > 0 && string(raw) != "null" {
		if err := json.Unmarshal(raw, &doc.Targets); err != nil {
			return nil, err
		}
	}
	return &doc, nil
}

// GetUptimeStatsRollup returns per-target and overall uptime for the stored aggregate month (period_ym, UTC).
func (s *Store) GetUptimeStatsRollup(ctx context.Context) (map[string]uptime.StatsRollup, float64, string, error) {
	if s == nil || s.pool == nil {
		return nil, 0, "", errors.New("store: nil")
	}
	doc, err := s.GetUptimeAggDoc(ctx)
	if err != nil {
		return nil, 0, "", err
	}
	if doc == nil {
		return map[string]uptime.StatsRollup{}, 0, "", nil
	}
	period := strings.TrimSpace(doc.PeriodYM)
	out := make(map[string]uptime.StatsRollup, len(doc.Targets))
	var totOK, totFail int64
	for _, t := range doc.Targets {
		idKey := strings.TrimSpace(t.ID)
		if idKey == "" {
			continue
		}
		n := t.OK + t.Fail
		pct := 0.0
		if n > 0 {
			pct = float64(t.OK) * 100.0 / float64(n)
		}
		out[idKey] = uptime.StatsRollup{OK: t.OK, Fail: t.Fail, UptimePct: pct}
		totOK += t.OK
		totFail += t.Fail
	}
	overall := 0.0
	if tot := totOK + totFail; tot > 0 {
		overall = float64(totOK) * 100.0 / float64(tot)
	}
	return out, overall, period, nil
}

// ClearUptimeRuns deletes all stored probe cycles from uptime_runs.
func (s *Store) ClearUptimeRuns(ctx context.Context) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM uptime_runs`)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// EnsureUptimeIndexes is a no-op for SQL (indexes created by migrations). Kept for API compatibility.
func (s *Store) EnsureUptimeIndexes(ctx context.Context) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	_ = ctx
	return nil
}
