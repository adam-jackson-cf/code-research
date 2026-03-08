#!/usr/bin/env python3
"""Validate deep-research-agent role lock payload and deterministic hash."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from deterministic_contracts import load_json, validate_role_lock, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate required role-lock fields and deterministic lock hash."
    )
    parser.add_argument("--role-lock-path", required=True, help="Path to role lock JSON file")
    parser.add_argument(
        "--output-path",
        help="Optional path to write validation report JSON",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    role_lock_path = Path(args.role_lock_path)

    try:
        payload = load_json(role_lock_path)
        computed_hash = validate_role_lock(payload)
    except ValueError as exc:
        report = {
            "status": "fail",
            "reason": str(exc),
            "roleLockPath": str(role_lock_path),
        }
        if args.output_path:
            write_json(Path(args.output_path), report)
        print(json.dumps(report, sort_keys=True))
        return 1

    report = {
        "status": "pass",
        "roleLockPath": str(role_lock_path),
        "workerId": payload["workerId"],
        "role": payload["role"],
        "computedLockHash": computed_hash,
    }
    if args.output_path:
        write_json(Path(args.output_path), report)
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
