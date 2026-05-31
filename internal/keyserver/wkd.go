package keyserver

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"

	vopenpgp "elvish/internal/openpgp"
)

// WKDSource implements both advanced and direct WKD methods.
type WKDSource struct {
	HTTP      *http.Client
	UseDirect bool // when true, skips advanced and only tries direct (used by tests)
}

// Name returns the canonical source name (advanced wins by default).
func (s *WKDSource) Name() string {
	if s.UseDirect {
		return "wkd_direct"
	}
	return "wkd_advanced"
}

// Lookup performs the advanced + direct WKD URL fetch, returning the first armored key found.
func (s *WKDSource) Lookup(ctx context.Context, email string) (*KeyHit, error) {
	local, domain := SplitEmail(email)
	if local == "" || domain == "" {
		return nil, ErrNotFound
	}
	hash := vopenpgp.WKDLocalPartHash(local)
	urls := []struct {
		u   string
		src string
	}{
		{
			u:   fmt.Sprintf("https://openpgpkey.%s/.well-known/openpgpkey/%s/hu/%s?l=%s", domain, domain, hash, local),
			src: "wkd_advanced",
		},
		{
			u:   fmt.Sprintf("https://%s/.well-known/openpgpkey/hu/%s?l=%s", domain, hash, local),
			src: "wkd_direct",
		},
	}
	if s.UseDirect {
		urls = urls[1:]
	}
	hc := s.HTTP
	if hc == nil {
		hc = &http.Client{Timeout: 6 * time.Second}
	}
	for _, candidate := range urls {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, candidate.u, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Accept", "application/octet-stream, application/pgp-keys")
		resp, err := hc.Do(req)
		if err != nil {
			continue
		}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusOK || len(body) == 0 {
			continue
		}
		armored, err := normalizeToArmored(body)
		if err != nil {
			continue
		}
		hit, err := buildHit(email, candidate.src, armored)
		if err != nil {
			continue
		}
		return hit, nil
	}
	return nil, ErrNotFound
}

// normalizeToArmored returns an armored PUBLIC KEY BLOCK regardless of input format (binary or armored).
func normalizeToArmored(b []byte) (string, error) {
	trim := bytes.TrimSpace(b)
	if bytes.HasPrefix(trim, []byte("-----BEGIN PGP PUBLIC KEY BLOCK-----")) {
		return string(trim), nil
	}
	// Treat as binary keyring; re-armor.
	el, err := pgpcrypto.ReadKeyRing(bytes.NewReader(b))
	if err != nil {
		return "", fmt.Errorf("read keyring: %w", err)
	}
	if len(el) == 0 {
		return "", errors.New("empty keyring")
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

func buildHit(email, source, armored string) (*KeyHit, error) {
	d, err := vopenpgp.ParseKeyDetail(armored)
	if err != nil {
		return nil, err
	}
	if err := vopenpgp.ValidateForEncryption(d); err != nil {
		return nil, err
	}
	emailLow := strings.ToLower(strings.TrimSpace(email))
	verified := false
	for _, e := range d.Emails {
		if e == emailLow {
			verified = true
			break
		}
	}
	now := time.Now().UTC()
	return &KeyHit{
		Email:            emailLow,
		Fingerprint:      d.Fingerprint,
		Armored:          armored,
		Source:           source,
		FetchedAt:        now,
		ExpiresAt:        now.Add(24 * time.Hour),
		VerifiedUIDMatch: verified,
	}, nil
}
