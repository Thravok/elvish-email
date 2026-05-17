package oauthoidc

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

func newRS256Signer(priv *rsa.PrivateKey) (jose.Signer, string, error) {
	pubDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		return nil, "", err
	}
	kid := KeyIDFromPublicKey(pubDER)
	sig, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: priv},
		(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", kid),
	)
	if err != nil {
		return nil, "", fmt.Errorf("oauthoidc: new signer: %w", err)
	}
	return sig, kid, nil
}

// JWKS returns the public JWK set for this issuer's signing key.
func JWKS(priv *rsa.PublicKey, kid string) (jose.JSONWebKeySet, error) {
	if priv == nil {
		return jose.JSONWebKeySet{}, errors.New("oauthoidc: nil public key")
	}
	jwk := jose.JSONWebKey{
		Key:       priv,
		Algorithm: string(jose.RS256),
		Use:       "sig",
		KeyID:     kid,
	}
	if !jwk.Valid() {
		return jose.JSONWebKeySet{}, errors.New("oauthoidc: invalid jwk")
	}
	return jose.JSONWebKeySet{Keys: []jose.JSONWebKey{jwk}}, nil
}

// IDTokenClaims carries standard + OIDC private claims for the id_token.
type IDTokenClaims struct {
	Nonce         string `json:"nonce,omitempty"`
	Email         string `json:"email,omitempty"`
	EmailVerified bool   `json:"email_verified,omitempty"`
	Name          string `json:"name,omitempty"`
}

// SignIDToken builds and signs a compact JWT id_token.
func SignIDToken(signer jose.Signer, issuer, audience, subject, nonce, email, name string, ttl time.Duration) (string, error) {
	if ttl <= 0 {
		ttl = time.Hour
	}
	now := time.Now().UTC()
	jtiBytes := make([]byte, 16)
	if _, err := rand.Read(jtiBytes); err != nil {
		return "", err
	}
	jti := base64.RawURLEncoding.EncodeToString(jtiBytes)
	pub := jwt.Claims{
		Issuer:   issuer,
		Subject:  subject,
		Audience: jwt.Audience{audience},
		ID:       jti,
		Expiry:   jwt.NewNumericDate(now.Add(ttl)),
		IssuedAt: jwt.NewNumericDate(now),
	}
	priv := IDTokenClaims{
		Nonce:         nonce,
		Email:         email,
		EmailVerified: true,
		Name:          name,
	}
	return jwt.Signed(signer).Claims(pub).Claims(priv).Serialize()
}
