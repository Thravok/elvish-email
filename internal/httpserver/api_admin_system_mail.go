package httpserver

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/mailmeta"
	"elvish/internal/models"
	"elvish/internal/store"
)

const (
	adminSystemPreviewPerHour = int64(60)
	adminSystemSendPerHour    = int64(12)
	adminSystemWindow         = time.Hour
	adminSystemMaxRecipients  = 5000
)

type adminSystemMailBody struct {
	AudienceKind string   `json:"audience_kind"`
	UserIDs      []string `json:"user_ids"`
	FromAddr     string   `json:"from_addr"`
	Subject      string   `json:"subject"`
	BodyText     string   `json:"body_text"`
}

type adminRecipientPreview struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type adminSenderDomainOption struct {
	Domain    string `json:"domain"`
	Verified  bool   `json:"verified"`
	Source    string `json:"source"`
	IsDefault bool   `json:"is_default"`
}

func (s *Server) handleAdminSystemMailAPI(w http.ResponseWriter, r *http.Request, p string) {
	switch {
	case p == "" && r.Method == http.MethodGet:
		s.apiAdminSystemMailConfig(w, r)
	case p == "/preview" && r.Method == http.MethodPost:
		s.apiAdminSystemMailPreview(w, r)
	case p == "/send" && r.Method == http.MethodPost:
		s.apiAdminSystemMailSend(w, r)
	case p == "/runs" && r.Method == http.MethodGet:
		s.apiAdminSystemMailRuns(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) apiAdminSystemMailConfig(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	domains, err := s.adminSenderDomainOptions(r.Context())
	if err != nil {
		s.writeErrAPIInternal(w, "admin system mail config domains", err)
		return
	}
	activeUsers := int64(0)
	if s.store != nil {
		users, err := s.store.ListActiveUsers(r.Context(), 0)
		if err != nil {
			s.writeErrAPIInternal(w, "admin system mail config users", err)
			return
		}
		activeUsers = int64(len(users))
	}
	delivery := s.deliveryChecksForDomain(r.Context(), s.adminDeliveryCheckDomain(r.Context()))
	s.writeJSON(w, http.StatusOK, map[string]any{
		"relay_enabled":     s.relayKey != nil,
		"sender_domains":    domains,
		"default_from_addr": s.defaultAdminFromAddr(domains),
		"active_user_count": activeUsers,
		"admin_email":       admin.Email,
		"delivery":          delivery,
	})
}

func (s *Server) apiAdminSystemMailPreview(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_system_preview", admin.ID.String(), adminSystemPreviewPerHour, adminSystemWindow) {
		return
	}
	body, recipients, domains, err := s.decodeAndValidateAdminSystemMail(r.Context(), r)
	if err != nil {
		s.handleAdminSystemMailErr(w, err)
		return
	}
	s.writeJSON(w, http.StatusOK, s.buildAdminSystemMailPreview(body, recipients, domains))
}

func (s *Server) apiAdminSystemMailSend(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_system_send", admin.ID.String(), adminSystemSendPerHour, adminSystemWindow) {
		return
	}
	body, recipients, domains, err := s.decodeAndValidateAdminSystemMail(r.Context(), r)
	if err != nil {
		s.handleAdminSystemMailErr(w, err)
		return
	}
	if s.mailmeta == nil || s.blob == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "mail subsystem not configured")
		return
	}
	sum := sha256.Sum256([]byte(body.BodyText))
	runID, err := s.mailmeta.InsertAdminMailRun(r.Context(), mailmeta.AdminMailRunInput{
		AdminUserID:     admin.ID,
		AudienceKind:    body.AudienceKind,
		SendMode:        adminTestSendModePlaintext,
		SenderAddr:      body.FromAddr,
		Subject:         body.Subject,
		BodySHA256:      hex.EncodeToString(sum[:]),
		AttachmentCount: 0,
		AttachmentBytes: 0,
		RecipientCount:  len(recipients),
	})
	if err != nil {
		s.writeErrAPIInternal(w, "admin system mail run insert", err)
		return
	}
	dispatched := 0
	queuedExternal := 0
	deliveredLocal := 0
	failures := make([]string, 0)
	for _, recipient := range recipients {
		res, err := s.submitPlaintextOutboxWithContext(r.Context(), admin.ID, outboxPlainBody{
			FromAddr: body.FromAddr,
			ToAddrs:  []string{recipient.Email},
			Subject:  body.Subject,
			BodyText: body.BodyText,
		}, outboxSubmitOpts{
			Source:     "admin_system",
			AdminRunID: runID,
		})
		if err != nil {
			if len(failures) < 10 {
				failures = append(failures, recipient.Email+": "+err.Error())
			}
			continue
		}
		dispatched++
		queuedExternal += len(res.OutboxIDs)
		deliveredLocal += len(res.LocalMessageIDs)
	}
	if err := s.mailmeta.UpdateAdminMailRunQueuedCount(r.Context(), runID, dispatched); err != nil {
		s.writeErrAPIInternal(w, "admin system mail run update", err)
		return
	}
	status := http.StatusAccepted
	if dispatched == 0 {
		status = http.StatusServiceUnavailable
	}
	s.writeJSON(w, status, map[string]any{
		"ok":                    dispatched > 0,
		"run_id":                runID.String(),
		"queued_count":          dispatched,
		"queued_external_count": queuedExternal,
		"delivered_local_count": deliveredLocal,
		"failed_count":          len(recipients) - dispatched,
		"sender_domains":        domains,
		"errors":                failures,
	})
}

func (s *Server) apiAdminSystemMailRuns(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	if s.mailmeta == nil {
		s.writeJSON(w, http.StatusOK, map[string]any{
			"items": []any{},
			"total": 0,
		})
		return
	}
	runs, total, err := s.mailmeta.ListAdminMailRuns(r.Context(), 0, 40)
	if err != nil {
		s.writeErrAPIInternal(w, "admin system mail runs", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"items": runs,
		"total": total,
	})
}

func (s *Server) decodeAndValidateAdminSystemMail(ctx context.Context, r *http.Request) (*adminSystemMailBody, []models.User, []adminSenderDomainOption, error) {
	if s.store == nil {
		return nil, nil, nil, adminSystemErr(http.StatusServiceUnavailable, "database required")
	}
	var body adminSystemMailBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "invalid json")
	}
	body.AudienceKind = strings.ToLower(strings.TrimSpace(body.AudienceKind))
	body.FromAddr = strings.ToLower(strings.TrimSpace(body.FromAddr))
	body.Subject = strings.TrimSpace(body.Subject)
	body.BodyText = strings.TrimSpace(body.BodyText)
	if body.AudienceKind == "" {
		body.AudienceKind = "selected"
	}
	if body.FromAddr == "" {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "from_addr required")
	}
	if body.Subject == "" {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "subject required")
	}
	if body.BodyText == "" {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "body_text required")
	}
	if len(body.Subject) > 200 {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "subject too long")
	}
	if len(body.BodyText) > 64<<10 {
		return nil, nil, nil, adminSystemErr(http.StatusBadRequest, "body_text too long")
	}
	domains, err := s.adminSenderDomainOptions(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	if err := validateAdminFromAddr(body.FromAddr, domains); err != nil {
		return nil, nil, nil, err
	}
	recipients, err := s.resolveAdminSystemRecipients(ctx, body.AudienceKind, body.UserIDs)
	if err != nil {
		return nil, nil, nil, err
	}
	return &body, recipients, domains, nil
}

func (s *Server) resolveAdminSystemRecipients(ctx context.Context, audienceKind string, userIDStrings []string) ([]models.User, error) {
	if s.store == nil {
		return nil, adminSystemErr(http.StatusServiceUnavailable, "database required")
	}
	switch audienceKind {
	case "selected":
		ids := make([]uuid.UUID, 0, len(userIDStrings))
		seen := make(map[uuid.UUID]struct{}, len(userIDStrings))
		for _, raw := range userIDStrings {
			id, err := uuid.Parse(strings.TrimSpace(raw))
			if err != nil {
				return nil, adminSystemErr(http.StatusBadRequest, "invalid user id")
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
		if len(ids) == 0 {
			return nil, adminSystemErr(http.StatusBadRequest, "at least one user id is required")
		}
		users, err := s.store.UsersByIDs(ctx, ids)
		if err != nil {
			return nil, err
		}
		active := filterActiveUsers(users)
		if len(active) == 0 {
			return nil, adminSystemErr(http.StatusBadRequest, "no active recipients matched the selected user ids")
		}
		return active, nil
	case "all_active", "all-users", "all_users":
		users, err := s.store.ListActiveUsers(ctx, 0)
		if err != nil {
			return nil, err
		}
		if len(users) == 0 {
			return nil, adminSystemErr(http.StatusBadRequest, "no active users found")
		}
		if len(users) > adminSystemMaxRecipients {
			return nil, adminSystemErr(http.StatusBadRequest, "too many recipients for one admin send")
		}
		return users, nil
	default:
		return nil, adminSystemErr(http.StatusBadRequest, "audience_kind must be selected or all_active")
	}
}

func filterActiveUsers(users []models.User) []models.User {
	out := make([]models.User, 0, len(users))
	for _, user := range users {
		if store.IsDisabledUser(&user) {
			continue
		}
		out = append(out, user)
	}
	return out
}

func (s *Server) adminSenderDomainOptions(ctx context.Context) ([]adminSenderDomainOption, error) {
	seen := make(map[string]adminSenderDomainOption)
	defaultDomain := strings.ToLower(strings.TrimSpace(s.EffectiveMailDomain()))
	if defaultDomain != "" {
		domain := defaultDomain
		if domain != "" {
			seen[domain] = adminSenderDomainOption{Domain: domain, Verified: true, Source: "platform", IsDefault: true}
		}
	}
	if s.mailmeta != nil {
		domains, _, err := s.mailmeta.ListAllDomains(ctx, 0, 500)
		if err != nil {
			return nil, err
		}
		for _, domain := range domains {
			if !adminDomainReady(domain) {
				continue
			}
			key := strings.ToLower(strings.TrimSpace(domain.Domain))
			if key == "" {
				continue
			}
			item := adminSenderDomainOption{Domain: key, Verified: true, Source: "custom", IsDefault: strings.EqualFold(key, defaultDomain)}
			if existing, ok := seen[key]; ok {
				if existing.Source == "platform" {
					item.Source = existing.Source
				}
				item.IsDefault = item.IsDefault || existing.IsDefault
			}
			seen[key] = item
		}
	}
	out := make([]adminSenderDomainOption, 0, len(seen))
	for _, item := range seen {
		out = append(out, item)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDefault != out[j].IsDefault {
			return out[i].IsDefault
		}
		if out[i].Source != out[j].Source {
			return out[i].Source < out[j].Source
		}
		return out[i].Domain < out[j].Domain
	})
	return out, nil
}

func adminDomainReady(domain mailmeta.AdminDomain) bool {
	status := strings.ToLower(strings.TrimSpace(domain.Status))
	return (status == "active" || status == "verified") &&
		domain.SPFVerified && domain.DKIMVerified && domain.DMARCVerified
}

func (s *Server) defaultAdminFromAddr(domains []adminSenderDomainOption) string {
	if len(domains) == 0 {
		return ""
	}
	return "announcements@" + domains[0].Domain
}

func validateAdminFromAddr(fromAddr string, domains []adminSenderDomainOption) error {
	addr, err := mail.ParseAddress(fromAddr)
	if err != nil {
		return adminSystemErr(http.StatusBadRequest, "invalid from_addr")
	}
	if strings.TrimSpace(strings.ToLower(addr.Address)) != fromAddr {
		return adminSystemErr(http.StatusBadRequest, "from_addr must be a plain email address")
	}
	at := strings.LastIndex(fromAddr, "@")
	if at <= 0 || at == len(fromAddr)-1 {
		return adminSystemErr(http.StatusBadRequest, "invalid from_addr")
	}
	domain := fromAddr[at+1:]
	for _, allowed := range domains {
		if strings.EqualFold(allowed.Domain, domain) {
			return nil
		}
	}
	return adminSystemErr(http.StatusBadRequest, "from_addr must use a verified sender domain")
}

func (s *Server) buildAdminSystemMailPreview(body *adminSystemMailBody, recipients []models.User, domains []adminSenderDomainOption) map[string]any {
	sampleCap := len(recipients)
	if sampleCap > 10 {
		sampleCap = 10
	}
	sample := make([]adminRecipientPreview, 0, sampleCap)
	for i := 0; i < len(recipients) && i < 10; i++ {
		sample = append(sample, adminRecipientPreview{
			ID:    recipients[i].ID.String(),
			Email: recipients[i].Email,
			Name:  recipients[i].Name,
		})
	}
	return map[string]any{
		"ok":              true,
		"audience_kind":   body.AudienceKind,
		"from_addr":       body.FromAddr,
		"subject":         body.Subject,
		"body_chars":      len(body.BodyText),
		"recipient_count": len(recipients),
		"sample":          sample,
		"sender_domains":  domains,
		"relay_enabled":   s.relayKey != nil,
	}
}

type adminSystemMailError struct {
	Status int
	Msg    string
}

func (e *adminSystemMailError) Error() string { return e.Msg }

func adminSystemErr(status int, msg string) error {
	return &adminSystemMailError{Status: status, Msg: msg}
}

func (s *Server) handleAdminSystemMailErr(w http.ResponseWriter, err error) {
	var typed *adminSystemMailError
	if errors.As(err, &typed) {
		s.writeErr(w, typed.Status, typed.Msg)
		return
	}
	s.writeErrAPIInternal(w, "admin system mail", err)
}
