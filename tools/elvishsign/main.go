// Command elvishsign manages minisign detached signatures for Markdown log posts.
//
// Typical workflow:
//
//	elvishsign keygen -out content/blog
//	elvishsign sign -key content/blog/signing.key content/blog/2026-*.md
//
// Live site: go run ./cmd/elvishapi — minisign here is for file-based posts under content/blog/.
//
// Use MINISIGN_PASSWORD or -password for encrypted secret keys.
package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	aead "aead.dev/minisign"
	jed "github.com/jedisct1/go-minisign"
)

func main() {
	log.SetFlags(0)
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "keygen":
		runKeygen(os.Args[2:])
	case "sign":
		runSign(os.Args[2:])
	case "verify":
		runVerify(os.Args[2:])
	case "-h", "--help", "help":
		usage()
	default:
		log.Printf("unknown command %q\n", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintf(os.Stderr, `Usage:
  elvishsign keygen [-out DIR] [-password PASS]
  elvishsign sign -key SECRET.key [-password PASS] [-trusted TEXT] FILES.md ...
  elvishsign verify -pub PUB.pub FILES.md ...

Environment:
  MINISIGN_PASSWORD  decrypts an encrypted secret key (if -password omitted)

Files:
  keygen writes signing.pub and signing.key under -out (default: content/blog).
  sign writes a detached FILE.md.minisig next to each FILE.md (same bytes the site publishes as source.md).

`)
}

func runKeygen(args []string) {
	fs := flag.NewFlagSet("keygen", flag.ExitOnError)
	out := fs.String("out", "content/blog", "directory for signing.pub and signing.key")
	password := fs.String("password", os.Getenv("MINISIGN_PASSWORD"), "encrypt secret key (empty = unencrypted)")
	// Parse uses ExitOnError; invalid flags exit before returning an error.
	_ = fs.Parse(args)

	if err := os.MkdirAll(*out, 0o755); err != nil {
		log.Fatal(err)
	}
	pub, priv, err := aead.GenerateKey(rand.Reader)
	if err != nil {
		log.Fatal(err)
	}
	pubPath := filepath.Join(*out, "signing.pub")
	keyPath := filepath.Join(*out, "signing.key")
	pubPEM, err := pub.MarshalText()
	if err != nil {
		log.Fatal(err)
	}
	var keyOut []byte
	if strings.TrimSpace(*password) == "" {
		var errMarshal error
		keyOut, errMarshal = priv.MarshalText()
		if errMarshal != nil {
			log.Fatal(errMarshal)
		}
	} else {
		enc, err := aead.EncryptKey(*password, priv)
		if err != nil {
			log.Fatal(err)
		}
		keyOut = enc
	}
	if err := os.WriteFile(pubPath, pubPEM, 0o644); err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(keyPath, keyOut, 0o600); err != nil {
		log.Fatal(err)
	}
	log.Printf("wrote %s and %s", pubPath, keyPath)
	log.Printf("commit signing.pub; never commit signing.key (see .gitignore)")
}

func runSign(args []string) {
	fs := flag.NewFlagSet("sign", flag.ExitOnError)
	keyPath := fs.String("key", "", "path to minisign secret key")
	password := fs.String("password", os.Getenv("MINISIGN_PASSWORD"), "secret key password")
	trusted := fs.String("trusted", "", "trusted comment (default: timestamp + slug)")
	// Parse uses ExitOnError; invalid flags exit before returning an error.
	_ = fs.Parse(args)
	if strings.TrimSpace(*keyPath) == "" {
		log.Fatal("sign: -key is required")
	}
	files := fs.Args()
	if len(files) == 0 {
		log.Fatal("sign: need at least one .md file")
	}
	rawKey, err := os.ReadFile(*keyPath)
	if err != nil {
		log.Fatal(err)
	}
	priv, err := aead.DecryptKey(*password, rawKey)
	if err != nil {
		log.Fatal(err)
	}
	for _, f := range files {
		if filepath.Ext(f) != ".md" {
			log.Fatalf("sign: skip non-markdown %q", f)
		}
		msg, err := os.ReadFile(f)
		if err != nil {
			log.Fatal(err)
		}
		tc := strings.TrimSpace(*trusted)
		if tc == "" {
			tc = "elvishsign:" + filepath.Base(f)
		}
		uc := "signature from elvishsign"
		sig := aead.SignWithComments(priv, msg, tc, uc)
		out := f + ".minisig"
		if err := os.WriteFile(out, sig, 0o644); err != nil {
			log.Fatal(err)
		}
		log.Printf("wrote %s", out)
	}
}

func runVerify(args []string) {
	fs := flag.NewFlagSet("verify", flag.ExitOnError)
	pubPath := fs.String("pub", "", "path to minisign public key")
	// Parse uses ExitOnError; invalid flags exit before returning an error.
	_ = fs.Parse(args)
	if strings.TrimSpace(*pubPath) == "" {
		log.Fatal("verify: -pub is required")
	}
	files := fs.Args()
	if len(files) == 0 {
		log.Fatal("verify: need at least one .md file")
	}
	pubBin, err := os.ReadFile(*pubPath)
	if err != nil {
		log.Fatal(err)
	}
	pub, err := jed.DecodePublicKey(string(pubBin))
	if err != nil {
		log.Fatal(err)
	}
	for _, f := range files {
		if filepath.Ext(f) != ".md" {
			log.Fatalf("verify: skip non-markdown %q", f)
		}
		msg, err := os.ReadFile(f)
		if err != nil {
			log.Fatal(err)
		}
		sigBytes, err := os.ReadFile(f + ".minisig")
		if err != nil {
			log.Fatalf("%s: %v", f, err)
		}
		sig, err := jed.DecodeSignature(string(sigBytes))
		if err != nil {
			log.Fatalf("%s: %v", f, err)
		}
		ok, err := pub.Verify(msg, sig)
		if err != nil || !ok {
			log.Fatalf("%s: verification failed: %v", f, err)
		}
		log.Printf("ok %s", f)
	}
}
