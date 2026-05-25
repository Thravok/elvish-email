package elvishboot

import (
	"crypto/tls"
	"log/slog"
	"os"
	"strings"
)

func smtpServerTLSConfig(logger *slog.Logger) *tls.Config {
	certPath := strings.TrimSpace(os.Getenv("ELVISH_SMTP_TLS_CERT_PATH"))
	keyPath := strings.TrimSpace(os.Getenv("ELVISH_SMTP_TLS_KEY_PATH"))
	if certPath == "" || keyPath == "" {
		return nil
	}
	cert, err := tls.LoadX509KeyPair(certPath, keyPath)
	if err != nil {
		if logger != nil {
			logger.Warn("smtp tls disabled", "err", err, "cert_path", certPath, "key_path", keyPath)
		}
		return nil
	}
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}
}

func smtpClientTLSConfig() *tls.Config {
	return &tls.Config{MinVersion: tls.VersionTLS12}
}
