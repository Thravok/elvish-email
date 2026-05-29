package maillinks

import (
	"strings"
	"testing"
)

func TestNewTokenShape(t *testing.T) {
	for i := 0; i < 64; i++ {
		tok, err := NewToken()
		if err != nil {
			t.Fatalf("NewToken: %v", err)
		}
		if len(tok) != TokenLength {
			t.Fatalf("token length = %d, want %d (token=%q)", len(tok), TokenLength, tok)
		}
		if !ValidateToken(tok) {
			t.Fatalf("ValidateToken(%q) = false", tok)
		}
		if strings.ContainsAny(tok, "+/=") {
			t.Fatalf("token %q contains non-URL-safe characters", tok)
		}
	}
}

func TestValidateTokenRejects(t *testing.T) {
	bad := []string{
		"",
		"too-short",
		strings.Repeat("a", TokenLength-1),
		strings.Repeat("a", TokenLength+1),
		strings.Repeat("$", TokenLength),
		strings.Repeat("a", TokenLength-1) + " ",
		strings.Repeat("a", TokenLength-1) + "/",
		strings.Repeat("a", TokenLength-1) + "+",
	}
	for _, s := range bad {
		if ValidateToken(s) {
			t.Fatalf("ValidateToken(%q) = true, want false", s)
		}
	}
	good := []string{
		strings.Repeat("a", TokenLength),
		strings.Repeat("A", TokenLength),
		strings.Repeat("0", TokenLength),
		strings.Repeat("-", TokenLength),
		strings.Repeat("_", TokenLength),
	}
	for _, s := range good {
		if !ValidateToken(s) {
			t.Fatalf("ValidateToken(%q) = false, want true", s)
		}
	}
}

func TestNewTokenUniqueness(t *testing.T) {
	seen := make(map[string]struct{}, 4096)
	for i := 0; i < 4096; i++ {
		tok, err := NewToken()
		if err != nil {
			t.Fatalf("NewToken: %v", err)
		}
		if _, dup := seen[tok]; dup {
			t.Fatalf("duplicate token after %d iterations: %q", i, tok)
		}
		seen[tok] = struct{}{}
	}
}
