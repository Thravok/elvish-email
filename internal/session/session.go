// Package session stores opaque HTTP session tokens in Valkey (Redis protocol).
package session

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const defaultTTL = 14 * 24 * time.Hour

// Payload is stored JSON in Valkey for an authenticated browser session.
type Payload struct {
	// UserID is the account UUID (JSON field "uid" for compact cookies).
	UserID        string   `json:"uid"`
	Email         string   `json:"email"`
	AMR           []string `json:"amr,omitempty"`
	Authenticated int64    `json:"auth_at,omitempty"`
	MFAVerifiedAt int64    `json:"mfa_verified_at,omitempty"`
}

// Store manages session keys in Valkey.
type Store struct {
	r      *redis.Client
	prefix string
	ttl    time.Duration
}

// Valkey returns the underlying redis client for direct cache access.
func (s *Store) Valkey() *redis.Client {
	if s == nil {
		return nil
	}
	return s.r
}

// NewStore returns a session store or nil if r is nil.
func NewStore(r *redis.Client, keyPrefix string) *Store {
	if r == nil {
		return nil
	}
	if keyPrefix == "" {
		keyPrefix = "elvish:sess:"
	}
	return &Store{r: r, prefix: keyPrefix, ttl: defaultTTL}
}

func (s *Store) key(token string) string { return s.prefix + token }

func randomToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

func (s *Store) ephemeralKey(bucket, id string) string {
	return s.prefix + "ephem:" + strings.TrimSpace(bucket) + ":" + strings.TrimSpace(id)
}

// Ping checks connectivity to Valkey (sessions backend).
func (s *Store) Ping(ctx context.Context) error {
	if s == nil || s.r == nil {
		return errors.New("session: valkey not configured")
	}
	return s.r.Ping(ctx).Err()
}

// Create issues a new random token and stores the payload with TTL.
func (s *Store) Create(ctx context.Context, userID uuid.UUID, email string) (token string, err error) {
	return s.CreateWithPayload(ctx, Payload{
		UserID:        userID.String(),
		Email:         email,
		Authenticated: time.Now().UTC().Unix(),
	})
}

// CreateWithPayload issues a new random token and stores the provided payload.
func (s *Store) CreateWithPayload(ctx context.Context, p Payload) (token string, err error) {
	if s == nil || s.r == nil {
		return "", errors.New("session: valkey not configured")
	}
	if strings.TrimSpace(p.UserID) == "" || strings.TrimSpace(p.Email) == "" {
		return "", errors.New("session: invalid payload")
	}
	if p.Authenticated == 0 {
		p.Authenticated = time.Now().UTC().Unix()
	}
	token, err = randomToken()
	if err != nil {
		return "", err
	}
	data, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	if err := s.r.Set(ctx, s.key(token), data, s.ttl).Err(); err != nil {
		return "", err
	}
	idx := s.prefix + "byuid:" + p.UserID
	if err := s.r.SAdd(ctx, idx, token).Err(); err != nil {
		_ = s.r.Del(ctx, s.key(token)).Err()
		return "", err
	}
	_ = s.r.Expire(ctx, idx, s.ttl).Err()
	return token, nil
}

// Get reads a session by token.
func (s *Store) Get(ctx context.Context, token string) (*Payload, error) {
	if s == nil || s.r == nil {
		return nil, errors.New("session: valkey not configured")
	}
	if token == "" {
		return nil, redis.Nil
	}
	raw, err := s.r.Get(ctx, s.key(token)).Bytes()
	if err != nil {
		return nil, err
	}
	var p Payload
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, fmt.Errorf("session: corrupt payload: %w", err)
	}
	return &p, nil
}

// Put replaces an existing session payload and refreshes its TTL.
func (s *Store) Put(ctx context.Context, token string, p Payload) error {
	if s == nil || s.r == nil {
		return errors.New("session: valkey not configured")
	}
	if strings.TrimSpace(token) == "" {
		return errors.New("session: token required")
	}
	if strings.TrimSpace(p.UserID) == "" || strings.TrimSpace(p.Email) == "" {
		return errors.New("session: invalid payload")
	}
	if p.Authenticated == 0 {
		p.Authenticated = time.Now().UTC().Unix()
	}
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	if err := s.r.Set(ctx, s.key(token), data, s.ttl).Err(); err != nil {
		return err
	}
	idx := s.prefix + "byuid:" + p.UserID
	_ = s.r.SAdd(ctx, idx, token).Err()
	_ = s.r.Expire(ctx, idx, s.ttl).Err()
	return nil
}

// Delete removes a session token.
func (s *Store) Delete(ctx context.Context, token string) error {
	if s == nil || s.r == nil || token == "" {
		return nil
	}
	key := s.key(token)
	raw, err := s.r.Get(ctx, key).Bytes()
	if err == nil {
		var p Payload
		if json.Unmarshal(raw, &p) == nil {
			if uid := strings.TrimSpace(p.UserID); uid != "" {
				_ = s.r.SRem(ctx, s.prefix+"byuid:"+uid, token).Err()
			}
		}
	} else if !errors.Is(err, redis.Nil) {
		return err
	}
	return s.r.Del(ctx, key).Err()
}

// DeleteUserSessions revokes every browser session for the given account (e.g. admin disable).
func (s *Store) DeleteUserSessions(ctx context.Context, userID uuid.UUID) error {
	if s == nil || s.r == nil {
		return nil
	}
	idx := s.prefix + "byuid:" + userID.String()
	tokens, err := s.r.SMembers(ctx, idx).Result()
	if err != nil {
		return err
	}
	if len(tokens) == 0 {
		return nil
	}
	pipe := s.r.Pipeline()
	for _, tok := range tokens {
		pipe.Del(ctx, s.key(tok))
	}
	pipe.Del(ctx, idx)
	_, err = pipe.Exec(ctx)
	return err
}

func (s *Store) tempKey(kind, id string) string {
	return s.ephemeralKey(kind, id)
}

// SaveTemporaryJSON stores an opaque short-lived JSON value and returns its handle.
func (s *Store) SaveTemporaryJSON(ctx context.Context, kind string, value any, ttl time.Duration) (string, error) {
	if s == nil || s.r == nil {
		return "", errors.New("session: valkey not configured")
	}
	if strings.TrimSpace(kind) == "" {
		return "", errors.New("session: temp kind required")
	}
	if ttl <= 0 {
		return "", errors.New("session: temp ttl required")
	}
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	id, err := randomToken()
	if err != nil {
		return "", err
	}
	if err := s.r.Set(ctx, s.tempKey(kind, id), data, ttl).Err(); err != nil {
		return "", err
	}
	return id, nil
}

// LoadTemporaryJSON fetches a short-lived JSON value by kind and handle.
func (s *Store) LoadTemporaryJSON(ctx context.Context, kind, id string, dest any) (bool, error) {
	if s == nil || s.r == nil {
		return false, errors.New("session: valkey not configured")
	}
	if strings.TrimSpace(kind) == "" || strings.TrimSpace(id) == "" {
		return false, nil
	}
	raw, err := s.r.Get(ctx, s.tempKey(kind, id)).Bytes()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := json.Unmarshal(raw, dest); err != nil {
		return false, err
	}
	return true, nil
}

// DeleteTemporaryJSON removes a short-lived JSON value by kind and handle.
func (s *Store) DeleteTemporaryJSON(ctx context.Context, kind, id string) error {
	if s == nil || s.r == nil {
		return nil
	}
	if strings.TrimSpace(kind) == "" || strings.TrimSpace(id) == "" {
		return nil
	}
	return s.r.Del(ctx, s.tempKey(kind, id)).Err()
}

// PutEphemeralJSON stores a short-lived JSON blob under a namespaced ephemeral key.
func (s *Store) PutEphemeralJSON(ctx context.Context, bucket, id string, v any, ttl time.Duration) error {
	if s == nil || s.r == nil {
		return errors.New("session: valkey not configured")
	}
	if strings.TrimSpace(bucket) == "" || strings.TrimSpace(id) == "" {
		return errors.New("session: ephemeral bucket/id required")
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return s.r.Set(ctx, s.ephemeralKey(bucket, id), data, ttl).Err()
}

// TakeEphemeralJSON atomically reads and deletes a JSON blob. ok=false means missing.
func (s *Store) TakeEphemeralJSON(ctx context.Context, bucket, id string, dst any) (ok bool, err error) {
	if s == nil || s.r == nil {
		return false, errors.New("session: valkey not configured")
	}
	if strings.TrimSpace(bucket) == "" || strings.TrimSpace(id) == "" {
		return false, errors.New("session: ephemeral bucket/id required")
	}
	raw, err := s.r.GetDel(ctx, s.ephemeralKey(bucket, id)).Bytes()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := json.Unmarshal(raw, dst); err != nil {
		return false, fmt.Errorf("session: corrupt ephemeral payload: %w", err)
	}
	return true, nil
}

// CountEphemeralBucket counts ephemeral keys in a bucket. Used for diagnostics only.
func (s *Store) CountEphemeralBucket(ctx context.Context, bucket string) (int, error) {
	if s == nil || s.r == nil {
		return 0, errors.New("session: valkey not configured")
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return 0, errors.New("session: ephemeral bucket required")
	}
	pattern := s.ephemeralKey(bucket, "*")
	var cursor uint64
	total := 0
	for {
		keys, next, err := s.r.Scan(ctx, cursor, pattern, 200).Result()
		if err != nil {
			return 0, err
		}
		total += len(keys)
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return total, nil
}
