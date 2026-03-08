#!/usr/bin/env python3
"""Append one validated event to a worker journal JSONL file."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from deterministic_contracts import (
    append_jsonl_event,
    build_next_worker_event,
    load_json,
    load_jsonl_events,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Append a deterministic event to a worker journal (append-only JSONL)."
    )
    parser.add_argument("--journal-path", required=True, help="Path to worker journal JSONL")
    parser.add_argument(
        "--event-path", required=True, help="Path to input event payload JSON"
    )
    parser.add_argument(
        "--output-path",
        help="Optional path to write append result JSON report",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    journal_path = Path(args.journal_path)
    event_path = Path(args.event_path)

    try:
        prior_events = load_jsonl_events(journal_path)
        payload = load_json(event_path)
        event = build_next_worker_event(payload, prior_events)
        append_jsonl_event(journal_path, event)
    except ValueError as exc:
        report = {
            "status": "fail",
            "reason": str(exc),
            "journalPath": str(journal_path),
            "eventPath": str(event_path),
        }
        if args.output_path:
            write_json(Path(args.output_path), report)
        print(json.dumps(report, sort_keys=True))
        return 1

    report = {
        "status": "pass",
        "journalPath": str(journal_path),
        "eventHash": event["eventHash"],
        "sequence": event["sequence"],
        "claimId": event["claimId"],
        "workerId": event["workerId"],
    }
    if args.output_path:
        write_json(Path(args.output_path), report)
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
