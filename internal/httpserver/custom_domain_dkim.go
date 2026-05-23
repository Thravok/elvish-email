package httpserver

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"elvish/internal/dkim"
	"elvish/internal/models"
)

func customDomainDKIMKeyBasename(domain string) (string, error) {
	d, err := normalizeDNSDomain(domain)
	if err != nil {
		return "", err
	}
	base := d + ".pem"
	if filepath.Base(base) != base {
		return "", fmt.Errorf("invalid dkim key basename")
	}
	return base, nil
}

func (s *Server) customDomainDKIMDir() string {
	if s == nil || strings.TrimSpace(s.root) == "" {
		return ""
	}
	return filepath.Join(s.root, "data", "dkim", "domains")
}

// ensureCustomDomainDKIM generates a per-domain DKIM private key on disk when missing.
func (s *Server) ensureCustomDomainDKIM(ctx context.Context, userID uuid.UUID, domain string) error {
	if s == nil || s.mailmeta == nil {
		return fmt.Errorf("mail not configured")
	}
	dir := s.customDomainDKIMDir()
	if dir == "" {
		return fmt.Errorf("server root not set")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	if domain == "" {
		return fmt.Errorf("empty domain")
	}
	sel, ref, err := s.mailmeta.GetDomainDKIMByName(ctx, domain)
	if err != nil {
		return err
	}
	if ref != "" && sel != "" {
		return nil
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("dkim domains dir: %w", err)
	}
	base, err := customDomainDKIMKeyBasename(domain)
	if err != nil {
		return err
	}
	path := filepath.Join(dir, base)
	raw, err := dkim.GenerateRSAPrivatePEM(2048)
	if err != nil {
		return fmt.Errorf("dkim generate: %w", err)
	}
	if err := writeSecretFile(path, raw); err != nil {
		return fmt.Errorf("dkim write: %w", err)
	}
	selector := strings.TrimSpace(strings.ToLower(models.DefaultAdminDKIMSelector))
	if selector == "" {
		selector = "mail"
	}
	if err := s.mailmeta.SetOwnedDomainDKIM(ctx, userID, domain, selector, base); err != nil {
		_ = os.Remove(path)
		return err
	}
	return nil
}

func (s *Server) removeCustomDomainDKIMFiles(domain string) {
	dir := s.customDomainDKIMDir()
	if dir == "" {
		return
	}
	base, err := customDomainDKIMKeyBasename(domain)
	if err != nil {
		return
	}
	_ = os.Remove(filepath.Join(dir, base))
}

// dkimKeyStatusForDomain returns DKIM DNS guidance material for domain (custom mail_domains row or platform default).
func (s *Server) dkimKeyStatusForDomain(ctx context.Context, domain string) adminDKIMKeyStatus {
	domain = strings.TrimSpace(strings.ToLower(domain))
	out := adminDKIMKeyStatus{Domain: domain}
	if domain == "" {
		out.Error = "empty domain"
		return out
	}
	dir := s.customDomainDKIMDir()
	if s.mailmeta != nil && dir != "" {
		sel, ref, err := s.mailmeta.GetDomainDKIMByName(ctx, domain)
		if err == nil && ref != "" && sel != "" {
			wantBase, err := customDomainDKIMKeyBasename(domain)
			if err != nil {
				out.Error = err.Error()
				return out
			}
			safeRef := filepath.Base(ref)
			if safeRef != ref || safeRef != wantBase {
				out.Error = "invalid dkim key reference"
				return out
			}
			path := filepath.Join(dir, safeRef)
			out.Path = path
			out.Selector = sel
			out.Domain = domain
			raw, rerr := os.ReadFile(path)
			if rerr != nil {
				out.Error = rerr.Error()
				return out
			}
			signer, perr := dkim.NewRSASignerFromPEM(raw)
			if perr != nil {
				out.Error = perr.Error()
				return out
			}
			txt, terr := dkim.PublicKeyTXT(signer)
			if terr != nil {
				out.Error = terr.Error()
				return out
			}
			out.Present = true
			out.Configured = true
			out.PublicTXT = strings.TrimSpace(txt)
			if out.Selector != "" && out.Domain != "" {
				out.DNSName = out.Selector + "._domainkey." + out.Domain
			}
			return out
		}
	}
	if strings.EqualFold(domain, strings.TrimSpace(strings.ToLower(s.dkimDomain))) {
		return s.dkimKeyStatus()
	}
	out.Selector = strings.TrimSpace(strings.ToLower(models.DefaultAdminDKIMSelector))
	if out.Selector == "" {
		out.Selector = "mail"
	}
	out.Error = "per-domain DKIM not provisioned"
	return out
}

// ensureCustomDomainDKIMForDomainName provisions DKIM using the domain row owner (admin flows).
func (s *Server) ensureCustomDomainDKIMForDomainName(ctx context.Context, domain string) error {
	if s == nil || s.mailmeta == nil {
		return fmt.Errorf("mail not configured")
	}
	row, err := s.mailmeta.GetCustomDomainByName(ctx, domain)
	if err != nil {
		return err
	}
	return s.ensureCustomDomainDKIM(ctx, row.OwnerUserID, domain)
}
