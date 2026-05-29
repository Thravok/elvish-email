package telemetry

import (
	"context"
	"errors"
	"testing"
	"time"

	"elvish/libs/go/models"
)

type fakeStore struct {
	settings    *models.TelemetrySettingsDoc
	rows        []models.TelemetryRollupRow
	latencyRows []models.TelemetryLatencyBucketRow
}

func (f *fakeStore) GetTelemetrySettings(ctx context.Context) (*models.TelemetrySettingsDoc, error) {
	_ = ctx
	if f.settings == nil {
		return models.DefaultTelemetrySettings(), nil
	}
	cp := *f.settings
	return &cp, nil
}

func (f *fakeStore) SetTelemetrySettings(ctx context.Context, doc *models.TelemetrySettingsDoc) error {
	_ = ctx
	cp := *doc
	f.settings = &cp
	return nil
}

func (f *fakeStore) RecordTelemetryRollup(ctx context.Context, row models.TelemetryRollupRow) error {
	_ = ctx
	f.rows = append(f.rows, row)
	return nil
}

func (f *fakeStore) RecordTelemetryLatencyBucket(ctx context.Context, row models.TelemetryLatencyBucketRow) error {
	_ = ctx
	f.latencyRows = append(f.latencyRows, row)
	return nil
}

func (f *fakeStore) ListTelemetryRollups(ctx context.Context, since time.Time, limit int) ([]models.TelemetryRollupRow, error) {
	_, _, _ = ctx, since, limit
	return append([]models.TelemetryRollupRow(nil), f.rows...), nil
}

func (f *fakeStore) SummarizeTelemetryRollups(ctx context.Context, since time.Time) ([]models.TelemetrySummaryRow, error) {
	_, _ = ctx, since
	return []models.TelemetrySummaryRow{}, nil
}

func (f *fakeStore) ListTelemetryLatencyBuckets(ctx context.Context, since time.Time, limit int) ([]models.TelemetryLatencyBucketRow, error) {
	_, _, _ = ctx, since, limit
	return append([]models.TelemetryLatencyBucketRow(nil), f.latencyRows...), nil
}

func (f *fakeStore) SummarizeTelemetryLatencyBuckets(ctx context.Context, since time.Time) ([]models.TelemetryLatencyBucketSummaryRow, error) {
	_, _ = ctx, since
	return []models.TelemetryLatencyBucketSummaryRow{}, nil
}

func (f *fakeStore) DeleteTelemetryRollupsBefore(ctx context.Context, before time.Time) (int64, error) {
	_, _ = ctx, before
	return 0, nil
}

func (f *fakeStore) DeleteTelemetryLatencyBucketsBefore(ctx context.Context, before time.Time) (int64, error) {
	_, _ = ctx, before
	return 0, nil
}

func TestRecordHTTP_RedactsRouteIntoAllowlistedGroup(t *testing.T) {
	t.Parallel()

	fs := &fakeStore{
		settings: &models.TelemetrySettingsDoc{
			ID:            models.TelemetrySettingsID,
			Enabled:       true,
			RetentionDays: 30,
			ExportEnabled: true,
		},
	}
	svc := New(fs)
	if err := svc.RecordHTTP(context.Background(), "/api/v1/mail/messages/12345/thread/abc", 201, 175*time.Millisecond); err != nil {
		t.Fatalf("RecordHTTP: %v", err)
	}
	if len(fs.rows) != 1 {
		t.Fatalf("want 1 row, got %d", len(fs.rows))
	}
	if len(fs.latencyRows) != 1 {
		t.Fatalf("want 1 latency row, got %d", len(fs.latencyRows))
	}
	row := fs.rows[0]
	if row.FeatureArea != "mail_api" {
		t.Fatalf("feature area = %q, want mail_api", row.FeatureArea)
	}
	if row.StatusClass != "2xx" {
		t.Fatalf("status class = %q, want 2xx", row.StatusClass)
	}
	if row.Transport != "http" {
		t.Fatalf("transport = %q, want http", row.Transport)
	}
	if fs.latencyRows[0].LatencyBucket == "" {
		t.Fatal("expected latency bucket to be recorded")
	}
}

func TestRecord_RejectsNonAllowlistedDimension(t *testing.T) {
	t.Parallel()

	fs := &fakeStore{
		settings: &models.TelemetrySettingsDoc{
			ID:            models.TelemetrySettingsID,
			Enabled:       true,
			RetentionDays: 30,
			ExportEnabled: true,
		},
	}
	svc := New(fs)
	err := svc.Record(context.Background(), Event{
		MetricName:  MetricSMTPEvent,
		FeatureArea: "alice@example.com",
		Result:      "success",
		StatusClass: "none",
		Transport:   "smtp",
		Duration:    10 * time.Millisecond,
	})
	if !errors.Is(err, ErrInvalidEvent) {
		t.Fatalf("want ErrInvalidEvent, got %v", err)
	}
	if len(fs.rows) != 0 {
		t.Fatalf("want no persisted rows, got %d", len(fs.rows))
	}
	if len(fs.latencyRows) != 0 {
		t.Fatalf("want no persisted latency rows, got %d", len(fs.latencyRows))
	}
}

func TestValidateAndBuildRow_TruncatesToHourlyBucket(t *testing.T) {
	t.Parallel()

	at := time.Date(2026, 5, 11, 15, 42, 23, 0, time.UTC)
	row, err := validateAndBuildRow(Event{
		MetricName:  MetricJobRun,
		FeatureArea: "uptime",
		Result:      "success",
		StatusClass: "none",
		Transport:   "background",
		Duration:    1500 * time.Millisecond,
		At:          at,
	})
	if err != nil {
		t.Fatalf("validateAndBuildRow: %v", err)
	}
	want := time.Date(2026, 5, 11, 15, 0, 0, 0, time.UTC)
	if !row.BucketStart.Equal(want) {
		t.Fatalf("bucket start = %s, want %s", row.BucketStart, want)
	}
	if row.SumMS != 1500 || row.MinMS != 1500 || row.MaxMS != 1500 {
		t.Fatalf("unexpected duration aggregation: %+v", row)
	}
}

func TestRecordMailIngest_MapsInternalSource(t *testing.T) {
	t.Parallel()

	fs := &fakeStore{
		settings: &models.TelemetrySettingsDoc{
			ID:            models.TelemetrySettingsID,
			Enabled:       true,
			RetentionDays: 30,
			ExportEnabled: true,
		},
	}
	svc := New(fs)
	if err := svc.RecordMailIngest(context.Background(), "internal", nil, 25*time.Millisecond); err != nil {
		t.Fatalf("RecordMailIngest: %v", err)
	}
	if len(fs.rows) != 1 {
		t.Fatalf("want 1 row, got %d", len(fs.rows))
	}
	if got := fs.rows[0].FeatureArea; got != "internal" {
		t.Fatalf("feature area = %q, want internal", got)
	}
}

func TestBuildPerformanceHotspots_CombinesSuccessAndFailure(t *testing.T) {
	t.Parallel()

	rows := []models.TelemetrySummaryRow{
		{MetricName: MetricFrontendPerf, FeatureArea: "mail_ui", StatusClass: "search_query", Transport: "browser", Result: "success", Count: 9, SumMS: 900, MaxMS: 200},
		{MetricName: MetricFrontendPerf, FeatureArea: "mail_ui", StatusClass: "search_query", Transport: "browser", Result: "failure", Count: 3, SumMS: 900, MaxMS: 700},
	}
	hotspots := BuildPerformanceHotspots(rows)
	if len(hotspots) != 1 {
		t.Fatalf("want 1 hotspot, got %d", len(hotspots))
	}
	if hotspots[0].Count != 12 {
		t.Fatalf("count = %d, want 12", hotspots[0].Count)
	}
	if hotspots[0].FailureCount != 3 {
		t.Fatalf("failure_count = %d, want 3", hotspots[0].FailureCount)
	}
	if hotspots[0].FailureRate <= 0 {
		t.Fatalf("failure_rate = %f, want > 0", hotspots[0].FailureRate)
	}
}
