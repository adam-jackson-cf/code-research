"""Map verification failures to impacted features/capabilities."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List


class FailureImpactMapper:
    def map_failures(self, target_project_path: Path, failure_manifest: Dict, capabilities: List[Dict]) -> Dict:
        fallback_cap = {"feature_id": "project_core", "path": str(target_project_path), "keywords": ["project"]}
        indexed = capabilities or [fallback_cap]
        mappings: List[Dict] = []
        for failure in failure_manifest.get("failures", []):
            gate = failure.get("gate", "unknown")
            impacted = self._pick_impacted(gate, indexed)
            mappings.append({"gate": gate, "impacted_features": impacted, "risk": self._risk(gate)})

        risk_map = {
            "target_project_path": str(target_project_path),
            "mappings": mappings,
            "unmapped_failures": [m["gate"] for m in mappings if not m["impacted_features"]],
        }
        out = self._artifact_dir(target_project_path) / "feature-risk-map.json"
        out.write_text(json.dumps(risk_map, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return risk_map

    def _pick_impacted(self, gate: str, capabilities: List[Dict]) -> List[str]:
        chosen: List[str] = []
        for capability in capabilities:
            keywords = capability.get("keywords", [])
            if gate in keywords or gate in capability.get("feature_id", ""):
                chosen.append(capability["feature_id"])
        if not chosen and capabilities:
            chosen.append(capabilities[0]["feature_id"])
        return sorted(set(chosen))

    def _risk(self, gate: str) -> str:
        if gate in {"lint", "type"}:
            return "medium"
        if gate in {"unit", "integration", "visual"}:
            return "high"
        return "low"

    def _artifact_dir(self, target_project_path: Path) -> Path:
        path = target_project_path / ".rule-verifier-artifacts"
        path.mkdir(parents=True, exist_ok=True)
        return path
