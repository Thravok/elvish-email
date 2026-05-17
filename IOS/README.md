# ELVish iOS app

SwiftUI client in this directory that talks to the same **`/api/...`** surface as the web app. The Xcode project is **`IOS.xcodeproj`** in this folder (no workspace wrapper).

## Open in Xcode

1. Double-click `IOS.xcodeproj` or run `open IOS/IOS.xcodeproj` from the repository root.
2. Select the **IOS** scheme for running the app on a simulator or device.
3. Ensure **`elvishserver`** is running and reachable if you exercise authenticated flows (see root [README.md](../README.md) — default local URL is `http://127.0.0.1:8765` for `make dev` / `make dev-once`).

## API base URL

[`IOS/IOS/Config/AppEnvironment.swift`](IOS/IOS/Config/AppEnvironment.swift) resolves the API root in this order:

1. **`ElvishAPIBaseURL`** in the app bundle **Info.plist** (string, no trailing slash). The committed default is `http://127.0.0.1:8765` to match local `make dev` / `make dev-once`.
2. If you remove that key, the same URL is used as the code fallback in `AppEnvironment`. Override the plist value for staging or production hosts.

All requests should target the host that serves `/api/...` over HTTP or HTTPS.

## Code signing

The Xcode project does **not** commit an Apple **Development Team** ID. After opening the project, pick your team under the **IOS** target → **Signing & Capabilities** (or set `DEVELOPMENT_TEAM` in a local `.xcconfig` that you keep out of git).

## Tests

The project defines a **IOSTests** target (unit tests alongside the app).

- In Xcode: **Product → Test** (⌘U) with the **IOS** scheme selected; Xcode runs test targets associated with the scheme.
- From the CLI (example):

```bash
cd IOS
xcodebuild test -project IOS.xcodeproj -scheme IOS -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO
```

Adjust `-destination` to a simulator you have installed. Tests that call the real network need a running backend and a matching **ElvishAPIBaseURL**.

## Layout

| Path | Role |
|------|------|
| `IOS/` | Application sources (`Auth/`, `Config/`, `Networking/`, `Mail/`, …) |
| `IOSTests/` | XCTest sources |

For server-side behavior and API contracts, prefer [docs/README.md](../docs/README.md) and the code under `internal/httpserver/`.
