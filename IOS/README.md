# ELVish iOS app

SwiftUI client in this directory that talks to the same **`/api/...`** surface as the web app. The Xcode project is **`IOS.xcodeproj`** in this folder (no workspace wrapper).

## Open in Xcode

1. Double-click `IOS.xcodeproj` or run `open IOS/IOS.xcodeproj` from the repository root.
2. Select the **IOS** scheme for running the app on a simulator or device.
3. Ensure **`elvishserver`** is running and reachable if you exercise authenticated flows (see root [README.md](../README.md) — default local URL is `http://127.0.0.1:8765` for `make dev` / `make dev-once`).

## API base URL

[`IOS/Config/AppEnvironment.swift`](IOS/Config/AppEnvironment.swift) resolves the API root in this order:

1. **`ElvishAPIBaseURL`** in the app bundle **Info.plist** (string, no trailing slash). Use this to point at your dev server, for example `http://127.0.0.1:8765`.
2. If unset, the default in code may not match `make dev`’s port (`8765`); set **ElvishAPIBaseURL** or change the fallback in `AppEnvironment.swift` for local work.

All requests should target the host that serves `/api/...` over HTTP or HTTPS.

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
