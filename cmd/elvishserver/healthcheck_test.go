package main

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

func TestRunHealthcheck(t *testing.T) {
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
	if err := runHealthcheck(":" + port); err != nil {
		t.Fatalf("runHealthcheck: %v", err)
	}
}

func TestRunHealthcheckBadStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	_, port, err := net.SplitHostPort(srv.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	if err := runHealthcheck(":" + port); err == nil {
		t.Fatal("expected error for non-200 healthz")
	}
}

func TestRunHealthcheckTimeout(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_ = ctx
	if err := runHealthcheck("127.0.0.1:1"); err == nil {
		t.Fatal("expected connection error for closed port")
	}
}
