package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"elvish/libs/go/models"
)

// GetTelemetrySettings returns persisted telemetry settings or defaults when missing.
func (s *Store) GetTelemetrySettings(ctx context.Context) (*models.TelemetrySettingsDoc, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, enabled, retention_days, export_enabled, updated_at FROM telemetry_settings WHERE id = $1`
	var doc models.TelemetrySettingsDoc
	err := s.pool.QueryRow(ctx, q, models.TelemetrySettingsID).Scan(
		&doc.ID, &doc.Enabled, &doc.RetentionDays, &doc.ExportEnabled, &doc.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.DefaultTelemetrySettings(), nil
	}
	if err != nil {
		return models.DefaultTelemetrySettings(), nil
	}
	if doc.RetentionDays <= 0 {
		doc.RetentionDays = models.DefaultTelemetryRetentionDays
	}
	return &doc, nil
}

// SetTelemetrySettings replaces the singleton anonymous telemetry configuration.
func (s *Store) SetTelemetrySettings(ctx context.Context, doc *models.TelemetrySettingsDoc) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if doc == nil {
		return errors.New("store: nil telemetry settings")
	}
	doc.ID = models.TelemetrySettingsID
	if doc.RetentionDays <= 0 {
		doc.RetentionDays = models.DefaultTelemetryRetentionDays
	}
	const q = `INSERT INTO telemetry_settings (id, enabled, retention_days, export_enabled, updated_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (id) DO UPDATE SET
			enabled = EXCLUDED.enabled,
			retention_days = EXCLUDED.retention_days,
			export_enabled = EXCLUDED.export_enabled,
			updated_at = now()`
	_, err := s.pool.Exec(ctx, q, doc.ID, doc.Enabled, doc.RetentionDays, doc.ExportEnabled)
	return err
}

// RecordTelemetryRollup increments one anonymous telemetry bucket.
func (s *Store) RecordTelemetryRollup(ctx context.Context, row models.TelemetryRollupRow) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if row.Count <= 0 {
		row.Count = 1
	}
	const q = `INSERT INTO telemetry_rollups_hourly
		(bucket_start, metric_name, feature_area, result, status_class, transport, count, sum_ms, min_ms, max_ms, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
		ON CONFLICT (bucket_start, metric_name, feature_area, result, status_class, transport)
		DO UPDATE SET
			count = telemetry_rollups_hourly.count + EXCLUDED.count,
			sum_ms = telemetry_rollups_hourly.sum_ms + EXCLUDED.sum_ms,
			min_ms = CASE
				WHEN telemetry_rollups_hourly.count <= 0 THEN EXCLUDED.min_ms
				ELSE LEAST(telemetry_rollups_hourly.min_ms, EXCLUDED.min_ms)
			END,
			max_ms = GREATEST(telemetry_rollups_hourly.max_ms, EXCLUDED.max_ms),
			updated_at = now()`
	_, err := s.pool.Exec(ctx, q,
		row.BucketStart.UTC(), row.MetricName, row.FeatureArea, row.Result, row.StatusClass, row.Transport,
		row.Count, row.SumMS, row.MinMS, row.MaxMS,
	)
	return err
}

// ListTelemetryRollups returns recent hourly telemetry rows newest first.
func (s *Store) ListTelemetryRollups(ctx context.Context, since time.Time, limit int) ([]models.TelemetryRollupRow, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	const q = `SELECT bucket_start, metric_name, feature_area, result, status_class, transport, count, sum_ms, min_ms, max_ms, updated_at
		FROM telemetry_rollups_hourly
		WHERE bucket_start >= $1
		ORDER BY bucket_start DESC, metric_name, feature_area, result, status_class, transport
		LIMIT $2`
	rows, err := s.pool.Query(ctx, q, since.UTC(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.TelemetryRollupRow
	for rows.Next() {
		var row models.TelemetryRollupRow
		if err := rows.Scan(
			&row.BucketStart, &row.MetricName, &row.FeatureArea, &row.Result, &row.StatusClass, &row.Transport,
			&row.Count, &row.SumMS, &row.MinMS, &row.MaxMS, &row.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// SummarizeTelemetryRollups returns grouped aggregates across a bounded time window.
func (s *Store) SummarizeTelemetryRollups(ctx context.Context, since time.Time) ([]models.TelemetrySummaryRow, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT metric_name, feature_area, result, status_class, transport,
			SUM(count) AS count_total,
			SUM(sum_ms) AS sum_ms_total,
			MIN(min_ms) AS min_ms_total,
			MAX(max_ms) AS max_ms_total
		FROM telemetry_rollups_hourly
		WHERE bucket_start >= $1
		GROUP BY metric_name, feature_area, result, status_class, transport
		ORDER BY count_total DESC, metric_name, feature_area, result`
	rows, err := s.pool.Query(ctx, q, since.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.TelemetrySummaryRow
	for rows.Next() {
		var row models.TelemetrySummaryRow
		if err := rows.Scan(
			&row.MetricName, &row.FeatureArea, &row.Result, &row.StatusClass, &row.Transport,
			&row.Count, &row.SumMS, &row.MinMS, &row.MaxMS,
		); err != nil {
			return nil, err
		}
		if row.Count > 0 {
			row.AvgMS = float64(row.SumMS) / float64(row.Count)
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// DeleteTelemetryRollupsBefore prunes old hourly aggregates according to retention.
func (s *Store) DeleteTelemetryRollupsBefore(ctx context.Context, before time.Time) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM telemetry_rollups_hourly WHERE bucket_start < $1`, before.UTC())
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// RecordTelemetryLatencyBucket increments one anonymous hourly latency bucket.
func (s *Store) RecordTelemetryLatencyBucket(ctx context.Context, row models.TelemetryLatencyBucketRow) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if row.Count <= 0 {
		row.Count = 1
	}
	const q = `INSERT INTO telemetry_latency_buckets_hourly
		(bucket_start, metric_name, feature_area, result, status_class, transport, latency_bucket, count, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
		ON CONFLICT (bucket_start, metric_name, feature_area, result, status_class, transport, latency_bucket)
		DO UPDATE SET
			count = telemetry_latency_buckets_hourly.count + EXCLUDED.count,
			updated_at = now()`
	_, err := s.pool.Exec(ctx, q,
		row.BucketStart.UTC(), row.MetricName, row.FeatureArea, row.Result, row.StatusClass, row.Transport, row.LatencyBucket, row.Count,
	)
	return err
}

// ListTelemetryLatencyBuckets returns recent hourly latency-bucket rows newest first.
func (s *Store) ListTelemetryLatencyBuckets(ctx context.Context, since time.Time, limit int) ([]models.TelemetryLatencyBucketRow, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	if limit <= 0 || limit > 5000 {
		limit = 500
	}
	const q = `SELECT bucket_start, metric_name, feature_area, result, status_class, transport, latency_bucket, count, updated_at
		FROM telemetry_latency_buckets_hourly
		WHERE bucket_start >= $1
		ORDER BY bucket_start DESC, metric_name, feature_area, result, status_class, transport, latency_bucket
		LIMIT $2`
	rows, err := s.pool.Query(ctx, q, since.UTC(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.TelemetryLatencyBucketRow
	for rows.Next() {
		var row models.TelemetryLatencyBucketRow
		if err := rows.Scan(
			&row.BucketStart, &row.MetricName, &row.FeatureArea, &row.Result, &row.StatusClass, &row.Transport, &row.LatencyBucket, &row.Count, &row.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// SummarizeTelemetryLatencyBuckets returns grouped latency-bucket aggregates across a bounded time window.
func (s *Store) SummarizeTelemetryLatencyBuckets(ctx context.Context, since time.Time) ([]models.TelemetryLatencyBucketSummaryRow, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT metric_name, feature_area, result, status_class, transport, latency_bucket, SUM(count) AS count_total
		FROM telemetry_latency_buckets_hourly
		WHERE bucket_start >= $1
		GROUP BY metric_name, feature_area, result, status_class, transport, latency_bucket
		ORDER BY count_total DESC, metric_name, feature_area, status_class, latency_bucket`
	rows, err := s.pool.Query(ctx, q, since.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.TelemetryLatencyBucketSummaryRow
	for rows.Next() {
		var row models.TelemetryLatencyBucketSummaryRow
		if err := rows.Scan(
			&row.MetricName, &row.FeatureArea, &row.Result, &row.StatusClass, &row.Transport, &row.LatencyBucket, &row.Count,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// DeleteTelemetryLatencyBucketsBefore prunes old hourly latency-bucket aggregates according to retention.
func (s *Store) DeleteTelemetryLatencyBucketsBefore(ctx context.Context, before time.Time) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("store: nil")
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM telemetry_latency_buckets_hourly WHERE bucket_start < $1`, before.UTC())
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
