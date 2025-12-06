#!/usr/bin/env python3
"""
SQLGlot Database Analyzer - SQL performance anti-patterns using SQLGlot + configs.

Replaces SQLFluff dependency with a lightweight, pure-Python analyzer guided by
`shared/config/patterns/scalability/database.json`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer

try:
    import sqlglot  # type: ignore[import-not-found]
    from sqlglot import parse_one  # type: ignore[import-not-found]
except Exception:  # pragma: no cover - optional import validated at runtime
    sqlglot = None  # type: ignore[assignment]
    parse_one = None  # type: ignore[assignment]


@register_analyzer("performance:sqlglot")
class SQLGlotAnalyzer(BaseAnalyzer):
    """Analyze SQL files for common performance issues."""

    def __init__(self, config: AnalyzerConfig | None = None):
        perf_cfg = config or AnalyzerConfig(code_extensions={".sql"})
        super().__init__("performance", perf_cfg)

        self.patterns = self._load_db_patterns()

    def get_analyzer_metadata(self) -> dict[str, Any]:
        return {
            "name": "SQLGlot Database Analyzer",
            "version": "1.0.0",
            "description": "SQL performance analysis using SQLGlot and config-driven patterns",
            "category": "performance",
            "priority": "medium",
            "sqlglot_available": bool(sqlglot is not None),
        }

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        target = Path(target_path)
        if not target.is_file():
            return []

        content = target.read_text(encoding="utf-8", errors="ignore")
        lines = content.splitlines() or [""]
        findings: list[dict[str, Any]] = []

        # 1) Config-driven regex indicators (cheap and deterministic)
        for name, spec in self.patterns.items():
            indicators: list[str] = spec.get("indicators", [])
            severity: str = spec.get("severity", "medium")
            description: str = spec.get("description", name)
            for i, line in enumerate(lines, start=1):
                if any(re.search(pat, line, flags=re.IGNORECASE) for pat in indicators):
                    findings.append(
                        {
                            "title": f"SQL Pattern: {name}",
                            "description": description,
                            "severity": severity,
                            "file_path": str(target),
                            "line_number": i,
                            "recommendation": self._recommendation_for(name),
                            "metadata": {"pattern": name},
                        }
                    )

        # 2) AST-based heuristics when SQLGlot is available (e.g., no LIMIT on SELECT *)
        if sqlglot is not None:
            for stmt in _split_sql_statements(content):
                try:
                    expr = parse_one(stmt, error_level="ignore")
                except Exception:
                    continue
                if not expr:
                    continue

                # Simple heuristics: SELECT without LIMIT may be large result set
                if expr.find("select"):
                    has_limit = bool(list(expr.find_all("limit")))
                    if not has_limit:
                        findings.append(
                            {
                                "title": "SQL: SELECT without LIMIT",
                                "description": "Statement may return an unbounded result set",
                                "severity": "medium",
                                "file_path": str(target),
                                "line_number": 1,
                                "recommendation": "Consider LIMIT/OFFSET or pagination where appropriate.",
                                "metadata": {"ast_check": "no_limit"},
                            }
                        )

        return findings

    def _load_db_patterns(self) -> dict[str, dict[str, Any]]:
        cfg = (
            Path(__file__).resolve().parents[2]
            / "config"
            / "patterns"
            / "scalability"
            / "database.json"
        )
        data = json.loads(cfg.read_text(encoding="utf-8"))
        return data.get("patterns", {})

    def _recommendation_for(self, name: str) -> str:
        recs = {
            "large_result_sets": "Add LIMIT/OFFSET or pagination to avoid full scans.",
            "missing_indexes": "Ensure columns in WHERE/ORDER BY are indexed as needed.",
            "n_plus_one": "Batch queries or use eager loading to avoid N+1 pattern.",
            "no_pagination": "Add pagination to endpoints returning large collections.",
        }
        return recs.get(name, "Review and optimize the SQL statement.")


def _split_sql_statements(sql: str) -> list[str]:
    # Very simple splitter; sqlglot also handles multiple statements but we keep it explicit
    parts = [p.strip() for p in sql.split(";")]
    return [p for p in parts if p]
