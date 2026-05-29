package httpserver

import (
	"strings"
	"testing"
)

func TestEffectiveMailDomainString(t *testing.T) {
	t.Parallel()
	if g := effectiveMailDomainString(""); g != defaultSignupMailDomain {
		t.Fatalf("empty: got %q want %q", g, defaultSignupMailDomain)
	}
	if g := effectiveMailDomainString("  EXAMPLE.COM "); g != "example.com" {
		t.Fatalf("trim/lower: got %q", g)
	}
}

func TestNormalizeAndValidateUsername(t *testing.T) {
	t.Parallel()
	good := []struct{ in, want string }{
		{"abc", "abc"},
		{"USER", "user"},
		{" user.name ", "user.name"},
		{"a_b-c", "a_b-c"},
		{"a1b2c3", "a1b2c3"},
		{strings.Repeat("a", 64), strings.Repeat("a", 64)},
	}
	for _, tc := range good {
		out, err := NormalizeAndValidateUsername(tc.in)
		if err != nil {
			t.Fatalf("%q: %v", tc.in, err)
		}
		if out != tc.want {
			t.Fatalf("%q: got %q want %q", tc.in, out, tc.want)
		}
	}
	bad := []string{"", "ab", "a@b", ".bad", "bad.", "a..b", "bad!", strings.Repeat("a", 65)}
	for _, in := range bad {
		if _, err := NormalizeAndValidateUsername(in); err == nil {
			t.Fatalf("%q: want error", in)
		}
	}
}

func TestComposeCanonicalEmail(t *testing.T) {
	t.Parallel()
	if g := ComposeCanonicalEmail("alice", "Example.COM"); g != "alice@example.com" {
		t.Fatalf("got %q", g)
	}
}

func TestUsernameFromCanonicalEmail(t *testing.T) {
	t.Parallel()
	if g := UsernameFromCanonicalEmail("Alice@Elvish.LOCAL"); g != "alice" {
		t.Fatalf("got %q", g)
	}
	if UsernameFromCanonicalEmail("nope") != "" {
		t.Fatal("want empty")
	}
	if UsernameFromCanonicalEmail("@only") != "" {
		t.Fatal("want empty")
	}
}

func TestServerEffectiveMailDomain(t *testing.T) {
	t.Parallel()
	s := &Server{mailDomain: "mail.example"}
	if s.EffectiveMailDomain() != "mail.example" {
		t.Fatal(s.EffectiveMailDomain())
	}
	s.mailDomain = ""
	if s.EffectiveMailDomain() != defaultSignupMailDomain {
		t.Fatal(s.EffectiveMailDomain())
	}
}
