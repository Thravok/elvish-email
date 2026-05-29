package mailmeta

import (
	"testing"
	"time"
)

func TestNormalizeMessageExpiry(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name     string
		ttl      int64
		maxReads int64
		wantNil  bool
		wantErr  bool
	}{
		{name: "none", ttl: 0, maxReads: 0, wantNil: true},
		{name: "ttl only", ttl: 3600, maxReads: 0},
		{name: "reads only", ttl: 0, maxReads: 1},
		{name: "both", ttl: 86400, maxReads: 5},
		{name: "negative ttl", ttl: -1, maxReads: 0, wantErr: true},
		{name: "negative reads", ttl: 0, maxReads: -1, wantErr: true},
		{name: "ttl too long", ttl: int64(MaxMessageExpiry/time.Second) + 1, maxReads: 0, wantErr: true},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := NormalizeMessageExpiry(tc.ttl, tc.maxReads)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tc.wantNil {
				if got != nil {
					t.Fatal("expected nil expiry")
				}
				return
			}
			if got == nil {
				t.Fatal("expected expiry policy")
			}
			if tc.ttl > 0 && got.ExpiresAt == nil {
				t.Fatal("expected expires_at")
			}
			if got.MaxReads != tc.maxReads {
				t.Fatalf("max_reads = %d, want %d", got.MaxReads, tc.maxReads)
			}
		})
	}
}

func TestMessageLifecycleExpired(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 5, 24, 12, 0, 0, 0, time.UTC)
	past := now.Add(-time.Hour)
	future := now.Add(time.Hour)
	burned := now
	cases := []struct {
		name string
		lc   *MessageLifecycle
		want bool
	}{
		{name: "nil", lc: nil, want: false},
		{name: "open", lc: &MessageLifecycle{ExpiresAt: &future, MaxReads: 5, Reads: 1}, want: false},
		{name: "time expired", lc: &MessageLifecycle{ExpiresAt: &past}, want: true},
		{name: "reads exhausted", lc: &MessageLifecycle{MaxReads: 1, Reads: 1}, want: true},
		{name: "burned flag", lc: &MessageLifecycle{BurnedAt: &burned}, want: true},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := MessageLifecycleExpired(tc.lc, now); got != tc.want {
				t.Fatalf("expired = %v, want %v", got, tc.want)
			}
		})
	}
}
