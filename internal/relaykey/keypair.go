package relaykey

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
)

// ErrNotConfigured indicates the operator did not point ELVISH_RELAY_KEY_PATH at a key file.
// API endpoints that require Mode C must surface this as 503 with a clear message.
var ErrNotConfigured = errors.New("relaykey: not configured (set ELVISH_RELAY_KEY_PATH)")

// ErrPassphraseProtected means the loaded key has an encrypted private packet.
// We do not support passphrase-protected relay keys: the worker cannot prompt.
var ErrPassphraseProtected = errors.New("relaykey: passphrase-protected keys are not supported; export with --no-symmetric")

// KeyPair is the in-memory loaded relay keypair plus its armored public block.
type KeyPair struct {
	entity        *pgpcrypto.Entity
	armoredPublic string
	fingerprint   string
}

// LoadFromPath reads an armored OpenPGP private key block from disk and returns a usable KeyPair.
// path is treated as a path to a PGP-armored file; if path is empty, returns ErrNotConfigured.
func LoadFromPath(path string) (*KeyPair, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, ErrNotConfigured
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("relaykey: read %s: %w", path, err)
	}
	return Load(raw)
}

// Load parses an armored or binary OpenPGP private key block and returns a KeyPair.
func Load(raw []byte) (*KeyPair, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, ErrNotConfigured
	}
	el, err := pgpcrypto.ReadArmoredKeyRing(bytes.NewReader(raw))
	if err != nil {
		// Try unarmored.
		el, err = pgpcrypto.ReadKeyRing(bytes.NewReader(raw))
		if err != nil {
			return nil, fmt.Errorf("relaykey: parse: %w", err)
		}
	}
	if len(el) == 0 || el[0].PrivateKey == nil {
		return nil, errors.New("relaykey: file does not contain a private key")
	}
	ent := el[0]
	if ent.PrivateKey.Encrypted {
		return nil, ErrPassphraseProtected
	}
	for _, sub := range ent.Subkeys {
		if sub.PrivateKey != nil && sub.PrivateKey.Encrypted {
			return nil, ErrPassphraseProtected
		}
	}
	armPub, err := armorPublic(ent)
	if err != nil {
		return nil, fmt.Errorf("relaykey: armor public: %w", err)
	}
	fp := fmt.Sprintf("%X", ent.PrimaryKey.Fingerprint)
	return &KeyPair{entity: ent, armoredPublic: armPub, fingerprint: fp}, nil
}

// GenerateArmoredPrivate creates a new armored OpenPGP private key suitable for
// use as the server plaintext-relay key.
func GenerateArmoredPrivate(uid, email string) ([]byte, error) {
	uid = strings.TrimSpace(uid)
	if uid == "" {
		uid = "Elvish Plaintext Relay"
	}
	email = strings.TrimSpace(email)
	if email == "" {
		email = "relay@local"
	}
	cfg := &packet.Config{
		Algorithm: packet.PubKeyAlgoEdDSA,
		Time:      func() time.Time { return time.Now() },
	}
	ent, err := pgpcrypto.NewEntity(uid, "relaykey generated", email, cfg)
	if err != nil {
		return nil, fmt.Errorf("relaykey: generate entity: %w", err)
	}
	var buf bytes.Buffer
	aw, err := armor.Encode(&buf, "PGP PRIVATE KEY BLOCK", nil)
	if err != nil {
		return nil, fmt.Errorf("relaykey: armor private: %w", err)
	}
	if err := ent.SerializePrivateWithoutSigning(aw, nil); err != nil {
		_ = aw.Close()
		return nil, fmt.Errorf("relaykey: serialize private: %w", err)
	}
	if err := aw.Close(); err != nil {
		return nil, fmt.Errorf("relaykey: close private armor: %w", err)
	}
	return buf.Bytes(), nil
}

// LoadOrGenerate returns the key at path if it exists. If the file is missing
// (or empty), it creates a new keypair at that path with mode 0600, then loads it.
func LoadOrGenerate(path, uid, email string) (*KeyPair, bool, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, false, ErrNotConfigured
	}
	kp, err := LoadFromPath(path)
	if err == nil {
		return kp, false, nil
	}
	if !errors.Is(err, os.ErrNotExist) && !errors.Is(err, ErrNotConfigured) {
		return nil, false, err
	}
	dir := filepath.Dir(path)
	if dir != "" && dir != "." {
		if mkErr := os.MkdirAll(dir, 0o700); mkErr != nil {
			return nil, false, fmt.Errorf("relaykey: mkdir %s: %w", dir, mkErr)
		}
	}
	raw, genErr := GenerateArmoredPrivate(uid, email)
	if genErr != nil {
		return nil, false, genErr
	}
	if writeErr := os.WriteFile(path, raw, 0o600); writeErr != nil {
		return nil, false, fmt.Errorf("relaykey: write %s: %w", path, writeErr)
	}
	kp, loadErr := Load(raw)
	if loadErr != nil {
		return nil, false, loadErr
	}
	return kp, true, nil
}

// Fingerprint returns the uppercase hex fingerprint of the primary key.
func (k *KeyPair) Fingerprint() string {
	if k == nil {
		return ""
	}
	return k.fingerprint
}

// FingerprintShort returns the last 16 hex chars (the legacy long key id).
func (k *KeyPair) FingerprintShort() string {
	if k == nil || len(k.fingerprint) < 16 {
		return k.Fingerprint()
	}
	return k.fingerprint[len(k.fingerprint)-16:]
}

// ArmoredPublic returns the armored PGP PUBLIC KEY BLOCK for sharing/diagnostics.
func (k *KeyPair) ArmoredPublic() string {
	if k == nil {
		return ""
	}
	return k.armoredPublic
}

// PublicHashHex returns sha256 of the armored public key (used in audit logs).
func (k *KeyPair) PublicHashHex() string {
	if k == nil {
		return ""
	}
	sum := sha256.Sum256([]byte(k.armoredPublic))
	return hex.EncodeToString(sum[:])
}

// Wrap encrypts plaintext to the relay public key and returns an armored PGP MESSAGE.
// Used by the API layer when accepting a plaintext outbound submission so that the
// payload never touches durable storage in cleartext.
func (k *KeyPair) Wrap(plaintext []byte) ([]byte, error) {
	if k == nil || k.entity == nil {
		return nil, ErrNotConfigured
	}
	var buf bytes.Buffer
	aw, err := armor.Encode(&buf, "PGP MESSAGE", nil)
	if err != nil {
		return nil, fmt.Errorf("relaykey: armor: %w", err)
	}
	cfg := &packet.Config{DefaultCipher: packet.CipherAES256, DefaultCompressionAlgo: packet.CompressionNone}
	wc, err := pgpcrypto.Encrypt(aw, pgpcrypto.EntityList{k.entity}, nil, nil, cfg)
	if err != nil {
		_ = aw.Close()
		return nil, fmt.Errorf("relaykey: encrypt: %w", err)
	}
	if _, err := io.Copy(wc, bytes.NewReader(plaintext)); err != nil {
		_ = wc.Close()
		_ = aw.Close()
		return nil, fmt.Errorf("relaykey: write: %w", err)
	}
	if err := wc.Close(); err != nil {
		_ = aw.Close()
		return nil, fmt.Errorf("relaykey: close encrypted: %w", err)
	}
	if err := aw.Close(); err != nil {
		return nil, fmt.Errorf("relaykey: close armor: %w", err)
	}
	return buf.Bytes(), nil
}

// Unwrap decrypts an armored or binary PGP MESSAGE produced by Wrap and returns the plaintext.
// The caller is responsible for wiping the returned buffer after use.
func (k *KeyPair) Unwrap(ciphertext []byte) ([]byte, error) {
	if k == nil || k.entity == nil {
		return nil, ErrNotConfigured
	}
	var src io.Reader = bytes.NewReader(ciphertext)
	if bytes.HasPrefix(bytes.TrimSpace(ciphertext), []byte("-----BEGIN PGP MESSAGE-----")) {
		blk, err := armor.Decode(bytes.NewReader(ciphertext))
		if err != nil {
			return nil, fmt.Errorf("relaykey: armor decode: %w", err)
		}
		src = blk.Body
	}
	md, err := pgpcrypto.ReadMessage(src, pgpcrypto.EntityList{k.entity}, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("relaykey: read message: %w", err)
	}
	plain, err := io.ReadAll(md.UnverifiedBody)
	if err != nil {
		return nil, fmt.Errorf("relaykey: read body: %w", err)
	}
	return plain, nil
}

// armorPublic serializes the entity's public half as an armored PGP PUBLIC KEY BLOCK.
func armorPublic(ent *pgpcrypto.Entity) (string, error) {
	var buf bytes.Buffer
	aw, err := armor.Encode(&buf, "PGP PUBLIC KEY BLOCK", nil)
	if err != nil {
		return "", err
	}
	if err := ent.Serialize(aw); err != nil {
		_ = aw.Close()
		return "", err
	}
	if err := aw.Close(); err != nil {
		return "", err
	}
	return buf.String(), nil
}
