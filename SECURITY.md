# Security

## Reporting a vulnerability

Please **do not** open a **public** issue or discussion for undisclosed security problems.

**GitLab (this project today)**

1. Prefer **Project → Issues → New issue** and enable **This issue is confidential** (or your organization’s equivalent restricted visibility), **or**
2. Use any **private channel** your group publishes for security (contact link on the group/project page, security email in the README once public, etc.).

**Other hosts**

If the canonical tree is ever published or mirrored on another forge, use that platform’s **private** vulnerability reporting path instead of a public issue (and update this file if maintainers publish a single canonical URL).

Include enough detail to reproduce or reason about the issue (affected component, version or commit, impact, and suggested fix if you have one). We aim to acknowledge reasonable reports promptly; timelines depend on severity and maintainer availability.

## Scope

In scope: **`elvishapi`**, **`elvishmta`**, **`elvishworker`**, and related tooling in this repository, default configurations documented in [README.md](README.md), and documented trust boundaries for mail and auth ([docs/e2ee-mail-spec.md](docs/e2ee-mail-spec.md), ADRs under [docs/adr/](docs/adr/)).

Out of scope: third-party infrastructure misconfiguration, social engineering, or issues in dependencies unless they affect this codebase in a novel way (those may still be worth reporting upstream).

## Supported versions

Only the latest commit on the default branch is actively triaged for public reports unless maintainers publish a release policy elsewhere. Deployments should track fixes by updating from the default branch or tagged releases when those exist.
