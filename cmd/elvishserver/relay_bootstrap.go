package main

import (
	"os"
	"path/filepath"
	"strings"
)

func relayKeyPathForRoot(root string) (string, bool) {
	if path := strings.TrimSpace(os.Getenv("ELVISH_RELAY_KEY_PATH")); path != "" {
		return path, true
	}
	root = filepath.Clean(strings.TrimSpace(root))
	if root == "" {
		root = "."
	}
	return filepath.Join(root, "data", "relay.asc"), false
}

func dkimSettingsForRoot(root, mailDomain string) (selector, domain, path string, explicit bool) {
	root = filepath.Clean(strings.TrimSpace(root))
	if root == "" {
		root = "."
	}
	selector = strings.TrimSpace(os.Getenv("ELVISH_DKIM_SELECTOR"))
	domain = strings.TrimSpace(os.Getenv("ELVISH_DKIM_DOMAIN"))
	path = strings.TrimSpace(os.Getenv("ELVISH_DKIM_KEY_PATH"))
	explicit = selector != "" || domain != "" || path != ""
	if selector == "" {
		selector = "mail"
	}
	if domain == "" {
		domain = strings.TrimSpace(mailDomain)
	}
	if path == "" {
		path = filepath.Join(root, "data", "dkim.pem")
	}
	return selector, domain, path, explicit
}
