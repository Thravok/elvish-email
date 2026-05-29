// Command elvishdkim generates DKIM keys + emits the matching DNS TXT record.
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"elvish/libs/go/dkim"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "genkey":
		cmdGenkey(os.Args[2:])
	case "txt":
		cmdTXT(os.Args[2:])
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `elvishdkim — DKIM key + TXT record helper

  elvishdkim genkey -algo rsa|ed25519 -out PATH
      Writes PRIVATE KEY PEM (RSA-2048 or Ed25519) to PATH.

  elvishdkim txt    -in PATH
      Reads the private key at PATH and prints the matching DNS TXT value.`)
}

func cmdGenkey(args []string) {
	fs := flag.NewFlagSet("genkey", flag.ExitOnError)
	algo := fs.String("algo", "ed25519", "key algorithm: rsa or ed25519")
	out := fs.String("out", "dkim.pem", "output PEM file")
	bits := fs.Int("bits", 2048, "RSA bit length (>= 2048)")
	_ = fs.Parse(args)
	if *out == "" {
		fmt.Fprintln(os.Stderr, "elvishdkim: -out required")
		os.Exit(2)
	}
	switch *algo {
	case "rsa":
		if *bits < 2048 {
			fmt.Fprintln(os.Stderr, "elvishdkim: rsa bits must be >= 2048")
			os.Exit(2)
		}
		priv, err := rsa.GenerateKey(rand.Reader, *bits)
		if err != nil {
			die("rsa generate", err)
		}
		der := x509.MarshalPKCS1PrivateKey(priv)
		writePEM(*out, "RSA PRIVATE KEY", der)
	case "ed25519":
		_, priv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			die("ed25519 generate", err)
		}
		der, err := x509.MarshalPKCS8PrivateKey(priv)
		if err != nil {
			die("marshal", err)
		}
		writePEM(*out, "PRIVATE KEY", der)
	default:
		fmt.Fprintf(os.Stderr, "elvishdkim: unknown algo %q\n", *algo)
		os.Exit(2)
	}
	fmt.Println("wrote", filepath.Clean(*out))
}

func cmdTXT(args []string) {
	fs := flag.NewFlagSet("txt", flag.ExitOnError)
	in := fs.String("in", "", "input PEM file")
	_ = fs.Parse(args)
	if *in == "" {
		fmt.Fprintln(os.Stderr, "elvishdkim: -in required")
		os.Exit(2)
	}
	data, err := os.ReadFile(*in)
	if err != nil {
		die("read key", err)
	}
	signer, err := loadSigner(data)
	if err != nil {
		die("load key", err)
	}
	txt, err := dkim.PublicKeyTXT(signer)
	if err != nil {
		die("public TXT", err)
	}
	fmt.Println(txt)
}

func loadSigner(pemBytes []byte) (*dkim.Signer, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, fmt.Errorf("no PEM block")
	}
	switch block.Type {
	case "RSA PRIVATE KEY":
		return dkim.NewRSASignerFromPEM(pemBytes)
	case "PRIVATE KEY":
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		switch k := key.(type) {
		case *rsa.PrivateKey:
			return dkim.NewRSASignerFromPEM(pemBytes)
		case ed25519.PrivateKey:
			return dkim.NewEd25519Signer(k)
		}
	}
	return nil, fmt.Errorf("unsupported PEM type %q", block.Type)
}

func writePEM(path, blockType string, der []byte) {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		die("create file", err)
	}
	defer func() { _ = f.Close() }()
	if err := pem.Encode(f, &pem.Block{Type: blockType, Bytes: der}); err != nil {
		die("encode pem", err)
	}
}

func die(ctx string, err error) {
	fmt.Fprintf(os.Stderr, "elvishdkim: %s: %v\n", ctx, err)
	os.Exit(1)
}
