package store

import "testing"

func TestIsDisabledPasswordHash_TrimsSentinel(t *testing.T) {
	t.Parallel()

	if !IsDisabledPasswordHash(" \t" + DisabledPasswordHash() + "\n") {
		t.Fatal("expected disabled sentinel with surrounding whitespace to be recognized")
	}
	if IsDisabledPasswordHash("$srp$") {
		t.Fatal("expected non-disabled sentinel to remain active")
	}
}
