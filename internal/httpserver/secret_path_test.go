package httpserver

import "testing"

func TestSecretFileUnderDir_RejectsTraversal(t *testing.T) {
	t.Parallel()
	if _, err := secretFileUnderDir("/data/dkim", "../escape.pem"); err == nil {
		t.Fatal("expected error for traversal basename")
	}
}

func TestValidateConfiguredSecretPath(t *testing.T) {
	t.Parallel()
	if err := validateConfiguredSecretPath("/tmp/elvish/relay.key"); err != nil {
		t.Fatalf("absolute path: %v", err)
	}
	if err := validateConfiguredSecretPath("relative/key"); err == nil {
		t.Fatal("expected error for relative path")
	}
}
