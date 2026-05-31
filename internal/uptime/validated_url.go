package uptime

import (
	"context"
	"net/http"
	"strings"
)

// ValidatedProbeURL is a probe target URL that has passed ValidateProbeHTTPURL.
type ValidatedProbeURL string

// String returns the URL string for use with http.NewRequest.
func (u ValidatedProbeURL) String() string { return string(u) }

// NewValidatedProbeURL returns u only if raw passes ValidateProbeHTTPURL.
func NewValidatedProbeURL(raw string) (ValidatedProbeURL, error) {
	raw = strings.TrimSpace(raw)
	if err := ValidateProbeHTTPURL(raw); err != nil {
		return "", err
	}
	return ValidatedProbeURL(raw), nil
}

// NewProbeHTTPRequest builds an HTTP request for a validated uptime probe target.
func NewProbeHTTPRequest(ctx context.Context, method string, validated ValidatedProbeURL) (*http.Request, error) {
	return http.NewRequestWithContext(ctx, method, validated.String(), nil) //codeql[go/request-forgery]: URL validated by ValidateProbeHTTPURL via NewValidatedProbeURL.
}
