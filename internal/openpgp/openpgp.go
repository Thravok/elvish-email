// Package openpgp verifies detached signatures and reads public-key metadata using ProtonMail's OpenPGP fork.
package openpgp

import (
	"bytes"
	"fmt"
	"strings"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
)

// PublicKeyMeta holds display metadata for an armored PGP public key block.
type PublicKeyMeta struct {
	Fingerprint16 string // uppercase 16 hex chars (legacy key id style when available)
	FullKeyID     string // longer hex identifier for display
}

// ParseArmoredPublicKeyMeta parses an armored PUBLIC KEY BLOCK and returns fingerprint-like ids for UI.
func ParseArmoredPublicKeyMeta(armored string) (*PublicKeyMeta, error) {
	armored = strings.TrimSpace(armored)
	if armored == "" {
		return nil, fmt.Errorf("%w: empty", ErrInvalidArmoredKey)
	}
	el, err := pgpcrypto.ReadArmoredKeyRing(strings.NewReader(armored))
	if err != nil {
		return nil, fmt.Errorf("%w: read armored key: %v", ErrInvalidArmoredKey, err)
	}
	if len(el) == 0 {
		return nil, fmt.Errorf("%w: no keys in ring", ErrInvalidArmoredKey)
	}
	ent := el[0]
	if ent.PrimaryKey == nil {
		return nil, fmt.Errorf("%w: no primary public key", ErrInvalidArmoredKey)
	}
	fp := fmt.Sprintf("%X", ent.PrimaryKey.Fingerprint)
	var short16 string
	if len(fp) >= 16 {
		short16 = fp[len(fp)-16:]
	} else {
		short16 = fp
	}
	return &PublicKeyMeta{
		Fingerprint16: short16,
		FullKeyID:     fp,
	}, nil
}

// VerifyDetached checks detachedOpenPGP (armored PGP SIGNATURE or binary packet) over signedPlaintext using armoredPublicKeys.
func VerifyDetached(armoredPublicKeys string, signedPlaintext []byte, detachedOpenPGP []byte) error {
	el, err := pgpcrypto.ReadArmoredKeyRing(strings.NewReader(armoredPublicKeys))
	if err != nil {
		return fmt.Errorf("openpgp: public key: %w", err)
	}
	sigReader := bytes.NewReader(detachedOpenPGP)
	trim := bytes.TrimSpace(detachedOpenPGP)
	var cfg *packet.Config
	if bytes.HasPrefix(trim, []byte("-----BEGIN PGP SIGNATURE-----")) {
		_, err = pgpcrypto.CheckArmoredDetachedSignature(el, bytes.NewReader(signedPlaintext), sigReader, cfg)
	} else {
		_, err = pgpcrypto.CheckDetachedSignature(el, bytes.NewReader(signedPlaintext), sigReader, cfg)
	}
	if err != nil {
		return fmt.Errorf("openpgp: detached signature: %w", err)
	}
	return nil
}
