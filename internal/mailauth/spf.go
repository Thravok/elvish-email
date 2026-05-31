package mailauth

import (
	"context"
	"net"
	"strings"
)

// checkSPF performs a lightweight SPF evaluation against the connecting IP and From domain.
func checkSPF(ctx context.Context, peerHost, domain string) string {
	if peerHost == "" || domain == "" {
		return "none"
	}
	ip := net.ParseIP(peerHost)
	if ip == nil {
		return "none"
	}
	txts, err := net.DefaultResolver.LookupTXT(ctx, domain)
	if err != nil || len(txts) == 0 {
		return "none"
	}
	var spf string
	for _, t := range txts {
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(t)), "v=spf1") {
			spf = t
			break
		}
	}
	if spf == "" {
		return "none"
	}
	lower := strings.ToLower(spf)
	if strings.Contains(lower, "-all") {
		// Strict policy without a matching pass mechanism → fail for unknown senders.
		if spfMatchesIP(lower, ip) {
			return "pass"
		}
		return "fail"
	}
	if spfMatchesIP(lower, ip) {
		return "pass"
	}
	if strings.Contains(lower, "~all") || strings.Contains(lower, "?all") {
		return "softfail"
	}
	return "neutral"
}

func spfMatchesIP(spfLower string, ip net.IP) bool {
	ipStr := ip.String()
	parts := strings.Fields(spfLower)
	for _, p := range parts {
		switch {
		case strings.HasPrefix(p, "ip4:"):
			cidr := strings.TrimPrefix(p, "ip4:")
			if _, n, err := net.ParseCIDR(cidr); err == nil && n.Contains(ip) {
				return true
			}
			if cidr == ipStr {
				return true
			}
		case strings.HasPrefix(p, "ip6:"):
			cidr := strings.TrimPrefix(p, "ip6:")
			if _, n, err := net.ParseCIDR(cidr); err == nil && n.Contains(ip) {
				return true
			}
			if cidr == ipStr {
				return true
			}
		case p == "+all" || p == "all":
			return true
		}
	}
	return false
}
