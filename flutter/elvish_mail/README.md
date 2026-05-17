# ELVish Mail (Flutter / Android)

Flutter client for **ELVish** mail in this repository: same `/api/...` JSON surface and session cookie as the Swift app under [`IOS/`](../../IOS/README.md).

## Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (stable), Android Studio or SDK for builds.
- A running `elvishserver` (see repository root [README.md](../../README.md); local dev often uses port **8765**).

## API base URL

The default base URL is **`http://10.0.2.2:8765`** (Android emulator → host loopback). Override at run or build time:

```bash
cd flutter/elvish_mail
flutter run --dart-define=ELVISH_API_BASE=http://10.0.2.2:8765
# Physical device on same LAN:
flutter run --dart-define=ELVISH_API_BASE=http://192.168.1.10:8765
```

For **release** builds, prefer HTTPS; cleartext HTTP is enabled in the Android manifest for local development only.

## UI (Material Design 3)

The app targets **Material Design 3** as described for Flutter on [m3.material.io/develop/flutter](https://m3.material.io/develop/flutter): `ThemeData(useMaterial3: true)`, tonal `ColorScheme.fromSeed`, [`NavigationDrawer`](https://api.flutter.dev/flutter/material/NavigationDrawer-class.html), [`Card.filled`](https://api.flutter.dev/flutter/material/Card/Card.filled.html), [`FilledButton`](https://api.flutter.dev/flutter/material/FilledButton-class.html), [`SegmentedButton`](https://api.flutter.dev/flutter/material/SegmentedButton-class.html), and M3-style motion (`InkSparkle`). Central theme: [`lib/theme/material3_theme.dart`](lib/theme/material3_theme.dart).

## Commands

```bash
flutter pub get
flutter analyze
flutter test
flutter run
```

If the `android/` Gradle layout is out of date for your Flutter SDK, regenerate native scaffolding in-place (keeps `lib/`):

```bash
flutter create . --platforms=android --project-name elvish_mail --org org.elvish
```

## Scope notes

- Login uses **SRP-6a** + optional **TOTP / recovery** MFA (same as iOS). **WebAuthn-only** accounts are not supported in-app (use the web client), matching iOS behavior.
- Mail decryption uses **dart_pg** (OpenPGP). Test against your dev server early.

## Crypto tests

SRP vectors mirror [`IOS/IOSTests/ElvishSRPClientTests.swift`](../../IOS/IOSTests/ElvishSRPClientTests.swift). Regenerate server-side reference material with:

```bash
go run ./cmd/srpvector
```

(from the repository root).
