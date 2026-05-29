package mailtest

import (
	"context"
	"testing"
	"time"

	"elvish/libs/go/keyserver"
)

func TestRunWrapRoundtrip_OK(t *testing.T) {
	t.Parallel()
	for _, kdfName := range []string{"argon2id", "pbkdf2-sha256"} {
		res := RunWrapRoundtrip(kdfName)
		if !res.OK {
			t.Fatalf("%s failed: %+v", kdfName, res)
		}
		if res.KDF == "" || res.SaltHex == "" || res.NonceHex == "" || res.CipherB64 == "" || res.PlainSHA256 == "" {
			t.Fatalf("%s returned incomplete result: %+v", kdfName, res)
		}
	}
}

func TestProbeKeyserverFound(t *testing.T) {
	t.Parallel()
	src := keyserver.NewMockSource("mock")
	src.Set("alice@example.com", "FP123", "-----BEGIN PGP PUBLIC KEY BLOCK-----\nTEST\n-----END PGP PUBLIC KEY BLOCK-----")
	resolver := &keyserver.Resolver{
		Sources:   []keyserver.Source{src},
		OpTimeout: time.Second,
	}
	res := ProbeKeyserver(context.Background(), resolver, "alice@example.com")
	if !res.Found {
		t.Fatalf("expected found result: %+v", res)
	}
	if res.Source != "mock" {
		t.Fatalf("source = %q want mock", res.Source)
	}
	if res.Fingerprint != "FP123" {
		t.Fatalf("fingerprint = %q", res.Fingerprint)
	}
}

func TestProbeKeyserverNilResolver(t *testing.T) {
	t.Parallel()
	res := ProbeKeyserver(context.Background(), nil, "alice@example.com")
	if res.Found {
		t.Fatalf("unexpected found result: %+v", res)
	}
	if res.Error == "" {
		t.Fatalf("expected error: %+v", res)
	}
}
