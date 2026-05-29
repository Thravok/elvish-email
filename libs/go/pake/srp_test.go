package pake

import (
	"math/big"
	"testing"
)

func TestSRPDeterministicExponent(t *testing.T) {
	salt := make([]byte, 16)
	for i := range salt {
		salt[i] = byte(i*3 + 7)
	}
	reg, err := ComputeRegistration("alice", "correct horse battery staple", salt)
	if err != nil {
		t.Fatalf("ComputeRegistration: %v", err)
	}
	a := big.NewInt(1234567890123456)
	client, err := NewClientSessionWithPrivateExponent("alice", "correct horse battery staple", a)
	if err != nil {
		t.Fatalf("NewClientSessionWithPrivateExponent: %v", err)
	}
	server, err := NewServerSession("alice", reg.Salt, reg.Verifier, client.ClientPublic())
	if err != nil {
		t.Fatalf("NewServerSession: %v", err)
	}
	m1, expectedM2, err := client.ProcessChallenge(reg.Salt, server.ServerPublic())
	if err != nil {
		t.Fatalf("ProcessChallenge: %v", err)
	}
	if !server.VerifyClientProof(m1) {
		t.Fatal("VerifyClientProof = false")
	}
	if string(server.ServerProof()) != string(expectedM2) {
		t.Fatal("server proof mismatch")
	}
}

func TestSRPRoundTrip(t *testing.T) {
	salt, err := RandomSalt(16)
	if err != nil {
		t.Fatalf("RandomSalt: %v", err)
	}
	reg, err := ComputeRegistration("alice", "correct horse battery staple", salt)
	if err != nil {
		t.Fatalf("ComputeRegistration: %v", err)
	}
	client, err := NewClientSession("alice", "correct horse battery staple")
	if err != nil {
		t.Fatalf("NewClientSession: %v", err)
	}
	server, err := NewServerSession("alice", reg.Salt, reg.Verifier, client.ClientPublic())
	if err != nil {
		t.Fatalf("NewServerSession: %v", err)
	}
	m1, expectedM2, err := client.ProcessChallenge(reg.Salt, server.ServerPublic())
	if err != nil {
		t.Fatalf("ProcessChallenge: %v", err)
	}
	if !server.VerifyClientProof(m1) {
		t.Fatal("VerifyClientProof = false")
	}
	if got := server.ServerProof(); string(got) != string(expectedM2) {
		t.Fatalf("server proof mismatch")
	}
}

func TestSRPRejectsWrongPassword(t *testing.T) {
	salt, err := RandomSalt(16)
	if err != nil {
		t.Fatalf("RandomSalt: %v", err)
	}
	reg, err := ComputeRegistration("alice", "correct horse battery staple", salt)
	if err != nil {
		t.Fatalf("ComputeRegistration: %v", err)
	}
	client, err := NewClientSession("alice", "wrong password")
	if err != nil {
		t.Fatalf("NewClientSession: %v", err)
	}
	server, err := NewServerSession("alice", reg.Salt, reg.Verifier, client.ClientPublic())
	if err != nil {
		t.Fatalf("NewServerSession: %v", err)
	}
	m1, _, err := client.ProcessChallenge(reg.Salt, server.ServerPublic())
	if err != nil {
		t.Fatalf("ProcessChallenge: %v", err)
	}
	if server.VerifyClientProof(m1) {
		t.Fatal("VerifyClientProof = true, want false")
	}
}
