#!/usr/bin/env python3

from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from agent_manager import compile_manager_plan  # noqa: E402
from deterministic_contracts import validate_role_lock  # noqa: E402


class AgentManagerTests(unittest.TestCase):
    def test_compile_manager_plan_generates_valid_worker_locks(self) -> None:
        manager_plan = {
            "run_id": "20260306T000000Z",
            "created_utc": "2026-03-06T00:00:00Z",
            "manager": {
                "name": "manager-primary",
                "objective": "Produce auditable findings for Q1 and Q2.",
            },
            "workers": [
                {
                    "worker_id": "W01",
                    "role": "evidence-collector",
                    "question_ids": ["Q1"],
                    "allowed_domains": ["example.com"],
                    "blocked_domains": ["example.net"],
                    "output_files": ["workers/W01/journal.jsonl"],
                    "budget_tokens": 12000,
                    "escalation_threshold": 0.8,
                },
                {
                    "worker_id": "W02",
                    "role": "counterpoint-analyst",
                    "question_ids": ["Q2"],
                    "allowed_domains": ["example.org"],
                    "blocked_domains": ["example.net"],
                    "output_files": ["workers/W02/journal.jsonl"],
                    "budget_tokens": 8000,
                    "escalation_threshold": 0.7,
                },
            ],
        }

        locks, manifest = compile_manager_plan(manager_plan)

        self.assertEqual(len(locks), 2)
        self.assertEqual(manifest["workerCount"], 2)
        self.assertEqual([worker["workerId"] for worker in manifest["workers"]], ["W01", "W02"])
        for lock in locks:
            validate_role_lock(lock)


if __name__ == "__main__":
    unittest.main()
