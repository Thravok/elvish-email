package toolcalls

import "testing"

func TestFormatCount_Magnitudes_ReturnsShortStrings(t *testing.T) {
	t.Parallel()
	if FormatCount(0) != "0" {
		t.Fatalf("0: %q", FormatCount(0))
	}
	if FormatCount(999) != "999" {
		t.Fatalf("999: %q", FormatCount(999))
	}
	if FormatCount(1500) != "1.5K" {
		t.Fatalf("1500: %q", FormatCount(1500))
	}
	if FormatCount(3_460_000) != "3.5M" {
		t.Fatalf("3460000: %q", FormatCount(3_460_000))
	}
}
