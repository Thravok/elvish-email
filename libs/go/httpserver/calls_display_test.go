package httpserver

import "testing"

func TestCallsUsesLiveCounter_YAMLValues_DetectsLiveMode(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in   string
		want bool
	}{
		{"", true},
		{"live", true},
		{"AUTO", true},
		{"/", true},
		{"—", true},
		{"-", true},
		{"1.2M", false},
		{"340", false},
	}
	for _, c := range cases {
		if got := callsUsesLiveCounter(c.in); got != c.want {
			t.Fatalf("callsUsesLiveCounter(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestMergeToolCallsDisplay_LiveAndOverrides_FormatsCounts(t *testing.T) {
	t.Parallel()
	if mergeToolCallsDisplay("1.2M", 99, true, false) != "1.2M" {
		t.Fatal("manual override ignored")
	}
	if mergeToolCallsDisplay("—", 0, false, false) != "—" {
		t.Fatal("no valkey fallback")
	}
	if mergeToolCallsDisplay("—", 1500, true, false) != "1.5K" {
		t.Fatalf("got %q", mergeToolCallsDisplay("—", 1500, true, false))
	}
	if mergeToolCallsDisplay("—", 1500, true, true) != "—" {
		t.Fatal("calls_static should skip valkey merge")
	}
}
