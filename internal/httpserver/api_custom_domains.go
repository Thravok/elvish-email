package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"elvish/internal/mailmeta"
	"elvish/internal/store"
)

// handleCustomDomainsAPI dispatches /api/v1/custom-domains.
func (s *Server) handleCustomDomainsAPI(w http.ResponseWriter, r *http.Request, p string) {
	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem not configured")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if !s.paidFeaturesEnabled(r.Context(), u) {
		s.writeErr(w, http.StatusPaymentRequired, "paid subscription required")
		return
	}
	if !s.rateLimitMailUser(w, r, u.ID.String()) {
		return
	}
	rest := strings.TrimPrefix(p, "v1/custom-domains")
	rest = strings.TrimPrefix(rest, "/")
	parts := strings.FieldsFunc(rest, func(c rune) bool { return c == '/' })

	if len(parts) == 0 {
		switch r.Method {
		case http.MethodGet:
			s.apiCustomDomainsList(w, r, u.ID)
			return
		case http.MethodPost:
			s.apiCustomDomainsAdd(w, r, u.ID)
			return
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
	}

	if len(parts) == 1 {
		if r.Method != http.MethodDelete {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		domain, err := normalizeDNSDomain(parts[0])
		if err != nil {
			s.writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		s.apiCustomDomainsDelete(w, r, u.ID, domain)
		return
	}

	if len(parts) == 2 {
		domain, err := normalizeDNSDomain(parts[0])
		if err != nil {
			s.writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		switch parts[1] {
		case "verify":
			if r.Method != http.MethodPost {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			s.apiCustomDomainsVerify(w, r, u.ID, domain)
			return
		case "catchall":
			if r.Method != http.MethodPut {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			s.apiCustomDomainsCatchall(w, r, u.ID, domain)
			return
		}
	}

	http.NotFound(w, r)
}

func (s *Server) apiCustomDomainsList(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	list, err := s.mailmeta.ListOwnedDomains(r.Context(), userID)
	if err != nil {
		s.writeErrAPIInternal(w, "domains list", err)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, d := range list {
		out = append(out, map[string]any{
			"domain":                 d.Domain,
			"status":                 d.Status,
			"mx_verified":            d.MXVerified,
			"spf_verified":           d.SPFVerified,
			"dkim_verified":          d.DKIMVerified,
			"dmarc_verified":         d.DMARCVerified,
			"verification_txt_host":  d.VerificationTXTHost,
			"verification_txt_value": d.VerificationTXTValue,
			"dns_config":             s.customDomainDNSConfig(r.Context(), d.Domain, d.VerificationTXTHost, d.VerificationTXTValue),
			"catchall_identity_fp":   d.CatchallIdentityFP,
			"dkim_selector":          d.DKIMSelector,
			"dkim_key_ref":           d.DKIMKeyRef,
			"created_at":             d.CreatedAt,
		})
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"domains": out})
}

type customDomainAddBody struct {
	Domain string `json:"domain"`
}

func randomTokenHex(nBytes int) string {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

func (s *Server) apiCustomDomainsAdd(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var body customDomainAddBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	domain, err := normalizeDNSDomain(body.Domain)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	reserved, err := s.store.IsDeletedDomainReserved(r.Context(), domain)
	if err != nil {
		s.writeErrAPIInternal(w, "domain reservation check", err)
		return
	}
	if reserved {
		s.writeErr(w, http.StatusConflict, "domain is reserved after account deletion")
		return
	}
	token := randomTokenHex(16)
	host := "_elvish-verify." + domain
	val := "elvish-domain-verify=" + token
	if err := s.mailmeta.InsertOwnedDomain(r.Context(), userID, domain, host, val); err != nil {
		if store.IsDuplicateKey(err) {
			s.writeErr(w, http.StatusConflict, "domain already registered")
			return
		}
		s.writeErrAPIInternal(w, "domain add", err)
		return
	}
	if err := s.ensureCustomDomainDKIM(r.Context(), userID, domain); err != nil {
		_ = s.mailmeta.DeleteOwnedDomain(r.Context(), userID, domain)
		s.writeErrAPIInternal(w, "domain dkim provision", err)
		return
	}
	s.writeJSON(w, http.StatusCreated, map[string]any{
		"domain":     domain,
		"dns_config": s.customDomainDNSConfig(r.Context(), domain, host, val),
	})
}

func (s *Server) apiCustomDomainsDelete(w http.ResponseWriter, r *http.Request, userID uuid.UUID, domain string) {
	if err := s.mailmeta.DeleteOwnedDomain(r.Context(), userID, domain); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "domain not found")
			return
		}
		s.writeErrAPIInternal(w, "domain delete", err)
		return
	}
	s.removeCustomDomainDKIMFiles(domain)
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) apiCustomDomainsVerify(w http.ResponseWriter, r *http.Request, userID uuid.UUID, domain string) {
	ctx := r.Context()
	list, err := s.mailmeta.ListOwnedDomains(ctx, userID)
	if err != nil {
		s.writeErrAPIInternal(w, "domains list", err)
		return
	}
	var row *mailmeta.OwnedDomain
	for i := range list {
		if list[i].Domain == domain {
			row = &list[i]
			break
		}
	}
	if row == nil {
		s.writeErr(w, http.StatusNotFound, "domain not found")
		return
	}
	if err := s.ensureCustomDomainDKIM(ctx, userID, domain); err != nil {
		s.writeErrAPIInternal(w, "domain dkim provision", err)
		return
	}
	ownership := lookupTXTCheck(ctx, systemDNSResolver, row.VerificationTXTHost, row.VerificationTXTValue, func(v string) bool {
		return matchTXTExact([]string{v}, row.VerificationTXTValue)
	})
	delivery := s.deliveryChecksForDomain(ctx, domain)
	status := "pending"
	if ownership.OK && delivery.Ready {
		status = "active"
	}
	if err := s.mailmeta.UpdateDomainVerification(ctx, userID, domain, delivery.MX.OK, delivery.SPF.OK, delivery.DKIM.OK, delivery.DMARC.OK, status); err != nil {
		s.writeErrAPIInternal(w, "domain verify save", err)
		return
	}
	issues := append([]string{}, delivery.Issues...)
	if !ownership.OK {
		issues = append([]string{issueText("ownership", ownership)}, issues...)
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"status":             status,
		"ownership_verified": ownership.OK,
		"mx_verified":        delivery.MX.OK,
		"spf_verified":       delivery.SPF.OK,
		"dkim_verified":      delivery.DKIM.OK,
		"dmarc_verified":     delivery.DMARC.OK,
		"ready":              ownership.OK && delivery.Ready,
		"issues":             issues,
		"checks": map[string]any{
			"ownership": ownership,
			"mx":        delivery.MX,
			"spf":       delivery.SPF,
			"dkim":      delivery.DKIM,
			"dmarc":     delivery.DMARC,
		},
	})
}

type catchallBody struct {
	IdentityFingerprint *string `json:"identity_fingerprint"`
}

func (s *Server) apiCustomDomainsCatchall(w http.ResponseWriter, r *http.Request, userID uuid.UUID, domain string) {
	var body catchallBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	fp := ""
	if body.IdentityFingerprint != nil {
		raw := strings.TrimSpace(*body.IdentityFingerprint)
		if raw != "" {
			var err error
			fp, err = s.resolveIdentitySelector(r.Context(), userID, raw)
			if err != nil {
				if errors.Is(err, mailmeta.ErrNotFound) {
					s.writeErr(w, http.StatusNotFound, "identity not found")
					return
				}
				s.writeErrAPIInternal(w, "catchall identity resolve", err)
				return
			}
			identity, err := s.mailmeta.IdentityByFingerprint(r.Context(), userID, fp)
			if err != nil {
				if errors.Is(err, mailmeta.ErrNotFound) {
					s.writeErr(w, http.StatusNotFound, "identity not found")
					return
				}
				s.writeErrAPIInternal(w, "catchall identity lookup", err)
				return
			}
			if !identity.IsActive {
				s.writeErr(w, http.StatusBadRequest, "identity must be active for catch-all delivery")
				return
			}
		}
	}
	if err := s.mailmeta.SetDomainCatchall(r.Context(), userID, domain, fp); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "domain not found")
			return
		}
		s.writeErrAPIInternal(w, "catchall", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) customDomainDNSConfig(ctx context.Context, domain, verificationHost, verificationValue string) map[string]any {
	mxTarget := strings.TrimSpace(s.smtpHostname)
	if mxTarget == "" {
		mxTarget = strings.TrimSpace(s.EffectiveMailDomain())
	}
	config := map[string]any{
		"verification_txt": map[string]string{
			"type":  "TXT",
			"host":  verificationHost,
			"value": verificationValue,
			"ttl":   "Auto",
		},
		"spf": map[string]string{
			"type":  "TXT",
			"host":  domain,
			"value": "v=spf1 mx -all",
			"ttl":   "Auto",
			"hint":  "publish an SPF TXT record for this domain before expecting outbound checks to pass",
		},
		"dmarc": map[string]string{
			"type":  "TXT",
			"host":  "_dmarc." + domain,
			"value": fmt.Sprintf("v=DMARC1; p=none; rua=mailto:dmarc@%s; adkim=s; aspf=s", domain),
			"ttl":   "Auto",
			"hint":  "publish a DMARC TXT record for this domain",
		},
	}
	mxConfig := map[string]string{
		"type":  "MX",
		"host":  domain,
		"ttl":   "Auto",
		"extra": "Priority 10",
		"hint":  "publish an MX record for this domain that points at your Elvish mail ingress",
	}
	if mxTarget != "" {
		mxConfig["value"] = mxTarget
	}
	config["mx"] = mxConfig

	dkimStatus := s.dkimKeyStatusForDomain(ctx, domain)
	selector := strings.TrimSpace(strings.ToLower(dkimStatus.Selector))
	dkimHost := "_domainkey." + domain
	if selector != "" {
		dkimHost = selector + "._domainkey." + domain
	}
	dkimConfig := map[string]string{
		"type": "TXT",
		"host": dkimHost,
		"ttl":  "Auto",
	}
	switch {
	case selector == "":
		dkimConfig["hint"] = "configure a DKIM selector before verifying DKIM"
	case strings.TrimSpace(dkimStatus.PublicTXT) != "":
		dkimConfig["value"] = strings.TrimSpace(dkimStatus.PublicTXT)
	default:
		if strings.TrimSpace(dkimStatus.Error) != "" {
			dkimConfig["hint"] = strings.TrimSpace(dkimStatus.Error)
		} else {
			dkimConfig["hint"] = "DKIM key not ready; retry after the server provisions a key for this domain"
		}
	}
	config["dkim"] = dkimConfig
	return config
}
