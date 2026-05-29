package httpserver

import "testing"

func TestProbeBaseFromAddr_ListenAddrs_ReturnsBaseURL(t *testing.T) {
	t.Parallel()
	cases := []struct {
		addr, want string
	}{
		{":8765", "http://127.0.0.1:8765"},
		{"0.0.0.0:3000", "http://127.0.0.1:3000"},
		{"127.0.0.1:8080", "http://127.0.0.1:8080"},
		{"localhost:443", "https://localhost:443"},
	}
	for _, tc := range cases {
		got := ProbeBaseFromAddr(tc.addr)
		if got != tc.want {
			t.Errorf("ProbeBaseFromAddr(%q) = %q, want %q", tc.addr, got, tc.want)
		}
	}
}
