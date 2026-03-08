"""Discover verification gates and local/CI parity drift."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List


class GateDiscovery:
    def discover(self, target_project_path: Path) -> Dict:
        local = self._detect_local(target_project_path)
        ci = self._detect_ci(target_project_path)
        parity_drift = sorted(set(local) ^ set(ci))
        return {
            "target_project_path": str(target_project_path),
            "local_gates": local,
            "ci_gates": ci,
            "parity_drift": parity_drift,
        }

    def write_report(self, target_project_path: Path, report: Dict) -> Path:
        output = self._artifact_dir(target_project_path) / "gate-parity-report.json"
        output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
        return output

    def _detect_local(self, root: Path) -> List[str]:
        gates: List[str] = []
        if (root / ".pre-commit-config.yaml").exists():
            gates.append("precommit")
        if (root / "pyproject.toml").exists() or (root / "ruff.toml").exists():
            gates.append("lint")
        if (root / "mypy.ini").exists() or (root / "pyproject.toml").exists():
            gates.append("type")
        if (root / "tests").exists():
            gates.append("unit")
        if (root / "integration_tests").exists() or (root / "tests" / "integration").exists():
            gates.append("integration")
        if (root / "playwright.config.ts").exists() or (root / "tests" / "visual").exists():
            gates.append("visual")
        return sorted(set(gates))

    def _detect_ci(self, root: Path) -> List[str]:
        ci_file = root / ".github" / "workflows" / "ci.yml"
        quality_file = root / ".github" / "workflows" / "rule-verifier-quality.yml"
        ci_text = ""
        if quality_file.exists():
            ci_text += quality_file.read_text(encoding="utf-8")
        if ci_file.exists():
            ci_text += "\n" + ci_file.read_text(encoding="utf-8")

        gates: List[str] = []
        lookup = {
            "ruff": "lint",
            "mypy": "type",
            "pytest": "unit",
            "integration": "integration",
            "playwright": "visual",
            "pre-commit": "precommit",
        }
        for token, gate in lookup.items():
            if token in ci_text:
                gates.append(gate)
        return sorted(set(gates))

    def _artifact_dir(self, target_project_path: Path) -> Path:
        path = target_project_path / ".rule-verifier-artifacts"
        path.mkdir(parents=True, exist_ok=True)
        return path
