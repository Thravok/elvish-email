package elvishboot

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMFAKeyPathForRoot_Default(t *testing.T) {
	t.Setenv(envMFAKeyPath, "")
	got, explicit := mfaKeyPathForRoot("/tmp/elvish-root")
	if explicit {
		t.Fatal("expected default path to be implicit")
	}
	want := filepath.Join("/tmp/elvish-root", "data", "mfa.key")
	if got != want {
		t.Fatalf("path = %q want %q", got, want)
	}
}

func TestMFAKeyPathForRoot_EnvWins(t *testing.T) {
	t.Setenv(envMFAKeyPath, "/custom/mfa.key")
	got, explicit := mfaKeyPathForRoot(".")
	if !explicit {
		t.Fatal("expected env path to be explicit")
	}
	if got != "/custom/mfa.key" {
		t.Fatalf("path = %q", got)
	}
}

func TestMaybeBootstrapMFAEncryptionKey_DisabledSkipsGeneration(t *testing.T) {
	t.Setenv("ELVISH_MFA_ENCRYPTION_KEY", "")
	t.Setenv(envMFAAutoGenerate, "0")
	root := t.TempDir()
	if err := maybeBootstrapMFAEncryptionKey(root, nil); err != nil {
		t.Fatalf("maybeBootstrapMFAEncryptionKey: %v", err)
	}
	if got := strings.TrimSpace(os.Getenv("ELVISH_MFA_ENCRYPTION_KEY")); got != "" {
		t.Fatalf("unexpected env key %q", got)
	}
	_, err := os.Stat(filepath.Join(root, "data", "mfa.key"))
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected no key file, got err=%v", err)
	}
}

func TestMaybeBootstrapMFAEncryptionKey_GeneratesAndReusesKey(t *testing.T) {
	t.Setenv("ELVISH_MFA_ENCRYPTION_KEY", "")
	t.Setenv(envMFAAutoGenerate, "1")
	root := t.TempDir()
	if err := maybeBootstrapMFAEncryptionKey(root, nil); err != nil {
		t.Fatalf("maybeBootstrapMFAEncryptionKey(first): %v", err)
	}
	first := strings.TrimSpace(os.Getenv("ELVISH_MFA_ENCRYPTION_KEY"))
	if first == "" {
		t.Fatal("expected env key to be set")
	}
	data, err := os.ReadFile(filepath.Join(root, "data", "mfa.key"))
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if strings.TrimSpace(string(data)) != first {
		t.Fatalf("file key = %q want %q", strings.TrimSpace(string(data)), first)
	}
	if err := os.Unsetenv("ELVISH_MFA_ENCRYPTION_KEY"); err != nil {
		t.Fatalf("Unsetenv: %v", err)
	}
	if err := maybeBootstrapMFAEncryptionKey(root, nil); err != nil {
		t.Fatalf("maybeBootstrapMFAEncryptionKey(second): %v", err)
	}
	second := strings.TrimSpace(os.Getenv("ELVISH_MFA_ENCRYPTION_KEY"))
	if second != first {
		t.Fatalf("second key = %q want %q", second, first)
	}
}
