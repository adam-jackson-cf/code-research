#!/usr/bin/env python3
"""
Summarize security analyzer outputs into a prioritized Markdown plan.

Inputs: security analyzer JSONs inside an artifacts directory
Output: Markdown between markers on stdout:
=== BEGIN_SECURITY_MD ===
... content ...
=== END_SECURITY_MD ===
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


def _load_findings(root: Path) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for name in ("security_semgrep.json", "security_secrets.json"):
        fp = root / name
        if not fp.exists():
            continue
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        for f in data.get("findings", []) or []:
            findings.append(f)
    return findings


def _group(findings: list[dict[str, Any]]):
    groups: dict[str, dict[str, Any]] = {}
    for f in findings:
        title = str(f.get("title") or "Security finding")
        file_path = str(f.get("file_path") or "")
        line = int(f.get("line_number") or 1)
        meta = f.get("evidence") or {}
        check = meta.get("check_id") or meta.get("rule_id") or title
        key = f"{check}::{title}"
        g = groups.setdefault(
            key,
            {
                "title": title,
                "check": str(check),
                "severity": str(f.get("severity") or "medium").lower(),
                "locations": set(),
                "example": (file_path, line),
            },
        )
        g["locations"].add((file_path, line))
        # keep the most severe
        if SEV_ORDER.get(str(f.get("severity") or "medium").lower(), 2) < SEV_ORDER.get(
            g["severity"], 2
        ):
            g["severity"] = str(f.get("severity") or "medium").lower()
    return list(groups.values())


def _rank(groups: list[dict[str, Any]]):
    return sorted(
        groups, key=lambda g: (SEV_ORDER.get(g["severity"], 9), -len(g["locations"]))
    )


def _md(groups: list[dict[str, Any]], total: int) -> str:
    dedup = len(groups)
    lines: list[str] = []
    lines.append("=== BEGIN_SECURITY_MD ===")
    lines.append("# Security Findings – Prioritized Plan")
    lines.append("")
    lines.append(f"Total raw findings: {total} → Consolidated entries: {dedup}")
    lines.append("")
    # Summary table
    lines.append("| Rank | Rule/CWE | Title | Affected | Risk | Example |")
    lines.append("| ---: | :-- | :-- | --: | :-- | :-- |")
    for i, g in enumerate(_rank(groups), start=1):
        example = f"{g['example'][0]}:{g['example'][1]}" if g["example"][0] else "n/a"
        lines.append(
            f"| {i} | {g['check']} | {g['title']} | {len(g['locations'])} | {g['severity']} | {example} |"
        )
    lines.append("")
    # Top 5 actions
    lines.append("## Top 5 Immediate Actions")
    for i, g in enumerate(_rank(groups)[:5], start=1):
        lines.append(
            f"- [{i}] Address {g['severity']} risk: {g['title']} ({g['check']}) – start at {g['example'][0]}:{g['example'][1]}"
        )
    lines.append("")
    # Details
    lines.append("## Deduplicated Findings (Full Details)")
    for g in _rank(groups):
        lines.append(f"### {g['title']} – {g['check']} ({g['severity']})")
        locs = sorted({f"{p}:{n}" for p, n in g["locations"] if p})
        lines.append(f"Affected locations: {', '.join(locs) if locs else 'n/a'}")
        lines.append("")
    lines.append("=== END_SECURITY_MD ===")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Render security findings markdown plan"
    )
    parser.add_argument(
        "artifacts",
        nargs="?",
        default="artifacts",
        help="Directory with analyzer JSONs",
    )
    args = parser.parse_args()

    root = Path(args.artifacts)
    findings = _load_findings(root)
    if not findings:
        print(
            "=== BEGIN_SECURITY_MD ===\nNo parsable SAST/security findings detected.\n=== END_SECURITY_MD ==="
        )
        return 0

    groups = _group(findings)
    print(_md(groups, len(findings)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
