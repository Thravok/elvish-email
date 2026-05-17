package main

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	mfautil "elvish/internal/mfa"
)

const (
	envMFAAutoGenerate = "ELVISH_AUTO_GEN_MFA_KEY"
	envMFAKeyPath      = "ELVISH_MFA_ENCRYPTION_KEY_PATH"
)

func mfaKeyPathForRoot(root string) (string, bool) {
	if path := strings.TrimSpace(os.Getenv(envMFAKeyPath)); path != "" {
		return path, true
	}
	root = filepath.Clean(strings.TrimSpace(root))
	if root == "" {
		root = "."
	}
	return filepath.Join(root, "data", "mfa.key"), false
}

func maybeBootstrapMFAEncryptionKey(root string, logger *slog.Logger) error {
	if strings.TrimSpace(os.Getenv("ELVISH_MFA_ENCRYPTION_KEY")) != "" || !envTruthyMain(envMFAAutoGenerate) {
		return nil
	}
	path, _ := mfaKeyPathForRoot(root)
	raw, generated, err := mfautil.LoadOrGenerateEncryptionKey(path)
	if err != nil {
		return fmt.Errorf("bootstrap mfa encryption key: %w", err)
	}
	if err := os.Setenv("ELVISH_MFA_ENCRYPTION_KEY", raw); err != nil {
		return fmt.Errorf("set ELVISH_MFA_ENCRYPTION_KEY: %w", err)
	}
	if logger != nil {
		msg := "mfa encryption key loaded for local development"
		if generated {
			msg = "mfa encryption key generated for local development"
		}
		logger.Info(msg, "path", path)
	}
	return nil
}
