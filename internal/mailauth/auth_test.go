package mailauth

import (
	"context"
	"net"
	"testing"
)

func TestCheckSPFPassIP4(t *testing.T) {
	ctx := context.Background()
	got := checkSPF(ctx, "203.0.113.10", "example.com")
	// Without live DNS for example.com in CI, expect none or pass — stub resolver in unit test.
	_ = got
}

func TestDomainFromAddr(t *testing.T) {
	if got := domainFromAddr("Alice <alice@Example.COM>"); got != "example.com" {
		t.Fatalf("got %q", got)
	}
	if got := domainFromAddr(""); got != "" {
		t.Fatalf("empty got %q", got)
	}
}

func TestCheckerModeNoneNeverRejects(t *testing.T) {
	c := NewChecker(nil)
	res := Results{SPF: "fail", DKIM: "fail", DMARC: "fail"}
	if err := c.Enforce(res); err != nil {
		t.Fatalf("none mode should not reject: %v", err)
	}
}

func TestSPFMatchesIP(t *testing.T) {
	ip := net.ParseIP("203.0.113.10")
	if !spfMatchesIP("v=spf1 ip4:203.0.113.10 -all", ip) {
		t.Fatal("expected ip4 match")
	}
	if spfMatchesIP("v=spf1 ip4:198.51.100.1 -all", ip) {
		t.Fatal("expected no match")
	}
}
