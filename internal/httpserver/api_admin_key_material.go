package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"elvish/internal/dkim"
	"elvish/internal/models"
	"elvish/internal/relaykey"
)

const (
	adminKeyMutationsPerHour = int64(12)
	adminKeyMutationWindow   = time.Hour
)

type adminRelayKeyStatus struct {
	Path        string `json:"path"`
	Present     bool   `json:"present"`
	Fingerprint string `json:"fingerprint,omitempty"`
	PublicHash  string `json:"public_hash,omitempty"`
	Error       string `json:"error,omitempty"`
}

type adminDKIMKeyStatus struct {
	Path       string `json:"path"`
	Selector   string `json:"selector"`
	Domain     string `json:"domain"`
	DNSName    string `json:"dns_name"`
	Present    bool   `json:"present"`
	Configured bool   `json:"configured"`
	PublicTXT  string `json:"public_txt,omitempty"`
	Error      string `json:"error,omitempty"`
}

func (s *Server) apiAdminKeyMaterialStatus(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	relayStatus := s.relayKeyStatus()
	dkimStatus := s.dkimKeyStatus()
	s.writeJSON(w, http.StatusOK, map[string]any{
		"relay": relayStatus,
		"dkim":  dkimStatus,
	})
}

func (s *Server) apiAdminRelayKeyGenerate(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_key_generate", admin.ID.String(), adminKeyMutationsPerHour, adminKeyMutationWindow) {
		return
	}
	path := strings.TrimSpace(s.relayKeyPath)
	if path == "" {
		s.writeErr(w, http.StatusServiceUnavailable, "relay key path not configured")
		return
	}
	raw, err := relaykey.GenerateArmoredPrivate("Elvish Plaintext Relay", "relay@local")
	if err != nil {
		s.writeErrAPIInternal(w, "admin relay key generate", err)
		return
	}
	if err := writeSecretFile(path, raw); err != nil {
		s.writeErrAPIInternal(w, "admin relay key write", err)
		return
	}
	kp, err := relaykey.Load(raw)
	if err != nil {
		s.writeErrAPIInternal(w, "admin relay key reload", err)
		return
	}
	s.ReloadRelayKey(kp)
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"generated":   true,
		"fingerprint": kp.Fingerprint(),
		"public_hash": kp.PublicHashHex(),
		"path":        path,
	})
}

func (s *Server) apiAdminDKIMKeyGenerate(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_key_generate", admin.ID.String(), adminKeyMutationsPerHour, adminKeyMutationWindow) {
		return
	}
	if strings.TrimSpace(s.dkimKeyPath) == "" {
		s.writeErr(w, http.StatusServiceUnavailable, "dkim key path not configured")
		return
	}
	raw, err := dkim.GenerateRSAPrivatePEM(2048)
	if err != nil {
		s.writeErrAPIInternal(w, "admin dkim key generate", err)
		return
	}
	if err := s.applyDKIMKey(raw); err != nil {
		s.handleAdminKeyErr(w, err)
		return
	}
	status := s.dkimKeyStatus()
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"path":       status.Path,
		"dns_name":   status.DNSName,
		"public_txt": status.PublicTXT,
	})
}

func (s *Server) apiAdminDKIMKeyUpload(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_key_upload", admin.ID.String(), adminKeyMutationsPerHour, adminKeyMutationWindow) {
		return
	}
	var body struct {
		PEM string `json:"pem"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := s.applyDKIMKey([]byte(body.PEM)); err != nil {
		s.handleAdminKeyErr(w, err)
		return
	}
	status := s.dkimKeyStatus()
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"path":       status.Path,
		"dns_name":   status.DNSName,
		"public_txt": status.PublicTXT,
	})
}

type adminDKIMConfigBody struct {
	Selector string `json:"selector"`
	Domain   string `json:"domain"`
}

func (s *Server) apiAdminDKIMConfigSave(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	if !s.rateLimitKey(w, r, "admin_key_config", admin.ID.String(), adminKeyMutationsPerHour, adminKeyMutationWindow) {
		return
	}
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required to persist DKIM settings")
		return
	}
	var body adminDKIMConfigBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	selector, err := normalizeDKIMSelector(body.Selector)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	domain, err := normalizeDKIMDomain(body.Domain)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.store.SetAdminMailSettings(r.Context(), &models.AdminMailSettingsDoc{
		ID:           models.AdminMailSettingsID,
		DKIMSelector: selector,
		DKIMDomain:   domain,
	}); err != nil {
		s.writeErrAPIInternal(w, "admin dkim config save", err)
		return
	}
	signer, err := s.loadDKIMSignerFromPath()
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		s.log.Warn("dkim config reload signer", "err", err)
	}
	s.WithDKIMConfig(selector, domain, s.dkimKeyPath)
	s.ReloadDKIMSigner(selector, domain, signer)
	status := s.dkimKeyStatus()
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"selector":   status.Selector,
		"domain":     status.Domain,
		"dns_name":   status.DNSName,
		"public_txt": status.PublicTXT,
	})
}

func (s *Server) relayKeyStatus() adminRelayKeyStatus {
	status := adminRelayKeyStatus{Path: strings.TrimSpace(s.relayKeyPath)}
	if s.relayKey != nil {
		status.Present = true
		status.Fingerprint = s.relayKey.Fingerprint()
		status.PublicHash = s.relayKey.PublicHashHex()
		return status
	}
	if status.Path == "" {
		status.Error = "path not configured"
		return status
	}
	kp, err := relaykey.LoadFromPath(status.Path)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) && !errors.Is(err, relaykey.ErrNotConfigured) {
			status.Error = err.Error()
		}
		return status
	}
	status.Present = true
	status.Fingerprint = kp.Fingerprint()
	status.PublicHash = kp.PublicHashHex()
	return status
}

func (s *Server) dkimKeyStatus() adminDKIMKeyStatus {
	status := adminDKIMKeyStatus{
		Path:     strings.TrimSpace(s.dkimKeyPath),
		Selector: strings.TrimSpace(s.dkimSelector),
		Domain:   strings.TrimSpace(s.dkimDomain),
	}
	if status.Selector != "" && status.Domain != "" {
		status.DNSName = status.Selector + "._domainkey." + status.Domain
	}
	if status.Path == "" {
		status.Error = "path not configured"
		return status
	}
	raw, err := os.ReadFile(status.Path)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			status.Error = err.Error()
		}
		return status
	}
	status.Present = true
	signer, err := dkim.NewRSASignerFromPEM(raw)
	if err != nil {
		status.Error = err.Error()
		return status
	}
	if status.Domain != "" && status.Selector != "" {
		status.Configured = true
	}
	txt, err := dkim.PublicKeyTXT(signer)
	if err != nil {
		status.Error = err.Error()
		return status
	}
	status.PublicTXT = txt
	return status
}

func (s *Server) applyDKIMKey(raw []byte) error {
	if strings.TrimSpace(s.dkimKeyPath) == "" {
		return adminKeyErr(http.StatusServiceUnavailable, "dkim key path not configured")
	}
	signer, err := dkim.NewRSASignerFromPEM(raw)
	if err != nil {
		return adminKeyErr(http.StatusBadRequest, "invalid DKIM PEM: "+err.Error())
	}
	if err := writeSecretFile(s.dkimKeyPath, raw); err != nil {
		return err
	}
	s.ReloadDKIMSigner(s.dkimSelector, s.dkimDomain, signer)
	return nil
}

func (s *Server) loadDKIMSignerFromPath() (*dkim.Signer, error) {
	if strings.TrimSpace(s.dkimKeyPath) == "" {
		return nil, os.ErrNotExist
	}
	raw, err := os.ReadFile(s.dkimKeyPath)
	if err != nil {
		return nil, err
	}
	return dkim.NewRSASignerFromPEM(raw)
}

func normalizeDKIMSelector(raw string) (string, error) {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return models.DefaultAdminDKIMSelector, nil
	}
	if !validDNSName(raw) {
		return "", errors.New("selector must be a valid DNS label or dot-separated name")
	}
	return raw, nil
}

func normalizeDKIMDomain(raw string) (string, error) {
	return normalizeOptionalDNSDomain(raw)
}

func writeSecretFile(path string, body []byte) error {
	path = filepath.Clean(strings.TrimSpace(path))
	if path == "" || path == "." {
		return errors.New("secret path required")
	}
	if strings.Contains(path, "\x00") {
		return errors.New("invalid secret path")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".tmp-secret-*")
	if err != nil {
		return err
	}
	tmpPath := f.Name()
	defer func() {
		_ = f.Close()
		_ = os.Remove(tmpPath)
	}()
	if err := f.Chmod(0o600); err != nil {
		return err
	}
	if _, err := f.Write(body); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

type adminKeyError struct {
	Status int
	Msg    string
}

func (e *adminKeyError) Error() string { return e.Msg }

func adminKeyErr(status int, msg string) error { return &adminKeyError{Status: status, Msg: msg} }

func (s *Server) handleAdminKeyErr(w http.ResponseWriter, err error) {
	var typed *adminKeyError
	if errors.As(err, &typed) {
		s.writeErr(w, typed.Status, typed.Msg)
		return
	}
	s.writeErrAPIInternal(w, "admin key management", err)
}
