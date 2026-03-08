"""Scenario generation for rule prompts and risk-map regressions."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Dict, List


class ScenarioGenerator:
    def __init__(self, rules: List[Dict], config: Dict | None = None):
        self.rules = rules
        self.config = config or {}
        self.scenarios: List[Dict] = []

    def generate_scenarios(self) -> List[Dict]:
        self.scenarios = []
        for rule in self.rules:
            sid = self._id(rule["rule_id"], "rule")
            self.scenarios.append(
                {
                    "scenario_id": sid,
                    "rule_id": rule["rule_id"],
                    "feature_id": rule.get("feature_id"),
                    "prompt": f"Follow this rule exactly: {rule['description']}",
                    "expected_behavior": {"should_contain": rule.get("commands", [])},
                }
            )
        return self.scenarios

    def generate_from_risk_map(self, risk_map: Dict, target_project_path: Path) -> Dict:
        scenarios: List[Dict] = []
        for mapping in sorted(risk_map.get("mappings", []), key=lambda m: m["gate"]):
            for feature in mapping.get("impacted_features", []):
                sid = self._id(f"{mapping['gate']}:{feature}", "risk")
                scenarios.append(
                    {
                        "scenario_id": sid,
                        "gate": mapping["gate"],
                        "feature_id": feature,
                        "risk": mapping["risk"],
                        "prompt": f"Verify regression safety for feature {feature} after {mapping['gate']} fixes.",
                    }
                )
        suite = {"target_project_path": str(target_project_path), "scenarios": scenarios}
        out = self._artifact_dir(target_project_path) / "scenario-regression-suite.json"
        out.write_text(json.dumps(suite, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return suite

    def get_summary(self) -> Dict:
        return {"total_scenarios": len(self.scenarios), "by_type": {"rule": len(self.scenarios)}}

    def _id(self, seed: str, prefix: str) -> str:
        return f"{prefix}_{hashlib.sha1(seed.encode('utf-8')).hexdigest()[:10]}"

    def _artifact_dir(self, target_project_path: Path) -> Path:
        path = target_project_path / ".rule-verifier-artifacts"
        path.mkdir(parents=True, exist_ok=True)
        return path
