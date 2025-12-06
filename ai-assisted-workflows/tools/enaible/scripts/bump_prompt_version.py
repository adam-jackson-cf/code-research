#!/usr/bin/env python3
"""Bump prompt versions in catalog.py for modified source files."""
from __future__ import annotations

import re
import sys
from pathlib import Path

CATALOG_PATH = Path("tools/enaible/src/enaible/prompts/catalog.py")
PROMPT_DIR = Path("shared/prompts")


def bump_version(title: str) -> str:
    """Increment minor version: 'foo v1.0' -> 'foo v1.1'."""
    match = re.match(r"(.+)\s+v(\d+)\.(\d+)$", title)
    if not match:
        return title
    name, major, minor = match.groups()
    return f"{name} v{major}.{int(minor) + 1}"


def main(changed_files: list[str]) -> int:
    """Bump versions for changed prompt files."""
    # Filter to prompt source files
    prompts = [
        Path(f).stem
        for f in changed_files
        if f.startswith("shared/prompts/") and f.endswith(".md")
    ]

    if not prompts:
        return 0  # No prompts changed

    content = CATALOG_PATH.read_text()
    modified = False

    for prompt_id in prompts:
        # Match: title="prompt-id vX.Y"
        pattern = rf'(title=")({re.escape(prompt_id)}\s+v\d+\.\d+)(")'
        match = re.search(pattern, content)
        if match:
            old_title = match.group(2)
            new_title = bump_version(old_title)
            if old_title != new_title:
                content = content.replace(
                    f'title="{old_title}"', f'title="{new_title}"'
                )
                print(f"Bumped: {old_title} -> {new_title}")
                modified = True

    if modified:
        CATALOG_PATH.write_text(content)

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
