#!/usr/bin/env python3
"""Reduce one or more worker journal JSONL files into canonical evidence JSON."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

from deterministic_contracts import (
    SCHEMA_VERSION,
    load_jsonl_events,
    validate_event_chain,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Deterministically merge worker journals into canonical evidence JSON."
    )
    parser.add_argument(
        "--journal-path",
        action="append",
        required=True,
        help="Path to worker journal JSONL (repeat for multiple journals)",
    )
    parser.add_argument("--output-path", required=True, help="Output canonical evidence JSON path")
    return parser.parse_args()


def _claim_summary(events: list[dict[str, Any]]) -> str:
    counts = Counter(event["claimText"] for event in events)
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return ranked[0][0]


def _canonical_evidence_item(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "eventHash": event["eventHash"],
        "eventId": event["eventId"],
        "eventType": event["eventType"],
        "workerId": event["workerId"],
        "sourceId": event["sourceId"],
        "evidence": event["evidence"],
        "counterpoint": event["counterpoint"],
        "implication": event["implication"],
        "actionability": event["actionability"],
        "confidence": float(event["confidence"]),
        "occurredAt": event["occurredAt"],
        "sequence": int(event["sequence"]),
    }


def _canonical_claim(claim_id: str, events: list[dict[str, Any]]) -> dict[str, Any]:
    sorted_events = sorted(
        events,
        key=lambda event: (
            event["sourceId"],
            event["workerId"],
            event["eventId"],
            event["eventHash"],
        ),
    )

    evidence_items = [_canonical_evidence_item(event) for event in sorted_events]
    confidence_values = [item["confidence"] for item in evidence_items]

    return {
        "claimId": claim_id,
        "claimText": _claim_summary(events),
        "workerIds": sorted({event["workerId"] for event in events}),
        "sourceIds": sorted({event["sourceId"] for event in events}),
        "evidenceCount": len(evidence_items),
        "confidence": {
            "average": round(sum(confidence_values) / len(confidence_values), 6),
            "min": min(confidence_values),
            "max": max(confidence_values),
        },
        "evidence": evidence_items,
    }


def reduce_journals(journal_paths: list[Path]) -> dict[str, Any]:
    validated_events: list[dict[str, Any]] = []
    for journal_path in sorted(journal_paths, key=lambda path: str(path)):
        events = load_jsonl_events(journal_path)
        validate_event_chain(events)
        validated_events.extend(events)

    deduped_events_by_hash: dict[str, dict[str, Any]] = {}
    for event in validated_events:
        deduped_events_by_hash.setdefault(event["eventHash"], event)

    deduped_events = sorted(
        deduped_events_by_hash.values(),
        key=lambda event: (
            event["claimId"],
            event["sourceId"],
            event["workerId"],
            event["eventId"],
            event["eventHash"],
        ),
    )

    claims: dict[str, list[dict[str, Any]]] = {}
    for event in deduped_events:
        claims.setdefault(event["claimId"], []).append(event)

    canonical_claims = [
        _canonical_claim(claim_id, claims[claim_id]) for claim_id in sorted(claims.keys())
    ]

    return {
        "schemaVersion": SCHEMA_VERSION,
        "journalCount": len(journal_paths),
        "eventCount": len(deduped_events),
        "claims": canonical_claims,
    }


def main() -> int:
    args = parse_args()
    journal_paths = [Path(path) for path in args.journal_path]
    output_path = Path(args.output_path)

    try:
        canonical = reduce_journals(journal_paths)
        write_json(output_path, canonical)
    except ValueError as exc:
        report = {
            "status": "fail",
            "reason": str(exc),
            "journalPaths": [str(path) for path in journal_paths],
            "outputPath": str(output_path),
        }
        print(json.dumps(report, sort_keys=True))
        return 1

    report = {
        "status": "pass",
        "outputPath": str(output_path),
        "journalCount": canonical["journalCount"],
        "eventCount": canonical["eventCount"],
        "claimCount": len(canonical["claims"]),
    }
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
