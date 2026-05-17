package blobstore

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"elvish/internal/relaykey"
)

// TestSignRequestAddsHeaders verifies the signer populates the expected SigV4 headers.
func TestSignRequestAddsHeaders(t *testing.T) {
	req, err := http.NewRequest(http.MethodPut, "https://bucket.example.com/path/to/key", strings.NewReader("payload"))
	if err != nil {
		t.Fatal(err)
	}
	cfg := SignerConfig{Region: "us-east-1", Service: "s3", AccessKey: "AKIA", SecretKey: "secret"}
	if err := SignRequest(req, cfg, hexSHA256([]byte("payload")), time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	if req.Header.Get("X-Amz-Date") == "" {
		t.Errorf("missing X-Amz-Date")
	}
	if req.Header.Get("X-Amz-Content-Sha256") == "" {
		t.Errorf("missing X-Amz-Content-Sha256")
	}
	auth := req.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "AWS4-HMAC-SHA256 ") {
		t.Errorf("unexpected Authorization: %q", auth)
	}
	if !strings.Contains(auth, "Credential=AKIA/20260101/us-east-1/s3/aws4_request") {
		t.Errorf("auth missing credential scope: %q", auth)
	}
	if !strings.Contains(auth, "Signature=") {
		t.Errorf("auth missing signature: %q", auth)
	}
}

// TestSignerCanonicalRequestStable ensures URI encoding / header handling produces stable signatures.
func TestSignerCanonicalRequestStable(t *testing.T) {
	cfg := SignerConfig{Region: "us-east-1", Service: "s3", AccessKey: "AKIA", SecretKey: "secret"}
	build := func() string {
		req, _ := http.NewRequest(http.MethodGet, "https://bucket.example.com/some/key?delimiter=%2F&prefix=p", nil)
		req.Header.Set("X-Custom", "  v1  v2  ")
		_ = SignRequest(req, cfg, emptyPayloadHash, time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
		return req.Header.Get("Authorization")
	}
	a := build()
	b := build()
	if a != b {
		t.Errorf("non-deterministic signature")
	}
}

func testRelayCiphertext(t *testing.T, plaintext []byte) []byte {
	t.Helper()
	raw, err := relaykey.GenerateArmoredPrivate("Blobstore Test", "blob@test.local")
	if err != nil {
		t.Fatalf("GenerateArmoredPrivate: %v", err)
	}
	kp, err := relaykey.Load(raw)
	if err != nil {
		t.Fatalf("Load relay key: %v", err)
	}
	ct, err := kp.Wrap(plaintext)
	if err != nil {
		t.Fatalf("Wrap: %v", err)
	}
	return ct
}

func TestURLForHandlesMinIOAndS3Addressing(t *testing.T) {
	t.Parallel()

	minio, err := New(Config{
		Endpoint:       "http://127.0.0.1:9000",
		Region:         "us-east-1",
		Bucket:         "elvish-mail",
		AccessKey:      "AKIA",
		SecretKey:      "secret",
		ForcePathStyle: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	u, err := minio.urlFor("mail/u/m/body.enc")
	if err != nil {
		t.Fatal(err)
	}
	if got, want := u.String(), "http://127.0.0.1:9000/elvish-mail/mail/u/m/body.enc"; got != want {
		t.Fatalf("path-style url = %q want %q", got, want)
	}

	s3, err := New(Config{
		Endpoint:       "https://s3.amazonaws.com",
		Region:         "us-east-1",
		Bucket:         "elvish-mail",
		AccessKey:      "AKIA",
		SecretKey:      "secret",
		ForcePathStyle: false,
	})
	if err != nil {
		t.Fatal(err)
	}
	u, err = s3.urlFor("mail/u/m/body.enc")
	if err != nil {
		t.Fatal(err)
	}
	if got, want := u.String(), "https://elvish-mail.s3.amazonaws.com/mail/u/m/body.enc"; got != want {
		t.Fatalf("virtual-host url = %q want %q", got, want)
	}
}

// TestStoreRoundTripAgainstHTTPTest puts and gets via an httptest server that validates
// MinIO-style bucket targeting, payload hashing, and encrypted blob writes.
func TestStoreRoundTripAgainstHTTPTest(t *testing.T) {
	t.Parallel()

	plaintext := []byte("plain body that should never land in object storage")
	ciphertext := testRelayCiphertext(t, plaintext)
	store := map[string][]byte{}
	contentTypes := map[string]string{}
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			http.Error(w, "no auth", http.StatusForbidden)
			return
		}
		switch r.Method {
		case http.MethodPut:
			body, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			if got, want := r.Header.Get("X-Amz-Content-Sha256"), hexSHA256(body); got != want {
				http.Error(w, "bad payload hash", http.StatusForbidden)
				return
			}
			if !strings.HasPrefix(r.URL.Path, "/elvish-mail/") {
				http.Error(w, "expected path-style bucket target", http.StatusBadRequest)
				return
			}
			if got := r.Header.Get("Content-Type"); got != "application/pgp-encrypted" {
				http.Error(w, "unexpected content type: "+got, http.StatusBadRequest)
				return
			}
			if bytes.Contains(body, plaintext) {
				http.Error(w, "plaintext leaked to blobstore", http.StatusBadRequest)
				return
			}
			if !bytes.Equal(body, ciphertext) {
				http.Error(w, "unexpected payload body", http.StatusBadRequest)
				return
			}
			store[r.URL.Path] = body
			contentTypes[r.URL.Path] = r.Header.Get("Content-Type")
			w.WriteHeader(http.StatusOK)
		case http.MethodGet:
			if got, want := r.Header.Get("X-Amz-Content-Sha256"), emptyPayloadHash; got != want {
				http.Error(w, "bad get payload hash", http.StatusForbidden)
				return
			}
			b, ok := store[r.URL.Path]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", contentTypes[r.URL.Path])
			_, _ = w.Write(b)
		case http.MethodHead:
			if got, want := r.Header.Get("X-Amz-Content-Sha256"), emptyPayloadHash; got != want {
				http.Error(w, "bad head payload hash", http.StatusForbidden)
				return
			}
			b, ok := store[r.URL.Path]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Length", itoa(len(b)))
			w.WriteHeader(http.StatusOK)
		case http.MethodDelete:
			if got, want := r.Header.Get("X-Amz-Content-Sha256"), emptyPayloadHash; got != want {
				http.Error(w, "bad delete payload hash", http.StatusForbidden)
				return
			}
			if _, ok := store[r.URL.Path]; !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			delete(store, r.URL.Path)
			delete(contentTypes, r.URL.Path)
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	s, err := New(Config{
		Endpoint:       srv.URL,
		Region:         "us-east-1",
		Bucket:         "elvish-mail",
		AccessKey:      "AKIA",
		SecretKey:      "secret",
		ForcePathStyle: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if err := s.Put(ctx, "mail/u/m/body.enc", ciphertext, "application/pgp-encrypted"); err != nil {
		t.Fatalf("put: %v", err)
	}
	body, err := s.Get(ctx, "mail/u/m/body.enc")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if !bytes.Equal(body, ciphertext) {
		t.Errorf("round-trip body mismatch")
	}
	if _, err := s.Head(ctx, "mail/u/m/body.enc"); err != nil {
		t.Errorf("head: %v", err)
	}
	if err := s.Delete(ctx, "mail/u/m/body.enc"); err != nil {
		t.Errorf("delete: %v", err)
	}
	if _, err := s.Get(ctx, "mail/u/m/body.enc"); err != ErrNotFound {
		t.Fatalf("get after delete err = %v want ErrNotFound", err)
	}
}

func TestEnsureBucketUsesPathStyleBucketTarget(t *testing.T) {
	t.Parallel()

	var gotPath string
	var gotHash string
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotHash = r.Header.Get("X-Amz-Content-Sha256")
		w.WriteHeader(http.StatusConflict)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	s, err := New(Config{
		Endpoint:       srv.URL,
		Region:         "us-east-1",
		Bucket:         "elvish-mail",
		AccessKey:      "AKIA",
		SecretKey:      "secret",
		ForcePathStyle: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.EnsureBucket(context.Background()); err != nil {
		t.Fatalf("EnsureBucket: %v", err)
	}
	if gotPath != "/elvish-mail/" {
		t.Fatalf("EnsureBucket path = %q want /elvish-mail/", gotPath)
	}
	if gotHash != emptyPayloadHash {
		t.Fatalf("EnsureBucket hash = %q want %q", gotHash, emptyPayloadHash)
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
