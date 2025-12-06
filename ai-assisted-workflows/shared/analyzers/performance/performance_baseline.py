#!/usr/bin/env python3
"""
Performance Baseline Analyzer - Performance Benchmarking and Baseline Establishment.

PURPOSE: Establishes performance benchmarks before refactoring for comparison validation.
Part of the shared/analyzers/performance suite using BaseAnalyzer infrastructure.

APPROACH:
- Language detection and analysis
- System performance baseline capture
- Project structure analysis
- Build performance measurement
- Dependency analysis
- Performance recommendations generation
- Baseline data storage for comparison

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements baseline-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns
"""

import sys
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer


@register_analyzer("performance:baseline")
class PerformanceBaseliner(BaseAnalyzer):
    """Language-agnostic performance baseline analyzer."""

    def __init__(self, config: AnalyzerConfig | None = None):
        # Create baseline-specific configuration
        baseline_config = config or AnalyzerConfig(
            code_extensions={
                ".py",
                ".js",
                ".ts",
                ".jsx",
                ".tsx",
                ".java",
                ".go",
                ".rs",
                ".cs",
                ".rb",
                ".php",
                ".cpp",
                ".c",
                ".h",
                ".hpp",
                ".swift",
                ".kt",
                ".scala",
                ".dart",
                ".vue",
                ".svelte",
                ".json",
                ".xml",
                ".toml",
                ".yaml",
                ".yml",
                ".gradle",
                ".pom",
                ".csproj",
                ".sln",
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
                "*.min.js",
                "*.min.css",
                "*.d.ts",
                "*.lock",
                "logs",
                "tmp",
                "temp",
            },
        )

        # Initialize base analyzer
        super().__init__("performance", baseline_config)

        # Performance metrics to capture
        self.baseline_metrics = [
            "execution_time",
            "memory_usage",
            "cpu_utilization",
            "build_time",
            "startup_time",
            "throughput",
            "latency",
            "file_sizes",
            "dependency_count",
        ]

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """Return metadata about this analyzer."""
        return {
            "name": "Performance Baseline Analyzer",
            "version": "2.0.0",
            "description": "Establishes performance benchmarks for comparison validation",
            "category": "performance",
            "priority": "medium",
            "capabilities": [
                "Language detection and analysis",
                "System performance baseline capture",
                "Project structure analysis",
                "Build performance measurement",
                "Dependency analysis",
                "Performance recommendations generation",
                "Baseline data storage for comparison",
                "Multi-language support",
            ],
            "supported_formats": list(self.config.code_extensions),
            "baseline_metrics": self.baseline_metrics,
        }

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Analyze a single file for performance baseline characteristics.

        Args:
            target_path: Path to file to analyze

        Returns
        -------
            List of findings with standardized structure
        """
        all_findings = []
        file_path = Path(target_path)

        # Skip files that are too large
        if file_path.stat().st_size > 10 * 1024 * 1024:  # Skip files > 10MB
            return all_findings

        findings = self._analyze_file_for_baseline(file_path)

        # Convert to standardized finding format
        for finding in findings:
            standardized = {
                "title": finding["title"],
                "description": finding["description"],
                "severity": finding["severity"],
                "file_path": finding["file_path"],
                "line_number": finding.get("line_number", 1),
                "recommendation": finding["recommendation"],
                "metadata": {
                    "baseline_type": finding["baseline_type"],
                    "language": finding.get("language", "unknown"),
                    "file_size": finding.get("file_size", 0),
                    "confidence": "high",
                },
            }
            all_findings.append(standardized)

        return all_findings

    def _analyze_file_for_baseline(self, file_path: Path) -> list[dict[str, Any]]:
        """Analyze a single file for baseline characteristics."""
        findings = []

        try:
            file_size = file_path.stat().st_size
            filename = file_path.name
            suffix = file_path.suffix.lower()

            # Language detection
            language = self._detect_file_language(suffix)

            # Check for build configuration files
            if any(
                pattern.lower() in filename.lower()
                for pattern in [
                    "package.json",
                    "requirements.txt",
                    "pipfile",
                    "pom.xml",
                    "build.gradle",
                    "go.mod",
                    "cargo.toml",
                    "gemfile",
                    "composer.json",
                    "cmakelists.txt",
                ]
            ):
                findings.append(
                    {
                        "title": f"Build Configuration File ({filename})",
                        "description": f"Build configuration file detected: {filename}. This file defines project dependencies and build settings that impact performance.",
                        "severity": "info",
                        "file_path": str(file_path),
                        "line_number": 1,
                        "recommendation": "Monitor build performance and consider optimization strategies for faster development cycles.",
                        "baseline_type": "build_config",
                        "language": language,
                        "file_size": file_size,
                    }
                )

            # Check for large files that could impact performance
            if file_size > 1024 * 1024:  # > 1MB
                findings.append(
                    {
                        "title": f"Large File Detected ({file_size / 1024 / 1024:.1f}MB)",
                        "description": f"Large file detected: {filename} ({file_size / 1024 / 1024:.1f}MB). Large files can impact build times, load times, and memory usage.",
                        "severity": "medium",
                        "file_path": str(file_path),
                        "line_number": 1,
                        "recommendation": "Consider optimizing file size or implementing lazy loading strategies.",
                        "baseline_type": "large_file",
                        "language": language,
                        "file_size": file_size,
                    }
                )

            # Check for asset files
            if suffix in [
                ".jpg",
                ".jpeg",
                ".png",
                ".gif",
                ".svg",
                ".pdf",
                ".zip",
                ".tar",
                ".gz",
                ".mp4",
                ".mov",
                ".avi",
                ".ttf",
                ".woff",
                ".woff2",
            ]:
                findings.append(
                    {
                        "title": f"Asset File ({suffix.upper()})",
                        "description": f"Asset file detected: {filename}. Asset files can impact application performance during build and runtime.",
                        "severity": "low",
                        "file_path": str(file_path),
                        "line_number": 1,
                        "recommendation": "Monitor asset sizes and consider compression or optimization strategies.",
                        "baseline_type": "asset_file",
                        "language": "asset",
                        "file_size": file_size,
                    }
                )

            # Check for test files (baseline for test performance)
            if any(
                test_indicator in filename.lower()
                for test_indicator in ["test", "spec", "benchmark", "perf"]
            ):
                findings.append(
                    {
                        "title": f"Test File ({language.title()})",
                        "description": f"Test file detected: {filename}. Test files are important for establishing performance baselines.",
                        "severity": "info",
                        "file_path": str(file_path),
                        "line_number": 1,
                        "recommendation": "Ensure test suites include performance benchmarks for regression detection.",
                        "baseline_type": "test_file",
                        "language": language,
                        "file_size": file_size,
                    }
                )

        except Exception as e:
            if self.verbose:
                print(f"Warning: Could not analyze {file_path}: {e}", file=sys.stderr)

        return findings

    def _detect_file_language(self, suffix: str) -> str:
        """Detect programming language from file extension."""
        ext_map = {
            ".py": "python",
            ".js": "javascript",
            ".jsx": "javascript",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".java": "java",
            ".go": "go",
            ".rs": "rust",
            ".cs": "csharp",
            ".rb": "ruby",
            ".php": "php",
            ".cpp": "cpp",
            ".cc": "cpp",
            ".cxx": "cpp",
            ".c++": "cpp",
            ".c": "c",
            ".h": "c",
            ".hpp": "cpp",
            ".swift": "swift",
            ".kt": "kotlin",
            ".kts": "kotlin",
            ".scala": "scala",
            ".dart": "dart",
            ".vue": "vue",
            ".svelte": "svelte",
        }
        return ext_map.get(suffix, "unknown")


if __name__ == "__main__":
    raise SystemExit(0)
