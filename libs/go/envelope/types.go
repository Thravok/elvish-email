// Package envelope defines Elvish's versioned encrypted mail envelope model.
//
// The envelope package is intentionally codec-agnostic: it describes what a
// stored encrypted message looks like without hard-coding OpenPGP as the only
// answer. This lets native Elvish mail move to stronger primitives while still
// preserving ciphertext-only interoperability modes such as OpenPGP passthrough.
package envelope

import (
	"errors"
	"fmt"
	"strings"
)

// Version identifies a persisted envelope schema version.
type Version string

const (
	// VersionV1 is the first versioned Elvish mail envelope format.
	VersionV1 Version = "v1"
)

// Mode describes how the stored payload should be interpreted.
type Mode string

const (
	// ModeNativeEncrypted is Elvish's native encrypted envelope.
	ModeNativeEncrypted Mode = "native-encrypted"
	// ModeAlreadyEncrypted stores ciphertext generated elsewhere as-is.
	ModeAlreadyEncrypted Mode = "already-encrypted"
)

// BodyCipher names the symmetric body/attachment cipher or passthrough format.
type BodyCipher string

const (
	BodyCipherXChaCha20Poly1305 BodyCipher = "xchacha20-poly1305"
	BodyCipherAES256GCM         BodyCipher = "aes-256-gcm"
	BodyCipherOpenPGPMessage    BodyCipher = "openpgp-message"
)

// WrapAlgorithm names the algorithm used to wrap a content key to one
// recipient. OpenPGP is retained as an interop option; native Elvish mail can
// move to ML-KEM without changing the stored manifest shape.
type WrapAlgorithm string

const (
	WrapAlgorithmMLKEM768  WrapAlgorithm = "ml-kem-768"
	WrapAlgorithmMLKEM1024 WrapAlgorithm = "ml-kem-1024"
	WrapAlgorithmOpenPGP   WrapAlgorithm = "openpgp"
	WrapAlgorithmNone      WrapAlgorithm = "none"
)

// SignatureAlgorithm describes the manifest signature algorithm.
type SignatureAlgorithm string

const (
	SignatureAlgorithmNone    SignatureAlgorithm = "none"
	SignatureAlgorithmMLDSA65 SignatureAlgorithm = "ml-dsa-65"
	SignatureAlgorithmOpenPGP SignatureAlgorithm = "openpgp"
)

// Provenance describes how the stored ciphertext entered the system.
type Provenance string

const (
	ProvenanceNativeEncrypted   Provenance = "native_encrypted"
	ProvenanceAlreadyEncrypted  Provenance = "already_encrypted"
	ProvenanceCompatibilityLink Provenance = "compatibility_bridge"
)

// RecipientWrap is one recipient-specific wrapped content key.
type RecipientWrap struct {
	RecipientID     string        `json:"recipient_id,omitempty"`
	KeyHandle       string        `json:"key_handle,omitempty"`
	Algorithm       WrapAlgorithm `json:"algorithm"`
	WrappedKeyB64   string        `json:"wrapped_key_b64,omitempty"`
	WrappedKeyArmor string        `json:"wrapped_key_armor,omitempty"`
}

// Attachment describes one encrypted attachment referenced by the envelope.
type Attachment struct {
	AttachmentID string `json:"attachment_id"`
	FileName     string `json:"file_name,omitempty"`
	ContentType  string `json:"content_type,omitempty"`
	BlobRef      string `json:"blob_ref"`
	SizeBytes    int64  `json:"size_bytes,omitempty"`
}

// Manifest is the stored per-message encrypted envelope descriptor.
type Manifest struct {
	Version            Version            `json:"version"`
	Mode               Mode               `json:"mode"`
	Provenance         Provenance         `json:"provenance"`
	BodyCipher         BodyCipher         `json:"body_cipher"`
	SignatureAlgorithm SignatureAlgorithm `json:"signature_algorithm,omitempty"`
	BodyBlobRef        string             `json:"body_blob_ref,omitempty"`
	BodySizeBytes      int64              `json:"body_size_bytes,omitempty"`
	HeaderBlobRef      string             `json:"header_blob_ref,omitempty"`
	RecipientWraps     []RecipientWrap    `json:"recipient_wraps,omitempty"`
	Attachments        []Attachment       `json:"attachments,omitempty"`
	ManifestSigB64     string             `json:"manifest_sig_b64,omitempty"`
}

// Validate checks that the manifest is self-consistent enough to persist.
func (m Manifest) Validate() error {
	if m.Version != VersionV1 {
		return fmt.Errorf("envelope: unsupported version %q", m.Version)
	}
	switch m.Mode {
	case ModeNativeEncrypted, ModeAlreadyEncrypted:
	default:
		return fmt.Errorf("envelope: unsupported mode %q", m.Mode)
	}
	switch m.Provenance {
	case ProvenanceNativeEncrypted, ProvenanceAlreadyEncrypted, ProvenanceCompatibilityLink:
	default:
		return fmt.Errorf("envelope: unsupported provenance %q", m.Provenance)
	}
	switch m.BodyCipher {
	case BodyCipherXChaCha20Poly1305, BodyCipherAES256GCM, BodyCipherOpenPGPMessage:
	default:
		return fmt.Errorf("envelope: unsupported body cipher %q", m.BodyCipher)
	}
	switch m.SignatureAlgorithm {
	case "", SignatureAlgorithmNone, SignatureAlgorithmMLDSA65, SignatureAlgorithmOpenPGP:
	default:
		return fmt.Errorf("envelope: unsupported signature algorithm %q", m.SignatureAlgorithm)
	}
	if strings.TrimSpace(m.BodyBlobRef) == "" {
		return errors.New("envelope: body blob ref required")
	}
	if m.BodySizeBytes < 0 {
		return errors.New("envelope: body size must be non-negative")
	}
	if m.Mode == ModeNativeEncrypted && len(m.RecipientWraps) == 0 {
		return errors.New("envelope: native-encrypted manifest requires recipient wraps")
	}
	for i, wrap := range m.RecipientWraps {
		if err := wrap.Validate(); err != nil {
			return fmt.Errorf("envelope: recipient wrap %d: %w", i, err)
		}
	}
	for i, attachment := range m.Attachments {
		if err := attachment.Validate(); err != nil {
			return fmt.Errorf("envelope: attachment %d: %w", i, err)
		}
	}
	return nil
}

// Validate checks one recipient wrap.
func (r RecipientWrap) Validate() error {
	switch r.Algorithm {
	case WrapAlgorithmMLKEM768, WrapAlgorithmMLKEM1024, WrapAlgorithmOpenPGP, WrapAlgorithmNone:
	default:
		return fmt.Errorf("unsupported wrap algorithm %q", r.Algorithm)
	}
	if r.Algorithm == WrapAlgorithmNone {
		return nil
	}
	if strings.TrimSpace(r.RecipientID) == "" && strings.TrimSpace(r.KeyHandle) == "" {
		return errors.New("recipient_id or key_handle required")
	}
	if strings.TrimSpace(r.WrappedKeyB64) == "" && strings.TrimSpace(r.WrappedKeyArmor) == "" {
		return errors.New("wrapped key payload required")
	}
	return nil
}

// Validate checks one attachment descriptor.
func (a Attachment) Validate() error {
	if strings.TrimSpace(a.AttachmentID) == "" {
		return errors.New("attachment id required")
	}
	if strings.TrimSpace(a.BlobRef) == "" {
		return errors.New("attachment blob ref required")
	}
	if a.SizeBytes < 0 {
		return errors.New("attachment size must be non-negative")
	}
	return nil
}
