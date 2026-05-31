package elvishboot

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestMaybeBootstrapDKIMKey_DisabledSkipsGeneration(t *testing.T) {
	t.Setenv(envDKIMAutoGenerate, "0")
	root := t.TempDir()
	if err := maybeBootstrapDKIMKey(root, "mail.example", nil); err != nil {
		t.Fatalf("maybeBootstrapDKIMKey: %v", err)
	}
	_, err := os.Stat(filepath.Join(root, "data", "dkim.pem"))
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected no key file, got err=%v", err)
	}
}

func TestMaybeBootstrapDKIMKey_GeneratesAndReusesKey(t *testing.T) {
	t.Setenv(envDKIMAutoGenerate, "1")
	root := t.TempDir()
	if err := maybeBootstrapDKIMKey(root, "mail.example", nil); err != nil {
		t.Fatalf("maybeBootstrapDKIMKey(first): %v", err)
	}
	path := filepath.Join(root, "data", "dkim.pem")
	first, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if len(first) == 0 {
		t.Fatal("expected non-empty dkim pem")
	}
	if err := maybeBootstrapDKIMKey(root, "mail.example", nil); err != nil {
		t.Fatalf("maybeBootstrapDKIMKey(second): %v", err)
	}
	second, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile second: %v", err)
	}
	if string(second) != string(first) {
		t.Fatal("expected existing dkim key to be reused")
	}
}
