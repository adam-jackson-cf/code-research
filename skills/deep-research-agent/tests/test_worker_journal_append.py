#!/usr/bin/env python3

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from deterministic_contracts import (  # noqa: E402
    append_jsonl_event,
    build_next_worker_event,
    load_jsonl_events,
    validate_event_chain,
)


class WorkerJournalAppendTests(unittest.TestCase):
    def _payload(self, event_id: str, confidence: float) -> dict[str, object]:
        return {
            "schemaVersion": "1.0.0",
            "eventId": event_id,
            "eventType": "evidence_recorded",
            "workerId": "worker-a",
            "claimId": "C1",
            "claimText": "Claim text",
            "sourceId": "S1",
            "evidence": "Observed evidence",
            "counterpoint": "Known caveat",
            "implication": "Operational implication",
            "actionability": "Recommended action",
            "confidence": confidence,
            "occurredAt": "2026-03-01T10:00:00Z",
        }

    def test_append_builds_contiguous_sequence_and_hash_chain(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            journal_path = Path(tmp_dir) / "journal.jsonl"
            prior_events: list[dict[str, object]] = []

            first = build_next_worker_event(self._payload("evt-1", 0.8), prior_events)  # type: ignore[arg-type]
            prior_events.append(first)
            append_jsonl_event(journal_path, first)

            second = build_next_worker_event(self._payload("evt-2", 0.6), prior_events)  # type: ignore[arg-type]
            prior_events.append(second)
            append_jsonl_event(journal_path, second)

            loaded = load_jsonl_events(journal_path)
            last_hash = validate_event_chain(loaded)

            self.assertEqual(loaded[0]["sequence"], 1)
            self.assertEqual(loaded[1]["sequence"], 2)
            self.assertEqual(loaded[1]["previousEventHash"], loaded[0]["eventHash"])
            self.assertEqual(last_hash, loaded[1]["eventHash"])


if __name__ == "__main__":
    unittest.main()
