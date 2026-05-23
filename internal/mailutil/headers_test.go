package mailutil

import (
	"errors"
	"strings"
	"testing"
)

func TestRejectHeaderInjection(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in    string
		want  error
	}{
		{"safe subject", nil},
		{"foo\r\nBcc: evil@x.com", ErrHeaderInjection},
		{"foo\nBcc: evil@x.com", ErrHeaderInjection},
		{"foo\x00bar", ErrHeaderInjection},
	}
	for _, c := range cases {
		err := RejectHeaderInjection(c.in)
		if !errors.Is(err, c.want) {
			t.Errorf("RejectHeaderInjection(%q) = %v want %v", c.in, err, c.want)
		}
	}
}

func TestParseMailboxList(t *testing.T) {
	t.Parallel()
	got, err := ParseMailboxList([]string{" Alice@Example.Com ", "Bob <bob@example.com>"})
	if err != nil {
		t.Fatalf("ParseMailboxList: %v", err)
	}
	if len(got) != 2 || got[0] != "alice@example.com" || got[1] != "bob@example.com" {
		t.Fatalf("got %#v", got)
	}
	_, err = ParseMailboxList([]string{"not-an-email"})
	if err == nil {
		t.Fatal("expected error for invalid address")
	}
	_, err = ParseMailboxList([]string{"a@b.com\r\nBcc: x@y.com"})
	if !errors.Is(err, ErrHeaderInjection) {
		t.Fatalf("err = %v want ErrHeaderInjection", err)
	}
}

func TestSanitizeAttachmentName(t *testing.T) {
	t.Parallel()
	if got := SanitizeAttachmentName("report.txt"); got != "report.txt" {
		t.Fatalf("got %q", got)
	}
	if got := SanitizeAttachmentName("../etc/passwd"); !strings.Contains(got, "passwd") || strings.Contains(got, "/") {
		t.Fatalf("got %q", got)
	}
	if got := SanitizeAttachmentName(""); got != "attachment.bin" {
		t.Fatalf("got %q", got)
	}
	long := strings.Repeat("a", 300)
	if len(SanitizeAttachmentName(long)) != maxAttachmentNameLen {
		t.Fatalf("expected truncated name")
	}
}
