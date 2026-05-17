package mailpipe

import "testing"

func TestExtractHeaders(t *testing.T) {
	raw := []byte("From: Alice <alice@example.com>\r\nTo: Bob <bob@example.com>\r\nSubject: hello\r\nMessage-ID: <abc@example.com>\r\nDate: Sun, 10 May 2026 12:00:00 +0000\r\n\r\nbody\r\n")
	h := extractHeaders(raw)
	if h.Subject != "hello" {
		t.Fatalf("subject: %q", h.Subject)
	}
	if h.From == "" {
		t.Fatalf("from empty")
	}
	if len(h.To) != 1 || h.To[0] != "bob@example.com" {
		t.Fatalf("to: %+v", h.To)
	}
	if h.ThreadID != "<abc@example.com>" {
		t.Fatalf("thread: %q", h.ThreadID)
	}
	if h.Date.IsZero() {
		t.Fatalf("date zero")
	}
}

func TestExtractHeadersBadInput(t *testing.T) {
	h := extractHeaders([]byte("not a real mail"))
	if h.Subject != "" || h.From != "" || h.ThreadID != "" {
		t.Fatalf("expected zero stub: %+v", h)
	}
}

func TestExtractHeadersPGPMIMEMessage(t *testing.T) {
	raw := []byte("From: IRC <irciscool@pm.me>\r\nTo: \"admin@elvish.quest\" <admin@elvish.quest>\r\nSubject: this is a test email!!!\r\nMessage-ID: <abc@pm.me>\r\nDate: Tue, 12 May 2026 21:25:49 +0000\r\nMIME-Version: 1.0\r\nContent-Type: multipart/encrypted; protocol=\"application/pgp-encrypted\"; boundary=\"foo\"\r\n\r\nThis is an OpenPGP/MIME encrypted message\r\n--foo\r\nContent-Type: application/pgp-encrypted\r\n\r\nVersion: 1\r\n--foo--\r\n")
	h := extractHeaders(raw)
	if h.Subject != "this is a test email!!!" {
		t.Fatalf("subject: %q", h.Subject)
	}
	if h.From != "IRC <irciscool@pm.me>" {
		t.Fatalf("from: %q", h.From)
	}
	if len(h.To) != 1 || h.To[0] != "admin@elvish.quest" {
		t.Fatalf("to: %+v", h.To)
	}
	if h.ThreadID != "<abc@pm.me>" {
		t.Fatalf("thread: %q", h.ThreadID)
	}
	if h.Date.IsZero() {
		t.Fatalf("date zero")
	}
}

func TestExtractHeadersThreadIDFromInReplyTo(t *testing.T) {
	raw := []byte("From: Bob <bob@example.com>\r\nTo: Alice <alice@example.com>\r\n" +
		"Subject: re: hello\r\n" +
		"Message-ID: <new-msg@example.com>\r\n" +
		"In-Reply-To: <parent@example.com>\r\n" +
		"Date: Sun, 10 May 2026 12:00:00 +0000\r\n\r\nbody\r\n")
	h := extractHeaders(raw)
	if h.ThreadID != "<parent@example.com>" {
		t.Fatalf("thread: %q want <parent@example.com>", h.ThreadID)
	}
}

func TestExtractHeadersThreadIDFromReferences(t *testing.T) {
	raw := []byte("From: Bob <bob@example.com>\r\nTo: Alice <alice@example.com>\r\n" +
		"Subject: re: hello\r\n" +
		"Message-ID: <new-msg@example.com>\r\n" +
		"References: <root@example.com> <mid@example.com>\r\n" +
		"In-Reply-To: <mid@example.com>\r\n" +
		"Date: Sun, 10 May 2026 12:00:00 +0000\r\n\r\nbody\r\n")
	h := extractHeaders(raw)
	if h.ThreadID != "<root@example.com>" {
		t.Fatalf("thread: %q want <root@example.com>", h.ThreadID)
	}
}

func TestCompleteHeaderSummaryFallsBackToEnvelope(t *testing.T) {
	h := completeHeaderSummary(HeaderSummary{}, "MAILER-DAEMON@example.com", []string{"Recipient@Example.com"})
	if h.From != "MAILER-DAEMON@example.com" {
		t.Fatalf("from = %q want MAILER-DAEMON@example.com", h.From)
	}
	if len(h.To) != 1 || h.To[0] != "recipient@example.com" {
		t.Fatalf("to = %#v want recipient@example.com", h.To)
	}
}

func TestExtractHeadersRFC2047EncodedWords(t *testing.T) {
	raw := []byte("From: =?UTF-8?B?U3VuZ2xhc3MgSHV0?= <news@e.sunglasshut.com>\r\n" +
		"To: shopper@example.com\r\n" +
		"Subject: =?UTF-8?B?U3VtbWVy4oCZcyBtb3N0IGV4Y2x1c2l2ZSBwYWlycywganVzdCA=?= =?UTF-8?B?ZHJvcHBlZC4=?=\r\n" +
		"Message-ID: <m@example.com>\r\n" +
		"Date: Sun, 10 May 2026 12:00:00 +0000\r\n" +
		"\r\nbody\r\n")
	h := extractHeaders(raw)
	if h.From != "Sunglass Hut <news@e.sunglasshut.com>" {
		t.Fatalf("from: %q", h.From)
	}
	if h.Subject != "Summer’s most exclusive pairs, just dropped." {
		t.Fatalf("subject: %q", h.Subject)
	}
}
