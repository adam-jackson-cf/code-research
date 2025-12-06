#!/usr/bin/env python3
"""
Code Performance Profiler - General Code Performance Analysis.

PURPOSE: General-purpose code performance profiler with extensible architecture.
Part of the shared/analyzers/performance suite using BaseProfiler infrastructure.

APPROACH:
- Static analysis for common performance anti-patterns
- Language-agnostic performance heuristics
- Placeholder framework for integrating real profiling tools
- Extensible pattern-based detection system

EXTENDS: BaseProfiler for common profiling infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements general code performance analysis in profile_target()
- Uses shared timing, logging, and error handling patterns

FUTURE INTEGRATIONS:
- cProfile/profile for Python profiling
- py-spy for Python sampling profiler
- memory-profiler for memory usage analysis
- line_profiler for line-by-line profiling
- Node.js clinic for JavaScript profiling
"""

import re
from pathlib import Path
from typing import Any

# Import base profiler (package root must be on PYTHONPATH)
from core.base.profiler_base import BaseProfiler, ProfilerConfig


class CodeProfiler(BaseProfiler):
    """General-purpose code performance profiler."""

    def __init__(self, config: ProfilerConfig | None = None):
        # Create code-specific configuration
        code_config = config or ProfilerConfig(
            code_extensions={
                ".py",
                ".js",
                ".ts",
                ".jsx",
                ".tsx",
                ".java",
                ".cs",
                ".php",
                ".rb",
                ".go",
                ".rs",
                ".cpp",
                ".c",
                ".h",
                ".hpp",
                ".swift",
                ".kt",
                ".scala",
                ".dart",
                ".vue",
            },
            skip_patterns={
                "node_modules",
                ".git",
                "__pycache__",
                ".pytest_cache",
                "venv",
                "env",
                ".venv",
                "dist",
                "build",
                ".next",
                "coverage",
                ".nyc_output",
                "target",
                "vendor",
                "bin",
                "obj",
                "Debug",
                "Release",
            },
        )

        # Initialize base profiler
        super().__init__("code", code_config)

        # Performance anti-patterns for static analysis
        self.performance_patterns = {
            "nested_loops": {
                "pattern": r"for\s+.*?:\s*[^{]*for\s+.*?:",
                "severity": "high",
                "description": "Nested loops detected - potential O(n²) complexity",
                "languages": ["python", "javascript", "java", "c"],
            },
            "string_concatenation_loop": {
                "pattern": r"for\s+.*?:\s*[^{]*[\w\s]*\+=\s*['\"].*['\"]",
                "severity": "medium",
                "description": "String concatenation in loop - consider using join() or StringBuilder",
                "languages": ["python", "java", "javascript"],
            },
            "inefficient_array_search": {
                "pattern": r"\.indexOf\(|\.includes\(|\.find\(.*?===",
                "severity": "medium",
                "description": "Linear array search - consider using Set or Map for frequent lookups",
                "languages": ["javascript", "typescript"],
            },
            "synchronous_file_operations": {
                "pattern": r"fs\.readFileSync|fs\.writeFileSync|open\([^)]*['\"][rwa]['\"]",
                "severity": "medium",
                "description": "Synchronous file operations - consider async alternatives",
                "languages": ["javascript", "python"],
            },
            "inefficient_dom_access": {
                "pattern": r"document\.getElementById|document\.querySelector.*for\s+",
                "severity": "medium",
                "description": "DOM query in loop - cache DOM references outside loops",
                "languages": ["javascript"],
            },
            "memory_leak_patterns": {
                "pattern": r"addEventListener\((?![^)]*removeEventListener)|setInterval\((?![^)]*clearInterval)",
                "severity": "high",
                "description": "Potential memory leak - missing cleanup for event listeners/intervals",
                "languages": ["javascript"],
            },
            "inefficient_string_operations": {
                "pattern": r"\.replace\(.*?\.replace\(|\.split\(.*?\.join\(",
                "severity": "low",
                "description": "Chained string operations - consider single regex or more efficient approach",
                "languages": ["javascript", "python"],
            },
        }

        # Language-specific file patterns
        self.language_patterns = {
            ".py": "python",
            ".js": "javascript",
            ".ts": "typescript",
            ".jsx": "javascript",
            ".tsx": "typescript",
            ".java": "java",
            ".cs": "csharp",
            ".php": "php",
            ".rb": "ruby",
            ".go": "go",
            ".rs": "rust",
            ".cpp": "c",
            ".c": "c",
            ".swift": "swift",
            ".kt": "kotlin",
            ".scala": "scala",
        }

    def profile_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Implement code performance profiling logic.

        Args:
            target_path: Path to analyze (single file - BaseProfiler handles directory iteration)

        Returns
        -------
            List of code performance findings
        """
        target = Path(target_path)

        if target.is_file():
            return self._analyze_file_performance(target)

        return []

    def _analyze_file_performance(self, file_path: Path) -> list[dict[str, Any]]:
        """
        Analyze a single file for performance issues.

        Args:
            file_path: Path to the file to analyze

        Returns
        -------
            List of performance findings
        """
        findings = []

        try:
            # Determine file language
            language = self.language_patterns.get(file_path.suffix.lower(), "unknown")

            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
                lines = content.split("\n")

                # Analyze performance patterns
                for pattern_name, pattern_info in self.performance_patterns.items():
                    # Check if pattern applies to this language
                    if language in pattern_info.get("languages", []):
                        findings.extend(
                            self._find_performance_issues(
                                content,
                                lines,
                                file_path,
                                pattern_name,
                                pattern_info,
                                language,
                            )
                        )

                # Add general file-level metrics
                findings.extend(
                    self._analyze_file_metrics(file_path, content, lines, language)
                )

        except Exception as e:
            self.logger.warning(f"Error analyzing {file_path}: {e}")

        return findings

    def _find_performance_issues(
        self,
        content: str,
        lines: list[str],
        file_path: Path,
        pattern_name: str,
        pattern_info: dict[str, Any],
        language: str,
    ) -> list[dict[str, Any]]:
        """Find performance issues matching a specific pattern."""
        findings = []

        try:
            matches = re.finditer(
                pattern_info["pattern"], content, re.MULTILINE | re.IGNORECASE
            )

            for match in matches:
                # Find line number
                line_start = content[: match.start()].count("\n") + 1

                # Get context lines
                context_start = max(0, line_start - 2)
                context_end = min(len(lines), line_start + 2)
                context_lines = lines[context_start:context_end]

                finding = {
                    "title": f"Performance Issue: {pattern_name.replace('_', ' ').title()}",
                    "description": pattern_info["description"],
                    "severity": pattern_info["severity"],
                    "file_path": str(file_path),
                    "line_number": line_start,
                    "recommendation": self._get_performance_recommendation(
                        pattern_name, language
                    ),
                    "metadata": {
                        "pattern_type": pattern_name,
                        "language": language,
                        "line_content": (
                            lines[line_start - 1].strip()
                            if line_start <= len(lines)
                            else ""
                        ),
                        "context": "\n".join(context_lines),
                        "matched_text": match.group(0)[:100],
                        "performance_impact": self._estimate_performance_impact(
                            pattern_name
                        ),
                    },
                }
                findings.append(finding)

        except re.error as e:
            self.logger.warning(f"Regex error in pattern {pattern_name}: {e}")

        return findings

    def _analyze_file_metrics(
        self, file_path: Path, content: str, lines: list[str], language: str
    ) -> list[dict[str, Any]]:
        """Analyze general file-level performance metrics."""
        findings = []

        # File size analysis
        file_size = len(content)
        line_count = len(lines)

        # Large file warning
        if file_size > 50000:  # 50KB threshold
            findings.append(
                {
                    "title": "Large File Size",
                    "description": f"File is {file_size:,} bytes - consider splitting for maintainability",
                    "severity": "low" if file_size < 100000 else "medium",
                    "file_path": str(file_path),
                    "line_number": 1,
                    "recommendation": "Consider refactoring into smaller, focused modules",
                    "metadata": {
                        "pattern_type": "file_size",
                        "language": language,
                        "file_size_bytes": file_size,
                        "line_count": line_count,
                        "performance_impact": "maintainability",
                    },
                }
            )

        # High cyclomatic complexity heuristic (nested braces/indentation)
        if language in ["javascript", "java", "c", "csharp"]:
            brace_nesting = self._estimate_complexity_by_braces(content)
            if brace_nesting > 4:
                findings.append(
                    {
                        "title": "High Complexity Detected",
                        "description": f"Deep nesting level ({brace_nesting}) detected - may impact performance",
                        "severity": "medium" if brace_nesting < 6 else "high",
                        "file_path": str(file_path),
                        "line_number": 1,
                        "recommendation": "Consider refactoring to reduce complexity and improve performance",
                        "metadata": {
                            "pattern_type": "complexity",
                            "language": language,
                            "estimated_nesting_depth": brace_nesting,
                            "performance_impact": "execution_time",
                        },
                    }
                )

        return findings

    def _estimate_complexity_by_braces(self, content: str) -> int:
        """Estimate complexity by analyzing brace nesting depth."""
        max_depth = 0
        current_depth = 0

        for char in content:
            if char == "{":
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif char == "}":
                current_depth = max(0, current_depth - 1)

        return max_depth

    def _get_performance_recommendation(self, pattern_name: str, language: str) -> str:
        """Get performance recommendation for specific pattern and language."""
        recommendations = {
            "nested_loops": {
                "python": "Use list comprehensions, pandas operations, or algorithmic optimization",
                "javascript": "Consider using map/filter/reduce or algorithmic improvements",
                "java": "Use streams API or optimize algorithm to reduce time complexity",
                "default": "Optimize algorithm to reduce time complexity from O(n²)",
            },
            "string_concatenation_loop": {
                "python": "Use ''.join(list) instead of += in loops",
                "java": "Use StringBuilder instead of String concatenation",
                "javascript": "Use array.join() instead of += in loops",
                "default": "Use efficient string building methods for your language",
            },
            "inefficient_array_search": {
                "javascript": "Use Set.has() or Map.has() for O(1) lookups instead of O(n) array methods",
                "default": "Consider using hash-based data structures for frequent lookups",
            },
            "synchronous_file_operations": {
                "javascript": "Use fs.promises or util.promisify for async file operations",
                "python": "Use aiofiles or asyncio for non-blocking file operations",
                "default": "Use asynchronous file operations to avoid blocking",
            },
            "inefficient_dom_access": {
                "javascript": "Cache DOM elements outside loops: const el = document.getElementById('id')",
                "default": "Cache DOM references to avoid repeated queries",
            },
            "memory_leak_patterns": {
                "javascript": "Always pair addEventListener with removeEventListener and setInterval with clearInterval",
                "default": "Ensure proper cleanup of resources and event listeners",
            },
            "inefficient_string_operations": {
                "javascript": "Use single regex with capture groups or more efficient string methods",
                "python": "Consider using regex with re.sub() or more efficient string operations",
                "default": "Optimize string operations to reduce repeated processing",
            },
        }

        pattern_recs = recommendations.get(pattern_name, {})
        return pattern_recs.get(
            language,
            pattern_recs.get(
                "default", "Review code for performance optimization opportunities"
            ),
        )

    def _estimate_performance_impact(self, pattern_name: str) -> str:
        """Estimate the performance impact category for a pattern."""
        impact_map = {
            "nested_loops": "execution_time",
            "string_concatenation_loop": "memory_and_cpu",
            "inefficient_array_search": "execution_time",
            "synchronous_file_operations": "blocking_io",
            "inefficient_dom_access": "rendering_performance",
            "memory_leak_patterns": "memory_usage",
            "inefficient_string_operations": "cpu_usage",
        }
        return impact_map.get(pattern_name, "general")

    def get_profiler_metadata(self) -> dict[str, Any]:
        """
        Get code profiler-specific metadata.

        Returns
        -------
            Dictionary with profiler-specific metadata
        """
        return {
            "analysis_type": "static_analysis",
            "performance_patterns": len(self.performance_patterns),
            "supported_languages": list(set(self.language_patterns.values())),
            "pattern_categories": {
                "algorithmic": ["nested_loops", "inefficient_array_search"],
                "memory": ["string_concatenation_loop", "memory_leak_patterns"],
                "io_operations": ["synchronous_file_operations"],
                "dom_performance": ["inefficient_dom_access"],
                "string_operations": ["inefficient_string_operations"],
            },
            "implementation_status": "pattern_based_heuristics",
            "future_integrations": [
                "cProfile",
                "py-spy",
                "memory-profiler",
                "line_profiler",
                "Node.js clinic",
                "perf",
                "valgrind",
            ],
        }


# Legacy function for backward compatibility
def profile_code_performance(target_path: str = ".") -> Any:
    """
    Legacy function for backward compatibility.

    Args:
        target_path: Path to analyze

    Returns
    -------
        AnalysisResult from CodeProfiler
    """
    profiler = CodeProfiler()
    return profiler.analyze(target_path)


if __name__ == "__main__":
    raise SystemExit(0)
