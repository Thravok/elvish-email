package keyserver

import (
	"context"
	"strings"
	"sync"
	"time"
)

// MockSource is a deterministic in-memory source for tests.
type MockSource struct {
	Label string
	mu    sync.Mutex
	hits  map[string]*KeyHit
}

// NewMockSource returns an empty mock source.
func NewMockSource(label string) *MockSource {
	return &MockSource{Label: label, hits: map[string]*KeyHit{}}
}

// Name returns the configured label.
func (m *MockSource) Name() string {
	if m == nil {
		return "mock"
	}
	return m.Label
}

// Set associates email → armored key.
func (m *MockSource) Set(email, fingerprint, armored string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now().UTC()
	m.hits[strings.ToLower(strings.TrimSpace(email))] = &KeyHit{
		Email:            email,
		Fingerprint:      fingerprint,
		Armored:          armored,
		Source:           m.Label,
		FetchedAt:        now,
		ExpiresAt:        now.Add(time.Hour),
		VerifiedUIDMatch: true,
	}
}

// Lookup returns the registered hit or ErrNotFound.
func (m *MockSource) Lookup(_ context.Context, email string) (*KeyHit, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if hit, ok := m.hits[strings.ToLower(strings.TrimSpace(email))]; ok {
		return hit, nil
	}
	return nil, ErrNotFound
}
