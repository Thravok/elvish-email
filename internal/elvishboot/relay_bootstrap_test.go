package elvishboot

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRelayKeyPathForRoot_Default(t *testing.T) {
	t.Setenv("ELVISH_RELAY_KEY_PATH", "")
	got, explicit := relayKeyPathForRoot("/tmp/elvish-root")
	if explicit {
		t.Fatal("expected default path to be implicit")
	}
	want := filepath.Join("/tmp/elvish-root", "data", "relay.asc")
	if got != want {
		t.Fatalf("path = %q want %q", got, want)
	}
}

func TestRelayKeyPathForRoot_EnvWins(t *testing.T) {
	t.Setenv("ELVISH_RELAY_KEY_PATH", "/custom/relay.asc")
	got, explicit := relayKeyPathForRoot(".")
	if !explicit {
		t.Fatal("expected env path to be explicit")
	}
	if got != "/custom/relay.asc" {
		t.Fatalf("path = %q", got)
	}
}

func TestRelayKeyPathForRoot_EmptyRootFallsBack(t *testing.T) {
	_ = os.Unsetenv("ELVISH_RELAY_KEY_PATH")
	got, explicit := relayKeyPathForRoot("")
	if explicit {
		t.Fatal("expected implicit path")
	}
	want := filepath.Join(".", "data", "relay.asc")
	if got != want {
		t.Fatalf("path = %q want %q", got, want)
	}
}

func TestDKIMSettingsForRoot_Defaults(t *testing.T) {
	t.Setenv("ELVISH_DKIM_SELECTOR", "")
	t.Setenv("ELVISH_DKIM_DOMAIN", "")
	t.Setenv("ELVISH_DKIM_KEY_PATH", "")
	selector, domain, path, explicit := dkimSettingsForRoot("/tmp/elvish-root", "mail.example")
	if explicit {
		t.Fatal("expected implicit defaults")
	}
	if selector != "mail" {
		t.Fatalf("selector = %q", selector)
	}
	if domain != "mail.example" {
		t.Fatalf("domain = %q", domain)
	}
	wantPath := filepath.Join("/tmp/elvish-root", "data", "dkim.pem")
	if path != wantPath {
		t.Fatalf("path = %q want %q", path, wantPath)
	}
}

func TestDKIMSettingsForRoot_KeyPathEnv(t *testing.T) {
	t.Setenv("ELVISH_DKIM_KEY_PATH", "/custom/dkim.pem")
	selector, domain, path, explicit := dkimSettingsForRoot(".", "mail.example")
	if !explicit {
		t.Fatal("expected explicit key path")
	}
	if selector != "mail" || domain != "mail.example" || path != "/custom/dkim.pem" {
		t.Fatalf("unexpected dkim settings: %q %q %q", selector, domain, path)
	}
}
