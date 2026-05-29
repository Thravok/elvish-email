package dkim

import (
	"bufio"
	"bytes"
	"crypto"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"net/textproto"
	"sort"
	"strings"
	"time"
)

// Algo selects the DKIM signing algorithm.
type Algo string

const (
	AlgoRSASHA256     Algo = "rsa-sha256"
	AlgoEd25519SHA256 Algo = "ed25519-sha256"
)

// Options configures a single Sign call.
type Options struct {
	Domain    string   // d=
	Selector  string   // s=
	Algo      Algo     // a=
	Headers   []string // h= (lowercased; default minimal set)
	Now       time.Time
	ExpiresIn time.Duration // optional x=
}

// Signer holds parsed key material.
type Signer struct {
	algo Algo
	rsa  *rsa.PrivateKey
	ed   ed25519.PrivateKey
}

// NewRSASignerFromPEM parses a PKCS#1 or PKCS#8 PEM block.
func NewRSASignerFromPEM(pemBytes []byte) (*Signer, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("dkim: no PEM block")
	}
	var key any
	var err error
	switch block.Type {
	case "RSA PRIVATE KEY":
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
	case "PRIVATE KEY":
		key, err = x509.ParsePKCS8PrivateKey(block.Bytes)
	default:
		return nil, fmt.Errorf("dkim: unexpected PEM type %q", block.Type)
	}
	if err != nil {
		return nil, err
	}
	rk, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("dkim: not an RSA key")
	}
	if rk.N.BitLen() < 2048 {
		return nil, errors.New("dkim: RSA key must be ≥ 2048 bits")
	}
	return &Signer{algo: AlgoRSASHA256, rsa: rk}, nil
}

// GenerateRSAPrivatePEM returns a freshly generated RSA private key as PEM.
func GenerateRSAPrivatePEM(bits int) ([]byte, error) {
	if bits < 2048 {
		bits = 2048
	}
	key, err := rsa.GenerateKey(rand.Reader, bits)
	if err != nil {
		return nil, fmt.Errorf("dkim: generate rsa: %w", err)
	}
	block := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	}
	return pem.EncodeToMemory(block), nil
}

// NewEd25519Signer wraps a 32-byte seed (or the full 64-byte private key).
func NewEd25519Signer(seedOrPriv []byte) (*Signer, error) {
	switch len(seedOrPriv) {
	case ed25519.SeedSize:
		return &Signer{algo: AlgoEd25519SHA256, ed: ed25519.NewKeyFromSeed(seedOrPriv)}, nil
	case ed25519.PrivateKeySize:
		return &Signer{algo: AlgoEd25519SHA256, ed: ed25519.PrivateKey(seedOrPriv)}, nil
	}
	return nil, fmt.Errorf("dkim: unexpected ed25519 key length %d", len(seedOrPriv))
}

// PublicKeyTXT returns the value for the DKIM DNS TXT record (v=DKIM1; k=...; p=base64).
func PublicKeyTXT(s *Signer) (string, error) {
	if s == nil {
		return "", errors.New("dkim: nil signer")
	}
	switch s.algo {
	case AlgoRSASHA256:
		der, err := x509.MarshalPKIXPublicKey(&s.rsa.PublicKey)
		if err != nil {
			return "", err
		}
		return "v=DKIM1; k=rsa; p=" + base64.StdEncoding.EncodeToString(der), nil
	case AlgoEd25519SHA256:
		pub := s.ed.Public().(ed25519.PublicKey)
		return "v=DKIM1; k=ed25519; p=" + base64.StdEncoding.EncodeToString(pub), nil
	}
	return "", errors.New("dkim: unknown algo")
}

// Sign returns the DKIM-Signature header (without the leading "DKIM-Signature: ") for the given RFC 822 message.
// rawMessage must contain CRLF line endings and a header/body separator (CRLFCRLF).
func Sign(s *Signer, opt Options, rawMessage []byte) (string, error) {
	if s == nil {
		return "", errors.New("dkim: nil signer")
	}
	if opt.Domain == "" || opt.Selector == "" {
		return "", errors.New("dkim: domain and selector required")
	}
	if opt.Algo == "" {
		opt.Algo = s.algo
	}
	headersSet, body, err := splitHeadersBody(rawMessage)
	if err != nil {
		return "", err
	}
	useHeaders := opt.Headers
	if len(useHeaders) == 0 {
		useHeaders = []string{"from", "to", "subject", "date", "message-id"}
	}
	bh := bodyHashRelaxed(body)
	canonHeaders := canonHeadersRelaxed(headersSet, useHeaders)

	now := opt.Now
	if now.IsZero() {
		now = time.Now().UTC()
	}
	tag := newTagBuilder()
	tag.set("v", "1")
	tag.set("a", string(opt.Algo))
	tag.set("c", "relaxed/relaxed")
	tag.set("d", opt.Domain)
	tag.set("s", opt.Selector)
	tag.set("t", fmt.Sprintf("%d", now.Unix()))
	if opt.ExpiresIn > 0 {
		tag.set("x", fmt.Sprintf("%d", now.Add(opt.ExpiresIn).Unix()))
	}
	tag.set("h", strings.Join(useHeaders, ":"))
	tag.set("bh", base64.StdEncoding.EncodeToString(bh))
	tag.set("b", "")

	dkimHeader := tag.String()
	canonical := canonHeaders + "dkim-signature:" + canonRelaxedValue(dkimHeader)
	digest := sha256.Sum256([]byte(canonical))
	var sig []byte
	switch opt.Algo {
	case AlgoRSASHA256:
		sig, err = rsa.SignPKCS1v15(rand.Reader, s.rsa, crypto.SHA256, digest[:])
		if err != nil {
			return "", err
		}
	case AlgoEd25519SHA256:
		sig = ed25519.Sign(s.ed, digest[:])
	default:
		return "", fmt.Errorf("dkim: unsupported algo %s", opt.Algo)
	}
	tag.set("b", base64.StdEncoding.EncodeToString(sig))
	return tag.String(), nil
}

// SignAndPrepend returns rawMessage with the DKIM-Signature header prepended.
func SignAndPrepend(s *Signer, opt Options, rawMessage []byte) ([]byte, error) {
	header, err := Sign(s, opt, rawMessage)
	if err != nil {
		return nil, err
	}
	out := make([]byte, 0, len(header)+18+len(rawMessage))
	out = append(out, []byte("DKIM-Signature: ")...)
	out = append(out, []byte(header)...)
	out = append(out, '\r', '\n')
	out = append(out, rawMessage...)
	return out, nil
}

func splitHeadersBody(raw []byte) ([]headerField, []byte, error) {
	idx := bytes.Index(raw, []byte("\r\n\r\n"))
	if idx < 0 {
		idx = bytes.Index(raw, []byte("\n\n"))
		if idx < 0 {
			return nil, nil, errors.New("dkim: no header/body separator")
		}
		// normalize body to CRLF for canonicalization purposes
		raw = bytes.ReplaceAll(raw, []byte("\n"), []byte("\r\n"))
		idx = bytes.Index(raw, []byte("\r\n\r\n"))
	}
	headerBlock := raw[:idx]
	body := raw[idx+4:]
	// MIME parsing needs the header block + a trailing blank line (CRLFCRLF).
	hb := append(append([]byte(nil), headerBlock...), '\r', '\n', '\r', '\n')
	tp := textproto.NewReader(bufio.NewReader(bytes.NewReader(hb)))
	mime, err := tp.ReadMIMEHeader()
	if err != nil {
		return nil, nil, err
	}
	var fields []headerField
	for k, vs := range mime {
		for _, v := range vs {
			fields = append(fields, headerField{name: k, value: v})
		}
	}
	return fields, body, nil
}

type headerField struct {
	name  string
	value string
}

// canonHeadersRelaxed produces the "h=" canonicalized header block, preserving
// the order from useHeaders (most recent occurrence first).
func canonHeadersRelaxed(fields []headerField, useHeaders []string) string {
	byName := map[string][]string{}
	for _, f := range fields {
		k := strings.ToLower(f.name)
		byName[k] = append(byName[k], f.value)
	}
	var out strings.Builder
	for _, h := range useHeaders {
		vs := byName[h]
		if len(vs) == 0 {
			continue
		}
		val := vs[len(vs)-1]
		out.WriteString(h)
		out.WriteByte(':')
		out.WriteString(canonRelaxedValue(val))
	}
	return out.String()
}

// canonRelaxedValue collapses internal whitespace and trims trailing/leading WSP per RFC 6376.
func canonRelaxedValue(v string) string {
	v = strings.ReplaceAll(v, "\r\n", "")
	var b strings.Builder
	prevWS := false
	for _, r := range v {
		if r == ' ' || r == '\t' {
			if !prevWS {
				b.WriteByte(' ')
			}
			prevWS = true
			continue
		}
		prevWS = false
		b.WriteRune(r)
	}
	out := strings.TrimSpace(b.String())
	return out + "\r\n"
}

// bodyHashRelaxed implements relaxed body canonicalization + SHA256.
func bodyHashRelaxed(body []byte) []byte {
	body = bytes.ReplaceAll(body, []byte("\n"), []byte("\r\n"))
	body = bytes.ReplaceAll(body, []byte("\r\r\n"), []byte("\r\n"))
	// Collapse whitespace within each line; ignore trailing whitespace.
	lines := bytes.Split(body, []byte("\r\n"))
	for i, line := range lines {
		lines[i] = canonRelaxedBodyLine(line)
	}
	canon := bytes.Join(lines, []byte("\r\n"))
	// Trim trailing empty lines, then ensure single CRLF if any non-empty data.
	canon = bytes.TrimRight(canon, "\r\n")
	if len(canon) > 0 {
		canon = append(canon, '\r', '\n')
	}
	sum := sha256.Sum256(canon)
	return sum[:]
}

func canonRelaxedBodyLine(line []byte) []byte {
	out := make([]byte, 0, len(line))
	prevWS := false
	for _, c := range line {
		if c == ' ' || c == '\t' {
			if !prevWS {
				out = append(out, ' ')
			}
			prevWS = true
			continue
		}
		prevWS = false
		out = append(out, c)
	}
	return bytes.TrimRight(out, " \t")
}

// tagBuilder builds a DKIM tag-value list, preserving insertion order (with b last and ordered).
type tagBuilder struct {
	keys []string
	vals map[string]string
}

func newTagBuilder() *tagBuilder { return &tagBuilder{vals: map[string]string{}} }

func (t *tagBuilder) set(k, v string) {
	if _, ok := t.vals[k]; !ok {
		t.keys = append(t.keys, k)
	}
	t.vals[k] = v
}

func (t *tagBuilder) String() string {
	keys := append([]string(nil), t.keys...)
	sort.SliceStable(keys, func(i, j int) bool {
		// Keep DKIM-prescribed order: v, a, c, d, s, t, x, h, bh, b last
		order := map[string]int{"v": 1, "a": 2, "c": 3, "d": 4, "s": 5, "t": 6, "x": 7, "h": 8, "bh": 9, "b": 10}
		oi, oj := order[keys[i]], order[keys[j]]
		if oi == 0 {
			oi = 99
		}
		if oj == 0 {
			oj = 99
		}
		return oi < oj
	})
	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteString("; ")
		}
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(t.vals[k])
	}
	return b.String()
}
