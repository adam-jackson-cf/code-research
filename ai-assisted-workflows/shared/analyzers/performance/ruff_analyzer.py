#!/usr/bin/env python3
"""
Ruff Performance Analyzer - Python performance anti-patterns via Ruff.

Replaces the flake8 + perflint + plugin stack with a single fast linter.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from typing import Any

from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


@register_analyzer("performance:ruff")
class RuffPerformanceAnalyzer(BaseAnalyzer):
    """Maps `ruff check --output-format json` into our finding schema."""

    def __init__(self, config: AnalyzerConfig | None = None):
        perf_cfg = config or AnalyzerConfig(code_extensions={".py", ".pyi"})
        super().__init__("performance", perf_cfg)

        if not shutil.which("ruff"):
            # We keep a soft failure to allow other analyzers to run
            self.ruff_available = False
        else:
            self.ruff_available = True

        # Map Ruff codes to severity (conservative defaults)
        self.code_severity: dict[str, str] = {
            # performance families
            "PERF": "high",  # perflint rules in Ruff
            "C4": "medium",  # flake8-comprehensions
            "B": "medium",  # bugbear (includes some perf)
        }

    def get_analyzer_metadata(self) -> dict[str, Any]:
        return {
            "name": "Ruff Performance Analyzer",
            "version": "1.0.0",
            "description": "Python performance analysis via Ruff (PERF/C4/B)",
            "category": "performance",
            "priority": "medium",
            "ruff_available": self.ruff_available,
        }

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        if not self.ruff_available:
            return []

        cmd = [
            "ruff",
            "check",
            "--output-format",
            "json",
            target_path,
        ]
        try:
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        except subprocess.TimeoutExpired:
            return []

        raw = (p.stdout or "").strip()
        if not raw:
            return []

        findings: list[dict[str, Any]] = []
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return []

        for item in data:
            code = item.get("code", "")
            prefix = "".join([c for c in code if c.isalpha()])  # PERF/C4/B...
            severity = self.code_severity.get(prefix, "low")
            filepath = item.get("filename", "unknown")
            line = int(item.get("location", {}).get("row", 1))
            message = item.get("message", code)

            findings.append(
                {
                    "title": f"Ruff {code}",
                    "description": message,
                    "severity": severity,
                    "file_path": filepath,
                    "line_number": line,
                    "recommendation": self._recommendation_for(code, message),
                    "metadata": {"ruff_code": code},
                }
            )

        return findings

    def _recommendation_for(self, code: str, message: str) -> str:
        if code.startswith("PERF"):
            return "Refactor to remove performance anti-pattern (PERF rule)."
        if code.startswith("C4"):
            return "Use comprehensions/literals appropriately to reduce overhead."
        if code.startswith("B"):
            return "Address bugbear issue; consider performance implications."
        return "Review and optimize the highlighted code path."
