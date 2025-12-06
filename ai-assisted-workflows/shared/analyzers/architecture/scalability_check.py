#!/usr/bin/env python3
"""
Scalability Analysis Analyzer - Code Scalability Assessment.

PURPOSE: Analyzes code for potential scalability bottlenecks and architectural constraints.
Part of the shared/analyzers/architecture suite using BaseAnalyzer infrastructure.

APPROACH:
- Database scalability patterns (N+1 queries, missing indexes, unbounded result sets)
- Performance bottleneck detection (synchronous I/O, nested loops, inefficient algorithms)
- Concurrency issue identification (thread safety, blocking operations, resource contention)
- Architecture scalability analysis (tight coupling, hardcoded config, SRP violations)
- Python AST analysis for algorithmic complexity detection

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements scalability-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns
"""

import ast
import json
import re
import subprocess
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer

_SCALABILITY_PATTERN_DIR = (
    Path(__file__).resolve().parents[2] / "config" / "patterns" / "scalability"
)
_SCALABILITY_CATEGORY_FILES = {
    "database": "database.json",
    "performance": "performance.json",
    "concurrency": "concurrency.json",
    "architecture": "architecture.json",
}
_SCALABILITY_CONFIG_VERSION = 1
_REQUIRED_PATTERN_FIELDS = {"indicators", "severity", "description"}


class ScalabilityPatternConfigError(RuntimeError):
    """Raised when scalability pattern configuration is invalid."""


@lru_cache(maxsize=1)
def _load_scalability_pattern_bundle() -> dict[str, dict[str, dict[str, Any]]]:
    """Load and validate all scalability pattern categories from JSON."""
    bundle: dict[str, dict[str, dict[str, Any]]] = {}
    for category, filename in _SCALABILITY_CATEGORY_FILES.items():
        path = _SCALABILITY_PATTERN_DIR / filename
        try:
            raw_data = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:  # pragma: no cover - configuration must exist
            raise ScalabilityPatternConfigError(
                f"Scalability pattern config not found: {path}"
            ) from exc

        if not isinstance(raw_data, dict):
            raise ScalabilityPatternConfigError(
                f"Config for category '{category}' must be a JSON object"
            )

        if raw_data.get("schema_version") != _SCALABILITY_CONFIG_VERSION:
            raise ScalabilityPatternConfigError(
                f"Unsupported schema version for '{category}':"
                f" {raw_data.get('schema_version')}"
            )

        pattern_block = raw_data.get("patterns")
        if not isinstance(pattern_block, dict):
            raise ScalabilityPatternConfigError(
                f"Config for category '{category}' must contain a 'patterns' object"
            )

        normalized: dict[str, dict[str, Any]] = {}
        for pattern_name, spec in pattern_block.items():
            if not isinstance(pattern_name, str):
                raise ScalabilityPatternConfigError(
                    f"Pattern keys must be strings in category '{category}'"
                )
            if not isinstance(spec, dict):
                raise ScalabilityPatternConfigError(
                    f"Pattern '{pattern_name}' in '{category}' must be an object"
                )

            missing = _REQUIRED_PATTERN_FIELDS - set(spec)
            if missing:
                raise ScalabilityPatternConfigError(
                    f"Pattern '{pattern_name}' in '{category}' missing keys:"
                    f" {', '.join(sorted(missing))}"
                )

            indicators = spec["indicators"]
            if not isinstance(indicators, list) or not all(
                isinstance(indicator, str) for indicator in indicators
            ):
                raise ScalabilityPatternConfigError(
                    f"Pattern '{pattern_name}' indicators must be a list of strings"
                )

            severity = spec["severity"]
            description = spec["description"]
            if not isinstance(severity, str) or not isinstance(description, str):
                raise ScalabilityPatternConfigError(
                    f"Pattern '{pattern_name}' severity and description must be strings"
                )

            normalized[pattern_name] = {
                "indicators": list(indicators),
                "severity": severity,
                "description": description,
            }

        bundle[category] = normalized

    return bundle


@dataclass(frozen=True)
class PatternScanContext:
    """Container holding context for scanning a file against scalability patterns."""

    content: str
    lines: list[str]
    file_path: str
    category: str
    patterns: dict[str, dict[str, Any]]
    lizard_metrics: dict[str, Any]
    content_lower: str = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "content_lower", self.content.lower())


@dataclass(frozen=True)
class PatternMatchContext:
    """Context for evaluating whether a specific pattern match should be flagged."""

    scan: PatternScanContext
    pattern_name: str
    context_line: str
    context_lower: str = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "context_lower", self.context_line.lower())


@register_analyzer("architecture:scalability")
class ScalabilityAnalyzer(BaseAnalyzer):
    """Analyzes code for scalability bottlenecks and architectural constraints."""

    def __init__(self, config: AnalyzerConfig | None = None):
        # Create scalability-specific configuration
        scalability_config = config or AnalyzerConfig(
            code_extensions={
                ".py",
                ".js",
                ".jsx",
                ".ts",
                ".tsx",
                ".java",
                ".cs",
                ".cpp",
                ".c",
                ".h",
                ".hpp",
                ".go",
                ".rs",
                ".php",
                ".rb",
                ".swift",
                ".kt",
                ".scala",
                ".sql",
            },
            skip_patterns={
                "node_modules",
                ".git",
                "__pycache__",
                ".pytest_cache",
                "build",
                "dist",
                ".next",
                ".nuxt",
                "coverage",
                "venv",
                "env",
                ".env",
                "vendor",
                "logs",
                "target",
                ".vscode",
                ".idea",
                "*.min.js",
                "*.bundle.js",
                "*.test.*",
                "*/tests/*",
            },
        )

        # Initialize base analyzer
        super().__init__("architecture", scalability_config)

        # Initialize scalability pattern definitions
        self._init_scalability_patterns()

    def _init_scalability_patterns(self):
        """Initialize all scalability pattern definitions."""
        pattern_bundle = _load_scalability_pattern_bundle()

        try:
            self.db_patterns = pattern_bundle["database"]
            self.performance_patterns = pattern_bundle["performance"]
            self.concurrency_patterns = pattern_bundle["concurrency"]
            self.architecture_patterns = pattern_bundle["architecture"]
        except (
            KeyError
        ) as exc:  # pragma: no cover - configuration must define all categories
            raise ScalabilityPatternConfigError(
                f"Missing scalability pattern category: {exc.args[0]}"
            ) from exc

        self.pattern_sets = {
            "database": self.db_patterns,
            "performance": self.performance_patterns,
            "concurrency": self.concurrency_patterns,
            "architecture": self.architecture_patterns,
        }
        self._pattern_evaluators = self._build_pattern_evaluators()
        # Cache for lizard metrics to avoid repeated CLI calls per file
        self._lizard_cache: dict[str, dict[str, Any]] = {}

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Scalability Analysis Analyzer",
            "version": "2.0.0",
            "description": "Analyzes code for potential scalability bottlenecks and architectural constraints",
            "category": "architecture",
            "priority": "high",
            "capabilities": [
                "Database scalability patterns (N+1 queries, missing indexes)",
                "Performance bottleneck detection (synchronous I/O, nested loops)",
                "Concurrency issue identification (thread safety, resource contention)",
                "Architecture scalability analysis (coupling, configuration)",
                "Python AST analysis for algorithmic complexity",
                "Multi-language scalability pattern recognition",
                "Scalability scoring and prioritized recommendations",
            ],
            "supported_formats": list(self.config.code_extensions),
            "pattern_categories": {
                "database_patterns": len(self.db_patterns),
                "performance_patterns": len(self.performance_patterns),
                "concurrency_patterns": len(self.concurrency_patterns),
                "architecture_patterns": len(self.architecture_patterns),
            },
        }

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze a single file for scalability bottlenecks.

        Args:
            target_path: Path to file to analyze

        Returns
        -------
            List of findings with standardized structure
        """
        all_findings = []
        file_path = Path(target_path)

        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
                lines = content.split("\n")

            lizard_metrics = self._get_lizard_metrics(str(file_path))

            for category, patterns in self.pattern_sets.items():
                scan_context = PatternScanContext(
                    content=content,
                    lines=lines,
                    file_path=str(file_path),
                    category=category,
                    patterns=patterns,
                    lizard_metrics=lizard_metrics,
                )
                findings = self._check_scalability_patterns(scan_context)
                all_findings.extend(findings)

            # Additional Python complexity analysis
            if file_path.suffix == ".py":
                complexity_findings = self._analyze_python_complexity(
                    content, lines, str(file_path)
                )
                all_findings.extend(complexity_findings)

        except Exception as e:
            all_findings.append(
                {
                    "title": "File Analysis Error",
                    "description": f"Could not analyze file: {str(e)}",
                    "severity": "low",
                    "file_path": str(file_path),
                    "line_number": 0,
                    "recommendation": "Check file encoding and permissions.",
                    "metadata": {"error_type": "file_read_error", "confidence": "high"},
                }
            )

        return all_findings

    def _check_scalability_patterns(
        self, scan: PatternScanContext
    ) -> list[dict[str, Any]]:
        """Check for specific scalability patterns in file content with context validation."""
        findings: list[dict[str, Any]] = []

        for pattern_name, pattern_info in scan.patterns.items():
            for indicator in pattern_info["indicators"]:
                matches = re.finditer(
                    indicator, scan.content, re.MULTILINE | re.IGNORECASE
                )
                for match in matches:
                    line_num = scan.content[: match.start()].count("\n") + 1
                    context_line = (
                        scan.lines[line_num - 1].strip()
                        if line_num <= len(scan.lines)
                        else ""
                    )

                    match_context = PatternMatchContext(
                        scan=scan, pattern_name=pattern_name, context_line=context_line
                    )

                    if self._should_flag_scalability_issue(match_context):
                        confidence = self._calculate_confidence(
                            pattern_name, context_line, scan.lizard_metrics
                        )

                        findings.append(
                            {
                                "title": f"Scalability Issue: {pattern_name.replace('_', ' ').title()}",
                                "description": f"{pattern_info['description']} ({pattern_name})",
                                "severity": pattern_info["severity"],
                                "file_path": scan.file_path,
                                "line_number": line_num,
                                "recommendation": self._get_recommendation(
                                    pattern_name, scan.category
                                ),
                                "metadata": {
                                    "scalability_category": scan.category,
                                    "pattern_name": pattern_name,
                                    "context": context_line,
                                    "confidence": confidence,
                                    "lizard_ccn": scan.lizard_metrics.get("max_ccn", 0),
                                },
                            }
                        )

        return findings

    def _get_lizard_metrics(self, file_path: str) -> dict[str, Any]:
        """Get Lizard complexity metrics for the file."""
        if file_path in self._lizard_cache:
            return self._lizard_cache[file_path]
        try:
            result = subprocess.run(
                ["lizard", "-C", "999", "-L", "999", "-a", "999", file_path],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode == 0:
                # Parse lizard output for metrics
                lines = result.stdout.strip().split("\n")
                metrics = {
                    "functions": [],
                    "avg_ccn": 0,
                    "max_ccn": 0,
                    "total_functions": 0,
                }

                for line in lines:
                    if (
                        line.strip()
                        and not line.startswith("=")
                        and not line.startswith("NLOC")
                    ):
                        parts = line.split()
                        if len(parts) >= 4 and parts[0].isdigit():
                            try:
                                ccn = int(parts[0])
                                nloc = int(parts[1])

                                metrics["functions"].append({"ccn": ccn, "nloc": nloc})
                                metrics["max_ccn"] = max(metrics["max_ccn"], ccn)
                                metrics["total_functions"] += 1
                            except (ValueError, IndexError):
                                continue

                if metrics["total_functions"] > 0:
                    metrics["avg_ccn"] = (
                        sum(f["ccn"] for f in metrics["functions"])
                        / metrics["total_functions"]
                    )

                self._lizard_cache[file_path] = metrics
                return metrics

        except (
            subprocess.TimeoutExpired,
            subprocess.SubprocessError,
            FileNotFoundError,
        ):
            pass

        metrics = {"functions": [], "avg_ccn": 0, "max_ccn": 0, "total_functions": 0}
        self._lizard_cache[file_path] = metrics
        return metrics

    def _should_flag_scalability_issue(self, match: "PatternMatchContext") -> bool:
        """Determine if a scalability issue should be flagged based on context."""
        if any(
            marker in match.context_lower
            for marker in ["test", "spec", "mock", "fixture", "stub", "config", "setup"]
        ):
            return False

        evaluator = self._pattern_evaluators.get(match.pattern_name)
        if evaluator:
            return evaluator(match)

        metrics = match.scan.lizard_metrics
        return metrics.get("total_functions", 0) > 3 and metrics.get("max_ccn", 0) > 8

    def _build_pattern_evaluators(
        self,
    ) -> dict[str, Callable[["PatternMatchContext"], bool]]:
        """Create evaluators that decide whether to flag a given pattern match."""

        def database_evaluator(match: "PatternMatchContext") -> bool:
            metrics = match.scan.lizard_metrics
            has_db_context = any(
                term in match.scan.content_lower
                for term in [
                    "select",
                    "insert",
                    "update",
                    "delete",
                    "query",
                    "orm",
                    "model",
                    "database",
                    "table",
                    "sequelize",
                    "mongoose",
                    "prisma",
                ]
            )
            return (
                metrics.get("max_ccn", 0) > 10
                and metrics.get("total_functions", 0) > 2
                and has_db_context
            )

        def synchronous_io(match: "PatternMatchContext") -> bool:
            metrics = match.scan.lizard_metrics
            has_loop = any(
                token in match.context_lower for token in ["for ", "while ", "foreach"]
            )
            return (
                has_loop
                and metrics.get("max_ccn", 0) > 12
                and "await" not in match.context_lower
            )

        def hardcoded_config(match: "PatternMatchContext") -> bool:
            metrics = match.scan.lizard_metrics
            has_config_context = any(
                term in match.scan.content_lower
                for term in ["config", "environment", "settings", "connection"]
            )
            return metrics.get("total_functions", 0) > 3 and has_config_context

        def memory_leaks(match: "PatternMatchContext") -> bool:
            metrics = match.scan.lizard_metrics
            return (
                metrics.get("total_functions", 0) > 5 and metrics.get("max_ccn", 0) > 8
            )

        def tight_coupling(match: "PatternMatchContext") -> bool:
            metrics = match.scan.lizard_metrics
            return (
                metrics.get("total_functions", 0) > 4 and metrics.get("max_ccn", 0) > 10
            )

        def thread_safety(match: "PatternMatchContext") -> bool:
            metrics = match.scan.lizard_metrics
            has_concurrent_context = any(
                term in match.scan.content_lower
                for term in [
                    "thread",
                    "async",
                    "concurrent",
                    "parallel",
                    "multiprocess",
                ]
            )
            return metrics.get("max_ccn", 0) > 8 and has_concurrent_context

        evaluators: dict[str, Callable[[PatternMatchContext], bool]] = {}
        for name in {
            "n_plus_one",
            "missing_indexes",
            "large_result_sets",
            "no_pagination",
        }:
            evaluators[name] = database_evaluator

        evaluators["synchronous_io"] = synchronous_io
        evaluators["hardcoded_config"] = hardcoded_config
        evaluators["memory_leaks"] = memory_leaks
        evaluators["tight_coupling"] = tight_coupling
        evaluators["thread_safety"] = thread_safety

        return evaluators

    def _calculate_confidence(
        self, pattern_name: str, context: str, lizard_metrics: dict
    ) -> str:
        """Calculate confidence level for the finding."""
        max_ccn = lizard_metrics.get("max_ccn", 0)

        # High confidence for complex functions with scalability patterns
        if max_ccn > 15:
            return "high"
        elif max_ccn > 8:
            return "medium"
        else:
            return "low"

    def _analyze_python_complexity(
        self, content: str, lines: list[str], file_path: str
    ) -> list[dict[str, Any]]:
        """Analyze Python-specific complexity that affects scalability."""
        findings = []

        try:
            tree = ast.parse(content)

            for node in ast.walk(tree):
                # Check for deeply nested loops
                if isinstance(node, ast.For | ast.While):
                    nesting_level = self._count_nesting_level(node, tree)
                    if nesting_level >= 3:
                        line_num = getattr(node, "lineno", 0)
                        context = (
                            lines[line_num - 1].strip()
                            if line_num <= len(lines)
                            else ""
                        )

                        findings.append(
                            {
                                "title": f"High Algorithmic Complexity (O(n^{nesting_level}))",
                                "description": f"Deeply nested loop (level {nesting_level}) - O(n^{nesting_level}) complexity",
                                "severity": "high",
                                "file_path": file_path,
                                "line_number": line_num,
                                "recommendation": "Consider algorithm optimization, caching, or breaking into smaller functions",
                                "metadata": {
                                    "scalability_category": "performance",
                                    "pattern_name": "algorithmic_complexity",
                                    "nesting_level": nesting_level,
                                    "context": context,
                                    "confidence": "high",
                                },
                            }
                        )

                # Check for large list comprehensions
                if isinstance(node, ast.ListComp) and len(node.generators) > 2:
                    line_num = getattr(node, "lineno", 0)
                    context = (
                        lines[line_num - 1].strip() if line_num <= len(lines) else ""
                    )

                    findings.append(
                        {
                            "title": "Complex List Comprehension",
                            "description": "Complex list comprehension with multiple generators may impact performance",
                            "severity": "medium",
                            "file_path": file_path,
                            "line_number": line_num,
                            "recommendation": "Consider breaking into simpler operations or using generator expressions",
                            "metadata": {
                                "scalability_category": "performance",
                                "pattern_name": "complex_comprehension",
                                "generator_count": len(node.generators),
                                "context": context,
                                "confidence": "medium",
                            },
                        }
                    )

        except SyntaxError:
            # Skip files with syntax errors
            pass
        except Exception as e:
            findings.append(
                {
                    "title": "AST Analysis Error",
                    "description": f"AST analysis failed: {str(e)}",
                    "severity": "low",
                    "file_path": file_path,
                    "line_number": 0,
                    "recommendation": "Manual review required - file may have syntax issues",
                    "metadata": {
                        "scalability_category": "analysis",
                        "pattern_name": "ast_analysis_error",
                        "error_type": type(e).__name__,
                        "confidence": "high",
                    },
                }
            )

        return findings

    def _count_nesting_level(self, target_node, tree) -> int:
        """Count the nesting level of loops."""
        level = 0

        def count_parent_loops(node):
            nonlocal level
            for child in ast.iter_child_nodes(node):
                if child == target_node:
                    return True
                if isinstance(child, ast.For | ast.While):
                    level += 1
                    if count_parent_loops(child):
                        return True
                    level -= 1
                elif count_parent_loops(child):
                    return True
            return False

        count_parent_loops(tree)
        return level

    def _get_recommendation(self, pattern_name: str, category: str) -> str:
        """Get specific recommendations for scalability issues."""
        recommendations = {
            "n_plus_one": "Use eager loading, batch queries, or caching",
            "missing_indexes": "Add database indexes for frequently queried columns",
            "large_result_sets": "Implement pagination or result limiting",
            "no_pagination": "Add LIMIT clauses and pagination support",
            "synchronous_io": "Use async/await or threading for I/O operations",
            "nested_loops": "Optimize algorithm complexity or use caching",
            "inefficient_algorithms": "Review algorithm choice and data structures",
            "memory_leaks": "Implement proper cleanup and bounded collections",
            "thread_safety": "Use thread-safe data structures and proper synchronization",
            "blocking_operations": "Use non-blocking alternatives or background processing",
            "resource_contention": "Minimize lock scope and consider lock-free algorithms",
            "tight_coupling": "Implement dependency injection and interface abstraction",
            "hardcoded_config": "Use environment variables or configuration files",
            "single_responsibility": "Refactor into smaller, focused components",
        }
        return recommendations.get(pattern_name, "Review and optimize this pattern")


if __name__ == "__main__":
    raise SystemExit(0)
