package httpserver

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/mailtest"
	"elvish/internal/pake"
	"elvish/internal/store"
)

func (s *Server) apiAdminTestHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	results := map[string]any{}

	if s.store != nil {
		if _, err := s.store.CountUsers(ctx); err != nil {
			results["postgres"] = map[string]any{"ok": false, "error": err.Error()}
		} else {
			results["postgres"] = map[string]any{"ok": true}
		}
	} else {
		results["postgres"] = map[string]any{"ok": false, "error": "not configured"}
	}

	if s.sessions != nil {
		if err := s.sessions.Ping(ctx); err != nil {
			results["valkey"] = map[string]any{"ok": false, "error": err.Error()}
		} else {
			results["valkey"] = map[string]any{"ok": true}
		}
	} else {
		results["valkey"] = map[string]any{"ok": false, "error": "not configured"}
	}

	if s.mailmeta != nil {
		if _, err := s.mailmeta.OutboxStats(ctx); err != nil {
			results["mailmeta"] = map[string]any{"ok": false, "error": err.Error()}
		} else {
			results["mailmeta"] = map[string]any{"ok": true}
		}
	} else {
		results["mailmeta"] = map[string]any{"ok": false, "error": "not configured"}
	}

	if s.blob != nil {
		results["blobstore"] = map[string]any{"ok": true}
	} else {
		results["blobstore"] = map[string]any{"ok": false, "error": "not configured"}
	}

	results["relay_key"] = map[string]any{"ok": s.relayKey != nil}
	results["keyserver"] = map[string]any{"ok": s.resolver != nil}
	dkimStatus := s.dkimKeyStatus()
	results["dkim"] = map[string]any{"ok": dkimStatus.Present && dkimStatus.Configured && dkimStatus.Error == ""}

	s.writeJSON(w, http.StatusOK, map[string]any{
		"checks":     results,
		"checked_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) apiAdminTestEcho(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_test_echo", admin.ID.String(), 12, time.Hour) {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	var body struct {
		RecipientEmail string `json:"recipient_email"`
		FromAddr       string `json:"from_addr"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil && err != io.EOF {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	recipientEmail := strings.ToLower(strings.TrimSpace(body.RecipientEmail))
	if recipientEmail == "" {
		recipientEmail = strings.ToLower(strings.TrimSpace(admin.Email))
	}
	recipient, err := s.store.UserByEmail(r.Context(), recipientEmail)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "recipient must be an active local user")
		return
	}
	if store.IsDisabledUser(recipient) {
		s.writeErr(w, http.StatusBadRequest, "recipient must be an active local user")
		return
	}
	domains, err := s.adminSenderDomainOptions(r.Context())
	if err != nil {
		s.writeErrAPIInternal(w, "admin test echo sender domains", err)
		return
	}
	fromAddr := strings.ToLower(strings.TrimSpace(body.FromAddr))
	if fromAddr == "" {
		fromAddr = s.defaultAdminFromAddr(domains)
	}
	if fromAddr == "" {
		s.writeErr(w, http.StatusBadRequest, "no verified sender domains available")
		return
	}
	if err := validateAdminFromAddr(fromAddr, domains); err != nil {
		s.handleAdminSystemMailErr(w, err)
		return
	}
	res, err := s.submitPlaintextOutboxWithContext(r.Context(), admin.ID, outboxPlainBody{
		FromAddr: fromAddr,
		ToAddrs:  []string{recipient.Email},
		Subject:  "Elvish admin send-path probe",
		BodyText: "This is an authenticated admin send-path probe. It verifies delivery through the normal Elvish routing path, including local mailbox delivery or external relay as applicable.",
	}, outboxSubmitOpts{
		Source: "admin_test",
	})
	if err != nil {
		s.handlePlainSubmitErr(w, err)
		return
	}
	out := map[string]any{
		"ok":              true,
		"recipient_email": recipient.Email,
		"from_addr":       fromAddr,
		"queued_count":    len(res.OutboxIDs),
		"local_delivered": len(res.LocalMessageIDs) > 0,
	}
	if id := res.FirstOutboxID(); id != uuid.Nil {
		out["status"] = "queued"
		out["outbox_id"] = id.String()
	} else {
		out["status"] = "delivered_local"
		delete(out, "outbox_id")
	}
	s.writeJSON(w, http.StatusAccepted, out)
}

func (s *Server) apiAdminTestKeyserverProbe(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_test_keyserver", admin.ID.String(), 60, time.Hour) {
		return
	}
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" {
		s.writeErr(w, http.StatusBadRequest, "email required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	res := mailtest.ProbeKeyserver(ctx, s.resolver, email)
	s.writeJSON(w, http.StatusOK, res)
}

func (s *Server) apiAdminTestWrapRoundtrip(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_test_wrap", admin.ID.String(), 60, time.Hour) {
		return
	}
	var body struct {
		KDF string `json:"kdf"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil && err != io.EOF {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	s.writeJSON(w, http.StatusOK, mailtest.RunWrapRoundtrip(body.KDF))
}

func (s *Server) apiAdminTestReadiness(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	domains, err := s.adminSenderDomainOptions(r.Context())
	if err != nil {
		s.writeErrAPIInternal(w, "admin test readiness domains", err)
		return
	}
	checkDomain := s.adminDeliveryCheckDomain(r.Context())
	dkimStatus := s.dkimKeyStatusForDomain(r.Context(), checkDomain)
	delivery := s.deliveryChecksForDomain(r.Context(), checkDomain)
	issues := make([]string, 0, 8)
	if s.relayKey == nil {
		issues = append(issues, "relay key missing")
	}
	if s.mailmeta == nil {
		issues = append(issues, "mail metadata store not configured")
	}
	if s.blob == nil {
		issues = append(issues, "blobstore not configured")
	}
	if len(domains) == 0 {
		issues = append(issues, "no sender domains available")
	}
	issues = append(issues, delivery.Issues...)
	s.writeJSON(w, http.StatusOK, map[string]any{
		"relay_enabled":        s.relayKey != nil,
		"keyserver_enabled":    s.resolver != nil,
		"dkim_configured":      dkimStatus.Present && dkimStatus.Configured && dkimStatus.Error == "",
		"dkim_dns_name":        dkimStatus.DNSName,
		"dkim_error":           dkimStatus.Error,
		"mailmeta_configured":  s.mailmeta != nil,
		"blobstore_configured": s.blob != nil,
		"platform_mail_domain": s.EffectiveMailDomain(),
		"sender_domains":       domains,
		"delivery":             delivery,
		"issues":               issues,
		"ready_for_system_mail": s.relayKey != nil &&
			s.mailmeta != nil &&
			s.blob != nil &&
			len(domains) > 0 &&
			delivery.Ready,
	})
}

func (s *Server) apiAdminTestAuthPosture(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	type shellAudit struct {
		Path              string   `json:"path"`
		ReferrerMeta      bool     `json:"referrer_meta"`
		RequiredScripts   []string `json:"required_scripts,omitempty"`
		MissingScripts    []string `json:"missing_scripts,omitempty"`
		ThirdPartyOrigins []string `json:"third_party_origins,omitempty"`
		ThirdPartyClean   bool     `json:"third_party_clean"`
	}
	loginAudit, loginErr := s.auditHTMLShell("static/auth/login.html", []string{`/auth/srp.js`, `/auth/keygen.js`, `/auth/unlock.js`})
	registerAudit, registerErr := s.auditHTMLShell("static/auth/register.html", []string{`/auth/srp.js`, `/auth/keygen.js`, `/auth/unlock.js`})
	mailAudit, mailErr := s.auditHTMLShell("static/mail/index.html", []string{`/auth/srp.js`, `/auth/keygen.js`, `/auth/unlock.js`})
	adminAudit, adminErr := s.auditHTMLShell("static/mail/index.html", nil)
	unlockSource, unlockErr := s.readProjectText("static/auth/unlock.js")
	storeStats := map[string]any{"configured": false}
	if s.store != nil {
		summary, err := s.store.AuthMethodSummary(r.Context())
		if err != nil {
			storeStats = map[string]any{
				"configured": false,
				"error":      err.Error(),
			}
		} else {
			storeStats = map[string]any{
				"configured":        true,
				"total_users":       summary.TotalUsers,
				"srp_users":         summary.SRPUsers,
				"legacy_users":      summary.LegacyUsers,
				"bcrypt_users":      summary.BcryptUsers,
				"unknown_auth_mode": summary.UnknownAuthMode,
				"disabled_users":    summary.DisabledUsers,
			}
		}
	}
	resp := map[string]any{
		"checked_at":            time.Now().UTC().Format(time.RFC3339),
		"sessions_configured":   s.sessions != nil,
		"store":                 storeStats,
		"srp_enabled":           s.store != nil && s.sessions != nil,
		"srp_group":             pake.DefaultGroup().Name,
		"srp_hash":              "sha256",
		"active_srp_challenges": s.activeSRPChallengeCount(),
		"unlock_memory_only": unlockErr == nil &&
			!strings.Contains(unlockSource, "sessionStorage.") &&
			!strings.Contains(unlockSource, "localStorage.") &&
			!strings.Contains(unlockSource, "indexedDB"),
		"pages": map[string]any{
			"login":    buildShellAuditJSON(loginAudit, loginErr),
			"register": buildShellAuditJSON(registerAudit, registerErr),
			"mail":     buildShellAuditJSON(mailAudit, mailErr),
			"admin":    buildShellAuditJSON(adminAudit, adminErr),
		},
	}
	if unlockErr != nil {
		resp["unlock_memory_only_error"] = unlockErr.Error()
	}
	s.writeJSON(w, http.StatusOK, resp)
}

func (s *Server) apiAdminTestPrivacyPosture(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	rec := httptest.NewRecorder()
	setSecureAppPageHeaders(rec)
	headers := rec.Header()
	loginAudit, loginErr := s.auditHTMLShell("static/auth/login.html", nil)
	registerAudit, registerErr := s.auditHTMLShell("static/auth/register.html", nil)
	mailAudit, mailErr := s.auditHTMLShell("static/mail/index.html", nil)
	protectedAudit, protectedErr := s.auditHTMLShell("static/protected/index.html", nil)
	adminAudit, adminErr := s.auditHTMLShell("static/mail/index.html", nil)
	unlockSource, unlockErr := s.readProjectText("static/auth/unlock.js")
	pipeSource, pipeErr := s.readProjectText("internal/mailpipe/pipe.go")
	resp := map[string]any{
		"checked_at":                    time.Now().UTC().Format(time.RFC3339),
		"default_metadata_encrypted":    false,
		"user_plaintext_relay_disabled": s.userPlaintextRelayDisabled(),
		"unlock_memory_only": unlockErr == nil &&
			!strings.Contains(unlockSource, "sessionStorage.") &&
			!strings.Contains(unlockSource, "localStorage.") &&
			!strings.Contains(unlockSource, "indexedDB"),
		"smtp_plaintext_gateway_encryption": pipeErr == nil &&
			strings.Contains(pipeSource, "return p.ingestPlaintext(ctx, mailmeta.SourceSMTPInbound") &&
			strings.Contains(pipeSource, "mailmeta.ProvenanceAlreadyEncrypted"),
		"secure_headers": map[string]any{
			"referrer_policy":        headers.Get("Referrer-Policy"),
			"x_frame_options":        headers.Get("X-Frame-Options"),
			"x_content_type_options": headers.Get("X-Content-Type-Options"),
			"permissions_policy":     headers.Get("Permissions-Policy"),
			"coop":                   headers.Get("Cross-Origin-Opener-Policy"),
			"corp":                   headers.Get("Cross-Origin-Resource-Policy"),
			"origin_agent_cluster":   headers.Get("Origin-Agent-Cluster"),
			"csp":                    headers.Get("Content-Security-Policy"),
		},
		"pages": map[string]any{
			"login":     buildShellAuditJSON(loginAudit, loginErr),
			"register":  buildShellAuditJSON(registerAudit, registerErr),
			"mail":      buildShellAuditJSON(mailAudit, mailErr),
			"protected": buildShellAuditJSON(protectedAudit, protectedErr),
			"admin":     buildShellAuditJSON(adminAudit, adminErr),
		},
	}
	if unlockErr != nil {
		resp["unlock_memory_only_error"] = unlockErr.Error()
	}
	if pipeErr != nil {
		resp["smtp_plaintext_gateway_encryption_error"] = pipeErr.Error()
	}
	s.writeJSON(w, http.StatusOK, resp)
}

type adminShellAudit struct {
	Path              string
	ReferrerMeta      bool
	RequiredScripts   []string
	MissingScripts    []string
	ThirdPartyOrigins []string
}

func (s *Server) auditHTMLShell(rel string, requiredScripts []string) (*adminShellAudit, error) {
	src, err := s.readProjectText(rel)
	if err != nil {
		return nil, err
	}
	audit := &adminShellAudit{
		Path:              rel,
		ReferrerMeta:      strings.Contains(src, `name="referrer" content="no-referrer"`),
		RequiredScripts:   append([]string(nil), requiredScripts...),
		ThirdPartyOrigins: thirdPartyOriginsInText(src),
	}
	for _, script := range requiredScripts {
		if !strings.Contains(src, script) {
			audit.MissingScripts = append(audit.MissingScripts, script)
		}
	}
	return audit, nil
}

func buildShellAuditJSON(audit *adminShellAudit, err error) map[string]any {
	if err != nil {
		return map[string]any{
			"ok":    false,
			"error": err.Error(),
		}
	}
	return map[string]any{
		"ok":                  len(audit.MissingScripts) == 0 && len(audit.ThirdPartyOrigins) == 0,
		"path":                audit.Path,
		"referrer_meta":       audit.ReferrerMeta,
		"required_scripts":    audit.RequiredScripts,
		"missing_scripts":     audit.MissingScripts,
		"third_party_origins": audit.ThirdPartyOrigins,
		"third_party_clean":   len(audit.ThirdPartyOrigins) == 0,
	}
}

func thirdPartyOriginsInText(src string) []string {
	needles := []string{
		"https://cdn.jsdelivr.net",
		"https://unpkg.com",
		"https://fonts.googleapis.com",
		"https://fonts.gstatic.com",
	}
	out := make([]string, 0, len(needles))
	for _, needle := range needles {
		if strings.Contains(src, needle) {
			out = append(out, needle)
		}
	}
	return out
}

func (s *Server) readProjectText(rel string) (string, error) {
	root := strings.TrimSpace(s.root)
	if root == "" {
		root = "."
	}
	b, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(rel)))
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (s *Server) activeSRPChallengeCount() int {
	if s.sessions != nil {
		if n, err := s.sessions.CountEphemeralBucket(context.Background(), "srpchallenge"); err == nil {
			return n
		}
	}
	s.authMu.Lock()
	defer s.authMu.Unlock()
	now := time.Now()
	n := 0
	for _, ch := range s.authChallenges {
		if ch == nil || now.Sub(ch.CreatedAt) > srpChallengeTTL {
			continue
		}
		n++
	}
	return n
}

func (s *Server) userPlaintextRelayDisabled() bool {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/mail/outbox-plain", nil)
	s.routeOutboxPlain(rec, req, uuid.Nil, "", nil)
	return rec.Code == http.StatusGone
}

// handleAdminTestAPI serves /api/admin/test/* operator diagnostics (admin session required).
func (s *Server) handleAdminTestAPI(w http.ResponseWriter, r *http.Request, p string) {
	p = strings.TrimPrefix(strings.TrimSpace(p), "/")
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	switch {
	case p == "" && r.Method == http.MethodGet:
		s.writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	case p == "health" && r.Method == http.MethodGet:
		s.apiAdminTestHealth(w, r)
	case p == "key-material" && r.Method == http.MethodGet:
		s.apiAdminKeyMaterialStatus(w, r)
	case p == "key-material/relay/generate" && r.Method == http.MethodPost:
		s.apiAdminRelayKeyGenerate(w, r)
	case p == "key-material/dkim/generate" && r.Method == http.MethodPost:
		s.apiAdminDKIMKeyGenerate(w, r)
	case p == "key-material/dkim/upload" && r.Method == http.MethodPost:
		s.apiAdminDKIMKeyUpload(w, r)
	case p == "key-material/dkim/config" && r.Method == http.MethodPost:
		s.apiAdminDKIMConfigSave(w, r)
	case p == "readiness" && r.Method == http.MethodGet:
		s.apiAdminTestReadiness(w, r)
	case p == "auth-posture" && r.Method == http.MethodGet:
		s.apiAdminTestAuthPosture(w, r)
	case p == "privacy-posture" && r.Method == http.MethodGet:
		s.apiAdminTestPrivacyPosture(w, r)
	case p == "uploads" && r.Method == http.MethodPost:
		s.apiAdminTestUpload(w, r)
	case p == "preview" && r.Method == http.MethodPost:
		s.apiAdminTestSendPreview(w, r)
	case p == "send" && r.Method == http.MethodPost:
		s.apiAdminTestSend(w, r)
	case p == "echo" && r.Method == http.MethodPost:
		s.apiAdminTestEcho(w, r)
	case p == "keyserver-probe" && r.Method == http.MethodPost:
		s.apiAdminTestKeyserverProbe(w, r)
	case p == "wrap-roundtrip" && r.Method == http.MethodPost:
		s.apiAdminTestWrapRoundtrip(w, r)
	default:
		http.NotFound(w, r)
	}
}
