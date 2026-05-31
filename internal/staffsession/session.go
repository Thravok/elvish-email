// Package staffsession stores Console staff session tokens in Valkey.
package staffsession

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

const (
	defaultTTL = 14 * 24 * time.Hour
	keyPrefix  = "elvish:console:sess:"
	cookieName = "elvish_console_session"
)

// Payload is stored JSON for an authenticated Console staff session.
type Payload struct {
	StaffID string `json:"sid"`
	Email   string `json:"email"`
	Role    string `json:"role"`
	AuthAt  int64  `json:"auth_at,omitempty"`
}

// CookieName is the HTTP cookie name for Console staff sessions.
func CookieName() string { return cookieName }

// Store manages staff session keys in Valkey.
type Store struct {
	r      *redis.Client
	prefix string
	ttl    time.Duration
}

// NewStore returns a staff session store or nil if r is nil.
func NewStore(r *redis.Client) *Store {
	if r == nil {
		return nil
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

// Ping checks connectivity to Valkey.
func (s *Store) Ping(ctx context.Context) error {
	if s == nil || s.r == nil {
		return errors.New("staffsession: valkey not configured")
	}
	return s.r.Ping(ctx).Err()
}

// Create issues a new session for a staff user.
func (s *Store) Create(ctx context.Context, staffID uuid.UUID, email, role string) (token string, err error) {
	if s == nil || s.r == nil {
		return "", errors.New("staffsession: valkey not configured")
	}
	email = strings.TrimSpace(email)
	if staffID == uuid.Nil || email == "" {
		return "", errors.New("staffsession: invalid payload")
	}
	p := Payload{
		StaffID: staffID.String(),
		Email:   email,
		Role:    strings.TrimSpace(role),
		AuthAt:  time.Now().UTC().Unix(),
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
	idx := s.prefix + "bystaff:" + p.StaffID
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
		return nil, errors.New("staffsession: valkey not configured")
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
		return nil, fmt.Errorf("staffsession: corrupt payload: %w", err)
	}
	return &p, nil
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
			if sid := strings.TrimSpace(p.StaffID); sid != "" {
				_ = s.r.SRem(ctx, s.prefix+"bystaff:"+sid, token).Err()
			}
		}
	} else if !errors.Is(err, redis.Nil) {
		return err
	}
	return s.r.Del(ctx, key).Err()
}

// DeleteStaffSessions revokes every session for a staff account.
func (s *Store) DeleteStaffSessions(ctx context.Context, staffID uuid.UUID) error {
	if s == nil || s.r == nil {
		return nil
	}
	idx := s.prefix + "bystaff:" + staffID.String()
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
