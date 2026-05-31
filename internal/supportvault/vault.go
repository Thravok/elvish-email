// Package supportvault encrypts support mailbox key material at rest for Console.
package supportvault

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

// Vault encrypts and decrypts support key blobs with a master key.
type Vault struct {
	aead cipher.AEAD
	id   string
}

// Open creates a vault from ELVISH_CONSOLE_VAULT_KEY (base64, 32 bytes).
func Open(keyB64, keyID string) (*Vault, error) {
	raw, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil {
		return nil, fmt.Errorf("supportvault: decode key: %w", err)
	}
	if len(raw) != 32 {
		return nil, errors.New("supportvault: key must be 32 bytes")
	}
	block, err := aes.NewCipher(raw)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if keyID == "" {
		keyID = "default"
	}
	return &Vault{aead: aead, id: keyID}, nil
}

// KeyID returns the vault key identifier stored with ciphertext.
func (v *Vault) KeyID() string {
	if v == nil {
		return ""
	}
	return v.id
}

// Encrypt seals plaintext with a random nonce prepended.
func (v *Vault) Encrypt(plaintext []byte) ([]byte, error) {
	if v == nil || v.aead == nil {
		return nil, errors.New("supportvault: not configured")
	}
	nonce := make([]byte, v.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	out := v.aead.Seal(nonce, nonce, plaintext, nil)
	return out, nil
}

// Decrypt opens ciphertext produced by Encrypt.
func (v *Vault) Decrypt(ciphertext []byte) ([]byte, error) {
	if v == nil || v.aead == nil {
		return nil, errors.New("supportvault: not configured")
	}
	ns := v.aead.NonceSize()
	if len(ciphertext) < ns {
		return nil, errors.New("supportvault: ciphertext too short")
	}
	nonce, ct := ciphertext[:ns], ciphertext[ns:]
	return v.aead.Open(nil, nonce, ct, nil)
}
