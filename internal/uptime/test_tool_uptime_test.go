package uptime

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestTestToolUptimeOnce_DefaultHTTP(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/alpha/" {
			t.Errorf("path %q", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)

	base := strings.TrimSuffix(srv.URL, "")
	res, err := TestToolUptimeOnce(context.Background(), http.DefaultClient, base, "alpha", "", nil, 3*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if !res.OK {
		t.Fatalf("want ok, got %#v", res)
	}
	if res.ID != "tool_alpha" {
		t.Errorf("id %q", res.ID)
	}
}
