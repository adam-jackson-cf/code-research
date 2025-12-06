#!/usr/bin/env python3
"""Normalize analyzer JSON outputs by stripping volatile fields and sorting collections."""
from __future__ import annotations

import argparse
import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

VOLATILE_KEYS = {"timestamp", "execution_time"}


PROJECT_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_REPORTS_DIR = PROJECT_ROOT / "docs" / "analyzer-testing" / "reports"


def normalize_path(path_value: str) -> str:
    """Return path relative to project root when possible."""
    candidate = Path(path_value)
    resolved = candidate
    if not candidate.is_absolute():
        resolved = (PROJECT_ROOT / candidate).resolve(strict=False)
    else:
        try:
            resolved = candidate.resolve(strict=False)
        except FileNotFoundError:
            resolved = candidate
    try:
        return str(resolved.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(resolved)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize analyzer JSON output for diffing."
    )
    parser.add_argument("input", type=Path, help="Path to the raw analyzer JSON file")
    parser.add_argument(
        "output",
        type=Path,
        help="Destination filename or path for the normalized JSON file",
    )
    parser.add_argument(
        "--indent", type=int, default=2, help="Indent level for the output JSON"
    )
    parser.add_argument(
        "--reports-dir",
        type=Path,
        default=DEFAULT_REPORTS_DIR,
        help="Directory where normalized reports are stored (defaults to docs/analyzer-testing/reports).",
    )
    args = parser.parse_args()
    reports_dir = args.reports_dir
    if not reports_dir.is_absolute():
        reports_dir = (PROJECT_ROOT / reports_dir).resolve()
    args.reports_dir = reports_dir
    return args


def normalize(obj: Any) -> Any:
    if isinstance(obj, dict):
        normalized: dict[str, Any] = {}
        for key, value in obj.items():
            if key in VOLATILE_KEYS:
                continue
            if key == "findings" and isinstance(value, list):
                normalized[key] = sort_findings(value)
            elif key == "file_path" and isinstance(value, str):
                normalized[key] = normalize_path(value)
            else:
                normalized[key] = normalize(value)
        return normalized
    if isinstance(obj, list):
        normalized_items = [normalize(item) for item in obj]
        return sort_collection(normalized_items)
    return obj


def sort_findings(findings: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized_findings: list[dict[str, Any]] = []
    for item in findings:
        normalized_item = normalize(item)
        if isinstance(normalized_item, dict):
            cleaned = {k: v for k, v in normalized_item.items() if k != "id"}
            if "file_path" in cleaned and isinstance(cleaned["file_path"], str):
                cleaned["file_path"] = normalize_path(cleaned["file_path"])
            normalized_findings.append(cleaned)
        else:
            normalized_findings.append(normalized_item)
    return sorted(
        normalized_findings,
        key=lambda item: (
            item.get("file_path", ""),
            item.get("line_number", 0),
            json.dumps(item, sort_keys=True),
        ),
    )


def sort_collection(items: list[Any]) -> list[Any]:
    if not items:
        return items
    first = items[0]
    if isinstance(first, dict | list):
        return sorted(items, key=lambda entry: json.dumps(entry, sort_keys=True))
    try:
        return sorted(items)
    except TypeError:
        return items


def main() -> None:
    args = parse_args()
    input_path = args.input
    if not input_path.exists():
        candidate = (PROJECT_ROOT / input_path).resolve()
        if candidate.exists():
            input_path = candidate
        else:
            raise FileNotFoundError(f"Input file not found: {input_path}")
    else:
        input_path = input_path.resolve()

    output_path = args.output
    if not output_path.is_absolute():
        if output_path.parent == Path("."):
            output_path = (args.reports_dir / output_path.name).resolve()
        else:
            output_path = (PROJECT_ROOT / output_path).resolve()
    else:
        output_path = output_path.resolve()

    raw_data = json.loads(input_path.read_text())
    normalized = normalize(raw_data)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(normalized, sort_keys=True, indent=args.indent) + "\n"
    )


if __name__ == "__main__":
    main()
