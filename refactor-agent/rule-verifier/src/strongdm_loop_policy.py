"""StrongDM-inspired loop and phase-order policy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple


PHASE_ORDER = [
    "init_pi_foundation",
    "discover_gates",
    "bootstrap_verification",
    "map_failure_impact",
    "generate_scenario_regression",
    "iterate_refactor",
    "matrix_acceptance",
]


@dataclass(frozen=True)
class PolicyCheck:
    passed: bool
    details: List[str]


class StrongDMLoopPolicy:
    def validate_sequence(self, phases: List[str]) -> PolicyCheck:
        expected = {phase: idx for idx, phase in enumerate(PHASE_ORDER)}
        details: List[str] = []
        last = -1
        passed = True
        for phase in phases:
            idx = expected.get(phase)
            if idx is None:
                passed = False
                details.append(f"unknown_phase:{phase}")
                continue
            if idx < last:
                passed = False
                details.append(f"out_of_order:{phase}")
            last = idx
        if not details:
            details.append("phase_sequence_valid")
        return PolicyCheck(passed=passed, details=details)

    def stop_condition(self, gate_failures: int, scenario_failures: int) -> Tuple[bool, str]:
        if gate_failures == 0 and scenario_failures == 0:
            return True, "all_green"
        return False, "failures_remaining"
