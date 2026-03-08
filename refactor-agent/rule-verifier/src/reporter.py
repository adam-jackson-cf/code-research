"""Reporting helpers for deterministic harness artifacts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict


class Reporter:
    def __init__(self, config: Dict | None = None):
        self.config = config or {}

    def write_json(self, path: Path, payload: Dict) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return path

    def write_matrix_acceptance(self, harness_root: Path, summary: Dict) -> Path:
        out = harness_root / "results" / "matrix-acceptance-summary.json"
        return self.write_json(out, summary)
