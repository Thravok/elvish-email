package ratelimit

import "testing"

func TestNew_NilRedis_ReturnsNil(t *testing.T) {
	t.Parallel()
	if New(nil, "x:") != nil {
		t.Fatal("expected nil when redis client is nil")
	}
}
