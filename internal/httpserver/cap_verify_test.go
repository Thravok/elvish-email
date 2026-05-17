package httpserver

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCapSiteVerifyURL(t *testing.T) {
	u, err := capSiteVerifyURL("https://cap.example.com/sitekey/")
	if err != nil {
		t.Fatal(err)
	}
	if u != "https://cap.example.com/siteverify" {
		t.Fatalf("got %q", u)
	}
	_, err = capSiteVerifyURL("http://insecure.example/x/")
	if err == nil {
		t.Fatal("expected error for http")
	}
	_, err = capSiteVerifyURL("")
	if err == nil {
		t.Fatal("expected error for empty")
	}
}

func TestVerifyCapTokenPOST(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method", http.StatusMethodNotAllowed)
			return
		}
		if err := r.ParseForm(); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if r.FormValue("secret") != "sec" || r.FormValue("response") != "tok" {
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": false})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}))
	defer ts.Close()

	client := ts.Client()
	ctx := context.Background()
	if err := verifyCapTokenPOST(ctx, client, ts.URL+"/siteverify", "sec", "tok"); err != nil {
		t.Fatal(err)
	}
	if err := verifyCapTokenPOST(ctx, client, ts.URL+"/siteverify", "sec", "bad"); err == nil {
		t.Fatal("expected error")
	}
}

func TestVerifyCapTokenPOST_nonOKStatus(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusInternalServerError)
	}))
	defer ts.Close()
	err := verifyCapTokenPOST(context.Background(), ts.Client(), ts.URL, "s", "t")
	if err == nil || !strings.Contains(err.Error(), "500") {
		t.Fatalf("expected 500 error, got %v", err)
	}
}

func TestVerifyCapTokenPOST_invalidJSON(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "not-json")
	}))
	defer ts.Close()
	err := verifyCapTokenPOST(context.Background(), ts.Client(), ts.URL, "s", "t")
	if err == nil {
		t.Fatal("expected json error")
	}
}
