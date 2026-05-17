package httpserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

const (
	senderIconCachePrefix   = "elvish:sender-icon:"
	senderIconPosTTL        = 24 * time.Hour
	senderIconNegTTL        = 1 * time.Hour
	senderIconMaxSVGBytes   = 32 * 1024
	senderIconMaxOtherBytes = 64 * 1024
	senderIconFetchTimeout  = 5 * time.Second
)

// SenderIconResponse is returned by GET /api/v1/mail/sender-icon.
type SenderIconResponse struct {
	Domain      string `json:"domain"`
	IconDataURL string `json:"icon_data_url,omitempty"`
	Source      string `json:"source"` // "bimi", "favicon", or "none"
	Cached      bool   `json:"cached"`
}

// senderIconCache is the Valkey-stored shape.
type senderIconCache struct {
	DataURL   string `json:"data_url,omitempty"`
	Source    string `json:"source"`
	FetchedAt int64  `json:"fetched_at"`
}

// routeSenderIcon handles GET /api/v1/mail/sender-icon?domain=...
func (s *Server) routeSenderIcon(w http.ResponseWriter, r *http.Request, _ []string) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	domain := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("domain")))
	if domain == "" {
		s.writeErr(w, http.StatusBadRequest, "domain query parameter required")
		return
	}
	if !isValidDomain(domain) {
		s.writeErr(w, http.StatusBadRequest, "invalid domain")
		return
	}

	ctx := r.Context()
	resp := SenderIconResponse{Domain: domain, Source: "none"}

	if cached, ok := s.getSenderIconCache(ctx, domain); ok {
		resp.IconDataURL = cached.DataURL
		resp.Source = cached.Source
		resp.Cached = true
		s.writeJSON(w, http.StatusOK, resp)
		return
	}

	icon, source := s.resolveSenderIcon(ctx, domain)
	resp.IconDataURL = icon
	resp.Source = source

	s.putSenderIconCache(ctx, domain, senderIconCache{
		DataURL:   icon,
		Source:    source,
		FetchedAt: time.Now().UTC().Unix(),
	})

	s.writeJSON(w, http.StatusOK, resp)
}

// getSenderIconCache checks Valkey for a cached sender icon.
func (s *Server) getSenderIconCache(ctx context.Context, domain string) (*senderIconCache, bool) {
	if s.sessions == nil || s.sessions.Valkey() == nil {
		return nil, false
	}
	key := senderIconCachePrefix + domain
	raw, err := s.sessions.Valkey().Get(ctx, key).Bytes()
	if err != nil {
		return nil, false
	}
	var c senderIconCache
	if err := json.Unmarshal(raw, &c); err != nil {
		return nil, false
	}
	return &c, true
}

// putSenderIconCache stores a sender icon result in Valkey.
func (s *Server) putSenderIconCache(ctx context.Context, domain string, c senderIconCache) {
	if s.sessions == nil || s.sessions.Valkey() == nil {
		return
	}
	ttl := senderIconPosTTL
	if c.Source == "none" {
		ttl = senderIconNegTTL
	}
	data, err := json.Marshal(c)
	if err != nil {
		return
	}
	key := senderIconCachePrefix + domain
	_ = s.sessions.Valkey().Set(ctx, key, data, ttl).Err()
}

// resolveSenderIcon tries BIMI first, then favicon fallback.
func (s *Server) resolveSenderIcon(ctx context.Context, domain string) (dataURL, source string) {
	if icon := s.resolveBIMI(ctx, domain); icon != "" {
		return icon, "bimi"
	}
	if icon := s.resolveFavicon(ctx, domain); icon != "" {
		return icon, "favicon"
	}
	return "", "none"
}

// resolveBIMI performs DNS TXT lookup for BIMI and fetches the SVG logo.
func (s *Server) resolveBIMI(ctx context.Context, domain string) string {
	bimi := "default._bimi." + domain
	txtRecords, err := net.DefaultResolver.LookupTXT(ctx, bimi)
	if err != nil || len(txtRecords) == 0 {
		return ""
	}

	var logoURL string
	for _, txt := range txtRecords {
		txt = strings.ToLower(txt)
		if !strings.HasPrefix(txt, "v=bimi1") {
			continue
		}
		logoURL = extractBIMILogoURL(txt)
		if logoURL != "" {
			break
		}
	}
	if logoURL == "" {
		return ""
	}

	if !strings.HasPrefix(logoURL, "https://") {
		return ""
	}

	svgData, contentType, err := s.fetchExternalImage(ctx, logoURL, senderIconMaxSVGBytes)
	if err != nil || len(svgData) == 0 {
		return ""
	}

	if !isSVGContentType(contentType) && !looksLikeSVG(svgData) {
		return ""
	}

	if !sanitizeSVG(svgData) {
		return ""
	}

	return "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString(svgData)
}

// extractBIMILogoURL parses the l= tag from a BIMI TXT record.
func extractBIMILogoURL(txt string) string {
	parts := strings.Split(txt, ";")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "l=") {
			return strings.TrimSpace(strings.TrimPrefix(part, "l="))
		}
	}
	return ""
}

// resolveFavicon fetches favicon from common locations.
func (s *Server) resolveFavicon(ctx context.Context, domain string) string {
	candidates := []string{
		"https://" + domain + "/favicon.ico",
		"https://" + domain + "/favicon.png",
		"https://www." + domain + "/favicon.ico",
	}

	for _, url := range candidates {
		data, contentType, err := s.fetchExternalImage(ctx, url, senderIconMaxOtherBytes)
		if err != nil || len(data) == 0 {
			continue
		}

		mimeType := detectImageMIME(contentType, data)
		if mimeType == "" {
			continue
		}

		return fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(data))
	}

	return ""
}

// fetchExternalImage fetches an image URL with size limit and timeout.
func (s *Server) fetchExternalImage(ctx context.Context, url string, maxBytes int64) ([]byte, string, error) {
	ctx, cancel := context.WithTimeout(ctx, senderIconFetchTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", "Elvish-Mail/1.0 (BIMI/Favicon fetcher)")
	req.Header.Set("Accept", "image/svg+xml,image/png,image/x-icon,image/*")

	client := &http.Client{
		Timeout: senderIconFetchTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("http %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return nil, "", err
	}
	if int64(len(data)) > maxBytes {
		return nil, "", fmt.Errorf("response too large")
	}

	return data, contentType, nil
}

// isValidDomain checks if domain looks valid (no path, no scheme).
func isValidDomain(d string) bool {
	if strings.Contains(d, "/") || strings.Contains(d, ":") {
		return false
	}
	if !strings.Contains(d, ".") {
		return false
	}
	for _, c := range d {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '.' || c == '-') {
			return false
		}
	}
	return len(d) >= 4 && len(d) <= 253
}

// isSVGContentType checks if content-type indicates SVG.
func isSVGContentType(ct string) bool {
	ct = strings.ToLower(ct)
	return strings.Contains(ct, "image/svg") || strings.Contains(ct, "svg+xml")
}

// looksLikeSVG does a basic check for SVG content.
func looksLikeSVG(data []byte) bool {
	s := strings.ToLower(string(data[:min(len(data), 500)]))
	return strings.Contains(s, "<svg") || strings.Contains(s, "<?xml")
}

// sanitizeSVG checks SVG for potentially dangerous content.
// Returns false if the SVG contains scripts or event handlers.
func sanitizeSVG(data []byte) bool {
	s := strings.ToLower(string(data))
	dangerous := []string{
		"<script",
		"javascript:",
		"onclick",
		"onload",
		"onerror",
		"onmouseover",
		"onfocus",
		"onblur",
		"<foreignobject",
		"<use",
		"xlink:href",
	}
	for _, d := range dangerous {
		if strings.Contains(s, d) {
			return false
		}
	}
	return true
}

// detectImageMIME determines MIME type from content-type header or magic bytes.
func detectImageMIME(contentType string, data []byte) string {
	ct := strings.ToLower(strings.Split(contentType, ";")[0])
	ct = strings.TrimSpace(ct)

	switch ct {
	case "image/png":
		return "image/png"
	case "image/x-icon", "image/vnd.microsoft.icon":
		return "image/x-icon"
	case "image/jpeg", "image/jpg":
		return "image/jpeg"
	case "image/gif":
		return "image/gif"
	case "image/webp":
		return "image/webp"
	case "image/svg+xml":
		return "image/svg+xml"
	}

	if len(data) >= 8 {
		if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
			return "image/png"
		}
		if data[0] == 0x00 && data[1] == 0x00 && data[2] == 0x01 && data[3] == 0x00 {
			return "image/x-icon"
		}
		if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
			return "image/jpeg"
		}
		if data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 {
			return "image/gif"
		}
		if len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
			return "image/webp"
		}
	}

	return ""
}
