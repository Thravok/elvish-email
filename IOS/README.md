# ELVish iOS app

SwiftUI client in this directory that talks to the same **`/api/...`** surface as the web app. The Xcode project is **`IOS.xcodeproj`** in this folder (no workspace wrapper).

## Open in Xcode

1. Double-click `IOS.xcodeproj` or run `open IOS/IOS.xcodeproj` from the repository root.
2. Select the **IOS** scheme for running the app on a simulator or device.
3. Ensure **`elvishapi`** is running and reachable if you exercise authenticated flows (see root [README.md](../README.md) — default local URL is `http://127.0.0.1:8765` for `make dev` / `make dev-api-once`).

## API base URL

[`IOS/IOS/Config/AppEnvironment.swift`](IOS/IOS/Config/AppEnvironment.swift) resolves the API root in this order:

1. **`ElvishAPIBaseURL`** in the app bundle **Info.plist** (string, no trailing slash). The committed default is `http://127.0.0.1:8765` to match local `make dev` / `make dev-once`.
2. If you remove that key, the same URL is used as the code fallback in `AppEnvironment`. Override the plist value for staging or production hosts.

All requests should target the host that serves `/api/...` over HTTP or HTTPS.

## Code signing

The Xcode project does **not** commit an Apple **Development Team** ID.

1. Copy [`Config/Local.xcconfig.example`](Config/Local.xcconfig.example) to `Config/Local.xcconfig` (gitignored).
2. Set `DEVELOPMENT_TEAM` to your 10-character team ID, or pick your team in Xcode under **IOS** → **Signing & Capabilities**.

[`Config/Project.xcconfig`](Config/Project.xcconfig) optionally includes `Local.xcconfig` for all configurations. CI builds with `CODE_SIGNING_ALLOWED=NO` and does not need a team file.

### Apple Developer App ID capabilities

For bundle ID `email.elvish.IOS`, leave **Capabilities** empty on the App ID unless you add matching code:

| Capability | When to enable |
|------------|----------------|
| Push Notifications | Tier 3 — not implemented in app code yet |
| Associated Domains | Tier 3 — `webcredentials:` in entitlements; enable on App ID when using passkeys / universal links |
| App Groups | Extensions or shared keychain across targets |

The app uses the standard Keychain API for unlocked key material (no custom access group entitlement).

## Tests

The project defines an **IOSTests** target under [`IOSTests/`](IOSTests/) (SRP vectors, mail filters, account wrap, compose MIME).

- In Xcode: **Product → Test** (⌘U) with the **IOS** scheme selected.
- From the CLI (use a **named** simulator — generic destinations fail for test bundles):

```bash
cd IOS
xcodebuild test -project IOS.xcodeproj -scheme IOS \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  CODE_SIGNING_ALLOWED=NO
```

Adjust `name=` to a simulator listed in `xcrun simctl list devices available`. Tests that call the real network need a running backend and a matching **ElvishAPIBaseURL**.

## Compose (mobile)

Tap the **compose** (pencil) button in the mail toolbar when mail keys are unlocked.

| Mode | Behavior |
|------|----------|
| **PGP Direct** | Encrypt+sign to one **To** address (Cc/Bcc are header-only). Local Elvish recipients use `POST /api/v1/mail/messages`; external addresses use `POST /api/v1/mail/outbox`. |
| **Protected link** | Password-wrapped body + `POST /api/v1/mail/protected-links`; share the returned `/m/{token}` URL out-of-band. |

Normative client behavior: [`static/mail/compose.jsx`](../static/mail/compose.jsx). Limitations: single **To** for PGP mode; no file attachments or HTML compose; WebAuthn-only accounts must use the web client.

### Manual QA (`make dev`)

1. **Local PGP** — User A → User B on the same server; message appears in B’s inbox.
2. **External PGP** — User A → external address with a resolvable pubkey; check outbox id in UI (delivery requires mail worker).
3. **Protected link** — Create link in app, open URL in browser `/m/{token}`, unlock with password.

## Layout

| Path | Role |
|------|------|
| `IOS/` | Application sources (`Auth/`, `Config/`, `Networking/`, `Mail/`, …) |
| `IOSTests/` | XCTest sources |

Client feature tiers and cross-platform QA: [docs/client-parity-roadmap.md](../docs/client-parity-roadmap.md).

## Tier 1 (mobile core)

- Inbox folders, decrypt, mark read/unread, swipe trash/archive/inbox
- Client-side mail filters (inbox; `body` rules need decrypted body — best-effort on list pass)
- Compose: PGP direct + protected link; **Reply** / **Reply all** from message detail
- Cc/Bcc in PGP mode are **header-only**; ciphertext encrypts exactly one **To**

From the repository root: `make test-ios` (macOS).

For server-side behavior and API contracts, prefer [docs/README.md](../docs/README.md) and the code under `internal/httpserver/`.
