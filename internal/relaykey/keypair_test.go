package relaykey

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
)

func makeTestKeyPair(t *testing.T) []byte {
	t.Helper()
	cfg := &packet.Config{
		Algorithm: packet.PubKeyAlgoEdDSA,
		Time:      func() time.Time { return time.Now() },
	}
	ent, err := pgpcrypto.NewEntity("Elvish Relay test", "test fixture", "relay@test.local", cfg)
	if err != nil {
		t.Fatalf("NewEntity: %v", err)
	}
	var buf bytes.Buffer
	aw, err := armor.Encode(&buf, "PGP PRIVATE KEY BLOCK", nil)
	if err != nil {
		t.Fatalf("armor: %v", err)
	}
	if err := ent.SerializePrivateWithoutSigning(aw, nil); err != nil {
		t.Fatalf("serialize: %v", err)
	}
	if err := aw.Close(); err != nil {
		t.Fatalf("close armor: %v", err)
	}
	return buf.Bytes()
}

func TestLoadRoundTrip(t *testing.T) {
	priv := makeTestKeyPair(t)
	kp, err := Load(priv)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if kp.Fingerprint() == "" {
		t.Fatal("empty fingerprint")
	}
	if !strings.HasPrefix(strings.TrimSpace(kp.ArmoredPublic()), "-----BEGIN PGP PUBLIC KEY BLOCK-----") {
		t.Fatalf("ArmoredPublic shape: %q", kp.ArmoredPublic())
	}
	if kp.PublicHashHex() == "" {
		t.Fatal("empty PublicHashHex")
	}

	plaintext := []byte("the body of the email\nwith\r\nmixed line endings and 0x00\x00bytes")
	ct, err := kp.Wrap(plaintext)
	if err != nil {
		t.Fatalf("Wrap: %v", err)
	}
	if !bytes.HasPrefix(bytes.TrimSpace(ct), []byte("-----BEGIN PGP MESSAGE-----")) {
		t.Fatalf("Wrap output not armored PGP MESSAGE: %q", ct)
	}
	if bytes.Contains(ct, plaintext) {
		t.Fatalf("ciphertext contains plaintext bytes (encryption is a no-op?)")
	}
	got, err := kp.Unwrap(ct)
	if err != nil {
		t.Fatalf("Unwrap: %v", err)
	}
	if !bytes.Equal(got, plaintext) {
		t.Fatalf("roundtrip mismatch:\n got %q\nwant %q", got, plaintext)
	}
}

func TestLoadFromPath(t *testing.T) {
	dir := t.TempDir()
	keyPath := filepath.Join(dir, "relay.asc")
	if err := os.WriteFile(keyPath, makeTestKeyPair(t), 0o600); err != nil {
		t.Fatal(err)
	}
	kp, err := LoadFromPath(keyPath)
	if err != nil {
		t.Fatalf("LoadFromPath: %v", err)
	}
	if kp.Fingerprint() == "" {
		t.Fatal("empty fingerprint")
	}
}

func TestLoadFromPathEmpty(t *testing.T) {
	if _, err := LoadFromPath(""); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("LoadFromPath(empty) err = %v, want ErrNotConfigured", err)
	}
	if _, err := LoadFromPath("   "); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("LoadFromPath(spaces) err = %v, want ErrNotConfigured", err)
	}
}

func TestLoadInvalidInput(t *testing.T) {
	if _, err := Load([]byte("nope, not a key")); err == nil {
		t.Fatal("expected error on garbage input")
	}
	if _, err := Load(nil); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("Load(nil) err = %v, want ErrNotConfigured", err)
	}
}

func TestGenerateArmoredPrivate(t *testing.T) {
	raw, err := GenerateArmoredPrivate("Test Relay", "relay@test.local")
	if err != nil {
		t.Fatalf("GenerateArmoredPrivate: %v", err)
	}
	if !bytes.Contains(raw, []byte("BEGIN PGP PRIVATE KEY BLOCK")) {
		t.Fatalf("generated key is not armored private key: %q", raw)
	}
	kp, err := Load(raw)
	if err != nil {
		t.Fatalf("Load(generated): %v", err)
	}
	if kp.Fingerprint() == "" {
		t.Fatal("expected fingerprint for generated key")
	}
}

func TestLoadOrGenerate(t *testing.T) {
	dir := t.TempDir()
	keyPath := filepath.Join(dir, "data", "relay.asc")
	kp, generated, err := LoadOrGenerate(keyPath, "Auto Relay", "relay@auto.local")
	if err != nil {
		t.Fatalf("LoadOrGenerate(create): %v", err)
	}
	if !generated {
		t.Fatal("expected first call to generate key")
	}
	if kp.Fingerprint() == "" {
		t.Fatal("expected generated key fingerprint")
	}
	info, err := os.Stat(keyPath)
	if err != nil {
		t.Fatalf("stat key: %v", err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("file mode = %o want 600", got)
	}
	kp2, generated2, err := LoadOrGenerate(keyPath, "Auto Relay", "relay@auto.local")
	if err != nil {
		t.Fatalf("LoadOrGenerate(load): %v", err)
	}
	if generated2 {
		t.Fatal("expected second call to reuse existing key")
	}
	if kp2.Fingerprint() != kp.Fingerprint() {
		t.Fatalf("fingerprint changed across reload: %s vs %s", kp2.Fingerprint(), kp.Fingerprint())
	}
}

func TestUnwrapRejectsTamperedCiphertext(t *testing.T) {
	kp, err := Load(makeTestKeyPair(t))
	if err != nil {
		t.Fatal(err)
	}
	ct, err := kp.Wrap([]byte("hello"))
	if err != nil {
		t.Fatal(err)
	}
	// Flip a byte in the middle of the armored block.
	idx := len(ct) / 2
	if ct[idx] == 'A' {
		ct[idx] = 'B'
	} else {
		ct[idx] = 'A'
	}
	if _, err := kp.Unwrap(ct); err == nil {
		t.Fatal("expected Unwrap to fail on tampered ciphertext")
	}
}
