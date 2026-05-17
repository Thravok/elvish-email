package httpserver

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAPISpecAndDocsRoutes(t *testing.T) {
	t.Parallel()
	s := &Server{log: slog.New(slog.NewTextHandler(io.Discard, nil))}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/openapi.yaml", nil)
	s.handleAPI(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("openapi.yaml: status %d", rec.Code)
	}
	if rec.Header().Get("Content-Type") == "" {
		t.Fatal("expected Content-Type on openapi response")
	}

	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/api/docs", nil)
	s.handleAPI(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("/api/docs: status %d", rec2.Code)
	}
}
