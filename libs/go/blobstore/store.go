package blobstore

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ErrNotFound is returned by Get/Head/Delete when the object does not exist.
var ErrNotFound = errors.New("blobstore: not found")

// Config configures the S3 client.
type Config struct {
	Endpoint       string // e.g. http://127.0.0.1:8333 or https://s3.amazonaws.com
	Region         string
	Bucket         string
	AccessKey      string
	SecretKey      string
	ForcePathStyle bool          // SeaweedFS / MinIO need path-style; AWS prefers virtual-host
	HTTP           *http.Client  // optional; nil → http.DefaultClient with timeout
	OpTimeout      time.Duration // default 30s
}

// Store is an S3-compatible object store client.
type Store struct {
	cfg    Config
	signer SignerConfig
	hc     *http.Client
}

// New constructs a Store. cfg.Bucket must be set.
func New(cfg Config) (*Store, error) {
	cfg.Endpoint = strings.TrimRight(cfg.Endpoint, "/")
	if cfg.Endpoint == "" || cfg.Bucket == "" || cfg.AccessKey == "" || cfg.SecretKey == "" {
		return nil, fmt.Errorf("blobstore: endpoint, bucket, access key, secret key required")
	}
	if cfg.Region == "" {
		cfg.Region = "us-east-1"
	}
	if cfg.OpTimeout <= 0 {
		cfg.OpTimeout = 30 * time.Second
	}
	hc := cfg.HTTP
	if hc == nil {
		hc = &http.Client{Timeout: cfg.OpTimeout}
	}
	return &Store{
		cfg: cfg,
		signer: SignerConfig{
			Region:    cfg.Region,
			Service:   "s3",
			AccessKey: cfg.AccessKey,
			SecretKey: cfg.SecretKey,
		},
		hc: hc,
	}, nil
}

// Bucket returns the configured bucket name.
func (s *Store) Bucket() string {
	if s == nil {
		return ""
	}
	return s.cfg.Bucket
}

// Endpoint returns the configured endpoint.
func (s *Store) Endpoint() string {
	if s == nil {
		return ""
	}
	return s.cfg.Endpoint
}

func (s *Store) urlFor(key string) (*url.URL, error) {
	key = strings.TrimLeft(key, "/")
	if key == "" {
		return nil, fmt.Errorf("blobstore: empty key")
	}
	base, err := url.Parse(s.cfg.Endpoint)
	if err != nil {
		return nil, fmt.Errorf("blobstore: bad endpoint: %w", err)
	}
	if s.cfg.ForcePathStyle {
		base.Path = "/" + s.cfg.Bucket + "/" + key
	} else {
		base.Host = s.cfg.Bucket + "." + base.Host
		base.Path = "/" + key
	}
	return base, nil
}

// Put uploads body to key with the given content type. Server returns the response status only.
func (s *Store) Put(ctx context.Context, key string, body []byte, contentType string) error {
	u, err := s.urlFor(key)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, u.String(), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.ContentLength = int64(len(body))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	req.Header.Set("Content-Type", contentType)
	if err := SignRequest(req, s.signer, hexSHA256(body), time.Now()); err != nil {
		return err
	}
	resp, err := s.hc.Do(req)
	if err != nil {
		return err
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return fmt.Errorf("blobstore put %s: status %d: %s", key, resp.StatusCode, string(b))
	}
	return nil
}

// Get returns the object body for key.
func (s *Store) Get(ctx context.Context, key string) ([]byte, error) {
	u, err := s.urlFor(key)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	if err := SignRequest(req, s.signer, emptyPayloadHash, time.Now()); err != nil {
		return nil, err
	}
	resp, err := s.hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNotFound
	}
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return nil, fmt.Errorf("blobstore get %s: status %d: %s", key, resp.StatusCode, string(b))
	}
	return io.ReadAll(resp.Body)
}

// Head returns the size of the object at key.
func (s *Store) Head(ctx context.Context, key string) (int64, error) {
	u, err := s.urlFor(key)
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, u.String(), nil)
	if err != nil {
		return 0, err
	}
	if err := SignRequest(req, s.signer, emptyPayloadHash, time.Now()); err != nil {
		return 0, err
	}
	resp, err := s.hc.Do(req)
	if err != nil {
		return 0, err
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusNotFound {
		return 0, ErrNotFound
	}
	if resp.StatusCode/100 != 2 {
		return 0, fmt.Errorf("blobstore head %s: status %d", key, resp.StatusCode)
	}
	return resp.ContentLength, nil
}

// Delete removes the object at key. NotFound is reported via ErrNotFound.
func (s *Store) Delete(ctx context.Context, key string) error {
	u, err := s.urlFor(key)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, u.String(), nil)
	if err != nil {
		return err
	}
	if err := SignRequest(req, s.signer, emptyPayloadHash, time.Now()); err != nil {
		return err
	}
	resp, err := s.hc.Do(req)
	if err != nil {
		return err
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("blobstore delete %s: status %d", key, resp.StatusCode)
	}
	return nil
}

// EnsureBucket creates the bucket if it does not exist (no-op on AWS where buckets are pre-created).
// Best-effort for SeaweedFS / MinIO dev setups.
func (s *Store) EnsureBucket(ctx context.Context) error {
	base, err := url.Parse(s.cfg.Endpoint)
	if err != nil {
		return err
	}
	if s.cfg.ForcePathStyle {
		base.Path = "/" + s.cfg.Bucket + "/"
	} else {
		base.Host = s.cfg.Bucket + "." + base.Host
		base.Path = "/"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, base.String(), nil)
	if err != nil {
		return err
	}
	if err := SignRequest(req, s.signer, emptyPayloadHash, time.Now()); err != nil {
		return err
	}
	resp, err := s.hc.Do(req)
	if err != nil {
		return err
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	if resp.StatusCode/100 != 2 && resp.StatusCode != http.StatusConflict && resp.StatusCode != http.StatusOK {
		// 409/200 are fine (already exists).
		return nil
	}
	return nil
}

// MailBodyKey returns the canonical object-storage key for a message body.
func MailBodyKey(userID, messageID string) string {
	return "mail/" + userID + "/" + messageID + "/body.enc"
}

// MailAttachmentKey returns the canonical object-storage key for an attachment.
func MailAttachmentKey(userID, messageID, attachmentID string) string {
	return "mail/" + userID + "/" + messageID + "/attachments/" + attachmentID + ".enc"
}

// OutboxKey returns the canonical object-storage key for an outbox payload.
func OutboxKey(userID, outboxID string) string {
	return "outbox/" + userID + "/" + outboxID + ".enc"
}

// ProtectedLinkKey returns the canonical object-storage key for a protected-link payload.
// Tokens are base64url-safe and unique, so the path stays simple and free of slashes.
func ProtectedLinkKey(token string) string {
	return "secure-link/" + token + ".enc"
}
