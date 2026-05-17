package telemetry

import (
	"context"
	"sort"
	"time"

	"elvish/internal/models"
)

var performanceMetrics = map[string]struct{}{
	MetricHTTPRequest:  {},
	MetricMailIngest:   {},
	MetricMailDelivery: {},
	MetricSMTPEvent:    {},
	MetricJobRun:       {},
	MetricFrontendPerf: {},
	MetricDependency:   {},
	MetricQueueHealth:  {},
}

// PerformanceSnapshot returns a bounded performance-focused snapshot for the admin dashboard.
func (s *Service) PerformanceSnapshot(ctx context.Context, days, recentHours, recentLimit, latencyLimit int) (*models.PerformanceSnapshotDoc, error) {
	st, err := s.loadSettings(ctx, false)
	if err != nil {
		return nil, err
	}
	if s.store == nil {
		return &models.PerformanceSnapshotDoc{
			Settings:       st,
			Summary:        []models.TelemetrySummaryRow{},
			Recent:         []models.TelemetryRollupRow{},
			LatencySummary: []models.TelemetryLatencyBucketSummaryRow{},
			LatencyRecent:  []models.TelemetryLatencyBucketRow{},
			Hotspots:       []models.PerformanceHotspot{},
		}, nil
	}
	if err := s.Prune(ctx); err != nil {
		return nil, err
	}
	days = normalizeExportDays(days, st.RetentionDays)
	if recentHours <= 0 {
		recentHours = minInt(defaultRecentHours, days*24)
	}
	if recentLimit <= 0 {
		recentLimit = 1000
	}
	if latencyLimit <= 0 {
		latencyLimit = 2000
	}
	now := time.Now().UTC()
	since := now.Add(-time.Duration(days) * 24 * time.Hour)
	recentSince := now.Add(-time.Duration(recentHours) * time.Hour)

	summary, err := s.store.SummarizeTelemetryRollups(ctx, since)
	if err != nil {
		return nil, err
	}
	recent, err := s.store.ListTelemetryRollups(ctx, recentSince, recentLimit)
	if err != nil {
		return nil, err
	}
	latencySummary, err := s.store.SummarizeTelemetryLatencyBuckets(ctx, since)
	if err != nil {
		return nil, err
	}
	latencyRecent, err := s.store.ListTelemetryLatencyBuckets(ctx, recentSince, latencyLimit)
	if err != nil {
		return nil, err
	}

	summary = filterPerformanceSummaryRows(summary)
	recent = filterPerformanceRollupRows(recent)
	latencySummary = filterPerformanceLatencySummaryRows(latencySummary)
	latencyRecent = filterPerformanceLatencyRows(latencyRecent)

	return &models.PerformanceSnapshotDoc{
		Settings:       st,
		Overview:       BuildPerformanceOverview(summary, latencySummary),
		Hotspots:       BuildPerformanceHotspots(summary),
		Summary:        summary,
		Recent:         recent,
		LatencySummary: latencySummary,
		LatencyRecent:  latencyRecent,
	}, nil
}

// BuildPerformanceOverview derives high-level KPI totals from bounded telemetry aggregates.
func BuildPerformanceOverview(summary []models.TelemetrySummaryRow, latencySummary []models.TelemetryLatencyBucketSummaryRow) models.PerformanceOverview {
	var out models.PerformanceOverview
	var durationCount int64
	var durationSum int64
	for _, row := range summary {
		if row.MetricName == MetricQueueHealth {
			continue
		}
		out.TotalCount += row.Count
		if isFailureResult(row.Result) {
			out.FailureCount += row.Count
		}
		if row.Transport == "browser" {
			out.BrowserCount += row.Count
		} else {
			out.BackendCount += row.Count
		}
		durationCount += row.Count
		durationSum += row.SumMS
		if row.MaxMS > out.MaxMS {
			out.MaxMS = row.MaxMS
		}
	}
	if durationCount > 0 {
		out.AvgMS = float64(durationSum) / float64(durationCount)
	}
	for _, row := range latencySummary {
		if isSlowLatencyBucket(row.LatencyBucket) {
			out.SlowBucketCount += row.Count
		}
	}
	return out
}

// BuildPerformanceHotspots derives the slowest/error-prone bounded surfaces.
func BuildPerformanceHotspots(summary []models.TelemetrySummaryRow) []models.PerformanceHotspot {
	type hotspotKey struct {
		metricName  string
		featureArea string
		statusClass string
		transport   string
	}
	agg := make(map[hotspotKey]*models.PerformanceHotspot)
	for _, row := range summary {
		if row.MetricName == MetricQueueHealth {
			continue
		}
		key := hotspotKey{
			metricName:  row.MetricName,
			featureArea: row.FeatureArea,
			statusClass: row.StatusClass,
			transport:   row.Transport,
		}
		item := agg[key]
		if item == nil {
			item = &models.PerformanceHotspot{
				MetricName:  row.MetricName,
				FeatureArea: row.FeatureArea,
				StatusClass: row.StatusClass,
				Transport:   row.Transport,
			}
			agg[key] = item
		}
		item.Count += row.Count
		if isFailureResult(row.Result) {
			item.FailureCount += row.Count
		} else if row.Result == "success" {
			item.SuccessCount += row.Count
		}
		item.AvgMS += float64(row.SumMS)
		if row.MaxMS > item.MaxMS {
			item.MaxMS = row.MaxMS
		}
	}
	out := make([]models.PerformanceHotspot, 0, len(agg))
	for _, item := range agg {
		if item.Count > 0 {
			item.AvgMS = item.AvgMS / float64(item.Count)
			item.FailureRate = float64(item.FailureCount) / float64(item.Count)
		}
		out = append(out, *item)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].FailureRate != out[j].FailureRate {
			return out[i].FailureRate > out[j].FailureRate
		}
		if out[i].AvgMS != out[j].AvgMS {
			return out[i].AvgMS > out[j].AvgMS
		}
		if out[i].MaxMS != out[j].MaxMS {
			return out[i].MaxMS > out[j].MaxMS
		}
		return out[i].Count > out[j].Count
	})
	if len(out) > 16 {
		out = out[:16]
	}
	return out
}

func filterPerformanceSummaryRows(in []models.TelemetrySummaryRow) []models.TelemetrySummaryRow {
	out := make([]models.TelemetrySummaryRow, 0, len(in))
	for _, row := range in {
		if isPerformanceMetric(row.MetricName) {
			out = append(out, row)
		}
	}
	return out
}

func filterPerformanceRollupRows(in []models.TelemetryRollupRow) []models.TelemetryRollupRow {
	out := make([]models.TelemetryRollupRow, 0, len(in))
	for _, row := range in {
		if isPerformanceMetric(row.MetricName) {
			out = append(out, row)
		}
	}
	return out
}

func filterPerformanceLatencySummaryRows(in []models.TelemetryLatencyBucketSummaryRow) []models.TelemetryLatencyBucketSummaryRow {
	out := make([]models.TelemetryLatencyBucketSummaryRow, 0, len(in))
	for _, row := range in {
		if isPerformanceMetric(row.MetricName) {
			out = append(out, row)
		}
	}
	return out
}

func filterPerformanceLatencyRows(in []models.TelemetryLatencyBucketRow) []models.TelemetryLatencyBucketRow {
	out := make([]models.TelemetryLatencyBucketRow, 0, len(in))
	for _, row := range in {
		if isPerformanceMetric(row.MetricName) {
			out = append(out, row)
		}
	}
	return out
}

func isPerformanceMetric(metric string) bool {
	_, ok := performanceMetrics[metric]
	return ok
}

func isFailureResult(result string) bool {
	switch result {
	case "", "success", "observed":
		return false
	default:
		return true
	}
}

func isSlowLatencyBucket(name string) bool {
	switch name {
	case "ms_2000_4999", "ms_5000_9999", "ms_10000_plus":
		return true
	default:
		return false
	}
}

func latencyBucketName(ms int64) string {
	switch {
	case ms < 50:
		return "lt_50ms"
	case ms < 100:
		return "ms_50_99"
	case ms < 250:
		return "ms_100_249"
	case ms < 500:
		return "ms_250_499"
	case ms < 1000:
		return "ms_500_999"
	case ms < 2000:
		return "ms_1000_1999"
	case ms < 5000:
		return "ms_2000_4999"
	case ms < 10000:
		return "ms_5000_9999"
	default:
		return "ms_10000_plus"
	}
}
