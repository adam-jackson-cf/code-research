#!/usr/bin/env python3

from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from prose_rubric_score import evaluate_gate  # noqa: E402


class ProseRubricTests(unittest.TestCase):
    def test_rubric_passes_high_quality_prose(self) -> None:
        prose = """
The workflow cut onboarding time by 32% in six weeks, according to the operations benchmark [1].
However, the sample was limited to one region, so we should mitigate that risk with a second cohort.
This means the support team can absorb higher ticket volume without increasing cost.
We recommend a controlled rollout in Q2 and assign engineering and operations owners.
1. Implement the automation checklist by week 2.
2. Track defect leakage weekly against the baseline.
Source: https://example.com/benchmark
""".strip()

        report = evaluate_gate(prose, min_dimension=3.0, min_overall=3.5)

        self.assertEqual(report["status"], "pass")
        self.assertGreaterEqual(report["overallScore"], 3.5)

    def test_rubric_fails_low_quality_prose(self) -> None:
        prose = """
Maybe this could help. Things might get better somehow.
""".strip()

        report = evaluate_gate(prose, min_dimension=3.0, min_overall=3.5)

        self.assertEqual(report["status"], "fail")
        self.assertIn("evidence", report["failingDimensions"])


if __name__ == "__main__":
    unittest.main()
