// Package config loads site JSON (home page, shared chrome, tools, log index copy).
package config

import (
	"encoding/json"
	"fmt"
	"net/mail"
	"os"
	"strings"
)

// Home is the root content/home.json document.
type Home struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Version     string `json:"version"`
	BuildLabel  string `json:"build_label"`
	LicenseLine string `json:"license_line"`
	HashShort   string `json:"hash_short"`
	BuildDate   string `json:"build_date"`
	BaseURL     string `json:"base_url"`

	BlogSigning BlogSigningConfig `json:"blog_signing"`

	TweakDefaults TweakDefaults `json:"tweak_defaults"`

	Nav    []NavLink    `json:"nav"`
	Footer FooterConfig `json:"footer"`

	Hero       HeroConfig     `json:"hero"`
	Terminal   TerminalConfig `json:"terminal"`
	Tools      []Tool         `json:"tools"`
	LogPage    LogPageConfig  `json:"log_page"`
	TickerHome []string       `json:"ticker_home"`

	// Support lists public contact addresses edited in the admin panel. This does
	// not provision SMTP routes; operators must still create mail_aliases / MX.
	Support SupportConfig `json:"support"`
}

// SupportConfig holds default and labeled support email addresses for the public site.
type SupportConfig struct {
	DefaultEmail string           `json:"default_email"`
	Contacts     []SupportContact `json:"contacts"`
}

// SupportContact is one labeled public contact (e.g. security, abuse).
type SupportContact struct {
	Label string `json:"label"`
	Email string `json:"email"`
}

// AnySupportAddress reports whether at least one non-empty email is configured.
func (s SupportConfig) AnySupportAddress() bool {
	if strings.TrimSpace(s.DefaultEmail) != "" {
		return true
	}
	for _, c := range s.Contacts {
		if strings.TrimSpace(c.Email) != "" {
			return true
		}
	}
	return false
}

// DisplayLabel returns a non-empty label for UI, falling back to the email.
func (c SupportContact) DisplayLabel() string {
	if t := strings.TrimSpace(c.Label); t != "" {
		return t
	}
	return strings.TrimSpace(c.Email)
}

const supportMaxContacts = 24
const supportMaxLabelRunes = 120

// ValidateSupport checks support email fields after home.json is parsed.
func (h *Home) ValidateSupport() error {
	if h == nil {
		return nil
	}
	s := h.Support
	if de := strings.TrimSpace(s.DefaultEmail); de != "" {
		if _, err := mail.ParseAddress(de); err != nil {
			return fmt.Errorf("support.default_email: %w", err)
		}
	}
	if len(s.Contacts) > supportMaxContacts {
		return fmt.Errorf("support.contacts: at most %d entries", supportMaxContacts)
	}
	for i, c := range s.Contacts {
		em := strings.TrimSpace(c.Email)
		lb := strings.TrimSpace(c.Label)
		if em == "" && lb == "" {
			continue
		}
		if em == "" {
			return fmt.Errorf("support.contacts[%d]: email required when label is set", i)
		}
		if _, err := mail.ParseAddress(em); err != nil {
			return fmt.Errorf("support.contacts[%d].email: %w", i, err)
		}
		if len([]rune(lb)) > supportMaxLabelRunes {
			return fmt.Errorf("support.contacts[%d].label: exceeds %d characters", i, supportMaxLabelRunes)
		}
	}
	return nil
}

// SupportPublicRow is one support link for SSR templates (footer, manifesto).
type SupportPublicRow struct {
	Label string
	Email string // RFC 5322 addr-spec only (for mailto:)
}

// PublicSupportRows returns non-empty support rows for public UI. Default email
// is shown first with label "Support" when set.
func (s SupportConfig) PublicSupportRows() []SupportPublicRow {
	var out []SupportPublicRow
	if em := strings.TrimSpace(s.DefaultEmail); em != "" {
		a, err := mail.ParseAddress(em)
		if err == nil && a.Address != "" {
			out = append(out, SupportPublicRow{Label: "Support", Email: a.Address})
		}
	}
	for _, c := range s.Contacts {
		em := strings.TrimSpace(c.Email)
		if em == "" {
			continue
		}
		a, err := mail.ParseAddress(em)
		if err != nil || a.Address == "" {
			continue
		}
		lbl := strings.TrimSpace(c.Label)
		if lbl == "" {
			lbl = a.Address
		}
		out = append(out, SupportPublicRow{Label: lbl, Email: a.Address})
	}
	return out
}

// BlogSigningConfig is optional metadata for minisign-backed log posts.
type BlogSigningConfig struct {
	PublicKeyURL string `json:"public_key_url"`
}

// SigningPubHref returns the href used in templates for the published minisign public key.
func (h *Home) SigningPubHref() string {
	u := strings.TrimSpace(h.BlogSigning.PublicKeyURL)
	if u != "" {
		return u
	}
	return "/signing.pub"
}

// TweakDefaults matches client-side theme keys in static/site.js.
type TweakDefaults struct {
	Theme     string `json:"theme"`
	Font      string `json:"font"`
	Crosshair bool   `json:"crosshair"`
	Scanlines bool   `json:"scanlines"`
	ShowGrid  bool   `json:"show_grid"`
}

// NavLink is a topbar link.
type NavLink struct {
	Href   string `json:"href"`
	Label  string `json:"label"`
	ID     string `json:"id"`
	Active bool   `json:"-"`
}

// FooterConfig describes footer columns.
type FooterConfig struct {
	Tagline         string       `json:"tagline"`
	Pages           []FooterLink `json:"pages"`
	Protocol        []string     `json:"protocol"`
	ASCIIBlock      string       `json:"ascii_block"`
	ASCIIScaleToFit bool         `json:"ascii_scale_to_fit"`
}

// FooterLink is a named href for the footer list.
type FooterLink struct {
	Href  string `json:"href"`
	Label string `json:"label"`
}

// HeroConfig drives the landing hero and side panels.
type HeroConfig struct {
	SectionIndex   string         `json:"section_index"`
	SectionTitle   string         `json:"section_title"`
	Lines          []HeroLine     `json:"lines"`
	LedeMarkdown   string         `json:"lede_markdown"`
	Stats          []StatKV       `json:"stats"`
	LoadBarHeights []int          `json:"load_bar_heights"`
	SysRows        []SysStatusRow `json:"sys_rows"`
	KeyboardRows   []KeyboardRow  `json:"keyboard_rows"`
	ToolsSection   ToolsSection   `json:"tools_section"`
}

// HeroLine is one line of the display headline (optional stripe span per part).
type HeroLine struct {
	Parts []HeroPart `json:"parts"`
}

// HeroPart is a text segment, optionally wrapped in .stripe.
type HeroPart struct {
	Stripe bool   `json:"stripe"`
	Text   string `json:"text"`
}

// StatKV is a hero-meta key/value.
type StatKV struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// SysStatusRow is a label + value row in the SYS · STATUS panel.
type SysStatusRow struct {
	Label  string `json:"label"`
	Value  string `json:"value"`
	Status string `json:"status"`
}

// KeyboardRow is a shortcut hint row.
type KeyboardRow struct {
	Label string `json:"label"`
	Key   string `json:"key"`
}

// ToolsSection labels the tools grid band.
type ToolsSection struct {
	SectionIndex string `json:"section_index"`
	SectionTitle string `json:"section_title"`
	Hint         string `json:"hint"`
}

// TerminalConfig is injected as JSON for site.js typewriter.
type TerminalConfig struct {
	Lines []TerminalLine `json:"lines"`
}

// TerminalLine is one boot line.
type TerminalLine struct {
	Kind string `json:"kind"`
	Text string `json:"text"`
}

// Tool is one card on the home grid.
// ToolMonitor is one Kuma-style check scoped to a home tool card (stored in home JSON / site_config).
type ToolMonitor struct {
	ID            string `json:"id"`
	Enabled       bool   `json:"enabled"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	Interval      string `json:"interval,omitempty"`
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

type Tool struct {
	ID   string `json:"id"`
	Slug string `json:"slug"`
	Name string `json:"name"`
	Tag  string `json:"tag"`
	Desc string `json:"desc"`
	// Signals are trust / data-posture chips for the home grid (browser-only, no-upload, …).
	Signals []string `json:"signals"`
	// Stack is a legacy JSON key; merged into Signals on load when Signals is empty.
	Stack       []string `json:"stack,omitempty"`
	Glyph       string   `json:"glyph"`
	Calls       string   `json:"calls"`
	CallsStatic bool     `json:"calls_static"`
	Since       string   `json:"since"`
	OpenHref    string   `json:"open_href"`
	Hidden      bool     `json:"hidden"`
	// Deprecated JSON keys; merged into Monitor by NormalizeUptimeToolFields on load.
	HealthHref string        `json:"health_href,omitempty"`
	Monitors   []ToolMonitor `json:"monitors,omitempty"`
	// Monitor is the single optional uptime check for this tool (HTTP/TCP/DNS/…). When set and enabled,
	// it replaces the default tool_<slug> HTTP probe from uptime resolution.
	Monitor *ToolMonitor `json:"monitor,omitempty"`
}

// ActiveUptimeMonitor returns the tool's monitor when it should run via RunMonitorRows (and skip default HTTP slot).
func (t *Tool) ActiveUptimeMonitor() *ToolMonitor {
	if t == nil || t.Monitor == nil || !t.Monitor.Enabled {
		return nil
	}
	if strings.TrimSpace(t.Monitor.ID) == "" {
		return nil
	}
	return t.Monitor
}

// LogPageConfig drives /log/ index chrome (not individual posts).
type LogPageConfig struct {
	SectionIndex  string      `json:"section_index"`
	SectionTitle  string      `json:"section_title"`
	Headlines     []HeroLine  `json:"headlines"`
	IntroMarkdown string      `json:"intro_markdown"`
	TaglineAccent string      `json:"tagline_accent"`
	Filters       []LogFilter `json:"filters"`
	Ticker        []string    `json:"ticker"`
}

// LogFilter is a tag filter chip id/label.
type LogFilter struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// ParseHomeJSON parses home site JSON bytes (same shape as content/home.json).
func ParseHomeJSON(raw []byte) (*Home, error) {
	var h Home
	if err := json.Unmarshal(raw, &h); err != nil {
		return nil, fmt.Errorf("parse home json: %w", err)
	}
	mergeLegacyStackIntoSignals(&h)
	NormalizeUptimeToolFields(&h)
	if h.BaseURL == "" {
		h.BaseURL = "https://example.com"
	}
	return &h, nil
}

// NormalizeUptimeToolFields folds deprecated health_href / monitors[] into a single Monitor and clears legacy fields.
func NormalizeUptimeToolFields(h *Home) {
	if h == nil {
		return
	}
	for i := range h.Tools {
		t := &h.Tools[i]
		if t.Monitor == nil && len(t.Monitors) > 0 {
			c := t.Monitors[0]
			t.Monitor = &c
		}
		if t.Monitor == nil {
			if hx := strings.TrimSpace(t.HealthHref); hx != "" {
				t.Monitor = &ToolMonitor{
					ID:      "primary",
					Enabled: true,
					Name:    "HTTP",
					Type:    "http",
					URL:     hx,
					Method:  "GET",
				}
			}
		}
		t.Monitors = nil
		t.HealthHref = ""
	}
}

func mergeLegacyStackIntoSignals(h *Home) {
	for i := range h.Tools {
		if len(h.Tools[i].Signals) > 0 {
			continue
		}
		if len(h.Tools[i].Stack) == 0 {
			continue
		}
		h.Tools[i].Signals = append([]string(nil), h.Tools[i].Stack...)
	}
}

// LoadHome reads and parses content/home.json.
func LoadHome(path string) (*Home, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read home json: %w", err)
	}
	return ParseHomeJSON(raw)
}
