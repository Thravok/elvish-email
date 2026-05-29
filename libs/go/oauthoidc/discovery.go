package oauthoidc

import (
	"encoding/json"
	"fmt"
)

// DiscoveryDocument returns OIDC provider metadata fields for this issuer.
func (i *Issuer) DiscoveryDocument() map[string]any {
	if i == nil {
		return nil
	}
	base := i.IssuerURL
	return map[string]any{
		"issuer":                                base,
		"authorization_endpoint":                base + "/oauth/authorize",
		"token_endpoint":                        base + "/oauth/token",
		"jwks_uri":                              base + "/.well-known/jwks.json",
		"response_types_supported":              []string{"code"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
		"scopes_supported":                      []string{"openid", "profile", "email"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_post", "client_secret_basic"},
		"grant_types_supported":                 []string{"authorization_code"},
		"claims_supported":                      []string{"sub", "iss", "aud", "exp", "iat", "nonce", "email", "email_verified", "name"},
	}
}

// MarshalDiscoveryJSON returns JSON for /.well-known/openid-configuration.
func (i *Issuer) MarshalDiscoveryJSON() ([]byte, error) {
	if i == nil {
		return nil, fmt.Errorf("oauthoidc: nil issuer")
	}
	return json.Marshal(i.DiscoveryDocument())
}

// MarshalJWKSJSON returns JSON for the JWKS document.
func (i *Issuer) MarshalJWKSJSON() ([]byte, error) {
	if i == nil || i.rsaKey == nil {
		return nil, fmt.Errorf("oauthoidc: nil issuer")
	}
	set, err := JWKS(&i.rsaKey.PublicKey, i.KeyID)
	if err != nil {
		return nil, err
	}
	return json.Marshal(set)
}
