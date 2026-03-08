#!/usr/bin/env python3

from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPT_DIR = (
    Path(__file__).resolve().parents[1] / "scripts"
)
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from deterministic_contracts import compute_role_lock_hash, validate_role_lock  # noqa: E402


class RoleLockValidationTests(unittest.TestCase):
    def test_valid_role_lock_passes_with_deterministic_hash(self) -> None:
        lock_payload = {
            "schemaVersion": "1.0.0",
            "workerId": "worker-alpha",
            "role": "evidence-collector",
            "objective": "Validate evidence for reliability claim",
            "assignedQuestions": ["Q1", "Q2"],
            "constraints": ["No unsupported assumptions", "Use primary sources only"],
            "deliverables": ["journal.jsonl", "evidence.json"],
            "budgetTokens": 9000,
            "escalationThreshold": 0.75,
        }
        lock_payload["lockHash"] = compute_role_lock_hash(lock_payload)

        computed = validate_role_lock(lock_payload)

        self.assertEqual(computed, lock_payload["lockHash"])

    def test_role_lock_hash_mismatch_fails(self) -> None:
        lock_payload = {
            "schemaVersion": "1.0.0",
            "workerId": "worker-alpha",
            "role": "evidence-collector",
            "objective": "Validate evidence for reliability claim",
            "assignedQuestions": ["Q1"],
            "constraints": ["No unsupported assumptions"],
            "deliverables": ["journal.jsonl"],
            "budgetTokens": 9000,
            "escalationThreshold": 0.75,
            "lockHash": "0" * 64,
        }

        with self.assertRaisesRegex(ValueError, "lockHash mismatch"):
            validate_role_lock(lock_payload)


if __name__ == "__main__":
    unittest.main()
