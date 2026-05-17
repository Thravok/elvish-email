# ADR 0002: Mail transport only inside the Go binary

## Status

Superseded by [ADR 0006](0006-own-smtp-stack.md). The "single binary, no sidecars" principle is preserved; only the underlying library choice (`emersion/go-smtp`, `net/smtp`) was replaced by an in-tree implementation.

## Context

Traditional mail stacks often use Postfix/Exim in separate containers. The product goal is a **single shipped binary** (`elvishserver`) that owns HTTP, SMTP receive, SMTP send, and queue workers—no co-located MTA sidecars.

## Decision

- Inbound SMTP is implemented with **`github.com/emersion/go-smtp`** as a library server in the same process as `elvishserver`.
- Outbound delivery uses the standard library **`net/smtp`** client (TLS where required) from goroutine workers reading the `mail_outbox` table.
- DKIM signing is **deferred** beyond optional future work; operators may front TLS and signing at an edge proxy, or we add in-process signing later.

## Consequences

- Positive: simpler Docker Compose (Cockroach/Postgres + Valkey for data planes); mail ports optional on the same image.
- Negative: the team owns full SMTP edge-case behavior (backscatter, retries, spam) instead of delegating to Postfix.
