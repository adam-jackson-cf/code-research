#!/usr/bin/env python3
"""
Error Pattern Analyzer - Root Cause Analysis Through Pattern Detection.

PURPOSE: Analyzes code for known error patterns and failure modes to assist with root cause analysis.
Part of the shared/analyzers/root_cause suite using BaseAnalyzer infrastructure.

APPROACH:
- Pattern matching for 9 error categories (memory leaks, null pointers, race conditions, etc.)
- Language-specific pattern detection (Python, JavaScript, Java)
- Error keyword detection in comments for debugging hints
- Error clustering analysis to identify systemic issues

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements error pattern analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns
"""

import json
import re
import sys
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer

_ERROR_PATTERN_DIR = (
    Path(__file__).resolve().parents[2] / "config" / "patterns" / "error"
)
_ERROR_PATTERNS_PATH = _ERROR_PATTERN_DIR / "patterns.json"
_LANGUAGE_PATTERNS_PATH = _ERROR_PATTERN_DIR / "language_patterns.json"
_ERROR_TYPE_MAP_PATH = _ERROR_PATTERN_DIR / "error_type_map.json"
_ERROR_PATTERN_SCHEMA_VERSION = 1
_LANGUAGE_PATTERN_SCHEMA_VERSION = 1
_ERROR_TYPE_MAP_VERSION = 1
_REQUIRED_ERROR_PATTERN_FIELDS = {
    "patterns",
    "severity",
    "category",
    "description",
}
_REQUIRED_LANGUAGE_PATTERN_FIELDS = {"patterns", "severity"}


class ErrorPatternConfigError(RuntimeError):
    """Raised when error pattern configuration is invalid."""


@lru_cache(maxsize=1)
def _load_error_pattern_bundle() -> (
    tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]
):
    """Load and validate general and language-specific error patterns."""
    try:
        general_raw = json.loads(_ERROR_PATTERNS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:  # pragma: no cover - configuration must exist
        raise ErrorPatternConfigError(
            f"Error pattern config not found: {_ERROR_PATTERNS_PATH}"
        ) from exc

    if not isinstance(general_raw, dict):
        raise ErrorPatternConfigError(
            "General error pattern config must be a JSON object"
        )

    if general_raw.get("schema_version") != _ERROR_PATTERN_SCHEMA_VERSION:
        raise ErrorPatternConfigError(
            "Unsupported error pattern schema version:"
            f" {general_raw.get('schema_version')}"
        )

    general_block = general_raw.get("patterns")
    if not isinstance(general_block, dict):
        raise ErrorPatternConfigError(
            "Error pattern config must contain a 'patterns' object"
        )

    general_patterns: dict[str, dict[str, Any]] = {}
    for name, spec in general_block.items():
        if not isinstance(name, str):
            raise ErrorPatternConfigError("Error pattern keys must be strings")
        if not isinstance(spec, dict):
            raise ErrorPatternConfigError(
                f"Error pattern '{name}' must be a JSON object"
            )

        missing = _REQUIRED_ERROR_PATTERN_FIELDS - set(spec)
        if missing:
            raise ErrorPatternConfigError(
                f"Error pattern '{name}' missing keys: {', '.join(sorted(missing))}"
            )

        indicators = spec["patterns"]
        if not isinstance(indicators, list) or not all(
            isinstance(pattern, str) for pattern in indicators
        ):
            raise ErrorPatternConfigError(
                f"Error pattern '{name}' must define a list of string patterns"
            )

        severity = spec["severity"]
        category = spec["category"]
        description = spec["description"]
        if not all(
            isinstance(value, str) for value in (severity, category, description)
        ):
            raise ErrorPatternConfigError(
                f"Error pattern '{name}' severity, category, and description must be strings"
            )

        general_patterns[name] = {
            "patterns": list(indicators),
            "severity": severity,
            "category": category,
            "description": description,
        }

    try:
        language_raw = json.loads(_LANGUAGE_PATTERNS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:  # pragma: no cover - configuration must exist
        raise ErrorPatternConfigError(
            f"Language pattern config not found: {_LANGUAGE_PATTERNS_PATH}"
        ) from exc

    if not isinstance(language_raw, dict):
        raise ErrorPatternConfigError(
            "Language-specific pattern config must be a JSON object"
        )

    if language_raw.get("schema_version") != _LANGUAGE_PATTERN_SCHEMA_VERSION:
        raise ErrorPatternConfigError(
            "Unsupported language pattern schema version:"
            f" {language_raw.get('schema_version')}"
        )

    language_block = language_raw.get("languages")
    if not isinstance(language_block, dict):
        raise ErrorPatternConfigError(
            "Language pattern config must contain a 'languages' object"
        )

    language_patterns: dict[str, dict[str, Any]] = {}
    for extension, spec in language_block.items():
        if not isinstance(extension, str):
            raise ErrorPatternConfigError(
                "Language pattern keys must be file extensions as strings"
            )
        if not isinstance(spec, dict):
            raise ErrorPatternConfigError(
                f"Language pattern '{extension}' must be a JSON object"
            )

        missing = _REQUIRED_LANGUAGE_PATTERN_FIELDS - set(spec)
        if missing:
            raise ErrorPatternConfigError(
                f"Language pattern '{extension}' missing keys: {', '.join(sorted(missing))}"
            )

        indicators = spec["patterns"]
        if not isinstance(indicators, list) or not all(
            isinstance(pattern, str) for pattern in indicators
        ):
            raise ErrorPatternConfigError(
                f"Language pattern '{extension}' must define a list of string patterns"
            )

        severity = spec["severity"]
        if not isinstance(severity, str):
            raise ErrorPatternConfigError(
                f"Language pattern '{extension}' severity must be a string"
            )

        language_patterns[extension] = {
            "patterns": list(indicators),
            "severity": severity,
        }

    return general_patterns, language_patterns


@lru_cache(maxsize=1)
def _load_error_type_map() -> tuple[dict[str, Any], list[str]]:
    """Load mapping of runtime error types to relevant pattern names."""
    try:
        raw_data = json.loads(_ERROR_TYPE_MAP_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:  # pragma: no cover - configuration must exist
        raise ErrorPatternConfigError(
            f"Error type mapping config not found: {_ERROR_TYPE_MAP_PATH}"
        ) from exc

    if not isinstance(raw_data, dict):
        raise ErrorPatternConfigError("Error type mapping config must be a JSON object")

    if raw_data.get("schema_version") != _ERROR_TYPE_MAP_VERSION:
        raise ErrorPatternConfigError(
            "Unsupported error type mapping schema version:"
            f" {raw_data.get('schema_version')}"
        )

    default_patterns = raw_data.get("default_patterns")
    if not isinstance(default_patterns, list) or not all(
        isinstance(item, str) for item in default_patterns
    ):
        raise ErrorPatternConfigError(
            "Error type mapping must define 'default_patterns' as a list of strings"
        )

    mappings = raw_data.get("mappings")
    if not isinstance(mappings, dict):
        raise ErrorPatternConfigError(
            "Error type mapping must define a 'mappings' object"
        )

    normalized: dict[str, Any] = {}
    for error_type, pattern_list in mappings.items():
        if pattern_list == "__all__":
            normalized[error_type] = "__all__"
            continue
        if not isinstance(pattern_list, list) or not all(
            isinstance(item, str) for item in pattern_list
        ):
            raise ErrorPatternConfigError(
                f"Mapping for '{error_type}' must be a list of strings or '__all__'"
            )
        normalized[error_type] = list(pattern_list)

    return normalized, list(default_patterns)


@dataclass(frozen=True)
class ErrorScanContext:
    """Context for scanning files against targeted error patterns."""

    content: str
    lines: list[str]
    file_path: str
    relevant_patterns: list[str]
    error_context: dict[str, Any]
    content_lower: str = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "content_lower", self.content.lower())


@register_analyzer("root_cause:error_patterns")
class ErrorPatternAnalyzer(BaseAnalyzer):
    """Analyze code for known error patterns and failure modes to assist with root cause analysis."""

    def __init__(self, config: AnalyzerConfig | None = None, error_info: str = ""):
        # Store error information for targeted analysis
        self.error_info = error_info

        # Create error pattern specific configuration
        error_config = config or AnalyzerConfig(
            code_extensions={
                ".py",
                ".js",
                ".jsx",
                ".ts",
                ".tsx",
                ".java",
                ".cpp",
                ".c",
                ".cs",
                ".php",
                ".rb",
                ".go",
                ".rs",
                ".kt",
                ".scala",
                ".swift",
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
        super().__init__("root_cause", error_config)

        # Initialize error pattern definitions
        self._init_error_patterns()

    def _init_error_patterns(self):
        """Initialize all error pattern definitions."""
        patterns, language_patterns = _load_error_pattern_bundle()
        self.error_patterns = patterns

        # Common error keywords to search for in files
        self.error_keywords = [
            "error",
            "exception",
            "fail",
            "crash",
            "bug",
            "issue",
            "problem",
            "todo",
            "fixme",
            "hack",
            "workaround",
            "temporary",
        ]

        # File extensions and their specific patterns
        self.language_patterns = language_patterns

        error_type_map, default_patterns = _load_error_type_map()
        self.error_type_map = error_type_map
        self.default_error_patterns = default_patterns

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Error Pattern Analyzer",
            "version": "2.0.0",
            "description": "Analyzes code for known error patterns and failure modes to assist with root cause analysis",
            "category": "root_cause",
            "priority": "high",
            "capabilities": [
                "Memory leak and resource management pattern detection",
                "Null pointer and undefined access pattern identification",
                "Race condition and concurrency issue detection",
                "Security vulnerability pattern matching (injection, auth bypass)",
                "Error handling anti-pattern identification",
                "Performance bottleneck pattern recognition",
                "State management issue detection",
                "Data corruption pattern analysis",
                "Language-specific error pattern detection",
                "Error keyword analysis in comments",
                "Error clustering analysis for systemic issues",
            ],
            "supported_formats": list(self.config.code_extensions),
            "pattern_categories": {
                "general_error_patterns": len(self.error_patterns),
                "language_specific_patterns": len(self.language_patterns),
                "error_keywords": len(self.error_keywords),
            },
        }

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze a single file for error patterns related to a specific error.

        Args:
            target_path: Path to file to analyze

        Returns
        -------
            List of findings with standardized structure
        """
        # REQUIRED: Must have error information to investigate
        if not self.error_info:
            return [
                {
                    "title": "Error Information Required",
                    "description": "Root cause analysis requires an error message or issue to investigate. Please provide: error message, stack trace, or specific issue description.",
                    "severity": "critical",
                    "file_path": target_path,
                    "line_number": 0,
                    "recommendation": "Run with --error parameter: python error_patterns.py --error 'your error message here'",
                    "metadata": {
                        "error_type": "missing_error_context",
                        "confidence": "high",
                    },
                }
            ]

        # Parse the error to understand what we're investigating
        error_context = self.parse_error(self.error_info)

        # Only analyze files related to the error
        file_path = Path(target_path)
        normalized_target = str(file_path).replace("\\", "/")

        # Skip files not related to the error
        if error_context.get("file"):
            error_file = error_context["file"].replace("\\", "/")
            # Allow exact match or if error file is contained in target path
            if error_file not in normalized_target and not any(
                part in normalized_target for part in error_file.split("/")
            ):
                return []  # Skip unrelated files

        all_findings = []

        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
                lines = content.split("\n")

            # Get patterns relevant to this error type
            relevant_patterns = self.get_patterns_for_error_type(
                error_context.get("error_type", "unknown")
            )

            # Check only relevant error patterns
            targeted_context = ErrorScanContext(
                content=content,
                lines=lines,
                file_path=str(file_path),
                relevant_patterns=relevant_patterns,
                error_context=error_context,
            )
            findings = self._check_targeted_error_patterns(targeted_context)
            all_findings.extend(findings)

            # Check for error keywords around the error line if known
            if error_context.get("line"):
                findings = self._check_error_keywords_targeted(
                    lines, str(file_path), error_context["line"]
                )
                all_findings.extend(findings)
            else:
                # Check all error keywords if no specific line
                findings = self._check_error_keywords(lines, str(file_path))
                all_findings.extend(findings)

        except Exception as e:
            all_findings.append(
                {
                    "title": "File Analysis Error",
                    "description": f"Could not analyze file for error patterns: {str(e)}",
                    "severity": "low",
                    "file_path": str(file_path),
                    "line_number": 0,
                    "recommendation": "Check file encoding and permissions.",
                    "metadata": {"error_type": "file_read_error", "confidence": "high"},
                }
            )

        # Add error context to all findings
        for finding in all_findings:
            finding["metadata"]["investigated_error"] = self.error_info
            finding["metadata"]["error_context"] = error_context

        return all_findings

    def _check_targeted_error_patterns(
        self, scan: ErrorScanContext
    ) -> list[dict[str, Any]]:
        """Check only patterns relevant to the error being investigated."""
        findings = []

        for pattern_name in scan.relevant_patterns:
            if pattern_name not in self.error_patterns:
                continue

            pattern_info = self.error_patterns[pattern_name]

            for regex_pattern in pattern_info["patterns"]:
                try:
                    matches = list(
                        re.finditer(
                            regex_pattern, scan.content, re.MULTILINE | re.IGNORECASE
                        )
                    )

                    for match in matches:
                        line_num = scan.content[: match.start()].count("\n") + 1
                        context = (
                            scan.lines[line_num - 1].strip()
                            if line_num <= len(scan.lines)
                            else ""
                        )

                        # If we have a specific error line, prioritize findings near it
                        proximity_weight = "medium"
                        if scan.error_context.get("line"):
                            distance = abs(line_num - scan.error_context["line"])
                            if distance <= 3:
                                proximity_weight = "high"
                            elif distance <= 10:
                                proximity_weight = "medium"
                            else:
                                proximity_weight = "low"

                        findings.append(
                            {
                                "title": f"Error Pattern: {pattern_name.replace('_', ' ').title()}",
                                "description": f"{pattern_info['description']} - Pattern: {pattern_name}",
                                "severity": pattern_info["severity"],
                                "file_path": scan.file_path,
                                "line_number": line_num,
                                "recommendation": self._get_targeted_recommendation(
                                    pattern_name, scan.error_context
                                ),
                                "metadata": {
                                    "error_category": pattern_info["category"],
                                    "pattern_name": pattern_name,
                                    "matched_text": match.group(0),
                                    "context": context,
                                    "proximity_to_error": proximity_weight,
                                    "confidence": "high"
                                    if proximity_weight == "high"
                                    else "medium",
                                },
                            }
                        )

                except re.error:
                    continue

        return findings

    def _check_error_keywords_targeted(
        self, lines: list[str], file_path: str, error_line: int
    ) -> list[dict[str, Any]]:
        """Check for error keywords near the specific error line."""
        findings = []

        # Check lines around the error (±5 lines)
        start_line = max(1, error_line - 5)
        end_line = min(len(lines), error_line + 5)

        for line_num in range(start_line, end_line + 1):
            if line_num > len(lines):
                break

            line = lines[line_num - 1]
            line_lower = line.lower()

            for keyword in self.error_keywords:
                if keyword in line_lower and re.search(
                    rf"\b{re.escape(keyword)}\b", line_lower
                ):
                    findings.append(
                        {
                            "title": f"Error Keyword Found: {keyword.upper()}",
                            "description": f"Found error-related keyword '{keyword}' near error location",
                            "severity": "medium",
                            "file_path": file_path,
                            "line_number": line_num,
                            "recommendation": f"Review context around '{keyword}' for debugging clues",
                            "metadata": {
                                "keyword": keyword,
                                "context": line.strip(),
                                "distance_from_error": abs(line_num - error_line),
                                "confidence": "high",
                            },
                        }
                    )

        return findings

    def _get_targeted_recommendation(
        self, pattern_name: str, error_context: dict[str, Any]
    ) -> str:
        """Get targeted recommendation based on pattern and error context."""
        base_recommendations = {
            "null_pointer": "Add null/undefined checks before accessing object properties",
            "memory_leak": "Ensure proper cleanup of resources and event listeners",
            "race_condition": "Add proper synchronization or use async/await correctly",
            "injection_vulnerability": "Sanitize and validate all user input",
            "poor_error_handling": "Implement proper error handling and logging",
            "performance_issue": "Optimize algorithms and reduce nested iterations",
            "state_mutation": "Use immutable updates or proper state management patterns",
            "auth_bypass": "Implement proper authentication and authorization checks",
            "data_corruption": "Add input validation and bounds checking for data operations",
        }

        base_rec = base_recommendations.get(
            pattern_name, "Review and fix the identified issue"
        )

        # Add context-specific advice
        if error_context.get("line"):
            return f"{base_rec}. Focus on line {error_context['line']} and surrounding code."
        elif error_context.get("file"):
            return f"{base_rec}. Pay special attention to this file as it's mentioned in the error."

        return base_rec

    def _check_error_patterns(
        self, content: str, lines: list[str], file_path: str
    ) -> list[dict[str, Any]]:
        """Check for general error patterns."""
        findings = []

        for pattern_name, pattern_info in self.error_patterns.items():
            for pattern in pattern_info["patterns"]:
                matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)

                for match in matches:
                    line_num = content[: match.start()].count("\n") + 1
                    context = (
                        lines[line_num - 1].strip() if line_num <= len(lines) else ""
                    )

                    findings.append(
                        {
                            "title": f"Error Pattern: {pattern_name.replace('_', ' ').title()}",
                            "description": f"{pattern_info['description']} - Pattern: {pattern_name}",
                            "severity": pattern_info["severity"],
                            "file_path": file_path,
                            "line_number": line_num,
                            "recommendation": self._get_pattern_recommendation(
                                pattern_name, pattern_info["category"]
                            ),
                            "metadata": {
                                "error_category": pattern_info["category"],
                                "pattern_name": pattern_name,
                                "matched_text": match.group(0),
                                "context": context,
                                "confidence": "high",
                            },
                        }
                    )

        return findings

    def _check_language_patterns(
        self, content: str, lines: list[str], file_path: str
    ) -> list[dict[str, Any]]:
        """Check for language-specific patterns."""
        findings = []

        file_ext = Path(file_path).suffix.lower()
        if file_ext in self.language_patterns:
            lang_config = self.language_patterns[file_ext]

            for pattern in lang_config["patterns"]:
                matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)

                for match in matches:
                    line_num = content[: match.start()].count("\n") + 1
                    context = (
                        lines[line_num - 1].strip() if line_num <= len(lines) else ""
                    )

                    findings.append(
                        {
                            "title": f"Language Anti-Pattern ({file_ext.upper()})",
                            "description": f"Language-specific anti-pattern detected for {file_ext} files",
                            "severity": lang_config["severity"],
                            "file_path": file_path,
                            "line_number": line_num,
                            "recommendation": self._get_language_recommendation(
                                file_ext, match.group(0)
                            ),
                            "metadata": {
                                "error_category": "language_specific",
                                "language": file_ext,
                                "matched_text": match.group(0),
                                "context": context,
                                "confidence": "medium",
                            },
                        }
                    )

        return findings

    def _check_error_keywords(
        self, lines: list[str], file_path: str
    ) -> list[dict[str, Any]]:
        """Check for error-related keywords in comments."""
        findings = []
        comment_patterns = [
            r"#.*",  # Python, shell comments
            r"//.*",  # C++, Java, JavaScript comments
            r"/\*.*?\*/",  # Multi-line comments
            r"<!--.*?-->",  # HTML comments
        ]

        for line_num, line in enumerate(lines, 1):
            line_lower = line.lower()

            # Check if line is a comment
            is_comment = any(re.search(pattern, line) for pattern in comment_patterns)

            if is_comment:
                for keyword in self.error_keywords:
                    if keyword in line_lower:
                        findings.append(
                            {
                                "title": f"Error Keyword Found: {keyword.upper()}",
                                "description": f"Error-related keyword '{keyword}' found in comment, may indicate debugging context",
                                "severity": "low",
                                "file_path": file_path,
                                "line_number": line_num,
                                "recommendation": f"Review comment containing '{keyword}' for potential issues or technical debt",
                                "metadata": {
                                    "error_category": "error_keyword",
                                    "keyword": keyword,
                                    "context": line.strip(),
                                    "confidence": "low",
                                },
                            }
                        )

        return findings

    def _get_pattern_recommendation(self, pattern_name: str, category: str) -> str:
        """Get specific recommendations for error patterns."""
        recommendations = {
            "memory_leak": "Ensure proper resource cleanup with try-finally blocks or context managers",
            "null_pointer": "Add null/undefined checks before accessing object properties",
            "race_condition": "Use proper synchronization mechanisms or atomic operations",
            "injection_vulnerability": "Use parameterized queries and input sanitization",
            "poor_error_handling": "Implement proper error handling with specific error messages and recovery",
            "performance_issue": "Optimize algorithm complexity and reduce nested operations",
            "state_mutation": "Use immutable data structures or proper state management patterns",
            "auth_bypass": "Implement proper authentication and authorization checks",
            "data_corruption": "Add input validation and bounds checking for data operations",
        }
        return recommendations.get(
            pattern_name, f"Review and address this {category} pattern"
        )

    def _get_language_recommendation(self, file_ext: str, matched_text: str) -> str:
        """Get language-specific recommendations."""
        recommendation_rules: dict[str, list[tuple[Callable[[str], bool], str]]] = {
            ".py": [
                (
                    lambda text: "except:" in text,
                    "Use specific exception types instead of bare except clauses",
                ),
                (
                    lambda text: "import *" in text,
                    "Use explicit imports instead of wildcard imports",
                ),
                (
                    lambda text: "eval" in text or "exec" in text,
                    "Avoid eval() and exec() - use safer alternatives like ast.literal_eval()",
                ),
            ],
            ".js": [
                (
                    lambda text: "==" in text
                    and ("null" in text or "undefined" in text),
                    "Use strict equality (===) instead of loose equality (==)",
                ),
                (
                    lambda text: "var " in text,
                    "Use let or const instead of var for better scoping",
                ),
            ],
            ".java": [
                (
                    lambda text: "printStackTrace" in text,
                    "Use proper logging instead of printStackTrace() in production code",
                ),
                (
                    lambda text: "System.out.print" in text,
                    "Use a proper logging framework instead of System.out",
                ),
            ],
        }

        for evaluator, message in recommendation_rules.get(file_ext, []):
            if evaluator(matched_text):
                return message

        return f"Follow {file_ext} best practices and avoid this anti-pattern"

    def analyze_error_clusters(
        self, all_findings: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Analyze clusters of errors that might indicate systemic issues."""
        clusters = []

        # Group by file and category
        file_categories = defaultdict(lambda: defaultdict(list))

        for finding in all_findings:
            if finding.get("metadata", {}).get("error_category") in self.error_patterns:
                file_path = finding.get("file_path", "")
                category = finding.get("metadata", {}).get("error_category", "unknown")
                file_categories[file_path][category].append(finding)

        # Find files with multiple issues in same category
        for file_path, categories in file_categories.items():
            for category, findings in categories.items():
                if len(findings) >= 3:  # 3+ issues in same category
                    clusters.append(
                        {
                            "title": f"Error Cluster: {category.replace('_', ' ').title()}",
                            "description": f"Multiple {category} issues clustered in {Path(file_path).name} - indicates systemic problem",
                            "severity": "high",
                            "file_path": file_path,
                            "line_number": 0,
                            "recommendation": f"Perform comprehensive review of {category} patterns in this file",
                            "metadata": {
                                "error_category": "error_cluster",
                                "cluster_category": category,
                                "issue_count": len(findings),
                                "clustered_findings": findings,
                                "confidence": "high",
                            },
                        }
                    )

        return clusters

    def parse_error(self, error_info: str) -> dict[str, Any]:
        """Parse error information to extract actionable context."""
        if not error_info:
            return {}

        error_context = {
            "error_type": "unknown",
            "message": error_info,
            "file": None,
            "line": None,
            "stack_files": [],
        }

        # JavaScript/TypeScript error patterns
        js_error_pattern = r"(\w+Error): (.+?) at (.+?):(\d+)"
        js_match = re.search(js_error_pattern, error_info)
        if js_match:
            error_context.update(
                {
                    "error_type": js_match.group(1),
                    "message": js_match.group(2),
                    "file": js_match.group(3),
                    "line": int(js_match.group(4)),
                }
            )

        # Python error patterns
        python_error_pattern = r'File "(.+?)", line (\d+).+\n\s*(.+)'
        python_match = re.search(python_error_pattern, error_info, re.MULTILINE)
        if python_match:
            error_context.update(
                {
                    "file": python_match.group(1),
                    "line": int(python_match.group(2)),
                    "message": python_match.group(3),
                }
            )

        # General file:line pattern
        general_pattern = r"([a-zA-Z_./\\]+\.\w+):?(\d+)?"
        general_match = re.search(general_pattern, error_info)
        if general_match and not error_context["file"]:
            error_context["file"] = general_match.group(1)
            if general_match.group(2):
                error_context["line"] = int(general_match.group(2))

        # Extract error type from message if not found
        if error_context["error_type"] == "unknown":
            type_patterns = [
                "TypeError",
                "ReferenceError",
                "SyntaxError",
                "Error",
                "Exception",
            ]
            for error_type in type_patterns:
                if error_type.lower() in error_info.lower():
                    error_context["error_type"] = error_type
                    break

        return error_context

    def get_patterns_for_error_type(self, error_type: str) -> list[str]:
        """Get relevant patterns based on error type."""
        patterns = self.error_type_map.get(error_type)

        if patterns is None and error_type.lower() != error_type:
            patterns = self.error_type_map.get(error_type.lower())

        if patterns is None:
            patterns = self.error_type_map.get("unknown")

        if patterns == "__all__":
            return list(self.error_patterns.keys())

        if isinstance(patterns, list):
            return patterns

        return list(self.default_error_patterns)


def main():
    """Run error patterns analyzer from the command line."""
    import argparse

    # Parse arguments first to get error info
    parser = argparse.ArgumentParser(
        description="Root cause analysis through error pattern detection"
    )
    parser.add_argument("target_path", help="Path to analyze")
    parser.add_argument(
        "--error",
        required=True,
        help="Error message, stack trace, or issue description to investigate",
    )
    parser.add_argument(
        "--output-format",
        choices=["json", "console"],
        default="json",
        help="Output format",
    )
    parser.add_argument("--max-files", type=int, help="Maximum files to analyze")
    parser.add_argument(
        "--min-severity",
        choices=["critical", "high", "medium", "low"],
        default="low",
        help="Minimum severity level",
    )

    args = parser.parse_args()

    # Create analyzer with error info
    analyzer = ErrorPatternAnalyzer(error_info=args.error)

    # Set up basic config
    analyzer.config.target_path = args.target_path
    analyzer.config.output_format = args.output_format
    if args.max_files:
        analyzer.config.max_files = args.max_files
    analyzer.config.min_severity = args.min_severity

    # Run analysis
    try:
        result = analyzer.analyze()

        if args.output_format == "console":
            print(f"Root Cause Analysis Results for: {args.error}")
            print("=" * 60)
            for finding in result.findings:
                print(f"\n{finding.title}")
                print(f"Severity: {finding.severity}")
                print(f"File: {finding.file_path}:{finding.line_number}")
                print(f"Description: {finding.description}")
                print(f"Recommendation: {finding.recommendation}")
        else:
            print(result.to_json(indent=2))

        sys.exit(0)

    except Exception as e:
        print(f"Error during analysis: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
