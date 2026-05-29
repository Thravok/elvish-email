// Package operatorconfig loads platform settings from SQL with a short in-process cache.
package operatorconfig

import (
	"context"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"elvish/libs/go/models"
	"elvish/libs/go/store"
)

const settingsCacheTTL = 15 * time.Second

// Settings is a snapshot of operator-facing platform configuration.
type Settings struct {
	PublicBaseURL        string
	PlatformMailDomain   string
	WebOrigins           []string
	CookieDomain         string
	RegistrationClosed   bool
	PaidFeaturesEnabled  bool
	TrustForwardedFor    bool
	ContentCacheSec      int
	SMTPRateLimitPerHour int64
}

// Service reads and caches operator_settings from the store.
type Service struct {
	store  *store.Store
	log    *slog.Logger
	mu     sync.RWMutex
	cached *Settings
	exp    time.Time
}

// New returns a Service backed by st. st may be nil (defaults only).
func New(st *store.Store, log *slog.Logger) *Service {
	if log == nil {
		log = slog.Default()
	}
	return &Service{store: st, log: log}
}

// MaybeMigrateFromEnv imports legacy environment variables into operator_settings.
func (s *Service) MaybeMigrateFromEnv(ctx context.Context) error {
	if s == nil || s.store == nil {
		return nil
	}
	doc, err := s.store.GetOperatorSettings(ctx)
	if err != nil {
		return err
	}
	fillEmptyOnly := !doc.UpdatedAt.IsZero()
	changed := applyEnvBootstrap(doc, fillEmptyOnly)
	if !changed {
		return nil
	}
	if err := s.store.SetOperatorSettings(ctx, doc); err != nil {
		return err
	}
	s.Invalidate()
	if fillEmptyOnly {
		s.log.Info("backfilled empty operator settings from environment")
	} else {
		s.log.Info("migrated operator settings from environment")
	}
	return nil
}

func applyEnvBootstrap(doc *models.OperatorSettingsDoc, fillEmptyOnly bool) bool {
	if doc == nil {
		return false
	}
	changed := false
	setString := func(dst *string, envName string, normalize func(string) string) {
		v := strings.TrimSpace(os.Getenv(envName))
		if v == "" {
			return
		}
		if fillEmptyOnly && strings.TrimSpace(*dst) != "" {
			return
		}
		next := normalize(v)
		if *dst == next {
			return
		}
		*dst = next
		changed = true
	}
	setString(&doc.PublicBaseURL, "ELVISH_PUBLIC_BASE_URL", func(v string) string {
		return strings.TrimRight(v, "/")
	})
	setString(&doc.PlatformMailDomain, "ELVISH_MAIL_DOMAIN", strings.ToLower)
	setString(&doc.WebOrigins, "ELVISH_WEB_ORIGINS", strings.TrimSpace)
	setString(&doc.CookieDomain, "ELVISH_COOKIE_DOMAIN", strings.TrimSpace)
	if fillEmptyOnly {
		return changed
	}
	if envTruthy("ELVISH_DISABLE_REGISTRATION") {
		doc.RegistrationClosed = true
		changed = true
	}
	if strings.TrimSpace(os.Getenv("ELVISH_PAID_FEATURES")) == "true" {
		doc.PaidFeaturesEnabled = true
		changed = true
	}
	if envTruthy("ELVISH_TRUST_FORWARDED_FOR") {
		doc.TrustForwardedFor = true
		changed = true
	}
	if v := strings.TrimSpace(os.Getenv("ELVISH_CONTENT_CACHE_SEC")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			doc.ContentCacheSec = n
			changed = true
		}
	}
	if v := strings.TrimSpace(os.Getenv("ELVISH_SMTP_RATE_LIMIT_PER_HOUR")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			doc.SMTPRateLimitPerHour = n
			changed = true
		}
	}
	return changed
}

// Invalidate clears the in-process settings cache.
func (s *Service) Invalidate() {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cached = nil
	s.exp = time.Time{}
}

// Save persists doc and refreshes the cache.
func (s *Service) Save(ctx context.Context, doc *models.OperatorSettingsDoc) error {
	if s == nil || s.store == nil {
		return nil
	}
	if err := s.store.SetOperatorSettings(ctx, doc); err != nil {
		return err
	}
	snap := docToSettings(doc)
	s.mu.Lock()
	s.cached = snap
	s.exp = time.Now().Add(settingsCacheTTL)
	s.mu.Unlock()
	return nil
}

// Settings returns cached platform settings (defaults when store is nil).
func (s *Service) Settings(ctx context.Context) (*Settings, error) {
	if s == nil {
		return defaultSettings(), nil
	}
	s.mu.RLock()
	if s.cached != nil && time.Now().Before(s.exp) {
		out := *s.cached
		s.mu.RUnlock()
		return &out, nil
	}
	s.mu.RUnlock()

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cached != nil && time.Now().Before(s.exp) {
		out := *s.cached
		return &out, nil
	}
	if s.store == nil {
		s.cached = defaultSettings()
		s.exp = time.Now().Add(settingsCacheTTL)
		out := *s.cached
		return &out, nil
	}
	doc, err := s.store.GetOperatorSettings(ctx)
	if err != nil {
		return nil, err
	}
	s.cached = docToSettings(doc)
	s.exp = time.Now().Add(settingsCacheTTL)
	out := *s.cached
	return &out, nil
}

func defaultSettings() *Settings {
	doc := models.DefaultOperatorSettings()
	return docToSettings(doc)
}

func docToSettings(doc *models.OperatorSettingsDoc) *Settings {
	if doc == nil {
		return defaultSettings()
	}
	return &Settings{
		PublicBaseURL:        doc.PublicBaseURL,
		PlatformMailDomain:   doc.PlatformMailDomain,
		WebOrigins:           parseWebOrigins(doc.WebOrigins),
		CookieDomain:         doc.CookieDomain,
		RegistrationClosed:   doc.RegistrationClosed,
		PaidFeaturesEnabled:  doc.PaidFeaturesEnabled,
		TrustForwardedFor:    doc.TrustForwardedFor,
		ContentCacheSec:      doc.ContentCacheSec,
		SMTPRateLimitPerHour: int64(doc.SMTPRateLimitPerHour),
	}
}

// ParseWebOriginsList splits a comma-separated browser origin list.
func ParseWebOriginsList(raw string) []string {
	return parseWebOrigins(raw)
}

func parseWebOrigins(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var out []string
	for _, p := range strings.Split(raw, ",") {
		o := strings.TrimRight(strings.TrimSpace(p), "/")
		if o != "" {
			out = append(out, o)
		}
	}
	return out
}

func envTruthy(key string) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	return v == "1" || v == "true" || v == "yes"
}
