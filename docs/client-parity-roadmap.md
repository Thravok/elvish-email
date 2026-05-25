# Client parity roadmap

Canonical plan for **web**, **iOS**, and **Android (Flutter)** ELVish mail clients. Server contracts live in [e2ee-mail-spec.md](e2ee-mail-spec.md) and [architecture.md](architecture.md).

## Normative references (web)

When implementing or reviewing mobile behavior, treat these browser modules as the spec unless an ADR says otherwise:

| Area | Normative source |
|------|------------------|
| Compose (PGP direct, protected link) | [`static/mail/compose.jsx`](../static/mail/compose.jsx) |
| Reply / Reply-all drafts | `buildReplyComposeDraft` in [`static/mail/mail-app.jsx`](../static/mail/mail-app.jsx) |
| Client-side filters | [`static/mail/mail-filter-engine.js`](../static/mail/mail-filter-engine.js), [`static/mail/mail-filter-ledger.js`](../static/mail/mail-filter-ledger.js) |
| Key unlock / decrypt | [`static/auth/unlock.js`](../static/auth/unlock.js), mail shell in `mail-app.jsx` |
| Full settings UI | [`static/mail/mail-settings.jsx`](../static/mail/mail-settings.jsx) (`SETTINGS_SECTIONS`) |
| Local body search | [`static/mail/search/`](../static/mail/search/) (ADR [0008](adr/0008-local-only-body-search.md)) |

## Feature matrix

| Feature | Web | iOS | Android | Tier | Notes |
|---------|-----|-----|---------|------|-------|
| SRP login | Yes | Yes | Yes | 1 | |
| MFA TOTP / recovery | Yes | Yes | Yes | 1 | |
| Login Cap (WebView) | Yes | Yes | Yes | 1 | `/auth/cap-embed.html` on API origin |
| MFA WebAuthn (login) | Yes | Partial | Partial | 1 | UI steers to web when WebAuthn-only |
| WebAuthn-only accounts | Yes | No | No | 3 | Use web client |
| Signup / register | Yes | No | No | 3 | |
| Key vault unlock | Yes | Yes | Yes | 1 | |
| Keychain / secure persist | N/A | Yes | Yes | 1 | |
| Folder list + message list | Yes | Yes | Yes | 1 | |
| Header + body decrypt | Yes | Yes | Yes | 1 | |
| Mark read / unread | Yes | Yes | Yes | 1 | |
| Move trash / archive / inbox | Yes | Yes | Yes | 1 | Swipe triage |
| Client filter engine + ledger | Yes | Yes | Yes | 1 | Inbox only; body conditions best-effort until body loaded |
| Compose PGP direct | Yes | Yes | Yes | 1 | One encrypted **To**; Cc/Bcc header-only |
| Compose protected link | Yes | Yes | Yes | 1 | |
| Reply / Reply-all | Yes | Yes | Yes | 1 | |
| Account settings (minimal) | Yes | Yes | Yes | 2 | Logout, session summary |
| Full settings editor | Yes | No | No | 3 | 11 sections in `mail-settings.jsx` |
| Admin panel | Yes | No | No | 3 | Embedded in web mail |
| Local body search | Yes | No | No | 3 | ADR 0008 |
| Attachments / HTML compose | Yes | No | No | 3 | |
| Push notifications | No | Planned | Planned | 3 | Entitlements stub only; no handler yet |

## Tiers

### Tier 1 — Mobile core (current milestone)

Shared across iOS and Android: auth, vault unlock, inbox read, triage, client filters, compose modes, reply.

**Compose limits (Tier 1):** PGP payload encrypts exactly one **To** address. Cc and Bcc appear on the wire as headers only. Plain-text body. No attachments.

**Filters:** Rules sync via `GET /api/v1/filters`. Evaluation runs on device after inbox refresh. `body` conditions do not match until decrypted body text is available (mobile passes `bodyText: nil` on list pass, same as iOS list evaluation).

### Tier 2 — Limited settings

Read-only or minimal account UI (email, key lock state, logout). Optional mail consent read-only.

### Tier 3 — Web-primary

Signup, WebAuthn enrollment, admin, full settings CRUD, local search, attachments, HTML compose, plaintext relay, push.

## iOS capabilities (`IOS.entitlements`)

| Entitlement | Status | Tier |
|-------------|--------|------|
| `aps-environment` (development) | Present in plist; **no app handler** | 3 — remove or keep only when implementing push |
| Associated domains (`webcredentials:…`) | Present | 3 — passkeys / universal links when planned |
| Keychain access groups | Present | 1 — account key persist |

Do not enable extra Xcode capabilities without a matrix row and implementation.

## Manual QA (`make dev` / `make dev-once`)

Run against `http://127.0.0.1:8765` (iOS simulator) or `http://10.0.2.2:8765` (Android emulator). Mail keys must be unlocked (password login).

### Auth

- [ ] SRP login with two users on the same server
- [ ] MFA TOTP or recovery when enabled on account
- [ ] Cap login when `signup-config` enables Cap

### Inbox / triage

- [ ] Folder switch (inbox, sent, trash, archive)
- [ ] Swipe: trash from inbox; archive from inbox; restore to inbox from trash/archive
- [ ] Mark unread from message detail

### Filters

- [ ] Create a filter on web (e.g. subject contains → move archive)
- [ ] New message in inbox on mobile triggers move without re-applying on refresh (ledger)

### Compose

- [ ] **Local PGP** — User A → User B on same server; appears in B inbox
- [ ] **External PGP** — User A → external address with resolvable key; outbox id shown
- [ ] **Protected link** — Create in app; open `/m/{token}` in browser with password

### Reply

- [ ] Reply to inbound message: To = original sender; subject `Re: …`
- [ ] Reply-all includes Cc recipients per web semantics

## Change process

1. Update this matrix when client behavior changes.
2. Point mobile code comments at the normative web file (or shared test vectors).
3. Trust-boundary or crypto changes: update [e2ee-mail-spec.md](e2ee-mail-spec.md) or an ADR.
4. Merge requests: check **Updated client parity matrix** in the MR template.

## CI / local checks

```bash
make test-flutter    # analyze + unit tests (Android client)
make test-ios        # macOS only; xcodebuild test
```

iOS unit tests are not run on default Linux GitLab runners; use a macOS runner or run locally before release.
