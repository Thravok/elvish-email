package elvishboot

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"elvish/libs/go/dkim"
)

const envDKIMAutoGenerate = "ELVISH_AUTO_GEN_DKIM_KEY"

func maybeBootstrapDKIMKey(root, mailDomain string, logger *slog.Logger) error {
	if !envTruthy(envDKIMAutoGenerate) {
		return nil
	}
	_, _, path, _ := dkimSettingsForRoot(root, mailDomain)
	if _, err := os.Stat(path); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("bootstrap dkim key stat %s: %w", path, err)
	}
	dir := filepath.Dir(path)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return fmt.Errorf("bootstrap dkim key mkdir %s: %w", dir, err)
		}
	}
	raw, err := dkim.GenerateRSAPrivatePEM(2048)
	if err != nil {
		return fmt.Errorf("bootstrap dkim key generate: %w", err)
	}
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		return fmt.Errorf("bootstrap dkim key write %s: %w", path, err)
	}
	if logger != nil {
		logger.Info("dkim key generated for local development", "path", path)
	}
	return nil
}
