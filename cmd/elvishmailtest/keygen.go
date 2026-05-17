package main

import (
	"bytes"
	"crypto"
	"errors"
	"fmt"
	"io"
	"strings"

	pgpcrypto "github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
)

// generateTestKey creates an unencrypted Curve25519 PGP key for selfcheck use.
func generateTestKey(uid string) (armoredPub, armoredPriv string, err error) {
	cfg := &packet.Config{
		Algorithm:     packet.PubKeyAlgoEdDSA,
		DefaultHash:   crypto.SHA256,
		DefaultCipher: packet.CipherAES256,
		RSABits:       2048,
	}
	parts := strings.SplitN(uid, "<", 2)
	name := strings.TrimSpace(parts[0])
	email := ""
	if len(parts) == 2 {
		email = strings.TrimSuffix(strings.TrimSpace(parts[1]), ">")
	}
	ent, err := pgpcrypto.NewEntity(name, "elvishmailtest", email, cfg)
	if err != nil {
		return "", "", fmt.Errorf("new entity: %w", err)
	}
	var pubBuf bytes.Buffer
	pa, err := armor.Encode(&pubBuf, "PGP PUBLIC KEY BLOCK", nil)
	if err != nil {
		return "", "", err
	}
	if err := ent.Serialize(pa); err != nil {
		return "", "", err
	}
	if err := pa.Close(); err != nil {
		return "", "", err
	}
	var privBuf bytes.Buffer
	pb, err := armor.Encode(&privBuf, "PGP PRIVATE KEY BLOCK", nil)
	if err != nil {
		return "", "", err
	}
	if err := ent.SerializePrivate(pb, nil); err != nil {
		return "", "", err
	}
	if err := pb.Close(); err != nil {
		return "", "", err
	}
	return pubBuf.String(), privBuf.String(), nil
}

func decryptArmored(armoredPriv string, ciphertext []byte) ([]byte, error) {
	el, err := pgpcrypto.ReadArmoredKeyRing(strings.NewReader(armoredPriv))
	if err != nil {
		return nil, err
	}
	if len(el) == 0 {
		return nil, errors.New("decryptArmored: no entities")
	}
	block, err := armor.Decode(bytes.NewReader(ciphertext))
	if err != nil {
		return nil, err
	}
	md, err := pgpcrypto.ReadMessage(block.Body, el, nil, nil)
	if err != nil {
		return nil, err
	}
	return io.ReadAll(md.UnverifiedBody)
}
