package dkim

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"strings"
	"testing"
	"time"
)

func mustRSAKey(t *testing.T) []byte {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der := x509.MarshalPKCS1PrivateKey(priv)
	return pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: der})
}

func TestSignRSARelaxedRelaxed(t *testing.T) {
	signer, err := NewRSASignerFromPEM(mustRSAKey(t))
	if err != nil {
		t.Fatal(err)
	}
	msg := []byte("From: alice@example.com\r\n" +
		"To: bob@example.org\r\n" +
		"Subject: test\r\n" +
		"Date: Tue, 01 Jan 2026 00:00:00 -0000\r\n" +
		"Message-ID: <abc@example.com>\r\n" +
		"\r\n" +
		"hello\r\n")
	header, err := Sign(signer, Options{Domain: "example.com", Selector: "default", Now: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}, msg)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if !strings.Contains(header, "v=1") {
		t.Errorf("missing v=1: %s", header)
	}
	if !strings.Contains(header, "a=rsa-sha256") {
		t.Errorf("missing a=rsa-sha256: %s", header)
	}
	if !strings.Contains(header, "d=example.com") {
		t.Errorf("missing d=example.com: %s", header)
	}
	if !strings.Contains(header, "bh=") {
		t.Errorf("missing bh=: %s", header)
	}
	if !strings.Contains(header, "b=") {
		t.Errorf("missing b=: %s", header)
	}
	if !strings.Contains(header, "h=from:to:subject:date:message-id") {
		t.Errorf("unexpected h=: %s", header)
	}
}

func TestSignEd25519(t *testing.T) {
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := NewEd25519Signer(priv)
	if err != nil {
		t.Fatal(err)
	}
	msg := []byte("From: alice@example.com\r\n" +
		"Date: Tue, 01 Jan 2026 00:00:00 -0000\r\n" +
		"Message-ID: <abc@example.com>\r\n" +
		"Subject: t\r\n\r\nbody\r\n")
	header, err := Sign(signer, Options{Domain: "example.com", Selector: "ed25519"}, msg)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(header, "a=ed25519-sha256") {
		t.Errorf("expected ed25519: %s", header)
	}
}

func TestPublicKeyTXT(t *testing.T) {
	signer, err := NewRSASignerFromPEM(mustRSAKey(t))
	if err != nil {
		t.Fatal(err)
	}
	txt, err := PublicKeyTXT(signer)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(txt, "v=DKIM1; k=rsa; p=") {
		t.Errorf("bad TXT: %s", txt)
	}
}

func TestGenerateRSAPrivatePEM(t *testing.T) {
	raw, err := GenerateRSAPrivatePEM(2048)
	if err != nil {
		t.Fatalf("GenerateRSAPrivatePEM: %v", err)
	}
	signer, err := NewRSASignerFromPEM(raw)
	if err != nil {
		t.Fatalf("NewRSASignerFromPEM(generated): %v", err)
	}
	txt, err := PublicKeyTXT(signer)
	if err != nil {
		t.Fatalf("PublicKeyTXT(generated): %v", err)
	}
	if !strings.HasPrefix(txt, "v=DKIM1; k=rsa; p=") {
		t.Fatalf("unexpected TXT: %s", txt)
	}
}

func TestRelaxedBodyHashStable(t *testing.T) {
	body := []byte("hello   world  \r\n  \r\n")
	h1 := bodyHashRelaxed(body)
	h2 := bodyHashRelaxed([]byte("hello world\n"))
	for i := range h1 {
		if h1[i] != h2[i] {
			t.Errorf("relaxed body hash mismatch")
			return
		}
	}
}

func TestSignAndPrepend(t *testing.T) {
	signer, err := NewRSASignerFromPEM(mustRSAKey(t))
	if err != nil {
		t.Fatal(err)
	}
	msg := []byte("From: a@example.com\r\nDate: x\r\nSubject: t\r\nMessage-ID: <m@x>\r\n\r\nhello\r\n")
	out, err := SignAndPrepend(signer, Options{Domain: "example.com", Selector: "s1"}, msg)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(string(out), "DKIM-Signature: ") {
		t.Errorf("expected DKIM-Signature header at start")
	}
}
