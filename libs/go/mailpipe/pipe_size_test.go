package mailpipe

import (
	"strings"
	"testing"
)

func TestCheckBodySize_RejectsOversizedPayload(t *testing.T) {
	t.Parallel()
	p := &Pipe{MaxSize: 128}
	raw := []byte(strings.Repeat("a", 129))
	if err := p.checkBodySize(raw); err == nil {
		t.Fatal("expected oversize error")
	}
	if err := p.checkBodySize([]byte("small")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
