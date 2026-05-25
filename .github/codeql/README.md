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
