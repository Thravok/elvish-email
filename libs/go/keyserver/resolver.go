package keyserver

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"elvish/libs/go/mailmeta"
)

// Resolver runs the configured chain of sources, with cache + local fallback.
type Resolver struct {
	Sources         []Source // in declared order
	Cache           *Cache   // optional persistent + negative cache
	Local           IdentityLookup
	Logger          *slog.Logger
	OpTimeout       time.Duration // per-source upper bound (default 6s)
	ProtonAutoBoost bool          // auto-promote proton source for proton domains
}

// DefaultChain returns a Resolver with the standard sources wired up.
func DefaultChain(local IdentityLookup, cache *Cache, lg *slog.Logger) *Resolver {
	return &Resolver{
		Sources: []Source{
			&WKDSource{},
			&ProtonSource{HKPFallback: &HKPSource{BaseURL: "https://keys.openpgp.org", Label: "hkps_keys_openpgp_org"}},
			&HKPSource{BaseURL: "https://keys.openpgp.org", Label: mailmeta.KeyserverSourceHKPSKeysOpenPGPOrg},
			&HKPSource{BaseURL: "https://keyserver.ubuntu.com", Label: mailmeta.KeyserverSourceHKPSKeyserverUbuntu},
		},
		Cache:           cache,
		Local:           local,
		Logger:          lg,
		OpTimeout:       6 * time.Second,
		ProtonAutoBoost: true,
	}
}

// Lookup runs the chain and returns the first hit, otherwise ErrNotFound.
func (r *Resolver) Lookup(ctx context.Context, email string) (*KeyHit, error) {
	if r == nil {
		return nil, errors.New("keyserver: nil resolver")
	}
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil, ErrNotFound
	}
	if r.Local != nil {
		row, err := r.Local.IdentityForEmail(ctx, email)
		if err == nil && row != nil {
			now := time.Now().UTC()
			return &KeyHit{
				Email:            email,
				Fingerprint:      row.Fingerprint,
				Armored:          row.ArmoredPublic,
				Source:           mailmeta.KeyserverSourceLocal,
				FetchedAt:        now,
				ExpiresAt:        now.Add(7 * 24 * time.Hour),
				VerifiedUIDMatch: true,
			}, nil
		}
	}
	if r.Cache != nil {
		if hit, err := r.Cache.Get(ctx, email); err == nil && hit != nil {
			return hit, nil
		} else if errors.Is(err, ErrCachedMiss) {
			return nil, ErrNotFound
		}
	}
	chain := r.Sources
	if r.ProtonAutoBoost {
		_, domain := SplitEmail(email)
		if IsProtonDomain(domain) {
			chain = promoteProton(chain)
		}
	}
	timeout := r.OpTimeout
	if timeout <= 0 {
		timeout = 6 * time.Second
	}
	for _, src := range chain {
		if src == nil {
			continue
		}
		opCtx, cancel := context.WithTimeout(ctx, timeout)
		hit, err := src.Lookup(opCtx, email)
		cancel()
		if err == nil && hit != nil {
			if r.Cache != nil {
				if cerr := r.Cache.Put(ctx, hit); cerr != nil && r.Logger != nil {
					r.Logger.Warn("keyserver cache put", "email", email, "err", cerr)
				}
			}
			return hit, nil
		}
		if r.Logger != nil && err != nil && !errors.Is(err, ErrNotFound) {
			r.Logger.Debug("keyserver source miss", "source", src.Name(), "email", email, "err", err)
		}
	}
	if r.Cache != nil {
		_ = r.Cache.PutMiss(ctx, email)
	}
	return nil, ErrNotFound
}

func promoteProton(sources []Source) []Source {
	out := make([]Source, 0, len(sources))
	var proton Source
	for _, s := range sources {
		if s == nil {
			continue
		}
		if _, ok := s.(*ProtonSource); ok && proton == nil {
			proton = s
			continue
		}
		out = append(out, s)
	}
	if proton != nil {
		return append([]Source{proton}, out...)
	}
	return out
}
