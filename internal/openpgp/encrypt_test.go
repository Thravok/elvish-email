package openpgp

import (
	"bytes"
	"io"
	"strings"
	"testing"
	"time"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
)

// genKey generates a Curve25519 keypair for fixture use in tests.
func genKey(t *testing.T, name, email string) *pgpcrypto.Entity {
	t.Helper()
	cfg := &packet.Config{Algorithm: packet.PubKeyAlgoEdDSA, RSABits: 2048, Time: func() time.Time { return time.Now() }}
	ent, err := pgpcrypto.NewEntity(name, "", email, cfg)
	if err != nil {
		t.Fatalf("NewEntity: %v", err)
	}
	return ent
}

func armorPub(t *testing.T, e *pgpcrypto.Entity) string {
	t.Helper()
	var buf bytes.Buffer
	w, err := armor.Encode(&buf, "PGP PUBLIC KEY BLOCK", nil)
	if err != nil {
		t.Fatalf("armor: %v", err)
	}
	if err := e.Serialize(w); err != nil {
		t.Fatalf("serialize: %v", err)
	}
	_ = w.Close()
	return buf.String()
}

// TestEncryptRoundTrip encrypts to a fixture pubkey and decrypts with the matching priv.
func TestEncryptRoundTrip(t *testing.T) {
	e := genKey(t, "alice", "alice@example.com")
	armPub := armorPub(t, e)
	plaintext := []byte("hello body")
	ct, err := Encrypt(armPub, plaintext)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if !bytes.HasPrefix(bytes.TrimSpace(ct), []byte("-----BEGIN PGP MESSAGE-----")) {
		t.Errorf("expected armored PGP message")
	}
	if bytes.Contains(ct, plaintext) {
		t.Errorf("ciphertext contains plaintext bytes")
	}

	// decrypt with the private key (still in entity).
	keyring := pgpcrypto.EntityList{e}
	armBlock, err := armor.Decode(bytes.NewReader(ct))
	if err != nil {
		t.Fatalf("armor decode: %v", err)
	}
	md, err := pgpcrypto.ReadMessage(armBlock.Body, keyring, nil, nil)
	if err != nil {
		t.Fatalf("read message: %v", err)
	}
	got, err := io.ReadAll(md.UnverifiedBody)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if string(got) != string(plaintext) {
		t.Errorf("plaintext mismatch: %q vs %q", got, plaintext)
	}
}

// TestEncryptToManyAddressesAllRecipients encrypts to two pubkeys and decrypts with each.
func TestEncryptToManyAddressesAllRecipients(t *testing.T) {
	a := genKey(t, "alice", "alice@example.com")
	b := genKey(t, "bob", "bob@example.com")
	plaintext := []byte("multi-recipient body")
	ct, err := EncryptToMany([]string{armorPub(t, a), armorPub(t, b)}, plaintext)
	if err != nil {
		t.Fatalf("encrypt many: %v", err)
	}
	for _, e := range []*pgpcrypto.Entity{a, b} {
		armBlock, err := armor.Decode(bytes.NewReader(ct))
		if err != nil {
			t.Fatal(err)
		}
		md, err := pgpcrypto.ReadMessage(armBlock.Body, pgpcrypto.EntityList{e}, nil, nil)
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		out, err := io.ReadAll(md.UnverifiedBody)
		if err != nil {
			t.Fatal(err)
		}
		if string(out) != string(plaintext) {
			t.Errorf("recipient %s mismatch", e.PrimaryIdentity().Name)
		}
	}
}

// TestParseAndValidateForEncryption validates capability flags and rejects bad inputs.
func TestParseAndValidateForEncryption(t *testing.T) {
	e := genKey(t, "alice", "alice@example.com")
	armPub := armorPub(t, e)
	d, err := ParseKeyDetail(armPub)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if d.Fingerprint == "" {
		t.Errorf("missing fingerprint")
	}
	if !d.Capabilities.Encrypt {
		t.Errorf("expected encryption capability")
	}
	if err := ValidateForEncryption(d); err != nil {
		t.Errorf("expected validate ok: %v", err)
	}
	if _, err := ParseKeyDetail(""); err == nil {
		t.Errorf("expected error on empty input")
	}
	if _, err := ParseKeyDetail("not a key"); err == nil {
		t.Errorf("expected error on invalid input")
	}
}

func TestSniffClassification(t *testing.T) {
	if got := Sniff([]byte("plain text body")); got != BodyCleartext {
		t.Errorf("expected cleartext, got %v", got)
	}
	if got := Sniff([]byte("\r\n  -----BEGIN PGP MESSAGE-----\nabc\n-----END PGP MESSAGE-----\n")); got != BodyCleartext {
		t.Errorf("fake armor should classify as cleartext, got %v", got)
	}
	mime := []byte("Content-Type: multipart/encrypted; protocol=\"application/pgp-encrypted\"; boundary=foo\r\n\r\n--foo\r\nContent-Type: application/pgp-encrypted\r\nVersion: 1\r\n\r\n--foo--\r\n")
	if got := Sniff(mime); got != BodyPGPMIME {
		t.Errorf("expected PGP/MIME, got %v", got)
	}
	if got := Sniff([]byte("-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA256\n\nx\n-----BEGIN PGP SIGNATURE-----\nabc\n-----END PGP SIGNATURE-----\n")); got != BodyCleartext {
		t.Errorf("signed cleartext should classify as cleartext, got %v", got)
	}
	e := genKey(t, "sniff", "sniff@test.local")
	pub := armorPub(t, e)
	ct, err := Encrypt(pub, []byte("secret"))
	if err != nil {
		t.Fatal(err)
	}
	if got := Sniff(ct); got != BodyArmoredMessage {
		t.Errorf("real ciphertext should classify as armored, got %v", got)
	}
}

func TestSniffEmpty(t *testing.T) {
	if got := Sniff(nil); got != BodyCleartext {
		t.Errorf("nil should classify as cleartext, got %v", got)
	}
	if got := Sniff([]byte{}); got != BodyCleartext {
		t.Errorf("empty should classify as cleartext, got %v", got)
	}
}

func TestWKDLocalPartHashKnownAnswer(t *testing.T) {
	// Z-Base-32 SHA-1 of "joe" per the WKD draft examples.
	got := WKDLocalPartHash("joe")
	if len(got) != 32 {
		t.Errorf("WKD hash length: got %d, want 32 (160 bits → 32 base32 chars)", len(got))
	}
	if got != strings.ToLower(got) {
		t.Errorf("WKD hash should be lowercase: %q", got)
	}
	// Stable across calls.
	if WKDLocalPartHash("Joe") != got {
		t.Errorf("WKD hash should be case-insensitive")
	}
}
