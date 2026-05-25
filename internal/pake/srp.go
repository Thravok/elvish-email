// Package pake implements SRP-6a helpers for browser authentication.
package pake

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"math/big"
)

var (
	// ErrInvalidPublic is returned when the peer public value is invalid.
	ErrInvalidPublic = errors.New("pake/srp: invalid public value")
	groupRFC50542048 = mustGroup(
		"rfc5054-2048",
		"AC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050A37329CBB4A099ED8193E0757767A13DD52312AB4B03310DCD7F48A9DA04FD50E8083969EDB767B0CF6096BEECFB71744F9A5B7CDBD7B3E8C94BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF",
		2,
	)
)

// Group holds SRP group parameters.
type Group struct {
	Name   string
	N      *big.Int
	G      *big.Int
	PadLen int
}

// DefaultGroup returns the server's default SRP group.
func DefaultGroup() Group { return groupRFC50542048 }

// Registration carries the stored verifier material.
type Registration struct {
	Salt      []byte
	Verifier  []byte
	GroupName string
	HashName  string
}

// ClientSession is a test/helper-side SRP client handshake state.
type ClientSession struct {
	group    Group
	username string
	password string
	a        *big.Int
	A        *big.Int
}

// ServerSession is one SRP server handshake state.
type ServerSession struct {
	group            Group
	username         string
	salt             []byte
	verifier         *big.Int
	A                *big.Int
	B                *big.Int
	expectedClientM1 []byte
	serverM2         []byte
}

// ComputeRegistration derives verifier material from username/password.
func ComputeRegistration(username, password string, salt []byte) (*Registration, error) {
	if len(salt) < 16 {
		return nil, errors.New("pake/srp: salt must be at least 16 bytes")
	}
	group := DefaultGroup()
	x := computeX(group, username, password, salt)
	v := new(big.Int).Exp(group.G, x, group.N)
	return &Registration{
		Salt:      append([]byte(nil), salt...),
		Verifier:  padBig(v, group.PadLen),
		GroupName: group.Name,
		HashName:  "sha256",
	}, nil
}

// RandomSalt returns cryptographically random salt bytes.
func RandomSalt(n int) ([]byte, error) {
	if n < 16 {
		n = 16
	}
	out := make([]byte, n)
	_, err := rand.Read(out)
	return out, err
}

// NewClientSession creates a client SRP session.
func NewClientSession(username, password string) (*ClientSession, error) {
	if username == "" || password == "" {
		return nil, errors.New("pake/srp: username/password required")
	}
	group := DefaultGroup()
	a, err := randomScalar(group)
	if err != nil {
		return nil, err
	}
	A := new(big.Int).Exp(group.G, a, group.N)
	if new(big.Int).Mod(A, group.N).Sign() == 0 {
		return nil, ErrInvalidPublic
	}
	return &ClientSession{group: group, username: username, password: password, a: a, A: A}, nil
}

// NewClientSessionWithPrivateExponent constructs a client session with a fixed private
// exponent (for deterministic tests and tooling such as cmd/srpvector). Prefer
// NewClientSession for production login flows.
func NewClientSessionWithPrivateExponent(username, password string, a *big.Int) (*ClientSession, error) {
	if username == "" || password == "" {
		return nil, errors.New("pake/srp: username/password required")
	}
	if a == nil || a.Sign() <= 0 {
		return nil, errors.New("pake/srp: invalid exponent")
	}
	group := DefaultGroup()
	max := new(big.Int).Sub(group.N, big.NewInt(2))
	if a.Cmp(max) > 0 {
		return nil, errors.New("pake/srp: exponent out of range")
	}
	A := new(big.Int).Exp(group.G, a, group.N)
	if new(big.Int).Mod(A, group.N).Sign() == 0 {
		return nil, ErrInvalidPublic
	}
	return &ClientSession{group: group, username: username, password: password, a: new(big.Int).Set(a), A: A}, nil
}

// ClientPublic returns the encoded client public value A.
func (c *ClientSession) ClientPublic() []byte {
	if c == nil || c.A == nil {
		return nil
	}
	return padBig(c.A, c.group.PadLen)
}

// ProcessChallenge computes the client proof and expected server proof.
func (c *ClientSession) ProcessChallenge(salt, serverPublic []byte) (clientProof, expectedServerProof []byte, err error) {
	if c == nil || c.A == nil {
		return nil, nil, errors.New("pake/srp: nil client session")
	}
	B := new(big.Int).SetBytes(serverPublic)
	if B.Sign() == 0 || new(big.Int).Mod(B, c.group.N).Sign() == 0 {
		return nil, nil, ErrInvalidPublic
	}
	k := multiplier(c.group)
	u := scramble(c.group, c.A, B)
	if u.Sign() == 0 {
		return nil, nil, errors.New("pake/srp: zero scramble")
	}
	x := computeX(c.group, c.username, c.password, salt)
	gx := new(big.Int).Exp(c.group.G, x, c.group.N)
	base := new(big.Int).Sub(B, new(big.Int).Mul(k, gx))
	base.Mod(base, c.group.N)
	if base.Sign() < 0 {
		base.Add(base, c.group.N)
	}
	exp := new(big.Int).Add(c.a, new(big.Int).Mul(u, x))
	S := new(big.Int).Exp(base, exp, c.group.N)
	K := digest(padBig(S, c.group.PadLen))
	m1 := clientProofBytes(c.group, c.username, salt, c.A, B, K)
	m2 := serverProofBytes(c.A, m1, K)
	return m1, m2, nil
}

// NewServerSession creates a server SRP session from persisted verifier data.
func NewServerSession(username string, salt, verifier, clientPublic []byte) (*ServerSession, error) {
	group := DefaultGroup()
	A := new(big.Int).SetBytes(clientPublic)
	if A.Sign() == 0 || new(big.Int).Mod(A, group.N).Sign() == 0 {
		return nil, ErrInvalidPublic
	}
	v := new(big.Int).SetBytes(verifier)
	b, err := randomScalar(group)
	if err != nil {
		return nil, err
	}
	k := multiplier(group)
	gb := new(big.Int).Exp(group.G, b, group.N)
	B := new(big.Int).Add(new(big.Int).Mul(k, v), gb)
	B.Mod(B, group.N)
	u := scramble(group, A, B)
	if u.Sign() == 0 {
		return nil, errors.New("pake/srp: zero scramble")
	}
	vu := new(big.Int).Exp(v, u, group.N)
	S := new(big.Int).Exp(new(big.Int).Mul(A, vu), b, group.N)
	S.Mod(S, group.N)
	K := digest(padBig(S, group.PadLen))
	return &ServerSession{
		group:            group,
		username:         username,
		salt:             append([]byte(nil), salt...),
		verifier:         v,
		A:                A,
		B:                B,
		expectedClientM1: clientProofBytes(group, username, salt, A, B, K),
		serverM2:         serverProofBytes(A, clientProofBytes(group, username, salt, A, B, K), K),
	}, nil
}

// ServerPublic returns the encoded server public value B.
func (s *ServerSession) ServerPublic() []byte {
	if s == nil || s.B == nil {
		return nil
	}
	return padBig(s.B, s.group.PadLen)
}

// VerifyClientProof checks the peer proof.
func (s *ServerSession) VerifyClientProof(clientProof []byte) bool {
	if s == nil {
		return false
	}
	return bytes.Equal(clientProof, s.expectedClientM1)
}

// ExpectedClientProof returns the proof this session expects from the client.
func (s *ServerSession) ExpectedClientProof() []byte {
	if s == nil {
		return nil
	}
	return append([]byte(nil), s.expectedClientM1...)
}

// ServerProof returns M2 after the client proof was validated.
func (s *ServerSession) ServerProof() []byte {
	if s == nil {
		return nil
	}
	return append([]byte(nil), s.serverM2...)
}

func mustGroup(name, nHex string, g int64) Group {
	N, ok := new(big.Int).SetString(nHex, 16)
	if !ok {
		panic("invalid SRP group")
	}
	return Group{Name: name, N: N, G: big.NewInt(g), PadLen: len(N.Bytes())}
}

func randomScalar(group Group) (*big.Int, error) {
	max := new(big.Int).Sub(group.N, big.NewInt(2))
	v, err := rand.Int(rand.Reader, max)
	if err != nil {
		return nil, err
	}
	return v.Add(v, big.NewInt(1)), nil
}

func multiplier(group Group) *big.Int {
	return new(big.Int).SetBytes(digest(padBig(group.N, group.PadLen), padBig(group.G, group.PadLen)))
}

func scramble(group Group, A, B *big.Int) *big.Int {
	return new(big.Int).SetBytes(digest(padBig(A, group.PadLen), padBig(B, group.PadLen)))
}

func computeX(group Group, username, password string, salt []byte) *big.Int {
	inner := digest([]byte(username + ":" + password))
	return new(big.Int).SetBytes(digest(salt, inner))
}

func clientProofBytes(group Group, username string, salt []byte, A, B *big.Int, key []byte) []byte {
	hN := digest(padBig(group.N, group.PadLen))
	hG := digest(padBig(group.G, group.PadLen))
	xor := make([]byte, len(hN))
	for i := range hN {
		xor[i] = hN[i] ^ hG[i]
	}
	return digest(xor, digest([]byte(username)), salt, padBig(A, group.PadLen), padBig(B, group.PadLen), key)
}

func serverProofBytes(A *big.Int, clientProof, key []byte) []byte {
	return digest(trimLeadingZeroes(A.Bytes()), clientProof, key)
}

func digest(parts ...[]byte) []byte {
	// SHA-256 is the SRP-6a mixing function for this implementation (RFC 5054); not offline password hashing.
	var buf []byte
	for _, p := range parts {
		buf = append(buf, p...)
	}
	// codeql[go/weak-sensitive-data-hashing]: SRP-6a protocol mixing hash per RFC 5054, not offline password storage.
	sum := sha256.Sum256(buf)
	return sum[:]
}

func padBig(n *big.Int, size int) []byte {
	return padBytes(trimLeadingZeroes(n.Bytes()), size)
}

func padBytes(b []byte, size int) []byte {
	if len(b) >= size {
		return append([]byte(nil), b...)
	}
	out := make([]byte, size)
	copy(out[size-len(b):], b)
	return out
}

func trimLeadingZeroes(b []byte) []byte {
	for len(b) > 0 && b[0] == 0 {
		b = b[1:]
	}
	if len(b) == 0 {
		return []byte{0}
	}
	return b
}

// ParseGroup validates the persisted group and hash names.
func ParseGroup(groupName, hashName string) (Group, error) {
	if groupName == "" {
		groupName = DefaultGroup().Name
	}
	if hashName == "" {
		hashName = "sha256"
	}
	if groupName != DefaultGroup().Name || hashName != "sha256" {
		return Group{}, fmt.Errorf("pake/srp: unsupported params %q/%q", groupName, hashName)
	}
	return DefaultGroup(), nil
}
