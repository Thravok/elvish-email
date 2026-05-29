# Blog / log (`content/blog/`)

## New post (minimal)

1. Add a Markdown file named **`YYYY-MM-DD-your-slug.md`** (the part after the date becomes the URL slug: `/log/your-slug/`).

2. Use a short front matter block — only **title** and **date** are required:

```yaml
---
title: "What we shipped today"
date: "2026-05-01"
tags: [release]
---
```

Optional in the post itself:

- **`tags`**: list of strings (default: none).
- **`slug`**: only if the filename cannot be `YYYY-MM-DD-<slug>.md`.
- **`type`**, **`time`**, **`bytes`**, **`reach`**, **`display_date`**: omit them and use **`metrics.json`** or **`-metrics-url`** (see below) so stats stay in one place.

Body is normal Markdown below the second `---`.

## Metrics (bytes, reach, time, type)

Edit **`metrics.json`** in this folder (`posts.<slug>.…`). Values are merged **only when the post leaves that field out**. Anything you set in the post’s front matter always wins.

For automation with a static metrics file only, merge is applied when loading from disk. A future server flag may merge remote JSON the same way the old generator did. Example (historical):

```json
{
  "posts": {
    "v074-quieter-logs": { "bytes": "412KB", "reach": "2.1k", "time": "03:14" }
  }
}
```

or a flat map of slug → object. Partial fields per slug are merged on top of `metrics.json`.

```bash
# (Remote metrics URL was supported by the retired static generator; elvishserver uses metrics.json on disk for defaults.)
```

## Cryptographic signatures

### OpenPGP (live / SQL posts)

When posts are stored in the database, the server verifies optional **detached OpenPGP** signatures over the same UTF-8 bytes as `source.md`. Upload armored public keys via `POST /api/pgp/keys` (authenticated). See `/pgp/keys.json` on a running site.

### minisign (file-based posts under `content/blog/`)

Posts are signed over the **exact bytes** of the Markdown file (including front matter). The live server publishes those bytes as `/log/<slug>/source.md` next to `source.md.minisig` when the post is still loaded from disk.

1. **Generate a key pair** (once), under this directory:

   ```bash
   go run ./cmd/elvishsign keygen -out content/blog -password 'use-a-strong-password'
   ```

   This writes **`signing.pub`** (commit this) and **`signing.key`** (gitignored; back it up offline).

2. **Sign posts** after editing (or in CI before deploy):

   ```bash
   export MINISIGN_PASSWORD='…'
   go run ./cmd/elvishsign sign -key content/blog/signing.key content/blog/2026-*.md
   ```

   Each `file.md` gets a detached **`file.md.minisig`**. Commit the `.minisig` files with the Markdown.

3. **Verify locally** before pushing:

   ```bash
   go run ./cmd/elvishsign verify -pub content/blog/signing.pub content/blog/2026-*.md
   ```

4. **Serving file-based posts:** run `elvishserver`; minisign sidecars are still honored when posts load from disk.

5. **Optional `home.json`**: set `blog_signing.public_key_url` if the public key is not served at `/signing.pub` (the default when `content/blog/signing.pub` exists).

Official [minisign](https://jedisct1.github.io/minisign/) can exchange signatures with `elvishsign` (same on-disk format).

## Examples

- **Most posts**: filename + `title` + `date` + tags + body; keep numbers in `metrics.json`.
- **Override once**: set `reach: "12k"` in the post’s front matter for that entry only.
