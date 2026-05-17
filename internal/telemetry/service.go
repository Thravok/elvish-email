package telemetry

import (
	"context"
	"errors"
	"path"
	"strings"
	"sync"
	"time"

	"elvish/internal/models"
)

const (
	settingsCacheTTL   = 15 * time.Second
	minRetentionDays   = 7
	maxRetentionDays   = 90
	defaultRecentHours = 72
	defaultRecentLimit = 200

	MetricHTTPRequest  = "http_requests"
	MetricMailIngest   = "mail_ingest"
	MetricMailDelivery = "mail_delivery"
	MetricSMTPEvent    = "smtp_events"
	MetricJobRun       = "job_runs"
	MetricFrontendPerf = "frontend_perf"
	MetricDependency   = "dependency_perf"
	MetricQueueHealth  = "queue_health"
)

var (
	// ErrExportDisabled is returned when manual export is disabled by the operator.
	ErrExportDisabled = errors.New("telemetry: export disabled")
	// ErrInvalidEvent is returned when a metric attempts to use a non-allowlisted dimension.
	ErrInvalidEvent = errors.New("telemetry: invalid event")
)

type metricSpec struct {
	featureAreas map[string]struct{}
	results      map[string]struct{}
	statuses     map[string]struct{}
	transports   map[string]struct{}
}

var metricSpecs = map[string]metricSpec{
	MetricHTTPRequest: {
		featureAreas: set(
			"admin_api", "auth_api", "mail_api", "mailbox_api", "filters_api",
			"domains_api", "smtp_submission_api", "site_api", "auth_ui",
			"admin_ui", "mail_ui", "protected_link", "wkd", "manifesto",
			"home", "public_page", "static_asset",
		),
		results:    set("success", "failure"),
		statuses:   set("1xx", "2xx", "3xx", "4xx", "5xx", "unknown"),
		transports: set("http"),
	},
	MetricMailIngest: {
		featureAreas: set("smtp_inbound", "smtp_submission", "api_client", "internal"),
		results:      set("success", "failure"),
		statuses:     set("none"),
		transports:   set("smtp", "api"),
	},
	MetricMailDelivery: {
		featureAreas: set("outbox"),
		results:      set("success", "transient_fail", "permanent_fail"),
		statuses:     set("none"),
		transports:   set("smtp"),
	},
	MetricSMTPEvent: {
		featureAreas: set("lookup", "auth", "inbound", "submission"),
		results:      set("success", "failure"),
		statuses:     set("none"),
		transports:   set("smtp"),
	},
	MetricJobRun: {
		featureAreas: set("mailworker", "uptime", "protected_link_sweeper", "mail_retention_sweeper", "account_deletion"),
		results:      set("success", "failure"),
		statuses:     set("none"),
		transports:   set("background"),
	},
	MetricFrontendPerf: {
		featureAreas: set("admin_ui", "mail_ui", "auth_ui", "home", "public_page"),
		results:      set("success", "failure"),
		statuses: set(
			"page_boot", "bootstrap_fetch", "section_switch", "save_action", "export_action",
			"folder_load", "search_init", "search_query", "search_index", "message_open",
			"compose_send", "key_unlock", "login_exchange", "register_bootstrap", "register_submit",
			"status_refresh", "first_contentful_paint",
		),
		transports: set("browser"),
	},
	MetricDependency: {
		featureAreas: set("mailworker", "smtp_backend", "account_delete"),
		results:      set("success", "failure"),
		statuses: set(
			"blob_get", "mx_lookup", "smtp_connect", "smtp_mail", "smtp_rcpt", "smtp_data",
			"identity_lookup", "auth_lookup", "principal_resolve", "user_purge",
		),
		transports: set("background", "smtp", "http"),
	},
	MetricQueueHealth: {
		featureAreas: set("mail_outbox"),
		results:      set("observed"),
		statuses:     set("empty", "depth_1_5", "depth_6_20", "depth_21_100", "depth_101_plus"),
		transports:   set("background"),
	},
}

// Store is the persistence surface required by Service.
type Store interface {
	GetTelemetrySettings(ctx context.Context) (*models.TelemetrySettingsDoc, error)
	SetTelemetrySettings(ctx context.Context, doc *models.TelemetrySettingsDoc) error
	RecordTelemetryRollup(ctx context.Context, row models.TelemetryRollupRow) error
	RecordTelemetryLatencyBucket(ctx context.Context, row models.TelemetryLatencyBucketRow) error
	ListTelemetryRollups(ctx context.Context, since time.Time, limit int) ([]models.TelemetryRollupRow, error)
	SummarizeTelemetryRollups(ctx context.Context, since time.Time) ([]models.TelemetrySummaryRow, error)
	ListTelemetryLatencyBuckets(ctx context.Context, since time.Time, limit int) ([]models.TelemetryLatencyBucketRow, error)
	SummarizeTelemetryLatencyBuckets(ctx context.Context, since time.Time) ([]models.TelemetryLatencyBucketSummaryRow, error)
	DeleteTelemetryRollupsBefore(ctx context.Context, before time.Time) (int64, error)
	DeleteTelemetryLatencyBucketsBefore(ctx context.Context, before time.Time) (int64, error)
}

// Event is one aggregate-only telemetry update before bucketing.
type Event struct {
	MetricName  string
	FeatureArea string
	Result      string
	StatusClass string
	Transport   string
	Duration    time.Duration
	Count       int64
	At          time.Time
}

// Snapshot is the operator-facing telemetry dashboard state.
type Snapshot struct {
	Settings *models.TelemetrySettingsDoc `json:"settings"`
	Summary  []models.TelemetrySummaryRow `json:"summary"`
	Recent   []models.TelemetryRollupRow  `json:"recent"`
}

// Service records and reads anonymous telemetry without storing event logs.
type Service struct {
	store Store

	mu       sync.RWMutex
	cached   *models.TelemetrySettingsDoc
	cacheExp time.Time
}

// New constructs a Service around an optional persistent store.
func New(st Store) *Service {
	return &Service{store: st}
}

// Settings returns the current telemetry settings, defaulting to disabled.
func (s *Service) Settings(ctx context.Context) (*models.TelemetrySettingsDoc, error) {
	return s.loadSettings(ctx, false)
}

// SaveSettings updates telemetry settings and refreshes the in-process cache.
func (s *Service) SaveSettings(ctx context.Context, doc *models.TelemetrySettingsDoc) (*models.TelemetrySettingsDoc, error) {
	if doc == nil {
		doc = models.DefaultTelemetrySettings()
	}
	doc.ID = models.TelemetrySettingsID
	doc.RetentionDays = normalizeRetentionDays(doc.RetentionDays)
	if s.store == nil {
		cp := *doc
		s.setCache(&cp)
		return &cp, nil
	}
	if err := s.store.SetTelemetrySettings(ctx, doc); err != nil {
		return nil, err
	}
	cp := *doc
	cp.UpdatedAt = time.Now().UTC()
	s.setCache(&cp)
	if err := s.Prune(ctx); err != nil {
		return nil, err
	}
	return &cp, nil
}

// Prune deletes rollups older than the current retention window.
func (s *Service) Prune(ctx context.Context) error {
	if s == nil || s.store == nil {
		return nil
	}
	st, err := s.loadSettings(ctx, false)
	if err != nil {
		return err
	}
	before := time.Now().UTC().AddDate(0, 0, -normalizeRetentionDays(st.RetentionDays))
	if _, err = s.store.DeleteTelemetryRollupsBefore(ctx, before); err != nil {
		return err
	}
	_, err = s.store.DeleteTelemetryLatencyBucketsBefore(ctx, before)
	return err
}

// Snapshot returns settings, a bounded summary, and recent hourly rollups.
func (s *Service) Snapshot(ctx context.Context, summaryDays int, recentHours int, recentLimit int) (*Snapshot, error) {
	st, err := s.loadSettings(ctx, false)
	if err != nil {
		return nil, err
	}
	if s.store == nil {
		return &Snapshot{Settings: st, Summary: []models.TelemetrySummaryRow{}, Recent: []models.TelemetryRollupRow{}}, nil
	}
	if err := s.Prune(ctx); err != nil {
		return nil, err
	}
	if summaryDays <= 0 {
		summaryDays = minInt(7, st.RetentionDays)
	}
	if recentHours <= 0 {
		recentHours = defaultRecentHours
	}
	if recentLimit <= 0 {
		recentLimit = defaultRecentLimit
	}
	summary, err := s.store.SummarizeTelemetryRollups(ctx, time.Now().UTC().Add(-time.Duration(summaryDays)*24*time.Hour))
	if err != nil {
		return nil, err
	}
	recent, err := s.store.ListTelemetryRollups(ctx, time.Now().UTC().Add(-time.Duration(recentHours)*time.Hour), recentLimit)
	if err != nil {
		return nil, err
	}
	return &Snapshot{Settings: st, Summary: summary, Recent: recent}, nil
}

// Export builds a bounded manual export document from aggregate-only telemetry rows.
func (s *Service) Export(ctx context.Context, days int) (*models.TelemetryExportDoc, error) {
	st, err := s.loadSettings(ctx, false)
	if err != nil {
		return nil, err
	}
	if !st.ExportEnabled {
		return nil, ErrExportDisabled
	}
	if err := s.Prune(ctx); err != nil {
		return nil, err
	}
	days = normalizeExportDays(days, st.RetentionDays)
	if s.store == nil {
		return &models.TelemetryExportDoc{
			SchemaVersion: models.TelemetryExportSchemaVersion,
			GeneratedAt:   time.Now().UTC(),
			Days:          days,
			Settings:      st,
			Summary:       []models.TelemetrySummaryRow{},
			Rollups:       []models.TelemetryRollupRow{},
		}, nil
	}
	since := time.Now().UTC().Add(-time.Duration(days) * 24 * time.Hour)
	summary, err := s.store.SummarizeTelemetryRollups(ctx, since)
	if err != nil {
		return nil, err
	}
	rollups, err := s.store.ListTelemetryRollups(ctx, since, 1000)
	if err != nil {
		return nil, err
	}
	return &models.TelemetryExportDoc{
		SchemaVersion: models.TelemetryExportSchemaVersion,
		GeneratedAt:   time.Now().UTC(),
		Days:          days,
		Settings:      st,
		Summary:       summary,
		Rollups:       rollups,
	}, nil
}

// Record validates and stores one anonymous aggregate event.
func (s *Service) Record(ctx context.Context, ev Event) error {
	if s == nil || s.store == nil {
		return nil
	}
	st, err := s.loadSettings(ctx, true)
	if err != nil {
		return err
	}
	if st == nil || !st.Enabled {
		return nil
	}
	row, err := validateAndBuildRow(ev)
	if err != nil {
		return err
	}
	if err := s.store.RecordTelemetryRollup(ctx, row); err != nil {
		return err
	}
	bucket, ok := buildLatencyBucketRow(row)
	if !ok {
		return nil
	}
	return s.store.RecordTelemetryLatencyBucket(ctx, bucket)
}

// RecordHTTP records one coarse HTTP request outcome.
func (s *Service) RecordHTTP(ctx context.Context, urlPath string, status int, d time.Duration) error {
	return s.Record(ctx, Event{
		MetricName:  MetricHTTPRequest,
		FeatureArea: HTTPFeatureArea(urlPath),
		Result:      httpResult(status),
		StatusClass: HTTPStatusClass(status),
		Transport:   "http",
		Duration:    d,
	})
}

// RecordMailIngest records one mail ingest operation outcome.
func (s *Service) RecordMailIngest(ctx context.Context, source string, ingestErr error, d time.Duration) error {
	featureArea := "smtp_inbound"
	transport := "smtp"
	switch strings.TrimSpace(source) {
	case "smtp_submission":
		featureArea = "smtp_submission"
	case "api_client":
		featureArea = "api_client"
		transport = "api"
	case "internal":
		featureArea = "internal"
	}
	result := "success"
	if ingestErr != nil {
		result = "failure"
	}
	return s.Record(ctx, Event{
		MetricName:  MetricMailIngest,
		FeatureArea: featureArea,
		Result:      result,
		StatusClass: "none",
		Transport:   transport,
		Duration:    d,
	})
}

// RecordMailDelivery records one outbound delivery attempt result.
func (s *Service) RecordMailDelivery(ctx context.Context, result string, d time.Duration) error {
	return s.Record(ctx, Event{
		MetricName:  MetricMailDelivery,
		FeatureArea: "outbox",
		Result:      strings.TrimSpace(result),
		StatusClass: "none",
		Transport:   "smtp",
		Duration:    d,
	})
}

// RecordSMTPEvent records coarse SMTP ingress, lookup, submission, or auth events.
func (s *Service) RecordSMTPEvent(ctx context.Context, stage string, success bool, d time.Duration) error {
	result := "failure"
	if success {
		result = "success"
	}
	return s.Record(ctx, Event{
		MetricName:  MetricSMTPEvent,
		FeatureArea: strings.TrimSpace(stage),
		Result:      result,
		StatusClass: "none",
		Transport:   "smtp",
		Duration:    d,
	})
}

// RecordJobRun records one background loop iteration outcome.
func (s *Service) RecordJobRun(ctx context.Context, job string, runErr error, d time.Duration) error {
	result := "failure"
	if runErr == nil {
		result = "success"
	}
	return s.Record(ctx, Event{
		MetricName:  MetricJobRun,
		FeatureArea: strings.TrimSpace(job),
		Result:      result,
		StatusClass: "none",
		Transport:   "background",
		Duration:    d,
	})
}

// RecordFrontendPerf records one anonymous browser-side performance sample.
func (s *Service) RecordFrontendPerf(ctx context.Context, surface, operation string, success bool, d time.Duration) error {
	return s.Record(ctx, Event{
		MetricName:  MetricFrontendPerf,
		FeatureArea: strings.TrimSpace(surface),
		Result:      boolResult(success),
		StatusClass: strings.TrimSpace(operation),
		Transport:   "browser",
		Duration:    d,
	})
}

// RecordDependencyPerf records one coarse dependency timing sample.
func (s *Service) RecordDependencyPerf(ctx context.Context, featureArea, operation, transport string, success bool, d time.Duration) error {
	return s.Record(ctx, Event{
		MetricName:  MetricDependency,
		FeatureArea: strings.TrimSpace(featureArea),
		Result:      boolResult(success),
		StatusClass: strings.TrimSpace(operation),
		Transport:   strings.TrimSpace(transport),
		Duration:    d,
	})
}

// RecordQueueHealth records one coarse queue-depth observation bucket.
func (s *Service) RecordQueueHealth(ctx context.Context, queue string, depth int) error {
	return s.Record(ctx, Event{
		MetricName:  MetricQueueHealth,
		FeatureArea: strings.TrimSpace(queue),
		Result:      "observed",
		StatusClass: queueDepthBucket(depth),
		Transport:   "background",
		Duration:    0,
	})
}

// HTTPStatusClass buckets HTTP statuses without persisting the exact route or code.
func HTTPStatusClass(status int) string {
	switch {
	case status >= 100 && status < 200:
		return "1xx"
	case status >= 200 && status < 300:
		return "2xx"
	case status >= 300 && status < 400:
		return "3xx"
	case status >= 400 && status < 500:
		return "4xx"
	case status >= 500 && status < 600:
		return "5xx"
	default:
		return "unknown"
	}
}

// HTTPFeatureArea maps raw paths into a fixed low-cardinality route group.
func HTTPFeatureArea(urlPath string) string {
	p := strings.TrimSpace(urlPath)
	switch {
	case strings.HasPrefix(p, "/api/admin/"):
		return "admin_api"
	case strings.HasPrefix(p, "/api/auth/"):
		return "auth_api"
	case strings.HasPrefix(p, "/api/v1/mailbox"):
		return "mailbox_api"
	case strings.HasPrefix(p, "/api/v1/mail"):
		return "mail_api"
	case strings.HasPrefix(p, "/api/v1/filters"):
		return "filters_api"
	case strings.HasPrefix(p, "/api/v1/custom-domains"):
		return "domains_api"
	case strings.HasPrefix(p, "/api/v1/smtp-submission"):
		return "smtp_submission_api"
	case strings.HasPrefix(p, "/api/"):
		return "site_api"
	case strings.HasPrefix(p, "/.well-known/webfinger"),
		strings.HasPrefix(p, "/.well-known/openid-configuration"),
		strings.HasPrefix(p, "/.well-known/jwks.json"),
		strings.HasPrefix(p, "/oauth/"):
		return "oidc_issuer"
	case strings.HasPrefix(p, "/.well-known/openpgpkey"):
		return "wkd"
	case strings.HasPrefix(p, "/admin"):
		return "admin_ui"
	case p == "/login" || p == "/register" || p == "/auth/logout":
		return "auth_ui"
	case p == "/mail" || p == "/mail/":
		return "mail_ui"
	case strings.HasPrefix(p, "/m/"):
		return "protected_link"
	case p == "/manifesto" || p == "/manifesto/":
		return "manifesto"
	case p == "/" || p == "/index.html":
		return "home"
	case looksStatic(p):
		return "static_asset"
	default:
		return "public_page"
	}
}

func (s *Service) loadSettings(ctx context.Context, allowCached bool) (*models.TelemetrySettingsDoc, error) {
	if s == nil || s.store == nil {
		return models.DefaultTelemetrySettings(), nil
	}
	now := time.Now()
	if allowCached {
		s.mu.RLock()
		if s.cached != nil && now.Before(s.cacheExp) {
			cp := *s.cached
			s.mu.RUnlock()
			return &cp, nil
		}
		s.mu.RUnlock()
	}
	doc, err := s.store.GetTelemetrySettings(ctx)
	if err != nil {
		return nil, err
	}
	if doc == nil {
		doc = models.DefaultTelemetrySettings()
	}
	doc.RetentionDays = normalizeRetentionDays(doc.RetentionDays)
	s.setCache(doc)
	cp := *doc
	return &cp, nil
}

func (s *Service) setCache(doc *models.TelemetrySettingsDoc) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := *doc
	s.cached = &cp
	s.cacheExp = time.Now().Add(settingsCacheTTL)
}

func validateAndBuildRow(ev Event) (models.TelemetryRollupRow, error) {
	ev.MetricName = strings.TrimSpace(ev.MetricName)
	ev.FeatureArea = strings.TrimSpace(ev.FeatureArea)
	ev.Result = strings.TrimSpace(ev.Result)
	ev.StatusClass = strings.TrimSpace(ev.StatusClass)
	ev.Transport = strings.TrimSpace(ev.Transport)
	if ev.StatusClass == "" {
		ev.StatusClass = "none"
	}
	if ev.Count <= 0 {
		ev.Count = 1
	}
	spec, ok := metricSpecs[ev.MetricName]
	if !ok || !contains(spec.featureAreas, ev.FeatureArea) || !contains(spec.results, ev.Result) ||
		!contains(spec.statuses, ev.StatusClass) || !contains(spec.transports, ev.Transport) {
		return models.TelemetryRollupRow{}, ErrInvalidEvent
	}
	ms := ev.Duration.Milliseconds()
	if ms < 0 {
		ms = 0
	}
	at := ev.At
	if at.IsZero() {
		at = time.Now().UTC()
	}
	return models.TelemetryRollupRow{
		BucketStart: at.UTC().Truncate(time.Hour),
		MetricName:  ev.MetricName,
		FeatureArea: ev.FeatureArea,
		Result:      ev.Result,
		StatusClass: ev.StatusClass,
		Transport:   ev.Transport,
		Count:       ev.Count,
		SumMS:       ms * ev.Count,
		MinMS:       ms,
		MaxMS:       ms,
	}, nil
}

func buildLatencyBucketRow(row models.TelemetryRollupRow) (models.TelemetryLatencyBucketRow, bool) {
	if row.Count <= 0 || row.MaxMS <= 0 || row.MetricName == MetricQueueHealth {
		return models.TelemetryLatencyBucketRow{}, false
	}
	return models.TelemetryLatencyBucketRow{
		BucketStart:   row.BucketStart,
		MetricName:    row.MetricName,
		FeatureArea:   row.FeatureArea,
		Result:        row.Result,
		StatusClass:   row.StatusClass,
		Transport:     row.Transport,
		LatencyBucket: latencyBucketName(row.MaxMS),
		Count:         row.Count,
	}, true
}

func httpResult(status int) string {
	if status >= 500 || status <= 0 {
		return "failure"
	}
	return "success"
}

func looksStatic(p string) bool {
	base := path.Base(p)
	if base == "." || base == "/" || base == "" {
		return false
	}
	return strings.Contains(base, ".")
}

func normalizeRetentionDays(days int) int {
	switch {
	case days < minRetentionDays:
		return models.DefaultTelemetryRetentionDays
	case days > maxRetentionDays:
		return maxRetentionDays
	default:
		return days
	}
}

func normalizeExportDays(days int, retention int) int {
	retention = normalizeRetentionDays(retention)
	if days <= 0 {
		return minInt(models.DefaultTelemetryRetentionDays, retention)
	}
	if days > retention {
		return retention
	}
	return days
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func boolResult(success bool) string {
	if success {
		return "success"
	}
	return "failure"
}

func queueDepthBucket(depth int) string {
	switch {
	case depth <= 0:
		return "empty"
	case depth <= 5:
		return "depth_1_5"
	case depth <= 20:
		return "depth_6_20"
	case depth <= 100:
		return "depth_21_100"
	default:
		return "depth_101_plus"
	}
}

func set(vals ...string) map[string]struct{} {
	out := make(map[string]struct{}, len(vals))
	for _, v := range vals {
		out[v] = struct{}{}
	}
	return out
}

func contains(m map[string]struct{}, key string) bool {
	_, ok := m[key]
	return ok
}
