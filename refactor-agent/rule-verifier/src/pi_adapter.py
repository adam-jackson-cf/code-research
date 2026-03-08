"""Deterministic host-to-pi integration helpers."""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List


@dataclass(frozen=True)
class PiInitResult:
    settings_path: Path
    trace_path: Path
    policy_status: str


class PiAdapter:
    def __init__(self, harness_root: Path, config: Dict):
        self.harness_root = harness_root
        self.config = config

    def initialize(self, target_project_path: Path, prompt_path: Path) -> PiInitResult:
        pi_dir = self.harness_root / ".pi"
        pi_dir.mkdir(parents=True, exist_ok=True)
        settings_path = pi_dir / "settings.json"
        trace_path = self._artifact_dir(target_project_path) / "pi-event-trace.jsonl"

        settings_payload = {
            "model": self.config.get("pi_foundation", {}).get("model", "default"),
            "prompt_template": str(prompt_path),
            "target_project_path": str(target_project_path),
            "runtime": "pi",
        }
        settings_path.write_text(json.dumps(settings_payload, indent=2, sort_keys=True) + "\n")

        pi_available = shutil.which("pi") is not None
        events: List[Dict] = [
            {"event": "pi_init_started", "target": str(target_project_path)},
            {"event": "pi_binary_check", "available": pi_available},
            {"event": "prompt_bound", "path": str(prompt_path)},
            {"event": "pi_init_completed", "status": "ok" if pi_available else "degraded"},
        ]
        with trace_path.open("w", encoding="utf-8") as handle:
            for event in events:
                handle.write(json.dumps(event, sort_keys=True) + "\n")

        return PiInitResult(
            settings_path=settings_path,
            trace_path=trace_path,
            policy_status="pass" if pi_available else "warn",
        )

    def _artifact_dir(self, target_project_path: Path) -> Path:
        path = target_project_path / ".rule-verifier-artifacts"
        path.mkdir(parents=True, exist_ok=True)
        return path
