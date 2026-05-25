# CodeQL (advanced setup)

This repository uses **advanced** CodeQL via [.github/workflows/codeql-analysis.yml](../workflows/codeql-analysis.yml), not GitHub’s **default setup**.

## Why

- **Go** — manual build (`CGO_ENABLED=0 go build ./...`) so the extractor sees compiled packages.
- **JavaScript/TypeScript** — mail UI under `static/` and `frontend/`; server paths scoped in [codeql-config.yml](codeql-config.yml).
- **Flutter Android** — separate job builds `flutter/elvish_mail` and scans Kotlin/Java under `android/` (no Dart extractor); see [codeql-config-flutter.yml](codeql-config-flutter.yml).

## Conflict with default setup

If **CodeQL default setup** is enabled in repository settings, `github/codeql-action/analyze` fails on upload with:

```text
CodeQL analyses from advanced configurations cannot be processed when the default setup is enabled
```

Use **one** mode only. For this repo, keep advanced setup and turn off default setup.

### Go job (`Analyze (go)`)

Run `actions/setup-go` **before** `codeql-action/init`. If Go is installed after init, manual `go build` is not traced and finalize fails with “no source code seen during build”.

### Flutter Android job (`Analyze (flutter-android)`)

Keep `android.enableJetifier=false` in `flutter/elvish_mail/android/gradle.properties` (Jetifier OOMs on Flutter engine JARs in CI). The workflow sets `GRADLE_OPTS` to 4 GB heap and builds a single ABI (`android-arm64`) to reduce Gradle memory use.

### Fix (repository settings)

1. **Settings** → **Advanced Security** → **Code scanning** → **CodeQL analysis**.
2. If you see **Switch to advanced**, default setup is on — choose **Disable CodeQL** (or switch to advanced and ensure default is not active).
3. Re-run the failed **CodeQL** workflow.

### Fix (CLI)

```bash
gh api -X PATCH /repos/OWNER/REPO/code-scanning/default-setup -f state=not-configured
gh api /repos/OWNER/REPO/code-scanning/default-setup   # state should be "not-configured"
```

Do **not** re-enable default setup at org scale on this repo unless you remove or disable `codeql-analysis.yml` first.
