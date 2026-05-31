package render

import (
	"html/template"

	"elvish/internal/blog"
	"elvish/internal/config"
)

// HeroUptimeBar is one column in the UPTIME · LIVE strip chart.
type HeroUptimeBar struct {
	HeightPx   int
	LatestDown bool // most recent probe round failed for this tool's primary target
}

// ToolVM is a tool card with pre-rendered glyph SVG.
type ToolVM struct {
	config.Tool
	Glyph      template.HTML
	SearchBlob string // lowercase name+desc+signals for client-side filter
	UptimeLine string // rollup / last probe label for public status (e.g. "99.2%" or "—")
}

// NavAuth is session state for the shared topbar (SSR).
type NavAuth struct {
	LoggedIn   bool
	Email      string
	Name       string
	IsAdmin    bool
	UITheme    string // auto | dark | light when LoggedIn; empty when anonymous
	LogoutNext string // safe same-origin path for POST /auth/logout (e.g. current page)
}

// HomePage is data for the landing page.
type HomePage struct {
	Site        *config.Home
	Title       string
	Description string
	LedeHTML    template.HTML
	Tools       []ToolVM
	// ToolsShown is the number of tools rendered on the home grid (not hidden).
	ToolsShown int
	// ToolsOnline is how many of those tools passed the latest uptime probe (tool_<slug> targets OK).
	ToolsOnline int
	// HeroLoadFootLeft / HeroLoadFootRight are the small caption under the hero spark bars (tool uptime rollup + last probe age).
	HeroLoadFootLeft  string
	HeroLoadFootRight string
	// HeroSysRows replaces static home.json sys_rows with live probe-derived copy for the SYS · STATUS panel.
	HeroSysRows []config.SysStatusRow
	// HeroUptimeBars drives the UPTIME · LIVE strip chart (one segment per listed tool when probes are live).
	HeroUptimeBars []HeroUptimeBar
	// HeroUptimeBarsPulse is true when bars come from home.json decor (animated) instead of probe-derived heights.
	HeroUptimeBarsPulse bool
	// HeroStats replaces static hero.stats from home.json with live TOOLS / CALLS / UPTIME values where keys match.
	HeroStats     []config.StatKV
	TweakDefaults template.JS
	TerminalLines template.JS
	TickerHome    []string
	ActiveNav     string
	NavAuth       NavAuth
}

// LogPage is data for /log/ and /log/tags/<tag>/.
type LogPage struct {
	Site          *config.Home
	Title         string
	Description   string
	Posts         []blog.Post
	Filters       []config.LogFilter
	ActiveFilter  string
	IntroHTML     template.HTML
	TweakDefaults template.JS
	Ticker        []string
	ActiveNav     string
	FirstDate     string
	LatestDate    string
	EntryCount    int
	NavAuth       NavAuth
}

// StatusRow is one monitored target row on /status/.
type StatusRow struct {
	ID          string
	DisplayName string
	OK          bool
	StatusCode  int
	LatencyMS   int64
	Error       string
	UptimePct   string
}

// StatusPage is data for the public reliability /status/ page.
type StatusPage struct {
	Site          *config.Home
	Title         string
	Description   string
	TweakDefaults template.JS
	UptimeInitial template.JS // same shape as /api/uptime.json for client refresh
	LabelsJSON    template.JS // map probe id -> display name for refresh UI
	Ticker        []string
	ActiveNav     string
	NavAuth       NavAuth
	OverallUptime string
	CheckedAt     string
	Live          bool
	EmptyMessage  string
	Rows          []StatusRow
}

// OpenPGPSection is template data for detached OpenPGP verification UI on a post.
type OpenPGPSection struct {
	HasSignature bool
	VerifiedOK   bool
	Fingerprint  string // display (e.g. 16 hex)
	ErrMsg       string
	SigURL       string // link to detached signature download
	KeyURL       string // link to armored public key
}

// ManifestoPage is data for /manifesto/.
type ManifestoPage struct {
	Site          *config.Home
	Title         string
	Description   string
	TweakDefaults template.JS
	ActiveNav     string
	NavAuth       NavAuth
}

// PostPage is data for a single log entry.
type PostPage struct {
	Site               *config.Home
	Title              string
	Description        string
	Post               blog.Post
	TweakDefaults      template.JS
	ActiveNav          string
	SigningPubURL      string // href to published minisign public key (e.g. /signing.pub)
	SigningPubDeployed bool   // true when signing.pub was copied into the site output
	OpenPGP            *OpenPGPSection
	NavAuth            NavAuth
}
