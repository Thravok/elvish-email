package keyserver

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
)

// ProtonSource hits Proton's key API and HKP endpoint, returning a verified key with KT state.
//
// Proton ships keys via:
//   - api.protonmail.ch/keys?Email=...   (JSON; address keys including KT proof)
//   - keys.openpgp.org HKP fallback (handled by HKPSource if Proton fails)
//
// We mark VerifiedAddressKeys=true when the API responds with at least one Key.PublicKey for the email.
// Full Key Transparency verification is a stub today (ProtonKTState=unverified).
type ProtonSource struct {
	HTTP        *http.Client
	BaseURL     string // default https://api.protonmail.ch
	HKPFallback *HKPSource
}

// Name returns the source label.
func (p *ProtonSource) Name() string { return "proton" }

// IsProtonDomain reports whether the address belongs to a Proton-managed mail domain.
func IsProtonDomain(domain string) bool {
	switch strings.ToLower(strings.TrimSpace(domain)) {
	case "proton.me", "protonmail.com", "protonmail.ch", "pm.me":
		return true
	}
	return false
}

// Lookup queries the Proton API and falls back to HKP if available.
func (p *ProtonSource) Lookup(ctx context.Context, email string) (*KeyHit, error) {
	base := p.BaseURL
	if base == "" {
		base = "https://api.protonmail.ch"
	}
	q := url.Values{}
	q.Set("Email", strings.ToLower(strings.TrimSpace(email)))
	u := strings.TrimRight(base, "/") + "/keys?" + q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Pm-Appversion", "Other")
	hc := p.HTTP
	if hc == nil {
		hc = &http.Client{Timeout: 6 * time.Second}
	}
	resp, err := hc.Do(req)
	if err == nil && resp != nil {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			if hit := parseProtonResponse(email, body); hit != nil {
				return hit, nil
			}
		}
	}
	if p.HKPFallback != nil {
		hit, err := p.HKPFallback.Lookup(ctx, email)
		if err == nil && hit != nil {
			hit.Source = "proton"
			hit.ProtonKTState = "fallback_hkp"
			return hit, nil
		}
	}
	return nil, ErrNotFound
}

type protonKeyEntry struct {
	PublicKey string `json:"PublicKey"`
	Flags     int    `json:"Flags"`
}

type protonAddressKey struct {
	Email string           `json:"Email"`
	Keys  []protonKeyEntry `json:"Keys"`
}

type protonResponse struct {
	Code      int                `json:"Code"`
	Address   *protonAddressKey  `json:"Address"`
	Addresses []protonAddressKey `json:"Addresses"`
	Keys      []protonKeyEntry   `json:"Keys"`
}

func parseProtonResponse(email string, body []byte) *KeyHit {
	var r protonResponse
	if err := json.Unmarshal(body, &r); err != nil {
		return nil
	}
	candidates := r.Keys
	if r.Address != nil {
		candidates = append(candidates, r.Address.Keys...)
	}
	for _, ak := range r.Addresses {
		candidates = append(candidates, ak.Keys...)
	}
	for _, k := range candidates {
		if strings.TrimSpace(k.PublicKey) == "" {
			continue
		}
		armored, err := normalizeProtonKey(k.PublicKey)
		if err != nil {
			continue
		}
		hit, err := buildHit(email, "proton", armored)
		if err != nil {
			continue
		}
		hit.AddressKeysVerified = true
		hit.ProtonKTState = "unverified" // KT proof check is a stub for v1
		return hit
	}
	return nil
}

func normalizeProtonKey(s string) (string, error) {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "-----BEGIN PGP PUBLIC KEY BLOCK-----") {
		return s, nil
	}
	// Proton sometimes returns base64 of binary key.
	if !strings.Contains(s, "BEGIN PGP") {
		raw, err := base64.StdEncoding.DecodeString(s)
		if err != nil {
			return "", fmt.Errorf("proton key: %w", err)
		}
		return reArmor(raw)
	}
	return s, nil
}

func reArmor(raw []byte) (string, error) {
	el, err := pgpcrypto.ReadKeyRing(bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	if len(el) == 0 {
		return "", fmt.Errorf("empty keyring")
	}
	var buf bytes.Buffer
	w, err := armor.Encode(&buf, "PGP PUBLIC KEY BLOCK", nil)
	if err != nil {
		return "", err
	}
	if err := el[0].Serialize(w); err != nil {
		return "", err
	}
	_ = w.Close()
	return buf.String(), nil
}

// _ keeps time import alive in case future expansion uses it for KT proofs.
var _ = time.Time{}
