package mfa

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
)

func TestServiceEncryptDecryptRoundTrip(t *testing.T) {
	t.Setenv(envEncryptionKey, base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")))
	svc, err := NewFromEnv()
	if err != nil {
		t.Fatalf("NewFromEnv: %v", err)
	}
	plain := []byte("MFA secret material")
	ciphertext, err := svc.Encrypt(plain)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if string(ciphertext) == string(plain) {
		t.Fatal("ciphertext should not equal plaintext")
	}
	roundTrip, err := svc.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if string(roundTrip) != string(plain) {
		t.Fatalf("roundTrip = %q, want %q", roundTrip, plain)
	}
}

func TestValidateTOTP_GeneratedCode(t *testing.T) {
	key, err := NewTOTPKey("Elvish", "alice@example.test")
	if err != nil {
		t.Fatalf("NewTOTPKey: %v", err)
	}
	code, err := totp.GenerateCode(key.Secret(), time.Now().UTC())
	if err != nil {
		t.Fatalf("GenerateCode: %v", err)
	}
	if !ValidateTOTP(code, key.Secret()) {
		t.Fatal("ValidateTOTP returned false for a generated code")
	}
}

func TestRecoveryCodeHashIgnoresFormatting(t *testing.T) {
	codes, err := GenerateRecoveryCodes(1)
	if err != nil {
		t.Fatalf("GenerateRecoveryCodes: %v", err)
	}
	code := codes[0]
	hash := HashRecoveryCode(code)
	compact := NormalizeRecoveryCode(code)
	if !RecoveryCodeMatches(hash, compact) {
		t.Fatal("RecoveryCodeMatches should accept normalized code")
	}
	if !RecoveryCodeMatches(hash, code) {
		t.Fatal("RecoveryCodeMatches should accept original formatted code")
	}
}

func TestLoadOrGenerateEncryptionKey(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "mfa.key")
	raw, generated, err := LoadOrGenerateEncryptionKey(path)
	if err != nil {
		t.Fatalf("LoadOrGenerateEncryptionKey(create): %v", err)
	}
	if !generated {
		t.Fatal("expected first call to generate key")
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat: %v", err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("file mode = %o want 600", got)
	}
	t.Setenv(envEncryptionKey, raw)
	if _, err := NewFromEnv(); err != nil {
		t.Fatalf("NewFromEnv(generated): %v", err)
	}
	raw2, generated2, err := LoadOrGenerateEncryptionKey(path)
	if err != nil {
		t.Fatalf("LoadOrGenerateEncryptionKey(load): %v", err)
	}
	if generated2 {
		t.Fatal("expected second call to reuse existing key")
	}
	if raw2 != raw {
		t.Fatalf("key mismatch: %q vs %q", raw2, raw)
	}
}
