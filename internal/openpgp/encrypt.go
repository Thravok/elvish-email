package openpgp

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
)

// ErrKeyExpired is returned by ValidateForEncryption when the primary key has expired.
var ErrKeyExpired = errors.New("openpgp: key expired")

// ErrKeyRevoked is returned by ValidateForEncryption when the key has a revocation signature.
var ErrKeyRevoked = errors.New("openpgp: key revoked")

// ErrNoEncryptionSubkey is returned when the key has no usable encryption subkey.
var ErrNoEncryptionSubkey = errors.New("openpgp: no encryption-capable subkey")

// Encrypt produces an armored PGP MESSAGE encrypting plaintext to armoredPub.
// No signing is performed; the server has no signing key for messages.
func Encrypt(armoredPub string, plaintext []byte) ([]byte, error) {
	return EncryptToMany([]string{armoredPub}, plaintext)
}

// EncryptToMany produces a single armored PGP MESSAGE addressable by any of the given pubkeys.
func EncryptToMany(armoredPubs []string, plaintext []byte) ([]byte, error) {
	if len(armoredPubs) == 0 {
		return nil, errors.New("openpgp: no recipients")
	}
	var to pgpcrypto.EntityList
	for i, ap := range armoredPubs {
		ap = strings.TrimSpace(ap)
		if ap == "" {
			return nil, fmt.Errorf("openpgp: empty pubkey at index %d", i)
		}
		el, err := pgpcrypto.ReadArmoredKeyRing(strings.NewReader(ap))
		if err != nil {
			return nil, fmt.Errorf("openpgp: read pubkey %d: %w", i, err)
		}
		if len(el) == 0 {
			return nil, fmt.Errorf("openpgp: pubkey %d has no entities", i)
		}
		to = append(to, el...)
	}
	var buf bytes.Buffer
	aw, err := armor.Encode(&buf, "PGP MESSAGE", nil)
	if err != nil {
		return nil, fmt.Errorf("openpgp: armor: %w", err)
	}
	cfg := &packet.Config{DefaultCipher: packet.CipherAES256, DefaultCompressionAlgo: packet.CompressionNone}
	wc, err := pgpcrypto.Encrypt(aw, to, nil, nil, cfg)
	if err != nil {
		_ = aw.Close()
		return nil, fmt.Errorf("openpgp: encrypt: %w", err)
	}
	if _, err := io.Copy(wc, bytes.NewReader(plaintext)); err != nil {
		_ = wc.Close()
		_ = aw.Close()
		return nil, fmt.Errorf("openpgp: write: %w", err)
	}
	if err := wc.Close(); err != nil {
		_ = aw.Close()
		return nil, fmt.Errorf("openpgp: close encrypted: %w", err)
	}
	if err := aw.Close(); err != nil {
		return nil, fmt.Errorf("openpgp: close armor: %w", err)
	}
	return buf.Bytes(), nil
}

// KeyDetail extends PublicKeyMeta with display+validation info.
type KeyDetail struct {
	Fingerprint  string
	KeyIDLong    string
	PrimaryUID   string
	Emails       []string
	Algorithm    string
	Bits         int
	Created      time.Time
	ExpiresAt    *time.Time
	IsRevoked    bool
	Capabilities Capabilities
}

// Capabilities flags the C/S/E roles found in the key (primary or subkey).
type Capabilities struct {
	Certify bool
	Sign    bool
	Encrypt bool
}

// ParseKeyDetail extracts UI- and validation-relevant fields from an armored public key.
func ParseKeyDetail(armored string) (*KeyDetail, error) {
	armored = strings.TrimSpace(armored)
	if armored == "" {
		return nil, fmt.Errorf("%w: empty", ErrInvalidArmoredKey)
	}
	el, err := pgpcrypto.ReadArmoredKeyRing(strings.NewReader(armored))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidArmoredKey, err)
	}
	if len(el) == 0 || el[0].PrimaryKey == nil {
		return nil, fmt.Errorf("%w: no primary public key", ErrInvalidArmoredKey)
	}
	ent := el[0]
	d := &KeyDetail{
		Fingerprint: fmt.Sprintf("%X", ent.PrimaryKey.Fingerprint),
		Created:     ent.PrimaryKey.CreationTime,
		Algorithm:   pubAlgoName(ent.PrimaryKey.PubKeyAlgo),
		Bits:        bitsFromKey(ent),
	}
	if len(d.Fingerprint) >= 16 {
		d.KeyIDLong = d.Fingerprint[len(d.Fingerprint)-16:]
	} else {
		d.KeyIDLong = d.Fingerprint
	}
	primaryUID := ""
	for _, id := range ent.Identities {
		if primaryUID == "" {
			primaryUID = id.Name
		}
		if id.UserId != nil && id.UserId.Email != "" {
			d.Emails = append(d.Emails, strings.ToLower(strings.TrimSpace(id.UserId.Email)))
		}
		if id.SelfSignature != nil && id.SelfSignature.IsPrimaryId != nil && *id.SelfSignature.IsPrimaryId {
			primaryUID = id.Name
		}
		if id.SelfSignature != nil && id.SelfSignature.RevocationReason != nil {
			d.IsRevoked = true
		}
	}
	d.PrimaryUID = primaryUID
	if len(ent.Revocations) > 0 {
		d.IsRevoked = true
	}
	if ent.PrimaryIdentity() != nil && ent.PrimaryIdentity().SelfSignature != nil {
		ss := ent.PrimaryIdentity().SelfSignature
		if ss.KeyLifetimeSecs != nil && *ss.KeyLifetimeSecs > 0 {
			t := ent.PrimaryKey.CreationTime.Add(time.Duration(*ss.KeyLifetimeSecs) * time.Second)
			d.ExpiresAt = &t
		}
		d.Capabilities.Certify = ss.FlagsValid && ss.FlagCertify
		d.Capabilities.Sign = ss.FlagsValid && ss.FlagSign
		d.Capabilities.Encrypt = ss.FlagsValid && (ss.FlagEncryptCommunications || ss.FlagEncryptStorage)
	}
	for _, sub := range ent.Subkeys {
		if sub.Sig == nil {
			continue
		}
		if sub.Sig.FlagsValid {
			if sub.Sig.FlagCertify {
				d.Capabilities.Certify = true
			}
			if sub.Sig.FlagSign {
				d.Capabilities.Sign = true
			}
			if sub.Sig.FlagEncryptCommunications || sub.Sig.FlagEncryptStorage {
				d.Capabilities.Encrypt = true
			}
		}
	}
	return d, nil
}

// ValidateForEncryption asserts the key is fit for encrypting (not expired, not revoked, has E subkey).
func ValidateForEncryption(d *KeyDetail) error {
	if d == nil {
		return errors.New("openpgp: nil key detail")
	}
	if d.IsRevoked {
		return ErrKeyRevoked
	}
	if d.ExpiresAt != nil && time.Now().After(*d.ExpiresAt) {
		return ErrKeyExpired
	}
	if !d.Capabilities.Encrypt {
		return ErrNoEncryptionSubkey
	}
	return nil
}

func pubAlgoName(a packet.PublicKeyAlgorithm) string {
	switch a {
	case packet.PubKeyAlgoRSA, packet.PubKeyAlgoRSAEncryptOnly, packet.PubKeyAlgoRSASignOnly:
		return "rsa"
	case packet.PubKeyAlgoElGamal:
		return "elgamal"
	case packet.PubKeyAlgoDSA:
		return "dsa"
	case packet.PubKeyAlgoECDH:
		return "ecdh"
	case packet.PubKeyAlgoECDSA:
		return "ecdsa"
	case packet.PubKeyAlgoEdDSA:
		return "eddsa"
	case packet.PubKeyAlgoX25519:
		return "x25519"
	case packet.PubKeyAlgoEd25519:
		return "ed25519"
	}
	return fmt.Sprintf("algo-%d", int(a))
}

func bitsFromKey(ent *pgpcrypto.Entity) int {
	if ent == nil || ent.PrimaryKey == nil {
		return 0
	}
	if n, err := ent.PrimaryKey.BitLength(); err == nil {
		return int(n)
	}
	return 0
}

// BodyKind is the result of Sniff.
type BodyKind int

const (
	BodyUnknown BodyKind = iota
	BodyCleartext
	BodyArmoredMessage
	BodyBinaryPGP
	BodyPGPMIME
)

// Sniff classifies a raw body for the mail pipeline.
func Sniff(body []byte) BodyKind {
	trim := bytes.TrimLeft(body, " \r\n\t")
	if bytes.HasPrefix(trim, []byte("-----BEGIN PGP MESSAGE-----")) {
		return BodyArmoredMessage
	}
	if bytes.HasPrefix(trim, []byte("-----BEGIN PGP SIGNED MESSAGE-----")) {
		// Cleartext-signed mail is not ciphertext; do not treat as an encrypted blob.
		return BodyCleartext
	}
	// Lightweight MIME sniff for PGP/MIME (RFC 3156).
	if bytes.Contains(body, []byte("multipart/encrypted")) && bytes.Contains(body, []byte("application/pgp-encrypted")) {
		return BodyPGPMIME
	}
	// OpenPGP packet header byte: 0x84/0x85/0x86/0x88 etc. New format = 0xC0|tag.
	if len(trim) > 0 {
		b := trim[0]
		// New-format packets always have bit 7 and bit 6 set: 0b11xxxxxx (>=0xC0).
		if b >= 0xC0 || (b&0xC0) == 0x80 {
			return BodyBinaryPGP
		}
	}
	return BodyCleartext
}
