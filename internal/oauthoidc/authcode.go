package oauthoidc

// EphemeralOAuthCodeBucket is the Valkey ephemeral bucket name for OAuth authorization codes.
const EphemeralOAuthCodeBucket = "oauthcode"

// StoredAuthCode is persisted briefly in Valkey for one-time exchange at the token endpoint.
type StoredAuthCode struct {
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
	Name        string `json:"name,omitempty"`
	Nonce       string `json:"nonce"`
	ClientID    string `json:"client_id"`
	RedirectURI string `json:"redirect_uri"`
}
