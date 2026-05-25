# CodeQL setup (ELVish monorepo)

## How this repo is configured

| Piece | Location | Role |
|-------|----------|------|
| **Mode** | Advanced (workflow file) | Full control; must not enable **default setup** in GitHub settings |
| **Workflow** | [`.github/workflows/codeql-analysis.yml`](../workflows/codeql-analysis.yml) | Three analyses per run |
| **Server + web** | [codeql-config.yml](codeql-config.yml) | Go + JS/TS; ignores `flutter/`, `IOS/`, `e2e/` |
| **Flutter Android** | [codeql-config-flutter.yml](codeql-config-flutter.yml) | `java-kotlin` on `flutter/elvish_mail/android` only (no Dart extractor) |

GitHub may also show a **dynamic** workflow (`dynamic/github-code-scanning/codeql`) from the Code Scanning product. That is separate from this file. **Default setup API state** must stay `not-configured` or SARIF uploads from this workflow are rejected.

```bash
gh api /repos/Thravok/elvish-email/code-scanning/default-setup
# "state": "not-configured"
```

## Jobs (one workflow, three checks)

```text
checkout → [toolchain] → codeql-action/init → [manual build] → codeql-action/analyze
```

| Check name | Language | build-mode | Build step |
|------------|----------|------------|------------|
| `Analyze (go)` | `go` | `manual` | `setup-go` **before** `init`, then `CGO_ENABLED=0 go build -v ./...` |
| `Analyze (javascript-typescript)` | `javascript-typescript` | `none` | None (interpreted) |
| `Analyze (flutter-android)` | `java-kotlin` | `manual` | `flutter build apk --debug --target-platform android-arm64` |

Each job sets `category: /language:…` so GitHub accepts multiple SARIF uploads per commit ([docs](https://docs.github.com/en/code-security/code-scanning/reference/code-scanning/workflow-configuration-options#analysis-category)).

## Common failures

### “default setup is enabled” on upload

Disable default setup: **Settings → Code security → CodeQL analysis → Disable CodeQL**, or:

```bash
gh api -X PATCH /repos/Thravok/elvish-email/code-scanning/default-setup -f state=not-configured
```

### Go: “no source code seen during build”

`actions/setup-go` must run **before** `codeql-action/init`. Do not reorder those steps.

### Flutter: Gradle `Java heap space` / JetifyTransform

Keep `android.enableJetifier=false` in `flutter/elvish_mail/android/gradle.properties`. CI sets `GRADLE_OPTS` to 4 GB and builds a single ABI.

### PR shows red CodeQL but `main` is green

The PR branch must include the workflow fixes from `main` (rebase or merge `main`, then push). Re-running an old failed workflow on a stale branch will still fail.

```bash
gh pr update-branch 3 --repo Thravok/elvish-email   # merge main into PR branch
```

### Not analyzed

- **Dart** (`flutter/elvish_mail/lib/`) — unsupported by CodeQL
- **Swift** (`IOS/`) — not in workflow; needs a `macos-latest` job if desired
- **GitHub Actions** — optional; add `languages: actions` to the matrix if you want workflow scanning

## References

- [About CodeQL](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql)
- [Advanced setup](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/configuring-advanced-setup-for-code-scanning)
- [Compiled languages / build modes](https://docs.github.com/en/code-security/code-scanning/reference/code-scanning/codeql/codeql-build-options-and-steps-for-compiled-languages)
