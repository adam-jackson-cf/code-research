#!/usr/bin/env python3
"""
Semgrep Performance Analyzer - Universal performance/best-practice heuristics.

Runs Semgrep across supported languages with a curated config (defaulting to
registry rules) and maps findings into our schema. Supports deferred install
via env var AAW_AUTO_INSTALL_SEMGREP=true.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from typing import Any

from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


def _has_semgrep() -> bool:
    return bool(shutil.which("semgrep"))


def _auto_install_semgrep() -> bool:
    if os.environ.get("AAW_AUTO_INSTALL_SEMGREP", "").lower() not in {
        "1",
        "true",
        "yes",
    }:
        return False
    py = shutil.which("python3") or shutil.which("python")
    if not py:
        return False
    try:
        r = subprocess.run(
            [py, "-m", "pip", "install", "--user", "semgrep"],
            capture_output=True,
            text=True,
            timeout=600,
        )
        return r.returncode == 0
    except Exception:
        return False


@register_analyzer("performance:semgrep")
class SemgrepPerformanceAnalyzer(BaseAnalyzer):
    """Universal performance heuristics using Semgrep rules."""

    def __init__(
        self, config: AnalyzerConfig | None = None, *, config_ref: str | None = None
    ):
        # Broad set of source extensions; Semgrep handles language detection
        perf_cfg = config or AnalyzerConfig()
        super().__init__("performance", perf_cfg)
        self.config_ref = config_ref or "r/performance"

    def get_analyzer_metadata(self) -> dict[str, Any]:
        return {
            "name": "Semgrep Performance Analyzer",
            "version": "1.0.0",
            "description": "Multi-language performance/best-practice heuristics via Semgrep",
            "category": "performance",
            "priority": "low",
            "config": self.config_ref,
        }

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        if not _has_semgrep() and not _auto_install_semgrep():
            # Defer: users can enable auto install or install themselves
            return []

        cmd = [
            "semgrep",
            "--json",
            "--timeout",
            "120",
            "--config",
            self.config_ref,
            target_path,
        ]
        try:
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        except subprocess.TimeoutExpired:
            return []

        if p.returncode not in (0, 1):  # 1 = findings
            return []

        try:
            data = json.loads(p.stdout or "{}")
        except json.JSONDecodeError:
            return []

        results = data.get("results", []) or []
        findings: list[dict[str, Any]] = []
        for r in results:
            check_id = r.get("check_id", "semgrep")
            path = r.get("path", "unknown")
            start = r.get("start", {})
            line = int(start.get("line", 1))
            message = (r.get("extra", {}) or {}).get("message", check_id)
            sev = (r.get("extra", {}) or {}).get("severity", "INFO").lower()
            severity = {"info": "info", "warning": "medium", "error": "high"}.get(
                sev, "low"
            )

            findings.append(
                {
                    "title": f"Semgrep: {check_id}",
                    "description": message,
                    "severity": severity,
                    "file_path": path,
                    "line_number": line,
                    "recommendation": "Review and optimize per rule guidance.",
                    "metadata": {"tool": "semgrep", "check_id": check_id},
                }
            )

        return findings
