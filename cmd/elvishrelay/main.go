// Command elvishrelay generates the optional server "plaintext relay" PGP keypair.
//
// This key wraps Mode-C (plaintext outbound) bodies at rest in object storage so
// the blob store never holds cleartext. Operators who do not want Mode C can
// simply leave ELVISH_RELAY_KEY_PATH unset.
//
// Usage:
//
//	elvishrelay genkey -out /var/lib/elvish/relay.asc
//	elvishrelay info   -in  /var/lib/elvish/relay.asc
package main

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
	"github.com/ProtonMail/go-crypto/openpgp/packet"

	"elvish/internal/relaykey"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "genkey":
		cmdGenkey(os.Args[2:])
	case "info":
		cmdInfo(os.Args[2:])
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `elvishrelay - server plaintext-relay key helper

  elvishrelay genkey -out PATH [-uid UID] [-email ADDR]
      Generates a Curve25519 OpenPGP keypair and writes the armored PRIVATE
      KEY BLOCK to PATH (mode 0600). Use the resulting file as
      ELVISH_RELAY_KEY_PATH for the elvishserver process.

  elvishrelay info -in PATH
      Prints fingerprint + armored public block of the key at PATH.`)
}

func cmdGenkey(args []string) {
	fs := flag.NewFlagSet("genkey", flag.ExitOnError)
	out := fs.String("out", "relay.asc", "output armored PGP private key file")
	uid := fs.String("uid", "Elvish Plaintext Relay", "user id (display name)")
	email := fs.String("email", "relay@local", "user id email")
	_ = fs.Parse(args)
	if *out == "" {
		fmt.Fprintln(os.Stderr, "elvishrelay: -out required")
		os.Exit(2)
	}
	cfg := &packet.Config{
		Algorithm: packet.PubKeyAlgoEdDSA,
		Time:      func() time.Time { return time.Now() },
	}
	ent, err := pgpcrypto.NewEntity(*uid, "elvishrelay generated", *email, cfg)
	if err != nil {
		die("generate", err)
	}
	var buf bytes.Buffer
	aw, err := armor.Encode(&buf, "PGP PRIVATE KEY BLOCK", nil)
	if err != nil {
		die("armor", err)
	}
	if err := ent.SerializePrivateWithoutSigning(aw, nil); err != nil {
		die("serialize", err)
	}
	if err := aw.Close(); err != nil {
		die("close armor", err)
	}
	f, err := os.OpenFile(*out, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		die("create file", err)
	}
	defer func() { _ = f.Close() }()
	if _, err := io.Copy(f, &buf); err != nil {
		die("write", err)
	}
	fmt.Println("wrote", filepath.Clean(*out))
	fmt.Printf("fingerprint: %X\n", ent.PrimaryKey.Fingerprint)
}

func cmdInfo(args []string) {
	fs := flag.NewFlagSet("info", flag.ExitOnError)
	in := fs.String("in", "", "input armored PGP private key file")
	_ = fs.Parse(args)
	if *in == "" {
		fmt.Fprintln(os.Stderr, "elvishrelay: -in required")
		os.Exit(2)
	}
	kp, err := relaykey.LoadFromPath(*in)
	if err != nil {
		die("load", err)
	}
	fmt.Println("fingerprint:", kp.Fingerprint())
	fmt.Println("short id:   ", kp.FingerprintShort())
	fmt.Println("hash:       ", kp.PublicHashHex())
	fmt.Println()
	fmt.Print(kp.ArmoredPublic())
}

func die(ctx string, err error) {
	fmt.Fprintf(os.Stderr, "elvishrelay: %s: %v\n", ctx, err)
	os.Exit(1)
}
