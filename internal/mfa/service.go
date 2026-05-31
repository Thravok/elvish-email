// Package mfa provides helpers for TOTP secrets, recovery codes, and at-rest
// encryption of server-readable factor material.
package mfa

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"github.com/skip2/go-qrcode"
)

const envEncryptionKey = "ELVISH_MFA_ENCRYPTION_KEY"

// Service wraps the helpers needed for server-side MFA verification.
type Service struct {
	key []byte
}

// NewFromEnv loads the MFA encryption key from the environment.
func NewFromEnv() (*Service, error) {
	raw := strings.TrimSpace(os.Getenv(envEncryptionKey))
	if raw == "" {
		return nil, fmt.Errorf("mfa: %s is required", envEncryptionKey)
	}
	key, err := decodeKey(raw)
	if err != nil {
		return nil, err
	}
	if err := validateKeyLength(key); err != nil {
		return nil, err
	}
	return &Service{key: key}, nil
}

// LoadOrGenerateEncryptionKey returns the key at path if it exists. If the file
// is missing (or empty), it creates a fresh AES-256 key at that path with mode
// 0600 and returns its hex encoding.
func LoadOrGenerateEncryptionKey(path string) (string, bool, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", false, errors.New("mfa: encryption key path required")
	}
	if raw, err := os.ReadFile(path); err == nil {
		value := strings.TrimSpace(string(raw))
		if value != "" {
			key, err := decodeKey(value)
			if err != nil {
				return "", false, err
			}
			if err := validateKeyLength(key); err != nil {
				return "", false, err
			}
			return value, false, nil
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", false, fmt.Errorf("mfa: read key file: %w", err)
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return "", false, fmt.Errorf("mfa: generate key: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", false, fmt.Errorf("mfa: mkdir key dir: %w", err)
	}
	value := hex.EncodeToString(key)
	if err := os.WriteFile(path, []byte(value+"\n"), 0o600); err != nil {
		return "", false, fmt.Errorf("mfa: write key file: %w", err)
	}
	return value, true, nil
}

func decodeKey(raw string) ([]byte, error) {
	if b, err := hex.DecodeString(raw); err == nil && len(b) > 0 {
		return b, nil
	}
	for _, dec := range []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	} {
		if b, err := dec.DecodeString(raw); err == nil && len(b) > 0 {
			return b, nil
		}
	}
	return nil, errors.New("mfa: encryption key must be hex or base64")
}

func validateKeyLength(key []byte) error {
	switch len(key) {
	case 16, 24, 32:
		return nil
	default:
		return errors.New("mfa: encryption key must decode to 16, 24, or 32 bytes")
	}
}

// Encrypt seals server-readable factor material using AES-GCM.
func (s *Service) Encrypt(plaintext []byte) ([]byte, error) {
	if s == nil || len(s.key) == 0 {
		return nil, errors.New("mfa: encryption service unavailable")
	}
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	out := make([]byte, 0, len(nonce)+len(plaintext)+gcm.Overhead())
	out = append(out, nonce...)
	out = gcm.Seal(out, nonce, plaintext, nil)
	return out, nil
}

// Decrypt opens server-readable factor material sealed with Encrypt.
func (s *Service) Decrypt(ciphertext []byte) ([]byte, error) {
	if s == nil || len(s.key) == 0 {
		return nil, errors.New("mfa: encryption service unavailable")
	}
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(ciphertext) < gcm.NonceSize() {
		return nil, errors.New("mfa: ciphertext too short")
	}
	nonce := ciphertext[:gcm.NonceSize()]
	body := ciphertext[gcm.NonceSize():]
	return gcm.Open(nil, nonce, body, nil)
}

// NewTOTPKey creates a fresh authenticator-app seed.
func NewTOTPKey(issuer, accountName string) (*otp.Key, error) {
	return totp.Generate(totp.GenerateOpts{
		Issuer:      strings.TrimSpace(issuer),
		AccountName: strings.TrimSpace(accountName),
		Algorithm:   otp.AlgorithmSHA1,
		Digits:      otp.DigitsSix,
		Period:      30,
	})
}

// ValidateTOTP validates a code against a shared secret.
func ValidateTOTP(code, secret string) bool {
	ok, err := totp.ValidateCustom(strings.TrimSpace(code), strings.TrimSpace(secret), time.Now().UTC(), totp.ValidateOpts{
		Period:    30,
		Skew:      1,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	return err == nil && ok
}

// QRPNGDataURL encodes content into a PNG data URL that the browser can embed directly.
func QRPNGDataURL(content string) (string, error) {
	png, err := qrcode.Encode(content, qrcode.Medium, 256)
	if err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(png), nil
}

// GenerateRecoveryCodes returns human-readable high-entropy one-time codes.
func GenerateRecoveryCodes(n int) ([]string, error) {
	if n <= 0 {
		n = 8
	}
	out := make([]string, 0, n)
	seen := make(map[string]struct{}, n)
	for len(out) < n {
		var b [9]byte
		if _, err := rand.Read(b[:]); err != nil {
			return nil, err
		}
		code := strings.ToUpper(base64.RawStdEncoding.EncodeToString(b[:]))
		code = code[:4] + "-" + code[4:8] + "-" + code[8:12]
		if _, ok := seen[code]; ok {
			continue
		}
		seen[code] = struct{}{}
		out = append(out, code)
	}
	return out, nil
}

// NormalizeRecoveryCode removes formatting differences before verification.
func NormalizeRecoveryCode(code string) string {
	code = strings.ToUpper(strings.TrimSpace(code))
	code = strings.ReplaceAll(code, "-", "")
	code = strings.ReplaceAll(code, " ", "")
	return code
}

// HashRecoveryCode returns a deterministic hash for a generated recovery code.
func HashRecoveryCode(code string) string {
	sum := sha256.Sum256([]byte(NormalizeRecoveryCode(code)))
	return hex.EncodeToString(sum[:])
}

// RecoveryCodeMatches compares a stored hash against a raw code.
func RecoveryCodeMatches(hash, code string) bool {
	want := []byte(strings.TrimSpace(hash))
	got := []byte(HashRecoveryCode(code))
	return len(want) == len(got) && subtle.ConstantTimeCompare(want, got) == 1
}
