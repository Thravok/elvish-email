package keyserver

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// HKPSource implements a generic HKP/HKPS lookup against a base URL like https://keys.openpgp.org.
type HKPSource struct {
	BaseURL string
	Label   string // canonical name used in cache rows (e.g. hkps_keys_openpgp_org)
	HTTP    *http.Client
}

// Name returns the source label.
func (s *HKPSource) Name() string {
	if s == nil {
		return ""
	}
	return s.Label
}

// Lookup queries /pks/lookup?op=get&options=mr&search=<email> and returns the first key.
func (s *HKPSource) Lookup(ctx context.Context, email string) (*KeyHit, error) {
	if s == nil || s.BaseURL == "" {
		return nil, ErrNotFound
	}
	q := url.Values{}
	q.Set("op", "get")
	q.Set("options", "mr")
	q.Set("search", strings.ToLower(strings.TrimSpace(email)))
	u := strings.TrimRight(s.BaseURL, "/") + "/pks/lookup?" + q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/pgp-keys")
	hc := s.HTTP
	if hc == nil {
		hc = &http.Client{Timeout: 6 * time.Second}
	}
	resp, err := hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("hkp %s: status %d", s.Label, resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	armored, err := normalizeToArmored(body)
	if err != nil {
		return nil, err
	}
	return buildHit(email, s.Label, armored)
}
