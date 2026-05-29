package httpserver

import (
	"context"
	"net"
	"strings"
	"time"
)

type dnsResolver interface {
	LookupTXT(ctx context.Context, name string) ([]string, error)
	LookupMX(ctx context.Context, name string) ([]*net.MX, error)
}

var systemDNSResolver dnsResolver = net.DefaultResolver

type deliveryDNSCheck struct {
	Name     string   `json:"name"`
	OK       bool     `json:"ok"`
	Expected string   `json:"expected,omitempty"`
	Values   []string `json:"values,omitempty"`
	Error    string   `json:"error,omitempty"`
	Note     string   `json:"note,omitempty"`
}

type adminMailDeliveryChecks struct {
	Domain      string           `json:"domain"`
	Selector    string           `json:"selector,omitempty"`
	DKIMDNSName string           `json:"dkim_dns_name,omitempty"`
	MX          deliveryDNSCheck `json:"mx"`
	SPF         deliveryDNSCheck `json:"spf"`
	DKIM        deliveryDNSCheck `json:"dkim"`
	DMARC       deliveryDNSCheck `json:"dmarc"`
	Ready       bool             `json:"ready"`
	Issues      []string         `json:"issues,omitempty"`
}

func (s *Server) deliveryChecksForDomain(ctx context.Context, domain string) adminMailDeliveryChecks {
	domain = strings.TrimSpace(strings.ToLower(domain))
	out := adminMailDeliveryChecks{Domain: domain}
	if domain == "" {
		out.Issues = []string{"domain required for delivery checks"}
		return out
	}

	dkimStatus := s.dkimKeyStatusForDomain(ctx, domain)
	out.Selector = strings.TrimSpace(strings.ToLower(dkimStatus.Selector))
	if out.Selector != "" {
		out.DKIMDNSName = out.Selector + "._domainkey." + domain
	}

	out.MX = lookupMXCheck(ctx, systemDNSResolver, domain)
	out.SPF = lookupTXTCheck(ctx, systemDNSResolver, domain, "v=spf1", func(v string) bool {
		return strings.HasPrefix(strings.ToLower(v), "v=spf1")
	})
	out.DMARC = lookupTXTCheck(ctx, systemDNSResolver, "_dmarc."+domain, "v=DMARC1", func(v string) bool {
		return strings.HasPrefix(strings.ToLower(v), "v=dmarc1")
	})
	out.DKIM = buildDKIMCheck(ctx, domain, dkimStatus)

	if !out.MX.OK {
		out.Issues = append(out.Issues, issueText("MX", out.MX))
	}
	if !out.SPF.OK {
		out.Issues = append(out.Issues, issueText("SPF", out.SPF))
	}
	if !out.DKIM.OK {
		out.Issues = append(out.Issues, issueText("DKIM", out.DKIM))
	}
	if !out.DMARC.OK {
		out.Issues = append(out.Issues, issueText("DMARC", out.DMARC))
	}
	out.Ready = out.MX.OK && out.SPF.OK && out.DKIM.OK && out.DMARC.OK
	return out
}

func lookupMXCheck(ctx context.Context, resolver dnsResolver, name string) deliveryDNSCheck {
	check := deliveryDNSCheck{Name: name}
	mx, err := lookupMXWithTimeout(ctx, resolver, name)
	if err != nil {
		check.Error = err.Error()
		return check
	}
	if len(mx) == 0 {
		check.Note = "no MX records returned"
		return check
	}
	check.OK = true
	for _, rec := range mx {
		host := strings.TrimSuffix(strings.TrimSpace(rec.Host), ".")
		if host != "" {
			check.Values = append(check.Values, host)
		}
	}
	return check
}

func lookupTXTCheck(ctx context.Context, resolver dnsResolver, name, expected string, match func(string) bool) deliveryDNSCheck {
	check := deliveryDNSCheck{Name: name, Expected: expected}
	recs, err := lookupTXTWithTimeout(ctx, resolver, name)
	if err != nil {
		check.Error = err.Error()
		return check
	}
	check.Values = cleanTXTValues(recs)
	for _, rec := range check.Values {
		if match(rec) {
			check.OK = true
			return check
		}
	}
	check.Note = "expected TXT record not found"
	return check
}

func buildDKIMCheck(ctx context.Context, domain string, status adminDKIMKeyStatus) deliveryDNSCheck {
	selector := strings.TrimSpace(strings.ToLower(status.Selector))
	name := ""
	if selector != "" {
		name = selector + "._domainkey." + domain
	}
	check := deliveryDNSCheck{
		Name:     name,
		Expected: strings.TrimSpace(status.PublicTXT),
	}
	if selector == "" {
		check.Note = "selector not configured"
		return check
	}
	if strings.TrimSpace(status.PublicTXT) == "" {
		if strings.TrimSpace(status.Error) != "" {
			check.Note = status.Error
		} else if !status.Present {
			check.Note = "DKIM key not present"
		} else {
			check.Note = "DKIM public TXT unavailable"
		}
		return check
	}
	recs, err := lookupTXTWithTimeout(ctx, systemDNSResolver, name)
	if err != nil {
		check.Error = err.Error()
		return check
	}
	check.Values = cleanTXTValues(recs)
	if matchTXTExact(check.Values, status.PublicTXT) {
		check.OK = true
		return check
	}
	check.Note = "published DKIM TXT does not match the active key"
	return check
}

func lookupTXTWithTimeout(parent context.Context, resolver dnsResolver, name string) ([]string, error) {
	ctx, cancel := context.WithTimeout(parent, 5*time.Second)
	defer cancel()
	return resolver.LookupTXT(ctx, name)
}

func lookupMXWithTimeout(parent context.Context, resolver dnsResolver, name string) ([]*net.MX, error) {
	ctx, cancel := context.WithTimeout(parent, 5*time.Second)
	defer cancel()
	return resolver.LookupMX(ctx, name)
}

func cleanTXTValues(recs []string) []string {
	out := make([]string, 0, len(recs))
	for _, rec := range recs {
		rec = strings.TrimSpace(rec)
		if rec != "" {
			out = append(out, rec)
		}
	}
	return out
}

func matchTXTExact(records []string, want string) bool {
	want = normalizeTXTValue(want)
	if want == "" {
		return false
	}
	for _, rec := range records {
		norm := normalizeTXTValue(rec)
		if norm == want || strings.Contains(norm, want) {
			return true
		}
	}
	return false
}

func normalizeTXTValue(v string) string {
	replacer := strings.NewReplacer(" ", "", "\t", "", "\r", "", "\n", "", "\"", "")
	return replacer.Replace(strings.TrimSpace(v))
}

func issueText(label string, check deliveryDNSCheck) string {
	if check.Note != "" {
		return label + ": " + check.Note
	}
	if check.Error != "" {
		return label + ": " + check.Error
	}
	return label + ": missing"
}

// adminDeliveryCheckDomain picks the domain used for admin deliverability previews (default sender domain).
func (s *Server) adminDeliveryCheckDomain(ctx context.Context) string {
	domains, err := s.adminSenderDomainOptions(ctx)
	if err != nil || len(domains) == 0 {
		d := strings.TrimSpace(strings.ToLower(s.dkimDomain))
		if d != "" {
			return d
		}
		return strings.TrimSpace(strings.ToLower(s.EffectiveMailDomain()))
	}
	return domains[0].Domain
}
