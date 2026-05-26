"""Rewrite repo-tree markdown links to GitHub when they leave the docs/ tree."""

from __future__ import annotations

import re
from pathlib import PurePosixPath
from typing import Any

REPO = "https://github.com/Thravok/elvish-email/blob/main"

DOC_TOP_LEVEL = frozenset(
    {
        "adr",
        "guides",
        "openapi",
        "runbooks",
        "README.md",
        "architecture.md",
        "backend-settings-api.md",
        "client-parity-roadmap.md",
        "deploy-coolify.md",
        "e2ee-mail-spec.md",
        "repo-layout.md",
    }
)

ROOT_GITHUB = frozenset(
    {
        "AGENTS.md",
        "CODE_OF_CONDUCT.md",
        "CONTRIBUTING.md",
        "LICENSE",
        "README.md",
        "SECURITY.md",
        ".gitlab-ci.yml",
        "go.mod",
        "renovate.json",
    }
)

REPO_TREE_PREFIXES = (
    ".cursor/",
    ".gitlab/",
    "cmd/",
    "content/",
    "docker/",
    "e2e/",
    "flutter/",
    "frontend/",
    "internal/",
    "IOS/",
    "Procfile",
    "scripts/",
    "static/",
)


def _to_github(href: str) -> str:
    clean = href.removeprefix("./").removeprefix("../")
    return f"{REPO}/{clean}"


def _should_rewrite(href: str) -> bool:
    if href.startswith(("http://", "https://", "#", "mailto:")):
        return False

    if href.startswith("../"):
        tail = href.removeprefix("../")
        top = PurePosixPath(tail).parts[0] if tail else ""
        return top not in DOC_TOP_LEVEL

    if href in ROOT_GITHUB or PurePosixPath(href).name in ROOT_GITHUB:
        return True

    return any(href.startswith(p) for p in REPO_TREE_PREFIXES)


def _rewrite_href(href: str, src_uri: str) -> str | None:
    name = PurePosixPath(href).name
    if name == "CONTRIBUTING.md":
        return "../guides/contributing.md" if src_uri.startswith("adr/") else "guides/contributing.md"
    if name == "README.md":
        return "../guides/product-readme.md" if src_uri.startswith("adr/") else "guides/product-readme.md"
    if not _should_rewrite(href):
        return None
    return _to_github(href)


def on_page_markdown(markdown: str, page: Any, config: Any, files: Any) -> str:
    if str(page.file.src_uri).startswith("guides/"):
        return markdown

    src_uri = str(page.file.src_uri)

    def sub(match: re.Match[str]) -> str:
        label, url = match.group(1), match.group(2)
        title = match.group(3) or ""
        new_url = _rewrite_href(url, src_uri)
        if new_url is None:
            return match.group(0)
        return f"[{label}]({new_url}{title})"

    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)(\s+\"[^\"]*\")?\)", sub, markdown)
