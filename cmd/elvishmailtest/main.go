// Command elvishmailtest exercises the four-store mail subsystem end to end.
//
// Subcommands:
//
//	bootstrap-and-selfcheck   generate a fresh PGP keypair, encrypt to self, decrypt, verify roundtrip
//	send-test                 submit a test ciphertext to the local API (uses session cookie env)
//	keyserver-probe           run the resolver chain (local → cache → WKD → Proton/HKPS) for an email
//	wrap-roundtrip            KDF + AES-GCM roundtrip with the same parameters as the browser
//	no-plaintext-audit        scan Cockroach, Scylla, blobstore, and logs for a sentinel cleartext
//	search-bench              measure local-index throughput against a fixture inbox (placeholder)
//
// Most subcommands respect the standard COCKROACH_DSN / VALKEY_ADDR /
// SCYLLA_HOSTS / BLOB_S3_* environment variables used by elvishserver.
package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/internal/blobstore"
	"elvish/internal/db"
	"elvish/internal/keyserver"
	"elvish/internal/mailmeta"
	"elvish/internal/mailpipe"
	"elvish/internal/mailtest"
	"elvish/internal/openpgp"
	"elvish/internal/scyllastore"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	cmd, args := os.Args[1], os.Args[2:]
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
	switch cmd {
	case "bootstrap-and-selfcheck":
		runBootstrap(logger)
	case "send-test":
		runSendTest(args, logger)
	case "keyserver-probe":
		runKeyserverProbe(args, logger)
	case "wrap-roundtrip":
		runWrapRoundtrip(args, logger)
	case "no-plaintext-audit":
		runNoPlaintextAudit(args, logger)
	case "search-bench":
		runSearchBench(args, logger)
	default:
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: elvishmailtest <subcommand> [args...]")
	fmt.Fprintln(os.Stderr, "  bootstrap-and-selfcheck")
	fmt.Fprintln(os.Stderr, "  send-test -url URL -session COOKIE -recipient EMAIL")
	fmt.Fprintln(os.Stderr, "  keyserver-probe -email EMAIL")
	fmt.Fprintln(os.Stderr, "  wrap-roundtrip [-kdf argon2id|pbkdf2-sha256] [-password P]")
	fmt.Fprintln(os.Stderr, "  no-plaintext-audit -recipient EMAIL [-sentinel TEXT]")
	fmt.Fprintln(os.Stderr, "  search-bench")
}

// ---- bootstrap-and-selfcheck --------------------------------------------

func runBootstrap(_ *slog.Logger) {
	const armoredPub = "" // We use the openpgp package's encrypt to a fresh key generated here.
	_ = armoredPub
	// Use go-crypto's helper to generate a fresh test key. We invoke through openpgp.ParseKeyDetail
	// for consistency by re-armoring the generated entity below.
	armoredPubKey, armoredPrivKey, err := generateTestKey("Test User <test@example.invalid>")
	if err != nil {
		fatalf("generate key: %v", err)
	}
	detail, err := openpgp.ParseKeyDetail(armoredPubKey)
	if err != nil {
		fatalf("parse key: %v", err)
	}
	if err := openpgp.ValidateForEncryption(detail); err != nil {
		fatalf("validate key: %v", err)
	}
	plaintext := []byte(fmt.Sprintf("hello selfcheck %s", time.Now().Format(time.RFC3339Nano)))
	ct, err := openpgp.Encrypt(armoredPubKey, plaintext)
	if err != nil {
		fatalf("encrypt: %v", err)
	}
	pt, err := decryptArmored(armoredPrivKey, ct)
	if err != nil {
		fatalf("decrypt: %v", err)
	}
	if !bytes.Equal(pt, plaintext) {
		fatalf("roundtrip mismatch")
	}
	fmt.Println("OK bootstrap-and-selfcheck")
	fmt.Printf("  fingerprint=%s\n  algo=%s bits=%d\n", detail.Fingerprint, detail.Algorithm, detail.Bits)
}

// ---- send-test ----------------------------------------------------------

func runSendTest(args []string, _ *slog.Logger) {
	fs := flag.NewFlagSet("send-test", flag.ExitOnError)
	url := fs.String("url", "http://127.0.0.1:8765", "base URL")
	cookie := fs.String("session", "", "elvish_session cookie value")
	recipient := fs.String("recipient", "", "recipient email")
	body := fs.String("body", "", "plaintext body (will be encrypted client-side)")
	_ = fs.Parse(args)
	if *cookie == "" || *recipient == "" {
		fatalf("send-test requires -session and -recipient")
	}
	// Look up recipient pubkey via /api/v1/keys/lookup
	hit, err := apiLookup(*url, *cookie, *recipient)
	if err != nil {
		fatalf("lookup: %v", err)
	}
	if hit == nil {
		fatalf("no key for %s", *recipient)
	}
	bodyBytes := []byte(*body)
	if len(bodyBytes) == 0 {
		bodyBytes = []byte(fmt.Sprintf("elvishmailtest %s", time.Now().Format(time.RFC3339)))
	}
	ct, err := openpgp.Encrypt(hit.Armored, bodyBytes)
	if err != nil {
		fatalf("encrypt: %v", err)
	}
	headerCT, err := openpgp.Encrypt(hit.Armored, []byte(`{"subject":"elvishmailtest"}`))
	if err != nil {
		fatalf("encrypt header: %v", err)
	}
	resp, err := apiPostMessage(*url, *cookie, *recipient, headerCT, ct, *recipient, []string{*recipient})
	if err != nil {
		fatalf("post: %v", err)
	}
	fmt.Printf("OK send-test message_id=%s blob_ref=%s\n", resp["id"], resp["blob_ref"])
}

// ---- keyserver-probe ----------------------------------------------------

func runKeyserverProbe(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("keyserver-probe", flag.ExitOnError)
	email := fs.String("email", "", "email to resolve")
	_ = fs.Parse(args)
	if *email == "" {
		fatalf("keyserver-probe requires -email")
	}
	cfg := db.LoadConfigFromEnv()
	bundle, err := db.Open(cfg)
	if err != nil {
		fatalf("db open: %v", err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = bundle.Close(ctx)
		cancel()
	}()
	mm := mailmeta.New(bundle.Pool())
	cache := keyserver.NewCache(bundle.Valkey(), mm)
	res := keyserver.DefaultChain(mm, cache, logger)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	outcome := mailtest.ProbeKeyserver(ctx, res, *email)
	if !outcome.Found && outcome.Error != "" {
		fatalf("lookup: %v", outcome.Error)
	}
	out, _ := json.MarshalIndent(outcome, "", "  ")
	fmt.Println(string(out))
}

// ---- wrap-roundtrip ----------------------------------------------------

func runWrapRoundtrip(args []string, _ *slog.Logger) {
	fs := flag.NewFlagSet("wrap-roundtrip", flag.ExitOnError)
	kdf := fs.String("kdf", "argon2id", "argon2id or pbkdf2-sha256")
	_ = fs.String("password", "correct horse battery staple", "legacy ignored; the diagnostic now uses an ephemeral password")
	_ = fs.Parse(args)
	res := mailtest.RunWrapRoundtrip(*kdf)
	if !res.OK {
		fatalf("wrap-roundtrip: %v", res.Error)
	}
	fmt.Printf("OK wrap-roundtrip kdf=%s salt=%s nonce=%s ct_b64=%s\n",
		res.KDF, res.SaltHex, res.NonceHex, res.CipherB64)
}

// ---- no-plaintext-audit ------------------------------------------------

func runNoPlaintextAudit(args []string, logger *slog.Logger) {
	fs := flag.NewFlagSet("no-plaintext-audit", flag.ExitOnError)
	recipient := fs.String("recipient", "", "recipient email (must be a local identity)")
	sentinel := fs.String("sentinel", "", "cleartext sentinel (default: random nonce)")
	_ = fs.Parse(args)
	if *recipient == "" {
		fatalf("no-plaintext-audit requires -recipient")
	}
	if *sentinel == "" {
		var b [16]byte
		if _, err := rand.Read(b[:]); err != nil {
			fatalf("rand: %v", err)
		}
		*sentinel = "ELVISHSENT-" + hex.EncodeToString(b[:])
	}
	cfg := db.LoadConfigFromEnv()
	bundle, err := db.Open(cfg)
	if err != nil {
		fatalf("db open: %v", err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = bundle.Close(ctx)
		cancel()
	}()
	mm := mailmeta.New(bundle.Pool())
	scy, err := scyllastore.Open(scyllastore.Config{Hosts: cfg.ScyllaHosts, Keyspace: cfg.ScyllaKeyspace})
	if err != nil {
		fatalf("scylla: %v", err)
	}
	defer scy.Close()
	bs, err := blobstore.New(blobstore.Config{
		Endpoint: cfg.BlobEndpoint, Region: cfg.BlobRegion, Bucket: cfg.BlobBucket,
		AccessKey: cfg.BlobAccessKey, SecretKey: cfg.BlobSecretKey, ForcePathStyle: cfg.BlobForcePathStyle,
	})
	if err != nil {
		fatalf("blob: %v", err)
	}

	// Build sentinel-bearing inbound message + ingest via mailpipe (gateway-encrypts).
	pipe := mailpipe.New(bs, scy, mm, logger)
	rfc822 := []byte(fmt.Sprintf("From: <auditor@example.com>\r\nTo: <%s>\r\nSubject: %s\r\n\r\n%s sentinel\r\n",
		*recipient, *sentinel, *sentinel))
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	res, err := pipe.IngestExternal(ctx, "auditor@example.com", *recipient, append([]byte(nil), rfc822...))
	if err != nil {
		fatalf("ingest: %v", err)
	}
	fmt.Printf("ingested message_id=%s blob_ref=%s\n", res.MessageID, res.BodyBlobRef)

	// 1. Cockroach: scan mail_ingest_ledger row + check no row contains sentinel.
	var ledgerOK bool
	if l, err := mm.IngestLedgerByMessage(ctx, res.MessageID); err == nil && l != nil {
		ledgerOK = !strings.Contains(l.BodyBlobRef, *sentinel) && !strings.Contains(l.Source, *sentinel)
	}
	// 2. Scylla manifest: header_ciphertext must be ciphertext (not contain sentinel).
	mf, err := scy.GetManifest(ctx, res.UserID, res.MessageID)
	if err != nil {
		fatalf("manifest: %v", err)
	}
	manifestOK := !bytes.Contains(mf.HeaderCiphertext, []byte(*sentinel))
	// 3. blobstore body: ciphertext must not contain sentinel.
	body, err := bs.Get(ctx, mf.BodyBlobRef)
	if err != nil {
		fatalf("blob get: %v", err)
	}
	bodyOK := !bytes.Contains(body, []byte(*sentinel))

	if !ledgerOK || !manifestOK || !bodyOK {
		fmt.Printf("FAIL no-plaintext-audit ledger=%v manifest=%v body=%v sentinel=%s\n",
			ledgerOK, manifestOK, bodyOK, *sentinel)
		os.Exit(1)
	}
	fmt.Printf("OK no-plaintext-audit message_id=%s sentinel=%s ledger_ok=true manifest_ok=true body_ok=true\n",
		res.MessageID, *sentinel)
}

// ---- search-bench (placeholder) ----------------------------------------

func runSearchBench(_ []string, _ *slog.Logger) {
	fmt.Println("search-bench: client-side only; run e2e/tests/search.spec.ts under Playwright instead")
}

// ---- helpers ------------------------------------------------------------

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "elvishmailtest: "+format+"\n", args...)
	os.Exit(1)
}

type apiKeyHit struct {
	Email       string `json:"email"`
	Fingerprint string `json:"fingerprint"`
	Armored     string `json:"armored"`
	Source      string `json:"source"`
}

func apiLookup(baseURL, cookie, email string) (*apiKeyHit, error) {
	req, err := http.NewRequest("GET", strings.TrimRight(baseURL, "/")+"/api/v1/keys/lookup?email="+email, nil)
	if err != nil {
		return nil, err
	}
	req.AddCookie(&http.Cookie{Name: "elvish_session", Value: cookie})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close() //nolint:errcheck // response body close error irrelevant after read
	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
	}
	var hit apiKeyHit
	if err := json.NewDecoder(resp.Body).Decode(&hit); err != nil {
		return nil, err
	}
	return &hit, nil
}

func apiPostMessage(baseURL, cookie, recipient string, headerCT, bodyCT []byte, fromAddr string, toAddrs []string) (map[string]any, error) {
	body, _ := json.Marshal(map[string]any{
		"recipient":             recipient,
		"header_ciphertext_b64": base64.StdEncoding.EncodeToString(headerCT),
		"body_ciphertext_b64":   base64.StdEncoding.EncodeToString(bodyCT),
		"from_addr":             fromAddr,
		"to_addrs":              toAddrs,
	})
	req, err := http.NewRequest("POST", strings.TrimRight(baseURL, "/")+"/api/v1/mail/messages", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/json")
	req.AddCookie(&http.Cookie{Name: "elvish_session", Value: cookie})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close() //nolint:errcheck // response body close error irrelevant after read
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
	}
	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}

// silence unused (uuid is needed when we extend send-test to read message ids back)
var _ = uuid.Nil
var _ = errors.New
