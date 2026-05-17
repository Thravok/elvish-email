package blobstore

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

// emptyPayloadHash is the hex SHA256 of an empty payload (used as a fallback marker).
const emptyPayloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

// SignerConfig holds AWS SigV4 credentials and target region/service.
type SignerConfig struct {
	Region    string
	Service   string // typically "s3"
	AccessKey string
	SecretKey string
}

// SignRequest signs req in-place with AWS SigV4. payloadSHA256 must be the lowercase hex
// SHA256 of the request body (use UnsignedPayload to skip body hashing for streaming).
func SignRequest(req *http.Request, cfg SignerConfig, payloadSHA256 string, now time.Time) error {
	if cfg.AccessKey == "" || cfg.SecretKey == "" {
		return fmt.Errorf("sigv4: missing credentials")
	}
	if cfg.Region == "" {
		cfg.Region = "us-east-1"
	}
	if cfg.Service == "" {
		cfg.Service = "s3"
	}
	if payloadSHA256 == "" {
		payloadSHA256 = emptyPayloadHash
	}
	now = now.UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	if req.Header.Get("Host") == "" {
		req.Header.Set("Host", req.URL.Host)
	}
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("X-Amz-Content-Sha256", payloadSHA256)

	canonicalURI := canonicalURIPath(req.URL.Path)
	canonicalQuery := canonicalQuery(req.URL.Query())
	signedHeaders, canonicalHeaders := canonicalHeadersAndSigned(req)
	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalURI,
		canonicalQuery,
		canonicalHeaders,
		signedHeaders,
		payloadSHA256,
	}, "\n")
	credScope := strings.Join([]string{dateStamp, cfg.Region, cfg.Service, "aws4_request"}, "/")
	hashedCanonical := hexSHA256([]byte(canonicalRequest))
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credScope,
		hashedCanonical,
	}, "\n")

	kDate := hmacSHA256([]byte("AWS4"+cfg.SecretKey), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(cfg.Region))
	kService := hmacSHA256(kRegion, []byte(cfg.Service))
	kSigning := hmacSHA256(kService, []byte("aws4_request"))
	signature := hex.EncodeToString(hmacSHA256(kSigning, []byte(stringToSign)))

	auth := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		cfg.AccessKey, credScope, signedHeaders, signature)
	req.Header.Set("Authorization", auth)
	return nil
}

func hexSHA256(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

func hmacSHA256(key, data []byte) []byte {
	m := hmac.New(sha256.New, key)
	m.Write(data)
	return m.Sum(nil)
}

func canonicalURIPath(p string) string {
	if p == "" {
		return "/"
	}
	// SigV4 requires double-encoding for non-S3 services. For S3 we encode each segment.
	parts := strings.Split(p, "/")
	for i, seg := range parts {
		parts[i] = uriEncode(seg, false)
	}
	out := strings.Join(parts, "/")
	if !strings.HasPrefix(out, "/") {
		out = "/" + out
	}
	return out
}

func canonicalQuery(q url.Values) string {
	if len(q) == 0 {
		return ""
	}
	keys := make([]string, 0, len(q))
	for k := range q {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteByte('&')
		}
		ek := uriEncode(k, true)
		vals := q[k]
		sort.Strings(vals)
		for j, v := range vals {
			if j > 0 {
				b.WriteByte('&')
				b.WriteString(ek)
			} else {
				b.WriteString(ek)
			}
			b.WriteByte('=')
			b.WriteString(uriEncode(v, true))
		}
	}
	return b.String()
}

func canonicalHeadersAndSigned(req *http.Request) (string, string) {
	headers := map[string]string{}
	headers["host"] = req.URL.Host
	for k, vs := range req.Header {
		lk := strings.ToLower(k)
		v := strings.Join(vs, ",")
		v = collapseWhitespace(v)
		headers[lk] = strings.TrimSpace(v)
	}
	keys := make([]string, 0, len(headers))
	for k := range headers {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var canonical strings.Builder
	for _, k := range keys {
		canonical.WriteString(k)
		canonical.WriteByte(':')
		canonical.WriteString(headers[k])
		canonical.WriteByte('\n')
	}
	return strings.Join(keys, ";"), canonical.String()
}

func collapseWhitespace(s string) string {
	var b strings.Builder
	prevSpace := false
	for _, r := range s {
		if r == ' ' || r == '\t' {
			if !prevSpace {
				b.WriteByte(' ')
			}
			prevSpace = true
			continue
		}
		prevSpace = false
		b.WriteRune(r)
	}
	return b.String()
}

// uriEncode mirrors the AWS SigV4 spec: unreserved chars unencoded, '/' optionally encoded.
func uriEncode(s string, encodeSlash bool) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case 'A' <= c && c <= 'Z', 'a' <= c && c <= 'z', '0' <= c && c <= '9':
			b.WriteByte(c)
		case c == '-' || c == '_' || c == '.' || c == '~':
			b.WriteByte(c)
		case c == '/' && !encodeSlash:
			b.WriteByte(c)
		default:
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}
