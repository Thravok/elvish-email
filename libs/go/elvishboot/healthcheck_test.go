package elvishboot

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLoopbackDialAddr(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{":8765", "127.0.0.1:8765"},
		{":25", "127.0.0.1:25"},
		{"0.0.0.0:587", "127.0.0.1:587"},
		{"127.0.0.1:8765", "127.0.0.1:8765"},
	}
	for _, tc := range tests {
		got, err := loopbackDialAddr(tc.in)
		if err != nil {
			t.Fatalf("loopbackDialAddr(%q): %v", tc.in, err)
		}
		if got != tc.want {
			t.Fatalf("loopbackDialAddr(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestProbeHTTPHealth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/healthz" {
			http.NotFound(w, r)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	_, port, err := net.SplitHostPort(srv.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	if err := probeHTTPHealth(context.Background(), ":"+port); err != nil {
		t.Fatalf("probeHTTPHealth: %v", err)
	}
}

func TestRunHealthcheckMTA_TCP(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	_, port, err := net.SplitHostPort(ln.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("ELVISH_HTTP_ENABLED", "0")
	t.Setenv("ELVISH_SMTP_ADDR", ":"+port)
	t.Setenv("ELVISH_SMTP_SUBMISSION_ADDR", ":"+port)
	if err := RunHealthcheck(RoleMTA, Flags{Addr: ":8765"}); err != nil {
		t.Fatalf("RunHealthcheck: %v", err)
	}
}
