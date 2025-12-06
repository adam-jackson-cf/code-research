#!/usr/bin/env python3
"""
Convert analyzer JSON outputs into CodeClimate-compatible JSON array.

Input: directory containing analyzer result JSON files (e.g., artifacts/)
Output: CodeClimate array on stdout ([] if no findings)

Minimal fields per item (compatible with GitLab and generic consumers):
- description (str)
- check_name (str)
- fingerprint (str)
- severity (info|minor|major|critical|blocker)
- location: { path: <repo-relative>, lines: { begin: <int> } }
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

SEVERITY_MAP = {
    "critical": "blocker",
    "high": "critical",
    "medium": "major",
    "low": "minor",
    "info": "info",
}


def _repo_relative(path: str) -> str | None:
    if not path:
        return None
    p = Path(path)
    try:
        return str(p.resolve().relative_to(Path.cwd().resolve()))
    except Exception:
        return str(p)


def _load_json_files(root: Path) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for fp in sorted(root.glob("*.json")):
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        results.append(data)
    return results


def _source_name(source: dict[str, Any], fallback: str) -> str:
    meta = source.get("metadata") or {}
    return str(meta.get("name") or meta.get("analyzer_type") or fallback)


def _cc_item(check_name: str, finding: dict[str, Any]) -> dict[str, Any] | None:
    title = str(finding.get("title") or finding.get("description") or "Finding").strip()
    desc = str(finding.get("description") or title).strip()
    file_path = finding.get("file_path")
    line = finding.get("line_number") or 1
    sev = str(finding.get("severity") or "info").lower()

    rel = _repo_relative(str(file_path)) if file_path else None
    if not rel:
        return None

    sev_cc = SEVERITY_MAP.get(sev, "info")
    # Stable fingerprint across runs
    h = hashlib.sha256()
    h.update((rel + "|" + str(line) + "|" + check_name + "|" + title).encode("utf-8"))
    fp = h.hexdigest()

    return {
        "description": f"{title}: {desc}" if desc and desc != title else title,
        "check_name": check_name,
        "fingerprint": fp,
        "severity": sev_cc,
        "location": {"path": rel, "lines": {"begin": int(line)}},
    }


def convert(root: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen_fp: set[str] = set()
    for payload in _load_json_files(root):
        fallback = payload.get("script_name") or "analyzer"
        check_name = _source_name(payload, fallback)
        for f in payload.get("findings", []) or []:
            item = _cc_item(check_name, f)
            if not item:
                continue
            fp = item["fingerprint"]
            if fp in seen_fp:
                continue
            seen_fp.add(fp)
            out.append(item)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert analyzer JSON to CodeClimate JSON"
    )
    parser.add_argument(
        "artifacts",
        nargs="?",
        default="artifacts",
        help="Directory with analyzer JSONs",
    )
    args = parser.parse_args()

    root = Path(args.artifacts)
    if not root.exists():
        print("[]")
        return 0

    items = convert(root)
    print(json.dumps(items, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
