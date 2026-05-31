# Documentation

Design notes, architecture, and feature specs for the **ELVish** server and clients. For how to run the stack locally, environment variables, and deploy notes, start at the repository [README.md](../README.md). For contributor workflows and Make targets, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## How to read this repository

- **Primary server binary:** [`cmd/elvishserver`](../cmd/elvishserver/) — HTTP site, JSON API under `/api/`, React admin and mail UI (static assets from [`static/`](../static/), templates from [`templates/`](../templates/)).
- **Go module path:** `elvish` (see [`go.mod`](../go.mod)). Application code lives under [`internal/`](../internal/).
- **SQL migrations:** [`internal/db/migrations/`](../internal/db/migrations/) — applied by goose when `elvishserver` starts with a configured `COCKROACH_DSN`.
- **E2EE mail (browser):** [`static/mail/`](../static/mail/) — React/JSX mail app; local-only search worker in [`static/mail/search/`](../static/mail/search/README.md).
- **Native iOS client:** [`IOS/`](../IOS/) — Xcode project and Swift sources.
- **Flutter Android client:** [`flutter/elvish_mail/`](../flutter/elvish_mail/) — Flutter app (same JSON API as iOS); see [`flutter/elvish_mail/README.md`](../flutter/elvish_mail/README.md).

## Table of contents

| Document | Description |
|----------|-------------|
| [architecture.md](architecture.md) | High-level system diagram and data planes |
| [e2ee-mail-spec.md](e2ee-mail-spec.md) | End-to-end encrypted mail product and protocol notes |
| [backend-settings-api.md](backend-settings-api.md) | Mail settings / account API implementation checklist |
| [runbooks/support-mailbox.md](runbooks/support-mailbox.md) | Support inbox provisioning, admin contact emails, `security.txt`, and triage notes |
| [adr/README.md](adr/README.md) | Index of architecture decision records (0001–0011) |
| [openapi/supplemental.yaml](openapi/supplemental.yaml) | Nested `/api` routes merged with auto-extracted `api.go` routes; run `make openapi` |
| [../flutter/elvish_mail/README.md](../flutter/elvish_mail/README.md) | Flutter Android mail client: API base URL, `flutter run`, tests |

See [adr/README.md](adr/README.md) for major mail, storage, and privacy decisions; the spec and checklists should stay consistent with them.
