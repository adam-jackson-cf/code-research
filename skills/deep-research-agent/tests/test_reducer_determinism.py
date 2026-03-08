#!/usr/bin/env python3

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from deterministic_contracts import append_jsonl_event, build_next_worker_event  # noqa: E402
from reduce_worker_journals import reduce_journals  # noqa: E402


class ReducerDeterminismTests(unittest.TestCase):
    def _build_event_payload(
        self,
        *,
        event_id: str,
        worker_id: str,
        claim_id: str,
        claim_text: str,
        source_id: str,
        evidence: str,
        counterpoint: str,
        implication: str,
        actionability: str,
        confidence: float,
        occurred_at: str,
    ) -> dict[str, object]:
        return {
            "schemaVersion": "1.0.0",
            "eventId": event_id,
            "eventType": "evidence_recorded",
            "workerId": worker_id,
            "claimId": claim_id,
            "claimText": claim_text,
            "sourceId": source_id,
            "evidence": evidence,
            "counterpoint": counterpoint,
            "implication": implication,
            "actionability": actionability,
            "confidence": confidence,
            "occurredAt": occurred_at,
        }

    def _write_journal(self, path: Path, payloads: list[dict[str, object]]) -> None:
        events: list[dict[str, object]] = []
        for payload in payloads:
            event = build_next_worker_event(payload, events)  # type: ignore[arg-type]
            events.append(event)
            append_jsonl_event(path, event)

    def test_reducer_output_is_identical_for_permuted_journal_order(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            journal_a = tmp_path / "worker-a.jsonl"
            journal_b = tmp_path / "worker-b.jsonl"

            self._write_journal(
                journal_a,
                [
                    self._build_event_payload(
                        event_id="evt-a-1",
                        worker_id="worker-a",
                        claim_id="C1",
                        claim_text="The pilot reduced triage time.",
                        source_id="S-101",
                        evidence="Cycle time dropped 24% over 8 weeks.",
                        counterpoint="However, the baseline period was short.",
                        implication="This means throughput can increase.",
                        actionability="Track trend for another quarter.",
                        confidence=0.82,
                        occurred_at="2026-03-01T10:00:00Z",
                    ),
                    self._build_event_payload(
                        event_id="evt-a-2",
                        worker_id="worker-a",
                        claim_id="C2",
                        claim_text="Automation reduced defect escape.",
                        source_id="S-102",
                        evidence="Escaped defects declined from 17 to 9.",
                        counterpoint="Risk remains in edge-case flows.",
                        implication="Fewer incidents lower support burden.",
                        actionability="Prioritize edge-case test coverage.",
                        confidence=0.77,
                        occurred_at="2026-03-01T12:00:00Z",
                    ),
                ],
            )

            self._write_journal(
                journal_b,
                [
                    self._build_event_payload(
                        event_id="evt-b-1",
                        worker_id="worker-b",
                        claim_id="C1",
                        claim_text="The pilot reduced triage time.",
                        source_id="S-201",
                        evidence="Backlog aging improved by 19%.",
                        counterpoint="But the dataset excludes holidays.",
                        implication="Response SLAs become more predictable.",
                        actionability="Recalculate after holiday-inclusive window.",
                        confidence=0.71,
                        occurred_at="2026-03-01T11:00:00Z",
                    )
                ],
            )

            canonical_a_then_b = reduce_journals([journal_a, journal_b])
            canonical_b_then_a = reduce_journals([journal_b, journal_a])

            self.assertEqual(canonical_a_then_b, canonical_b_then_a)

            claim_ids = [claim["claimId"] for claim in canonical_a_then_b["claims"]]
            self.assertEqual(claim_ids, ["C1", "C2"])


if __name__ == "__main__":
    unittest.main()
