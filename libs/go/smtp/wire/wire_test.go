package wire

import (
	"bytes"
	"strings"
	"testing"
)

func TestParseCommand(t *testing.T) {
	cases := map[string]struct{ verb, args string }{
		"EHLO host":       {"EHLO", "host"},
		"ehlo host":       {"EHLO", "host"},
		"DATA":            {"DATA", ""},
		"MAIL FROM:<a@b>": {"MAIL", "FROM:<a@b>"},
	}
	for in, want := range cases {
		v, a := ParseCommand(in)
		if v != want.verb || a != want.args {
			t.Errorf("%q: got (%q,%q), want (%q,%q)", in, v, a, want.verb, want.args)
		}
	}
}

func TestParseMailFromOrRcptTo(t *testing.T) {
	addr, err := ParseMailFromOrRcptTo("FROM:<alice@example.com>")
	if err != nil || addr != "alice@example.com" {
		t.Errorf("FROM: got (%q,%v)", addr, err)
	}
	addr, err = ParseMailFromOrRcptTo("TO:<bob@example.com> NOTIFY=NEVER")
	if err != nil || addr != "bob@example.com" {
		t.Errorf("TO: got (%q,%v)", addr, err)
	}
	if _, err := ParseMailFromOrRcptTo("FROM:bob"); err == nil {
		t.Error("expected syntax error for missing brackets")
	}
}

func TestReadDATAStuffing(t *testing.T) {
	body := []byte("hello\r\n..dotted line\r\n.\r\n")
	r := NewReader(bytes.NewReader(body))
	got, err := r.ReadDATA(1 << 20)
	if err != nil {
		t.Fatalf("ReadDATA: %v", err)
	}
	want := "hello\n.dotted line\n"
	if string(got) != want {
		t.Errorf("got %q want %q", got, want)
	}
}

func TestReadDATALimit(t *testing.T) {
	big := strings.Repeat("a", 1024)
	body := []byte(big + "\r\n.\r\n")
	r := NewReader(bytes.NewReader(body))
	if _, err := r.ReadDATA(100); err != ErrMessageTooLarge {
		t.Errorf("expected ErrMessageTooLarge, got %v", err)
	}
}

func TestSMTPErrorTransientPermanent(t *testing.T) {
	t1 := &SMTPError{Code: 451}
	if !t1.IsTransient() {
		t.Error("expected transient")
	}
	t2 := &SMTPError{Code: 550}
	if !t2.IsPermanent() {
		t.Error("expected permanent")
	}
}
