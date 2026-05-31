package keyserver

import (
	"fmt"
	"net"
	"strings"
)

// wkdDomainOK rejects hostnames that must not drive server-side WKD fetches.
func wkdDomainOK(domain string) error {
	d := strings.TrimSpace(strings.ToLower(domain))
	if d == "" {
		return fmt.Errorf("empty wkd domain")
	}
	if net.ParseIP(d) != nil {
		return fmt.Errorf("wkd domain must not be an IP literal")
	}
	if strings.Contains(d, ":") {
		return fmt.Errorf("wkd domain must not contain ':'")
	}
	if strings.ContainsAny(d, "/\\") {
		return fmt.Errorf("wkd domain must not contain path separators")
	}
	for _, p := range strings.Split(d, ".") {
		if len(p) == 0 || len(p) > 63 {
			return fmt.Errorf("invalid wkd domain label")
		}
	}
	return nil
}
