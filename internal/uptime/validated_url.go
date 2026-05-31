package uptime

import "strings"

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
