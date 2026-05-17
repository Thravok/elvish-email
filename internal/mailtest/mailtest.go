// Package mailtest contains reusable diagnostics for mail-related admin checks
// and the elvishmailtest CLI.
package mailtest

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/pbkdf2"

	"elvish/internal/keyserver"
)

// KeyserverProbeResult captures a single lookup result in a JSON-friendly form.
type KeyserverProbeResult struct {
	Email            string `json:"email"`
	Found            bool   `json:"found"`
	Source           string `json:"source,omitempty"`
	Fingerprint      string `json:"fingerprint,omitempty"`
	VerifiedUIDMatch bool   `json:"verified_uid_match"`
	Error            string `json:"error,omitempty"`
}

// ProbeKeyserver resolves one address through the configured resolver chain.
func ProbeKeyserver(ctx context.Context, resolver *keyserver.Resolver, email string) KeyserverProbeResult {
	email = strings.ToLower(strings.TrimSpace(email))
	out := KeyserverProbeResult{Email: email}
	if resolver == nil {
		out.Error = "keyserver resolver not configured"
		return out
	}
	hit, err := resolver.Lookup(ctx, email)
	if err != nil {
		out.Error = err.Error()
		if errors.Is(err, keyserver.ErrNotFound) {
			out.Error = "not found"
		}
		return out
	}
	out.Found = hit != nil
	if hit != nil {
		out.Source = hit.Source
		out.Fingerprint = hit.Fingerprint
		out.VerifiedUIDMatch = hit.VerifiedUIDMatch
	}
	return out
}

// WrapRoundtripResult captures a KDF + AES-GCM verification cycle.
type WrapRoundtripResult struct {
	OK          bool   `json:"ok"`
	KDF         string `json:"kdf"`
	SaltHex     string `json:"salt_hex,omitempty"`
	NonceHex    string `json:"nonce_hex,omitempty"`
	CipherB64   string `json:"cipher_b64,omitempty"`
	PlainSHA256 string `json:"plain_sha256,omitempty"`
	Error       string `json:"error,omitempty"`
}

// RunWrapRoundtrip verifies a single KDF + AES-GCM encrypt/decrypt cycle.
func RunWrapRoundtrip(kdfName string) WrapRoundtripResult {
	kdfName = strings.ToLower(strings.TrimSpace(kdfName))
	if kdfName == "" {
		kdfName = "argon2id"
	}
	password := make([]byte, 32)
	if _, err := rand.Read(password); err != nil {
		return WrapRoundtripResult{KDF: kdfName, Error: fmt.Sprintf("password: %v", err)}
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return WrapRoundtripResult{KDF: kdfName, Error: fmt.Sprintf("salt: %v", err)}
	}
	var kek []byte
	switch kdfName {
	case "argon2id":
		kek = argon2.IDKey(password, salt, 3, 64*1024, 1, 32)
	case "pbkdf2-sha256", "pbkdf2-sha256-600k":
		kek = pbkdf2.Key(password, salt, 600000, 32, sha256.New)
	default:
		return WrapRoundtripResult{KDF: kdfName, Error: "unknown kdf"}
	}
	plaintext := []byte("admin wrap roundtrip check")
	plainSum := sha256.Sum256(plaintext)
	block, err := aes.NewCipher(kek)
	if err != nil {
		return WrapRoundtripResult{KDF: kdfName, Error: fmt.Sprintf("aes: %v", err)}
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return WrapRoundtripResult{KDF: kdfName, Error: fmt.Sprintf("gcm: %v", err)}
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return WrapRoundtripResult{KDF: kdfName, Error: fmt.Sprintf("nonce: %v", err)}
	}
	ct := gcm.Seal(nil, nonce, plaintext, nil)
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return WrapRoundtripResult{KDF: kdfName, Error: fmt.Sprintf("open: %v", err)}
	}
	if !bytes.Equal(pt, plaintext) {
		return WrapRoundtripResult{KDF: kdfName, Error: "roundtrip mismatch"}
	}
	return WrapRoundtripResult{
		OK:          true,
		KDF:         kdfName,
		SaltHex:     hex.EncodeToString(salt),
		NonceHex:    hex.EncodeToString(nonce),
		CipherB64:   base64.StdEncoding.EncodeToString(ct),
		PlainSHA256: hex.EncodeToString(plainSum[:]),
	}
}
