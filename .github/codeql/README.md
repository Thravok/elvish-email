# CodeQL setup (ELVish 1.0.0-pre tree)

## Configuration

| Piece | Location | Role |
|-------|----------|------|
| **Mode** | Advanced (workflow file) | Do not enable **default setup** in GitHub settings |
| **Workflow** | [`.github/workflows/codeql-analysis.yml`](../workflows/codeql-analysis.yml) | Go + JS/TS + Flutter Android |
| **Server config** | [codeql-config.yml](codeql-config.yml) | Ignores `flutter/`, `IOS/`, `e2e/`, built `static/dist/` |
| **Go validators** | [elvish-go-models/](elvish-go-models/) | MaD barriers for `internal/uptime` and `internal/httpserver` |

Default setup API state must stay `not-configured`:

```bash
gh api /repos/Thravok/elvish-email/code-scanning/default-setup
# expect "state": "not-configured"
```

## Local analysis

Requires CodeQL CLI on `PATH` (`brew install codeql`):

```bash
make codeql-go          # Go (matches CI + elvish/go-models)
make codeql-js          # JavaScript/TypeScript
make codeql-all         # Both
make codeql-summary-go  # Text summary after codeql-go
make codeql-clean       # Remove .codeql/
```

## Common failures

### “default setup is enabled” on SARIF upload

Disable in **Settings → Code security → CodeQL analysis**, or:

```bash
gh api -X PATCH /repos/Thravok/elvish-email/code-scanning/default-setup -f state=not-configured
```

### Go: “no source code seen during build”

`actions/setup-go` must run **before** `codeql-action/init`.

### `Package 'local' cannot be used with a package registry`

Do not use `packs: - local:./…` in `codeql-config.yml`. Load `elvish/go-models` via `CODEQL_ACTION_EXTRA_OPTIONS` at analyze time.

### Flutter Gradle heap / JetifyTransform

Keep `android.enableJetifier=false` in `flutter/elvish_mail/android/gradle.properties`.
