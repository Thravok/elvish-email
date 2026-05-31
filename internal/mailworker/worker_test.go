package mailworker

import (
	"bytes"
	"net/mail"
	"strings"
	"testing"
	"time"

	"elvish/internal/dkim"
	"elvish/internal/mailmeta"
)

func TestPreparePGPOutboundPayload_WrapsArmoredCiphertextForSMTP(t *testing.T) {
	t.Parallel()

	row := mailmeta.OutboxRow{
		SentCopyFromAddr: "Alice <alice@example.com>",
	}
	payload := []byte("-----BEGIN PGP MESSAGE-----\n\naGVsbG8=\n-----END PGP MESSAGE-----\n")
	now := time.Date(2026, time.May, 12, 22, 0, 0, 0, time.UTC)

	wrapped, from, err := preparePGPOutboundPayload(row, []string{"bob@example.com"}, payload, now)
	if err != nil {
		t.Fatalf("preparePGPOutboundPayload: %v", err)
	}
	if from != "alice@example.com" {
		t.Fatalf("from = %q want alice@example.com", from)
	}
	text := string(wrapped)
	if !strings.Contains(text, "Content-Type: multipart/encrypted; protocol=\"application/pgp-encrypted\";") {
		t.Fatalf("wrapped payload missing PGP/MIME content-type:\n%s", text)
	}
	if !strings.Contains(text, "Subject: ...\r\n") {
		t.Fatalf("wrapped payload missing obscured subject:\n%s", text)
	}
	if !strings.Contains(text, "-----BEGIN PGP MESSAGE-----\r\n") {
		t.Fatalf("wrapped payload missing armored body:\n%s", text)
	}

	msg, err := mail.ReadMessage(bytes.NewReader(wrapped))
	if err != nil {
		t.Fatalf("mail.ReadMessage: %v", err)
	}
	if got := msg.Header.Get("From"); got != "alice@example.com" {
		t.Fatalf("From header = %q want alice@example.com", got)
	}

	rawKey, err := dkim.GenerateRSAPrivatePEM(2048)
	if err != nil {
		t.Fatalf("GenerateRSAPrivatePEM: %v", err)
	}
	signer, err := dkim.NewRSASignerFromPEM(rawKey)
	if err != nil {
		t.Fatalf("NewRSASignerFromPEM: %v", err)
	}
	if _, err := dkim.SignAndPrepend(signer, dkim.Options{
		Domain:   "example.com",
		Selector: "mail",
		Now:      now,
	}, wrapped); err != nil {
		t.Fatalf("SignAndPrepend: %v", err)
	}
}

func TestPreparePGPOutboundPayload_PreservesRFC822Payload(t *testing.T) {
	t.Parallel()

	raw := []byte("From: sender@example.com\r\nTo: rcpt@example.com\r\nSubject: hi\r\n\r\nbody\r\n")
	got, from, err := preparePGPOutboundPayload(mailmeta.OutboxRow{}, []string{"rcpt@example.com"}, raw, time.Time{})
	if err != nil {
		t.Fatalf("preparePGPOutboundPayload: %v", err)
	}
	if from != "sender@example.com" {
		t.Fatalf("from = %q want sender@example.com", from)
	}
	if !bytes.Equal(got, raw) {
		t.Fatalf("payload changed unexpectedly:\n%s", string(got))
	}
}

func TestWorkerSetDKIM_NormalizesSelectorAndDomain(t *testing.T) {
	t.Parallel()

	w := &Worker{}
	w.SetDKIM(" Mail.Signing ", " Example.COM ", nil)

	_, _, selector, domain := w.cryptoSnapshot()
	if selector != "mail.signing" {
		t.Fatalf("selector = %q want mail.signing", selector)
	}
	if domain != "example.com" {
		t.Fatalf("domain = %q want example.com", domain)
	}
}

func TestDomainFromFromAddress(t *testing.T) {
	t.Parallel()
	if got := domainFromFromAddress(`"User" <u@Example.COM>`); got != "example.com" {
		t.Fatalf("got %q", got)
	}
	if got := domainFromFromAddress("u@foo.bar"); got != "foo.bar" {
		t.Fatalf("got %q", got)
	}
	if got := domainFromFromAddress(""); got != "" {
		t.Fatalf("got %q", got)
	}
}
