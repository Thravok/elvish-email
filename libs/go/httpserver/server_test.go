package httpserver

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewSkipSSRWithoutTemplates(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "data"), 0o755); err != nil {
		t.Fatal(err)
	}

	srv, err := New(Options{Root: root, SkipSSR: true}, nil)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if srv == nil {
		t.Fatal("expected server")
	}
	if srv.eng != nil {
		t.Fatal("expected nil render engine when SkipSSR is set")
	}
}
