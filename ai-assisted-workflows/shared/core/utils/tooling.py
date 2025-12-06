#!/usr/bin/env python3
"""Lightweight helpers for external CLI tool detection and invocation."""

from __future__ import annotations

import shutil
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass
class ToolCheck:
    name: str
    available: bool
    path: str | None
    version: str | None = None


def find_cli(candidates: Sequence[str]) -> ToolCheck:
    """Return first available CLI from candidates (e.g., ["semgrep", "npx semgrep"])."""
    for cand in candidates:
        # Support space-separated forms like "npx jscpd"
        if " " in cand:
            exe = cand.split()[0]
            if shutil.which(exe):
                return ToolCheck(name=cand, available=True, path=cand)
        else:
            path = shutil.which(cand)
            if path:
                return ToolCheck(name=cand, available=True, path=path)
    return ToolCheck(
        name=candidates[0] if candidates else "", available=False, path=None
    )


def run_cli(cmd: Sequence[str], timeout: int = 300) -> tuple[int, str, str]:
    """Run a CLI command and return (rc, stdout, stderr)."""
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout or "", p.stderr or ""
    except subprocess.TimeoutExpired as e:
        return 124, "", str(e)
