package mailauth

import (
	"context"
	"net"
	"strings"
)

type txtResolver interface {
	LookupTXT(ctx context.Context, name string) ([]string, error)
}

var netDefaultResolver txtResolver = defaultResolver{}

type defaultResolver struct{}

func (defaultResolver) LookupTXT(ctx context.Context, name string) ([]string, error) {
	return net.DefaultResolver.LookupTXT(ctx, name)
}

// checkDMARC evaluates _dmarc.{domain} policy against SPF/DKIM alignment (simplified).
func checkDMARC(ctx context.Context, domain, spf, dkim string) string {
	if domain == "" {
		return "none"
	}
	txts, err := netDefaultResolver.LookupTXT(ctx, "_dmarc."+domain)
	if err != nil || len(txts) == 0 {
		return "none"
	}
	var record string
	for _, t := range txts {
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(t)), "v=dmarc1") {
			record = strings.ToLower(t)
			break
		}
	}
	if record == "" {
		return "none"
	}
	policy := "none"
	if i := strings.Index(record, "p="); i >= 0 {
		rest := record[i+2:]
		if j := strings.IndexAny(rest, "; \t"); j >= 0 {
			policy = strings.TrimSpace(rest[:j])
		} else {
			policy = strings.TrimSpace(rest)
		}
	}
	aligned := spf == "pass" || dkim == "pass"
	if aligned {
		return "pass"
	}
	switch policy {
	case "reject", "quarantine":
		return "fail"
	default:
		return "none"
	}
}
