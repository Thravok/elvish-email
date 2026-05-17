// Package models holds persisted document shapes for SQL storage (CockroachDB / Postgres).
package models

import (
	"time"

	"github.com/google/uuid"
)

const (
	SiteConfigID          = "default"
	UptimeSettingsID      = "default"
	UptimeAggID           = "default"
	DefaultUptimeInterval = "5m"
	TelemetrySettingsID   = "default"
	AdminMailSettingsID   = "default"
	AuthCaptchaSettingsID = "default"

	DefaultTelemetryRetentionDays = 30
	DefaultAdminDKIMSelector      = "mail"
	TelemetryExportSchemaVersion  = "telemetry_export_v1"
	PerformanceExportSchemaV1     = "performance_export_v1"
)

// UptimeSettingsDoc is persisted configuration for the in-process uptime worker.
type UptimeSettingsDoc struct {
	ID                   string              `json:"id"`
	Enabled              bool                `json:"enabled"`
	Interval             string              `json:"interval,omitempty"`
	BaseURL              string              `json:"base_url,omitempty"`
	IncludeToolsFromHome bool                `json:"include_tools_from_home"`
	Endpoints            []UptimeEndpointCfg `json:"endpoints,omitempty"`
}

// UptimeEndpointCfg is one extra URL to probe (full URL or site-relative path).
type UptimeEndpointCfg struct {
	ID     string `json:"id"`
	URL    string `json:"url"`
	Method string `json:"method,omitempty"`
}

// DefaultUptimeSettings returns panel defaults: monitoring on, 5m interval, tool paths from home.
func DefaultUptimeSettings() *UptimeSettingsDoc {
	return &UptimeSettingsDoc{
		ID:                   UptimeSettingsID,
		Enabled:              true,
		Interval:             DefaultUptimeInterval,
		IncludeToolsFromHome: true,
	}
}

// TelemetrySettingsDoc is persisted configuration for anonymous operational telemetry.
type TelemetrySettingsDoc struct {
	ID            string    `json:"id"`
	Enabled       bool      `json:"enabled"`
	RetentionDays int       `json:"retention_days"`
	ExportEnabled bool      `json:"export_enabled"`
	UpdatedAt     time.Time `json:"updated_at,omitempty"`
}

// DefaultTelemetrySettings returns safe defaults: disabled, 30-day retention, manual export enabled.
func DefaultTelemetrySettings() *TelemetrySettingsDoc {
	return &TelemetrySettingsDoc{
		ID:            TelemetrySettingsID,
		Enabled:       false,
		RetentionDays: DefaultTelemetryRetentionDays,
		ExportEnabled: true,
	}
}

// AdminMailSettingsDoc is the singleton persisted config for admin-managed mail delivery.
type AdminMailSettingsDoc struct {
	ID           string    `json:"id"`
	DKIMSelector string    `json:"dkim_selector,omitempty"`
	DKIMDomain   string    `json:"dkim_domain,omitempty"`
	UpdatedAt    time.Time `json:"updated_at,omitempty"`
}

// DefaultAdminMailSettings returns conservative defaults and leaves the domain unset.
func DefaultAdminMailSettings() *AdminMailSettingsDoc {
	return &AdminMailSettingsDoc{
		ID:           AdminMailSettingsID,
		DKIMSelector: DefaultAdminDKIMSelector,
	}
}

// AuthCaptchaSettingsDoc is persisted Cap (self-hosted) configuration for login/register.
type AuthCaptchaSettingsDoc struct {
	ID                string    `json:"id"`
	Enabled           bool      `json:"enabled"`
	WidgetAPIEndpoint string    `json:"widget_api_endpoint,omitempty"`
	Secret            string    `json:"-"`
	UpdatedAt         time.Time `json:"updated_at,omitempty"`
}

// DefaultAuthCaptchaSettings returns Cap disabled with empty endpoint and secret.
func DefaultAuthCaptchaSettings() *AuthCaptchaSettingsDoc {
	return &AuthCaptchaSettingsDoc{
		ID: AuthCaptchaSettingsID,
	}
}

// TelemetryRollupRow is one anonymous hourly aggregate row.
type TelemetryRollupRow struct {
	BucketStart time.Time `json:"bucket_start"`
	MetricName  string    `json:"metric_name"`
	FeatureArea string    `json:"feature_area"`
	Result      string    `json:"result"`
	StatusClass string    `json:"status_class"`
	Transport   string    `json:"transport"`
	Count       int64     `json:"count"`
	SumMS       int64     `json:"sum_ms"`
	MinMS       int64     `json:"min_ms"`
	MaxMS       int64     `json:"max_ms"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`
}

// TelemetrySummaryRow is an aggregate across multiple hourly rollup rows.
type TelemetrySummaryRow struct {
	MetricName  string  `json:"metric_name"`
	FeatureArea string  `json:"feature_area"`
	Result      string  `json:"result"`
	StatusClass string  `json:"status_class"`
	Transport   string  `json:"transport"`
	Count       int64   `json:"count"`
	SumMS       int64   `json:"sum_ms"`
	MinMS       int64   `json:"min_ms"`
	MaxMS       int64   `json:"max_ms"`
	AvgMS       float64 `json:"avg_ms"`
}

// TelemetryExportDoc is the bounded manual export document for anonymous telemetry.
type TelemetryExportDoc struct {
	SchemaVersion string                `json:"schema_version,omitempty"`
	GeneratedAt   time.Time             `json:"generated_at"`
	Days          int                   `json:"days"`
	Settings      *TelemetrySettingsDoc `json:"settings"`
	Summary       []TelemetrySummaryRow `json:"summary"`
	Rollups       []TelemetryRollupRow  `json:"rollups"`
}

// TelemetryLatencyBucketRow is one anonymous hourly latency-bucket aggregate row.
type TelemetryLatencyBucketRow struct {
	BucketStart   time.Time `json:"bucket_start"`
	MetricName    string    `json:"metric_name"`
	FeatureArea   string    `json:"feature_area"`
	Result        string    `json:"result"`
	StatusClass   string    `json:"status_class"`
	Transport     string    `json:"transport"`
	LatencyBucket string    `json:"latency_bucket"`
	Count         int64     `json:"count"`
	UpdatedAt     time.Time `json:"updated_at,omitempty"`
}

// TelemetryLatencyBucketSummaryRow is an aggregate across multiple hourly latency bucket rows.
type TelemetryLatencyBucketSummaryRow struct {
	MetricName    string `json:"metric_name"`
	FeatureArea   string `json:"feature_area"`
	Result        string `json:"result"`
	StatusClass   string `json:"status_class"`
	Transport     string `json:"transport"`
	LatencyBucket string `json:"latency_bucket"`
	Count         int64  `json:"count"`
}

// PerformanceOverview summarizes privacy-safe performance totals across a bounded window.
type PerformanceOverview struct {
	TotalCount      int64   `json:"total_count"`
	FailureCount    int64   `json:"failure_count"`
	BrowserCount    int64   `json:"browser_count"`
	BackendCount    int64   `json:"backend_count"`
	SlowBucketCount int64   `json:"slow_bucket_count"`
	AvgMS           float64 `json:"avg_ms"`
	MaxMS           int64   `json:"max_ms"`
}

// PerformanceHotspot is a derived slow/error-prone surface summary for operator dashboards and exports.
type PerformanceHotspot struct {
	MetricName   string  `json:"metric_name"`
	FeatureArea  string  `json:"feature_area"`
	StatusClass  string  `json:"status_class"`
	Transport    string  `json:"transport"`
	Count        int64   `json:"count"`
	SuccessCount int64   `json:"success_count"`
	FailureCount int64   `json:"failure_count"`
	FailureRate  float64 `json:"failure_rate"`
	AvgMS        float64 `json:"avg_ms"`
	MaxMS        int64   `json:"max_ms"`
}

// PerformanceSnapshotDoc is the telemetry-backed performance dashboard payload.
type PerformanceSnapshotDoc struct {
	Settings       *TelemetrySettingsDoc              `json:"settings"`
	Overview       PerformanceOverview                `json:"overview"`
	Hotspots       []PerformanceHotspot               `json:"hotspots"`
	Summary        []TelemetrySummaryRow              `json:"summary"`
	Recent         []TelemetryRollupRow               `json:"recent"`
	LatencySummary []TelemetryLatencyBucketSummaryRow `json:"latency_summary"`
	LatencyRecent  []TelemetryLatencyBucketRow        `json:"latency_recent"`
}

// PerformanceQueueSnapshot is a safe aggregate queue snapshot for admin dashboards and exports.
type PerformanceQueueSnapshot struct {
	Pending int64 `json:"pending"`
	Sending int64 `json:"sending"`
	Sent    int64 `json:"sent"`
	Failed  int64 `json:"failed"`
}

// PerformanceUptimeSummary is the safe uptime subset included in performance exports.
type PerformanceUptimeSummary struct {
	Live             bool      `json:"live"`
	CheckedAt        time.Time `json:"checked_at,omitempty"`
	StatsPeriodUTC   string    `json:"stats_period_utc,omitempty"`
	OverallOK        int64     `json:"overall_ok"`
	OverallFail      int64     `json:"overall_fail"`
	OverallUptimePct float64   `json:"overall_uptime_pct"`
}

// PerformanceRuntimeContext is safe instance/runtime context for manual export.
type PerformanceRuntimeContext struct {
	Version      string `json:"version,omitempty"`
	BuildLabel   string `json:"build_label,omitempty"`
	HasDatabase  bool   `json:"has_database"`
	HasMailMeta  bool   `json:"has_mailmeta"`
	HasScylla    bool   `json:"has_scylla"`
	HasBlobStore bool   `json:"has_blobstore"`
	HasUptime    bool   `json:"has_uptime"`
}

// PerformancePrivacyContract describes the privacy guarantees of the manual export bundle.
type PerformancePrivacyContract struct {
	Anonymous          bool     `json:"anonymous"`
	SelfHosted         bool     `json:"self_hosted"`
	ManualOnly         bool     `json:"manual_only"`
	NoUniqueIDs        bool     `json:"no_unique_ids"`
	ExcludedDimensions []string `json:"excluded_dimensions"`
}

// PerformanceExportDoc is the bounded manual export document for the admin performance suite.
type PerformanceExportDoc struct {
	SchemaVersion  string                             `json:"schema_version"`
	GeneratedAt    time.Time                          `json:"generated_at"`
	Days           int                                `json:"days"`
	Privacy        PerformancePrivacyContract         `json:"privacy"`
	Settings       *TelemetrySettingsDoc              `json:"settings"`
	Overview       PerformanceOverview                `json:"overview"`
	Runtime        PerformanceRuntimeContext          `json:"runtime"`
	Queue          PerformanceQueueSnapshot           `json:"queue"`
	Uptime         PerformanceUptimeSummary           `json:"uptime"`
	Hotspots       []PerformanceHotspot               `json:"hotspots"`
	Summary        []TelemetrySummaryRow              `json:"summary"`
	Rollups        []TelemetryRollupRow               `json:"rollups"`
	LatencySummary []TelemetryLatencyBucketSummaryRow `json:"latency_summary"`
	LatencyRollups []TelemetryLatencyBucketRow        `json:"latency_rollups"`
}

// UptimeRunDoc is one probe cycle stored for the admin log.
type UptimeRunDoc struct {
	ID      uuid.UUID          `json:"id,omitempty"`
	At      time.Time          `json:"at"`
	Results []UptimeProbePoint `json:"results"`
}

// UptimeProbePoint is one target result inside a run log.
type UptimeProbePoint struct {
	ID         string `json:"id"`
	URL        string `json:"url"`
	Method     string `json:"method,omitempty"`
	OK         bool   `json:"ok"`
	StatusCode int    `json:"status_code"`
	LatencyMS  int64  `json:"latency_ms"`
	Error      string `json:"error,omitempty"`
}

// UptimeAggDoc holds ok/fail counts per target for one calendar month (UTC), keyed by period_ym.
type UptimeAggDoc struct {
	ID        string                        `json:"id"`
	PeriodYM  string                        `json:"period_ym,omitempty"`
	StartedAt time.Time                     `json:"started_at"`
	UpdatedAt time.Time                     `json:"updated_at,omitempty"`
	Targets   map[string]UptimeAggPerTarget `json:"targets,omitempty"`
}

// UptimeAggPerTarget counts all probe outcomes for one target id.
type UptimeAggPerTarget struct {
	ID   string `json:"id,omitempty"`
	OK   int64  `json:"ok"`
	Fail int64  `json:"fail"`
}

// SiteConfig stores optional full home.json override; empty HomeJSON means use filesystem defaults only.
type SiteConfig struct {
	ID       string `json:"id"`
	HomeJSON string `json:"home_json,omitempty"`
}

// MonitorRow is one check (HTTP variants, TCP, DNS, ping, etc.).
type MonitorRow struct {
	ID            string `json:"id"`
	Enabled       bool   `json:"enabled"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	Interval      string `json:"interval,omitempty"`
	GroupSlug     string `json:"group_slug,omitempty"`
	URL           string `json:"url,omitempty"`
	Method        string `json:"method,omitempty"`
	ExpectStatus  []int  `json:"expect_status,omitempty"`
	Keyword       string `json:"keyword,omitempty"`
	JSONPath      string `json:"json_path,omitempty"`
	JSONValue     string `json:"json_value,omitempty"`
	Hostname      string `json:"hostname,omitempty"`
	Port          int    `json:"port,omitempty"`
	DNSName       string `json:"dns_name,omitempty"`
	DNSRecordType string `json:"dns_record_type,omitempty"`
	DNSExpected   string `json:"dns_expected,omitempty"`
	WSURL         string `json:"ws_url,omitempty"`
}

// BlogPost is a log entry stored in SQL.
type BlogPost struct {
	ID                 uuid.UUID `json:"id,omitempty"`
	Slug               string    `json:"slug"`
	Title              string    `json:"title"`
	Date               string    `json:"date"`
	DisplayDate        string    `json:"display_date,omitempty"`
	Time               string    `json:"time,omitempty"`
	Type               string    `json:"type,omitempty"`
	Tags               []string  `json:"tags,omitempty"`
	Bytes              string    `json:"bytes,omitempty"`
	Reach              string    `json:"reach,omitempty"`
	Draft              bool      `json:"draft,omitempty"`
	BodyMarkdown       string    `json:"body_markdown"`
	DetachedOpenPGPSig string    `json:"detached_openpgp_sig,omitempty"`
	DetachedMinisig    string    `json:"detached_minisig,omitempty"`
	OpenPGPKeyID       string    `json:"openpgp_key_id,omitempty"`
	CreatedAt          time.Time `json:"created_at,omitempty"`
	UpdatedAt          time.Time `json:"updated_at,omitempty"`
}

// User is a registered account.
type User struct {
	ID                    uuid.UUID  `json:"id,omitempty"`
	Email                 string     `json:"email"`
	Name                  string     `json:"name,omitempty"`
	PasswordHash          string     `json:"-"`
	AuthMethod            string     `json:"-"`
	SRPSalt               []byte     `json:"-"`
	SRPVerifier           []byte     `json:"-"`
	SRPGroup              string     `json:"-"`
	SRPHash               string     `json:"-"`
	IsAdmin               bool       `json:"is_admin,omitempty"`
	UITheme               string     `json:"ui_theme,omitempty"` // auto | dark | light
	LastActivityAt        time.Time  `json:"last_activity_at,omitempty"`
	ScheduledDeleteAt     *time.Time `json:"scheduled_delete_at,omitempty"`
	ScheduledDeleteReason string     `json:"scheduled_delete_reason,omitempty"`
	InactivityDeleteValue int        `json:"inactivity_delete_value,omitempty"`
	InactivityDeleteUnit  string     `json:"inactivity_delete_unit,omitempty"`
	CreatedAt             time.Time  `json:"created_at,omitempty"`
}

// MFASettings stores the per-user multi-factor posture.
type MFASettings struct {
	UserID          uuid.UUID `json:"user_id,omitempty"`
	Enabled         bool      `json:"enabled"`
	PreferredMethod string    `json:"preferred_method,omitempty"`
	CreatedAt       time.Time `json:"created_at,omitempty"`
	UpdatedAt       time.Time `json:"updated_at,omitempty"`
}

// TOTPFactor stores one authenticator-app factor for a user.
type TOTPFactor struct {
	ID              uuid.UUID  `json:"id,omitempty"`
	UserID          uuid.UUID  `json:"user_id,omitempty"`
	Label           string     `json:"label,omitempty"`
	SecretEncrypted []byte     `json:"-"`
	SecretVersion   int        `json:"secret_version,omitempty"`
	Issuer          string     `json:"issuer,omitempty"`
	AccountName     string     `json:"account_name,omitempty"`
	Algorithm       string     `json:"algorithm,omitempty"`
	Digits          int        `json:"digits,omitempty"`
	PeriodSeconds   int        `json:"period_seconds,omitempty"`
	VerifiedAt      *time.Time `json:"verified_at,omitempty"`
	LastUsedAt      *time.Time `json:"last_used_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at,omitempty"`
	UpdatedAt       time.Time  `json:"updated_at,omitempty"`
	RevokedAt       *time.Time `json:"revoked_at,omitempty"`
}

// WebAuthnCredential stores one security-key credential for a user.
type WebAuthnCredential struct {
	ID             uuid.UUID  `json:"id,omitempty"`
	UserID         uuid.UUID  `json:"user_id,omitempty"`
	Label          string     `json:"label,omitempty"`
	CredentialID   []byte     `json:"-"`
	CredentialJSON []byte     `json:"-"`
	AAGUID         string     `json:"aaguid,omitempty"`
	SignCount      int64      `json:"sign_count,omitempty"`
	Transports     []string   `json:"transports,omitempty"`
	Attachment     string     `json:"attachment,omitempty"`
	Discoverable   bool       `json:"discoverable,omitempty"`
	UserVerified   bool       `json:"user_verified,omitempty"`
	BackupEligible bool       `json:"backup_eligible,omitempty"`
	BackupState    bool       `json:"backup_state,omitempty"`
	CreatedAt      time.Time  `json:"created_at,omitempty"`
	LastUsedAt     *time.Time `json:"last_used_at,omitempty"`
	RevokedAt      *time.Time `json:"revoked_at,omitempty"`
}

// MFARecoveryCode stores one hashed recovery code for a user.
type MFARecoveryCode struct {
	ID        uuid.UUID  `json:"id,omitempty"`
	UserID    uuid.UUID  `json:"user_id,omitempty"`
	CodeHash  string     `json:"-"`
	CreatedAt time.Time  `json:"created_at,omitempty"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
}

// PGPPublicKey is an uploadable OpenPGP public key for verifying log entries.
type PGPPublicKey struct {
	ID            uuid.UUID `json:"id,omitempty"`
	Fingerprint16 string    `json:"fingerprint16"`
	FullKeyID     string    `json:"full_key_id,omitempty"`
	Armored       string    `json:"armored"`
	Label         string    `json:"label,omitempty"`
	CreatedAt     time.Time `json:"created_at,omitempty"`
}
