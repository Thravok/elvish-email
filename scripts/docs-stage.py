#!/usr/bin/env python3
"""Copy root README/CONTRIBUTING into docs/guides/ with MkDocs-friendly links."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GUIDES = ROOT / "docs" / "guides"
REPO = "https://github.com/Thravok/elvish-email/blob/main"

ROOT_GITHUB = frozenset(
    {
        "AGENTS.md",
        "CODEBASES.md",
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
    "apps/",
    "docker/",
    "e2e/",
    "flutter/",
    "libs/",
    "packages/",
    "services/",
    "tools/",
    "IOS/",
    "Procfile",
    "scripts/",
)


def _github_blob(path: str) -> str:
    clean = path.removeprefix("./").removeprefix("../")
    return f"{REPO}/{clean}"


def rewrite_href(href: str) -> str:
    if href.startswith(("http://", "https://", "#", "mailto:")):
        return href

    if href.startswith("docs/") or href.startswith("../docs/"):
        prefix = "../docs/" if href.startswith("../docs/") else "docs/"
        tail = href.removeprefix(prefix)
        if not tail:
            return "../README.md"
        return "../" + tail

    if href == "CONTRIBUTING.md":
        return "contributing.md"

    if href == "README.md":
        return "product-readme.md"

    base = Path(href).name
    if base in ROOT_GITHUB:
        return _github_blob(href.removeprefix("../"))

    for prefix in REPO_TREE_PREFIXES:
        if href.startswith(prefix) or href.startswith(f"../{prefix}"):
            return _github_blob(href)

    return href


def rewrite_markdown(text: str) -> str:
    def sub(match: re.Match[str]) -> str:
        label, url = match.group(1), match.group(2)
        title = match.group(3) or ""
        return f"[{label}]({rewrite_href(url)}{title})"

    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)(\s+\"[^\"]*\")?\)", sub, text)


def stage_file(src_name: str, dst_name: str) -> None:
    src = ROOT / src_name
    dst = GUIDES / dst_name
    if not src.is_file():
        print(f"docs-stage: missing {src}", file=sys.stderr)
        sys.exit(1)
    dst.write_text(rewrite_markdown(src.read_text(encoding="utf-8")), encoding="utf-8")


def main() -> None:
    GUIDES.mkdir(parents=True, exist_ok=True)
    stage_file("README.md", "product-readme.md")
    stage_file("CONTRIBUTING.md", "contributing.md")


if __name__ == "__main__":
    main()
