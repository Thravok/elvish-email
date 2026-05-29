// Command srpvector prints one-off SRP vectors for iOS tests (same flow as internal/pake.TestSRPRoundTrip).
package main

import (
	"encoding/base64"
	"fmt"
	"math/big"
	"os"

	"elvish/libs/go/pake"
)

func main() {
	salt := make([]byte, 16)
	for i := range salt {
		salt[i] = byte(i*3 + 7)
	}
	reg, err := pake.ComputeRegistration("alice", "correct horse battery staple", salt)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	// Fixed exponent for stable iOS test vectors (must be 0 < a < N-2).
	a := big.NewInt(1234567890123456)
	client, err := pake.NewClientSessionWithPrivateExponent("alice", "correct horse battery staple", a)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	cp := client.ClientPublic()
	server, err := pake.NewServerSession("alice", reg.Salt, reg.Verifier, cp)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	m1, m2, err := client.ProcessChallenge(reg.Salt, server.ServerPublic())
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("private_exp_decimal", a.String())
	fmt.Println("salt_b64", base64.StdEncoding.EncodeToString(salt))
	fmt.Println("client_pub_b64", base64.StdEncoding.EncodeToString(cp))
	fmt.Println("server_pub_b64", base64.StdEncoding.EncodeToString(server.ServerPublic()))
	fmt.Println("m1_b64", base64.StdEncoding.EncodeToString(m1))
	fmt.Println("m2_b64", base64.StdEncoding.EncodeToString(m2))
}
