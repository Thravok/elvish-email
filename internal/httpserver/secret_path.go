package httpserver

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// secretFileUnderDir joins dir and a sanitized basename; domain-derived names must pass basename checks first.
func secretFileUnderDir(dir, base string) (string, error) {
	dir = filepath.Clean(strings.TrimSpace(dir))
	raw := strings.TrimSpace(base)
	if raw == "" || raw == "." || strings.Contains(raw, "..") || strings.ContainsRune(raw, filepath.Separator) {
		return "", errors.New("invalid secret basename")
	}
	base = filepath.Base(raw)
	if dir == "" || dir == "." {
		return "", errors.New("secret directory required")
	}
	if base == "" || base == "." {
		return "", errors.New("invalid secret basename")
	}
	full := filepath.Join(dir, base)
	if !pathWithinBaseDir(dir, full) {
		return "", errors.New("secret path outside base directory")
	}
	return full, nil
}

func pathWithinBaseDir(dir, full string) bool {
	dir = filepath.Clean(dir)
	full = filepath.Clean(full)
	rel, err := filepath.Rel(dir, full)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

func validateConfiguredSecretPath(path string) error {
	path = filepath.Clean(strings.TrimSpace(path))
	if path == "" || path == "." {
		return errors.New("secret path required")
	}
	if strings.Contains(path, "\x00") || strings.Contains(path, "..") {
		return errors.New("invalid secret path")
	}
	return nil
}

func writeSecretFile(path string, body []byte) error {
	if err := validateConfiguredSecretPath(path); err != nil {
		return err
	}
	return writeSecretFileAt(path, body)
}

func writeSecretFileAt(path string, body []byte) error {
	// path was produced by validateConfiguredSecretPath or secretFileUnderDir.
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil { //codeql[go/path-injection]
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".tmp-secret-*")
	if err != nil {
		return err
	}
	tmpPath := f.Name()
	defer func() {
		_ = f.Close()
		_ = os.Remove(tmpPath)
	}()
	if err := f.Chmod(0o600); err != nil {
		return err
	}
	if _, err := f.Write(body); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil { //codeql[go/path-injection]
		return err
	}
	return os.Chmod(path, 0o600) //codeql[go/path-injection]
}
