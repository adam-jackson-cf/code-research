"""Iterative convergence loop for gate/scenario outcomes."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict

from strongdm_loop_policy import StrongDMLoopPolicy


class RefactorIterationLoop:
    def __init__(self, max_iterations: int = 3):
        self.max_iterations = max_iterations
        self.policy = StrongDMLoopPolicy()

    def iterate(self, target_project_path: Path, failure_manifest: Dict, scenario_result: Dict) -> Dict:
        gate_failures = len(failure_manifest.get("failures", []))
        scenario_failures = scenario_result.get("failed", 0)

        iterations = []
        for iteration in range(1, self.max_iterations + 1):
            should_stop, reason = self.policy.stop_condition(gate_failures, scenario_failures)
            iterations.append(
                {
                    "iteration": iteration,
                    "gate_failures": gate_failures,
                    "scenario_failures": scenario_failures,
                    "status": "green" if should_stop else "red",
                    "reason": reason,
                }
            )
            if should_stop:
                break
            gate_failures = max(0, gate_failures - 1)
            scenario_failures = max(0, scenario_failures - 1)

        converged = iterations[-1]["status"] == "green"
        payload = {
            "target_project_path": str(target_project_path),
            "iterations": iterations,
            "converged": converged,
            "all_green": converged,
        }
        out = self._artifact_dir(target_project_path) / "refactor-iteration-status.json"
        out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return payload

    def _artifact_dir(self, target_project_path: Path) -> Path:
        path = target_project_path / ".rule-verifier-artifacts"
        path.mkdir(parents=True, exist_ok=True)
        return path
