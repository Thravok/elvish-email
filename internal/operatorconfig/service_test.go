package operatorconfig

import (
	"testing"
	"time"

	"elvish/internal/models"
)

func TestApplyEnvBootstrap_BackfillsEmptyFieldsOnly(t *testing.T) {
	t.Setenv("ELVISH_PUBLIC_BASE_URL", "https://env.example/")
	t.Setenv("ELVISH_MAIL_DOMAIN", "MAIL.EXAMPLE")
	t.Setenv("ELVISH_WEB_ORIGINS", "https://web.example")
	t.Setenv("ELVISH_COOKIE_DOMAIN", ".example")
	t.Setenv("ELVISH_DISABLE_REGISTRATION", "1")
	t.Setenv("ELVISH_PAID_FEATURES", "true")
	t.Setenv("ELVISH_TRUST_FORWARDED_FOR", "1")

	doc := models.DefaultOperatorSettings()
	doc.UpdatedAt = time.Now()
	doc.PublicBaseURL = "https://configured.example"

	if !applyEnvBootstrap(doc, true) {
		t.Fatal("expected empty settings to be backfilled")
	}
	if got, want := doc.PublicBaseURL, "https://configured.example"; got != want {
		t.Fatalf("PublicBaseURL = %q, want %q", got, want)
	}
	if got, want := doc.PlatformMailDomain, "mail.example"; got != want {
		t.Fatalf("PlatformMailDomain = %q, want %q", got, want)
	}
	if got, want := doc.WebOrigins, "https://web.example"; got != want {
		t.Fatalf("WebOrigins = %q, want %q", got, want)
	}
	if got, want := doc.CookieDomain, ".example"; got != want {
		t.Fatalf("CookieDomain = %q, want %q", got, want)
	}
	if doc.RegistrationClosed || doc.PaidFeaturesEnabled || doc.TrustForwardedFor {
		t.Fatal("fill-empty bootstrap should not override boolean settings after initial migration")
	}
}

func TestApplyEnvBootstrap_FirstBootImportsLegacyEnv(t *testing.T) {
	t.Setenv("ELVISH_PUBLIC_BASE_URL", "https://env.example/")
	t.Setenv("ELVISH_MAIL_DOMAIN", "MAIL.EXAMPLE")
	t.Setenv("ELVISH_DISABLE_REGISTRATION", "1")
	t.Setenv("ELVISH_PAID_FEATURES", "true")
	t.Setenv("ELVISH_TRUST_FORWARDED_FOR", "1")
	t.Setenv("ELVISH_CONTENT_CACHE_SEC", "42")
	t.Setenv("ELVISH_SMTP_RATE_LIMIT_PER_HOUR", "123")

	doc := models.DefaultOperatorSettings()

	if !applyEnvBootstrap(doc, false) {
		t.Fatal("expected first boot settings to be imported")
	}
	if got, want := doc.PublicBaseURL, "https://env.example"; got != want {
		t.Fatalf("PublicBaseURL = %q, want %q", got, want)
	}
	if got, want := doc.PlatformMailDomain, "mail.example"; got != want {
		t.Fatalf("PlatformMailDomain = %q, want %q", got, want)
	}
	if !doc.RegistrationClosed || !doc.PaidFeaturesEnabled || !doc.TrustForwardedFor {
		t.Fatal("expected first boot boolean settings to be imported")
	}
	if got, want := doc.ContentCacheSec, 42; got != want {
		t.Fatalf("ContentCacheSec = %d, want %d", got, want)
	}
	if got, want := doc.SMTPRateLimitPerHour, 123; got != want {
		t.Fatalf("SMTPRateLimitPerHour = %d, want %d", got, want)
	}
}
