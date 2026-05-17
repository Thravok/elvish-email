package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"elvish/internal/mailmeta"
	"elvish/internal/store"
)

func (s *Server) apiAdminDomainsList(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}

	if s.mailmeta == nil {
		s.writeJSON(w, http.StatusOK, map[string]any{
			"domains":  []any{},
			"total":    0,
			"no_store": true,
		})
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	domains, total, err := s.mailmeta.ListAllDomains(r.Context(), offset, limit)
	if err != nil {
		s.writeErrAPIInternal(w, "list domains", err)
		return
	}

	s.writeJSON(w, http.StatusOK, map[string]any{
		"domains": domains,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

func (s *Server) apiAdminDomainsGet(w http.ResponseWriter, r *http.Request, domainName string) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}

	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail store required")
		return
	}

	domain, err := s.mailmeta.GetCustomDomainByName(r.Context(), domainName)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "domain not found")
			return
		}
		s.writeErrAPIInternal(w, "admin domain load", err)
		return
	}
	allowlist, err := s.mailmeta.ListDomainAllowlist(r.Context(), domain.Domain)
	if err != nil {
		s.writeErrAPIInternal(w, "domain allowlist", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"domain":                 domain.Domain,
		"owner_user_id":          domain.OwnerUserID.String(),
		"owner_email":            domain.OwnerEmail,
		"status":                 domain.Status,
		"mx_verified":            domain.MXVerified,
		"spf_verified":           domain.SPFVerified,
		"dkim_verified":          domain.DKIMVerified,
		"dmarc_verified":         domain.DMARCVerified,
		"verification_txt_host":  domain.VerificationTXTHost,
		"verification_txt_value": domain.VerificationTXTValue,
		"catchall_identity_fp":   domain.CatchallIdentityFP,
		"dkim_selector":          domain.DKIMSelector,
		"dkim_key_ref":           domain.DKIMKeyRef,
		"created_at":             domain.CreatedAt,
		"share_mode":             domain.ShareMode,
		"allowlist_count":        domain.AllowlistCount,
		"allowlist":              allowlist,
	})
}

type adminDomainAddBody struct {
	Domain     string `json:"domain"`
	OwnerEmail string `json:"owner_email"`
}

func (s *Server) apiAdminDomainsAdd(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.mailmeta == nil || s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail store required")
		return
	}
	var body adminDomainAddBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	domain, err := normalizeDNSDomain(body.Domain)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	ownerEmail := strings.TrimSpace(strings.ToLower(body.OwnerEmail))
	reserved, err := s.store.IsDeletedDomainReserved(r.Context(), domain)
	if err != nil {
		s.writeErrAPIInternal(w, "admin domain reservation check", err)
		return
	}
	if reserved {
		s.writeErr(w, http.StatusConflict, "domain is reserved after account deletion")
		return
	}
	if ownerEmail == "" {
		s.writeErr(w, http.StatusBadRequest, "owner_email required")
		return
	}
	owner, err := s.store.UserByEmail(r.Context(), ownerEmail)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "owner user not found")
			return
		}
		s.writeErrAPIInternal(w, "admin domain owner lookup", err)
		return
	}
	host := "_elvish-verify." + domain
	val := "elvish-domain-verify=" + randomTokenHex(16)
	if err := s.mailmeta.InsertOwnedDomain(r.Context(), owner.ID, domain, host, val); err != nil {
		if store.IsDuplicateKey(err) {
			s.writeErr(w, http.StatusConflict, "domain already registered")
			return
		}
		s.writeErrAPIInternal(w, "admin domain add", err)
		return
	}
	if err := s.ensureCustomDomainDKIM(r.Context(), owner.ID, domain); err != nil {
		_ = s.mailmeta.DeleteOwnedDomain(r.Context(), owner.ID, domain)
		s.writeErrAPIInternal(w, "admin domain dkim provision", err)
		return
	}
	s.writeJSON(w, http.StatusCreated, map[string]any{
		"domain":        domain,
		"owner_user_id": owner.ID,
		"owner_email":   owner.Email,
		"dns_config":    s.customDomainDNSConfig(r.Context(), domain, host, val),
	})
}

func (s *Server) apiAdminDomainsDelete(w http.ResponseWriter, r *http.Request, domainName string) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail store required")
		return
	}
	domain, err := s.mailmeta.GetCustomDomainByName(r.Context(), domainName)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "domain not found")
			return
		}
		s.writeErrAPIInternal(w, "admin domain load", err)
		return
	}
	if err := s.mailmeta.DeleteOwnedDomain(r.Context(), domain.OwnerUserID, domain.Domain); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "domain not found")
			return
		}
		s.writeErrAPIInternal(w, "admin domain delete", err)
		return
	}
	s.removeCustomDomainDKIMFiles(domain.Domain)
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) apiAdminDomainsVerify(w http.ResponseWriter, r *http.Request, domainName string) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail store required")
		return
	}
	row, err := s.mailmeta.GetCustomDomainByName(r.Context(), domainName)
	if err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "domain not found")
			return
		}
		s.writeErrAPIInternal(w, "admin domain load", err)
		return
	}
	if err := s.ensureCustomDomainDKIMForDomainName(r.Context(), row.Domain); err != nil {
		s.writeErrAPIInternal(w, "admin domain dkim provision", err)
		return
	}
	ownership := lookupTXTCheck(r.Context(), systemDNSResolver, row.VerificationTXTHost, row.VerificationTXTValue, func(v string) bool {
		return matchTXTExact([]string{v}, row.VerificationTXTValue)
	})
	delivery := s.deliveryChecksForDomain(r.Context(), row.Domain)
	status := "pending"
	if ownership.OK && delivery.Ready {
		status = "active"
	}
	if err := s.mailmeta.UpdateDomainVerification(r.Context(), row.OwnerUserID, row.Domain, delivery.MX.OK, delivery.SPF.OK, delivery.DKIM.OK, delivery.DMARC.OK, status); err != nil {
		s.writeErrAPIInternal(w, "admin domain verify save", err)
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

type adminDomainSharingBody struct {
	ShareMode        string   `json:"share_mode"`
	AllowlistUserIDs []string `json:"allowlist_user_ids"`
}

func (s *Server) apiAdminDomainsPatchSharing(w http.ResponseWriter, r *http.Request, domainName string) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.mailmeta == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail store required")
		return
	}
	domain, err := normalizeDNSDomain(domainName)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	var body adminDomainSharingBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	mode := strings.TrimSpace(strings.ToLower(body.ShareMode))
	if !mailmeta.ValidShareMode(mode) {
		s.writeErr(w, http.StatusBadRequest, "invalid share_mode")
		return
	}
	if mode == mailmeta.ShareModeAllowlist && len(body.AllowlistUserIDs) == 0 {
		s.writeErr(w, http.StatusBadRequest, "allowlist_user_ids required when share_mode is allowlist")
		return
	}
	ids := make([]uuid.UUID, 0, len(body.AllowlistUserIDs))
	for _, raw := range body.AllowlistUserIDs {
		id, err := uuid.Parse(strings.TrimSpace(raw))
		if err != nil {
			s.writeErr(w, http.StatusBadRequest, "invalid allowlist_user_ids entry")
			return
		}
		ids = append(ids, id)
	}
	if err := s.mailmeta.SetDomainShareMode(r.Context(), domain, mode); err != nil {
		if errors.Is(err, mailmeta.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "domain not found")
			return
		}
		s.writeErrAPIInternal(w, "domain share_mode", err)
		return
	}
	if mode != mailmeta.ShareModeAllowlist {
		ids = nil
	}
	if err := s.mailmeta.ReplaceDomainAllowlist(r.Context(), domain, ids); err != nil {
		s.writeErrAPIInternal(w, "domain allowlist", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{"ok": true, "share_mode": mode})
}

func (s *Server) handleAdminDomainsAPI(w http.ResponseWriter, r *http.Request, p string) {
	if p == "" {
		switch r.Method {
		case http.MethodGet:
			s.apiAdminDomainsList(w, r)
			return
		case http.MethodPost:
			s.apiAdminDomainsAdd(w, r)
			return
		default:
			http.NotFound(w, r)
			return
		}
	}
	if !strings.HasPrefix(p, "/") {
		http.NotFound(w, r)
		return
	}
	parts := strings.FieldsFunc(strings.TrimPrefix(p, "/"), func(c rune) bool { return c == '/' })
	if len(parts) == 0 {
		http.NotFound(w, r)
		return
	}
	domainName := strings.TrimSpace(strings.ToLower(parts[0]))
	if domainName == "" {
		http.NotFound(w, r)
		return
	}
	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			s.apiAdminDomainsGet(w, r, domainName)
			return
		case http.MethodDelete:
			s.apiAdminDomainsDelete(w, r, domainName)
			return
		default:
			http.NotFound(w, r)
			return
		}
	}
	if len(parts) == 2 && parts[1] == "sharing" && r.Method == http.MethodPatch {
		s.apiAdminDomainsPatchSharing(w, r, domainName)
		return
	}
	if len(parts) == 2 && parts[1] == "verify" && r.Method == http.MethodPost {
		s.apiAdminDomainsVerify(w, r, domainName)
		return
	}
	http.NotFound(w, r)
}
