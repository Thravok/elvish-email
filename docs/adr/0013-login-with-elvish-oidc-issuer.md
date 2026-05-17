# ADR 0013: “Login with Elvish” — OIDC issuer (Tailscale and registered clients)

## Status

Accepted (2026-05)

## Context

Operators want **“Login with Elvish”**: downstream products (starting with [Tailscale custom OIDC](https://tailscale.com/kb/1240/sso-custom-oidc)) redirect users to Elvish for first-party authentication, then receive standard OAuth2/OIDC tokens. Tailscale requires WebFinger on the mail domain, OIDC discovery, `openid` / `profile` / `email` scopes, JWT `id_token` signed with **RSA ≥2048 or ES256**, callback `https://login.tailscale.com/a/oauth_response`, and **does not use PKCE** on the client.

Elvish **does not** and **will not** implement inbound “Login with Google/Microsoft/…” (OIDC relying party) for access to the Elvish product; first-party sign-in remains SRP/password/MFA only.

## Decision

1. Ship a **minimal in-process OIDC authorization server** subset: WebFinger, `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `GET /oauth/authorize`, `POST /oauth/token` (authorization code only, no PKCE, no `userinfo` in MVP).
2. **JWT signing** via **`github.com/go-jose/go-jose/v4`**, **RS256** only for the first release, with an operator-supplied RSA private key (PEM path).
3. **Authorization codes** live only in **Valkey** under the existing session ephemeral helpers (`PutEphemeralJSON` / `TakeEphemeralJSON`), single-use, short TTL (~90s).
4. **Session gate**: unauthenticated authorize requests redirect to `/login` with `next=` restricted to paths starting with `/oauth/authorize`.
5. **MFA gate**: if the account has MFA enabled, a **recent** `MFAVerifiedAt` on the browser session is required before issuing a code (same recency window as other sensitive flows). Otherwise return HTML guidance with a retry link.
6. **Token response**: `access_token` duplicates `id_token` for MVP (no separate opaque access-token store); not intended for calling Elvish APIs.
7. **Configuration** (all optional until enabled): `ELVISH_OIDC_CLIENT_ID`, `ELVISH_OIDC_CLIENT_SECRET`, `ELVISH_OIDC_RSA_PRIVATE_KEY_PEM_PATH`, optional `ELVISH_OIDC_ISSUER` (defaults to trimmed `ELVISH_PUBLIC_BASE_URL`), optional `ELVISH_OIDC_REDIRECT_URI` (defaults to Tailscale’s callback). If client id, secret, or key path is missing, the OIDC surface stays disabled (404).

## Consequences

- **Trust boundary**: Registered OAuth clients (e.g. Tailscale) receive `id_token` claims including `sub` (user UUID), `email`, `email_verified`, and `name`. This is intentional disclosure to the client; it does not change server-side zero-access mail storage.
- **Operations**: The WebFinger host must match the **email domain** used with Tailscale; the issuer URL in WebFinger must match `iss` in tokens and discovery document (`ELVISH_OIDC_ISSUER` or `ELVISH_PUBLIC_BASE_URL`).
- **Security review surface**: Custom OAuth logic is bounded and covered by unit tests; no full OAuth framework dependency in MVP. Future clients may require PKCE, refresh tokens, or `userinfo`—tracked as follow-ups outside this ADR’s minimal scope.

## Non-goals (explicit)

- Elvish as OIDC **relying party** (social / enterprise IdP login **into** Elvish).
- Dynamic client registration, PAR/JAR, refresh tokens, key rotation (until a concrete requirement appears).
