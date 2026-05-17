package db

import (
	"os"
	"testing"
)

func TestLoadConfigFromEnv_defaults(t *testing.T) {
	_ = os.Unsetenv("COCKROACH_DSN")
	_ = os.Unsetenv("VALKEY_ADDR")
	_ = os.Unsetenv("VALKEY_PASSWORD")
	_ = os.Unsetenv("VALKEY_DB")
	t.Cleanup(func() {
		_ = os.Unsetenv("COCKROACH_DSN")
		_ = os.Unsetenv("VALKEY_ADDR")
		_ = os.Unsetenv("VALKEY_PASSWORD")
		_ = os.Unsetenv("VALKEY_DB")
	})

	c := LoadConfigFromEnv()
	if c.Enabled() {
		t.Fatal("expected disabled when env empty")
	}
	if err := c.Validate(); err != nil {
		t.Fatal(err)
	}
}

func TestConfigValidate_PasswordWithoutAddr_ReturnsError(t *testing.T) {
	t.Setenv("VALKEY_PASSWORD", "x")
	t.Setenv("VALKEY_ADDR", "")
	c := LoadConfigFromEnv()
	if err := c.Validate(); err == nil {
		t.Fatal("expected error")
	}
}
