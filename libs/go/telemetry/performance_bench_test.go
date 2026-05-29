package telemetry

import (
	"strconv"
	"testing"

	"elvish/libs/go/models"
)

func BenchmarkBuildPerformanceHotspots(b *testing.B) {
	rows := make([]models.TelemetrySummaryRow, 0, 512)
	for i := 0; i < 256; i++ {
		op := "search_query_" + strconv.Itoa(i%8)
		rows = append(rows,
			models.TelemetrySummaryRow{
				MetricName:  MetricFrontendPerf,
				FeatureArea: "mail_ui",
				Result:      "success",
				StatusClass: op,
				Transport:   "browser",
				Count:       12,
				SumMS:       2400,
				MaxMS:       380,
			},
			models.TelemetrySummaryRow{
				MetricName:  MetricFrontendPerf,
				FeatureArea: "mail_ui",
				Result:      "failure",
				StatusClass: op,
				Transport:   "browser",
				Count:       2,
				SumMS:       900,
				MaxMS:       900,
			},
		)
	}
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = BuildPerformanceHotspots(rows)
	}
}

func BenchmarkBuildPerformanceOverview(b *testing.B) {
	summary := []models.TelemetrySummaryRow{
		{MetricName: MetricFrontendPerf, FeatureArea: "admin_ui", Result: "success", StatusClass: "page_boot", Transport: "browser", Count: 120, SumMS: 48000, MaxMS: 1200},
		{MetricName: MetricDependency, FeatureArea: "mailworker", Result: "failure", StatusClass: "smtp_connect", Transport: "background", Count: 8, SumMS: 24000, MaxMS: 7000},
		{MetricName: MetricJobRun, FeatureArea: "mailworker", Result: "success", StatusClass: "none", Transport: "background", Count: 64, SumMS: 6400, MaxMS: 200},
	}
	latency := []models.TelemetryLatencyBucketSummaryRow{
		{MetricName: MetricFrontendPerf, FeatureArea: "admin_ui", Result: "success", StatusClass: "page_boot", Transport: "browser", LatencyBucket: "ms_2000_4999", Count: 3},
		{MetricName: MetricDependency, FeatureArea: "mailworker", Result: "failure", StatusClass: "smtp_connect", Transport: "background", LatencyBucket: "ms_5000_9999", Count: 2},
	}
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = BuildPerformanceOverview(summary, latency)
	}
}
