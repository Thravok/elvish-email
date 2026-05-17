package uptime

import "testing"

func TestValidateProbeHTTPURL(t *testing.T) {
	t.Parallel()
	good := []string{
		"https://example.com/",
		"http://127.0.0.1:8765/health",
		"http://10.0.0.1/status",
	}
	for _, u := range good {
		if err := ValidateProbeHTTPURL(u); err != nil {
			t.Errorf("good %q: %v", u, err)
		}
	}
	bad := []struct {
		raw string
	}{
		{""},
		{"ftp://example.com/"},
		{"https://metadata.google.internal/latest/meta-data"},
		{"http://169.254.169.254/latest/meta-data"},
		{"http://[::ffff:169.254.169.254]/"},
	}
	for _, tc := range bad {
		if err := ValidateProbeHTTPURL(tc.raw); err == nil {
			t.Errorf("expected error for %q", tc.raw)
		}
	}
}
