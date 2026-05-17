package uptime

import (
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"strings"
)

// blockedProbeHosts are hostnames that should never be fetched by server-side probes.
var blockedProbeHosts = map[string]struct{}{
	"metadata.google.internal": {},
	"metadata.goog":            {},
}

// ValidateProbeHTTPURL rejects schemes and destinations that must not be reached by
// elvishserver's outbound uptime checks (notably cloud metadata link-local IPv4).
func ValidateProbeHTTPURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fmt.Errorf("uptime: empty probe url")
	}
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("uptime: invalid probe url: %w", err)
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https":
	default:
		return fmt.Errorf("uptime: probe url must use http or https scheme")
	}
	host := strings.TrimSpace(u.Hostname())
	if host == "" {
		return fmt.Errorf("uptime: probe url missing host")
	}
	hl := strings.ToLower(host)
	if _, bad := blockedProbeHosts[hl]; bad {
		return fmt.Errorf("uptime: probe host %q is not allowed", host)
	}
	if err := validateProbeHostNoMetadataIP(host); err != nil {
		return err
	}
	return nil
}

func validateProbeHostNoMetadataIP(host string) error {
	if net.ParseIP(host) == nil {
		return nil
	}
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return nil
	}
	addr = addr.Unmap()
	if !addr.Is4() {
		return nil
	}
	b := addr.As4()
	// RFC3927 / AWS EC2 / Azure / GCP instance metadata on IPv4 link-local.
	if b[0] == 169 && b[1] == 254 {
		return fmt.Errorf("uptime: probe target must not use IPv4 link-local 169.254.0.0/16 (%s)", host)
	}
	return nil
}
