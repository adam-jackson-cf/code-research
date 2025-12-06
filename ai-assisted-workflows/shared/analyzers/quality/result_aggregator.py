#!/usr/bin/env python3
"""
Analysis Result Aggregation System.

PURPOSE: Unified aggregation and reporting system for comprehensive analysis results,
combining findings from multiple analysis engines (duplicate detection, pattern classification,
security scanning, etc.) into actionable, prioritized reports with correlation analysis.
Part of the analyzers/quality suite for comprehensive result management.

APPROACH:
- Multi-source result aggregation with unified AnalysisResult format
- Priority-based categorization and confidence scoring
- File-level and project-level summary generation
- Cross-analysis correlation and insight detection
- Comprehensive reporting with executive summaries and action plans

DEPENDENCIES:
- code_duplication_analyzer for DuplicateMatch integration
- pattern_classifier for PatternMatch integration
- Python standard library (json, datetime, pathlib, collections)

USE CASES:
- Comprehensive quality assessment report generation
- Multi-dimensional analysis result consolidation
- Executive reporting and actionable insights
- Development team quality dashboards

EXTENDS: BaseAnalyzer for common analyzer infrastructure
- Inherits file scanning, CLI, configuration, and result formatting
- Implements aggregation-specific analysis logic in analyze_target()
- Uses shared timing, logging, and error handling patterns
"""

import json
import logging
import os
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

# Import base analyzer (package root must be on PYTHONPATH)
from core.base.analyzer_base import AnalyzerConfig, BaseAnalyzer
from core.base.analyzer_registry import register_analyzer

try:
    from .pattern_classifier import (
        PatternMatch,
        PatternSeverity,
    )
except ImportError:  # pragma: no cover - fallback for direct execution
    from pattern_classifier import (
        PatternMatch,
        PatternSeverity,
    )

# Provide a lightweight fallback DuplicateMatch type so this module doesn't depend
# on the removed Python-only duplication analyzer.
try:
    # Prefer an import if available (compatibility if legacy module exists)
    from .code_duplication_analyzer import DuplicateMatch
except Exception:  # pragma: no cover
    from dataclasses import dataclass

    @dataclass
    class _Block:
        content: str
        file_path: str
        start_line: int
        end_line: int

    @dataclass
    class DuplicateMatch:
        similarity_score: float
        block1: _Block
        block2: _Block
        match_type: str
        confidence: float
        metadata: dict[str, Any]


# Configure logging
# Only configure basic logging if no handlers exist and use WARNING by default
if not logging.getLogger().handlers:
    log_level_name = os.getenv("CI_LOG_LEVEL", "WARNING").upper()
    log_level = getattr(logging, log_level_name, logging.WARNING)
    logging.basicConfig(level=log_level)
logger = logging.getLogger(__name__)


class AnalysisType(Enum):
    """Types of analysis that can be aggregated."""

    DUPLICATE_DETECTION = "duplicate_detection"
    PATTERN_CLASSIFICATION = "pattern_classification"
    SECURITY_SCAN = "security_scan"
    PERFORMANCE_ANALYSIS = "performance_analysis"
    ARCHITECTURE_ANALYSIS = "architecture_analysis"


class Priority(Enum):
    """Priority levels for analysis findings."""

    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4
    INFO = 5


@dataclass
class AnalysisResult:
    """Unified representation of analysis results."""

    analysis_id: str
    analysis_type: AnalysisType
    file_path: str
    start_line: int
    end_line: int
    title: str
    description: str
    recommendation: str
    priority: Priority
    confidence: float
    code_snippet: str
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        result = asdict(self)
        result["analysis_type"] = self.analysis_type.value
        result["priority"] = self.priority.value
        result["created_at"] = self.created_at.isoformat()
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AnalysisResult":
        """Create from dictionary."""
        data["analysis_type"] = AnalysisType(data["analysis_type"])
        data["priority"] = Priority(data["priority"])
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        return cls(**data)


@dataclass
class FileAnalysisSummary:
    """Summary of analysis results for a single file."""

    file_path: str
    total_issues: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    info_issues: int
    avg_confidence: float
    analysis_types: set[AnalysisType]
    first_analyzed: datetime
    last_analyzed: datetime

    def get_severity_distribution(self) -> dict[str, int]:
        """Get distribution of issues by severity."""
        return {
            "critical": self.critical_issues,
            "high": self.high_issues,
            "medium": self.medium_issues,
            "low": self.low_issues,
            "info": self.info_issues,
        }


@dataclass
class ProjectAnalysisSummary:
    """Summary of analysis results for the entire project."""

    project_path: str
    total_files_analyzed: int
    total_issues: int
    issues_by_priority: dict[Priority, int]
    issues_by_type: dict[AnalysisType, int]
    files_with_issues: int
    avg_confidence: float
    top_problematic_files: list[tuple[str, int]]  # (file_path, issue_count)
    analysis_duration: float  # seconds
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ResultFilter:
    """Parameter object describing how to filter aggregated results."""

    priority: Priority | None = None
    analysis_type: AnalysisType | None = None
    file_path_substring: str | None = None
    min_confidence: float | None = None


class ResultConverter:
    """Converts analysis results from various engines to unified format."""

    @staticmethod
    def convert_duplicate_matches(
        matches: list[DuplicateMatch],
    ) -> list[AnalysisResult]:
        """Convert duplicate detection results to unified format."""
        results = []

        for match in matches:
            # Create result for first block
            result1 = AnalysisResult(
                analysis_id=f"dup_{hash(match.block1.file_path + str(match.block1.start_line))}",
                analysis_type=AnalysisType.DUPLICATE_DETECTION,
                file_path=match.block1.file_path,
                start_line=match.block1.start_line,
                end_line=match.block1.end_line,
                title=f"Duplicate Code ({match.match_type.capitalize()})",
                description=f"Code block is {match.similarity_score:.1%} similar to {match.block2.file_path}:{match.block2.start_line}-{match.block2.end_line}",
                recommendation="Consider extracting common code into a shared function or class",
                priority=ResultConverter._get_duplicate_priority(match),
                confidence=match.confidence,
                code_snippet=match.block1.content[:200] + "..."
                if len(match.block1.content) > 200
                else match.block1.content,
                metadata={
                    "duplicate_location": f"{match.block2.file_path}:{match.block2.start_line}-{match.block2.end_line}",
                    "similarity_score": match.similarity_score,
                    "match_type": match.match_type,
                    **match.metadata,
                },
            )

            # Create result for second block
            result2 = AnalysisResult(
                analysis_id=f"dup_{hash(match.block2.file_path + str(match.block2.start_line))}",
                analysis_type=AnalysisType.DUPLICATE_DETECTION,
                file_path=match.block2.file_path,
                start_line=match.block2.start_line,
                end_line=match.block2.end_line,
                title=f"Duplicate Code ({match.match_type.capitalize()})",
                description=f"Code block is {match.similarity_score:.1%} similar to {match.block1.file_path}:{match.block1.start_line}-{match.block1.end_line}",
                recommendation="Consider extracting common code into a shared function or class",
                priority=ResultConverter._get_duplicate_priority(match),
                confidence=match.confidence,
                code_snippet=match.block2.content[:200] + "..."
                if len(match.block2.content) > 200
                else match.block2.content,
                metadata={
                    "duplicate_location": f"{match.block1.file_path}:{match.block1.start_line}-{match.block1.end_line}",
                    "similarity_score": match.similarity_score,
                    "match_type": match.match_type,
                    **match.metadata,
                },
            )

            results.extend([result1, result2])

        return results

    @staticmethod
    def convert_pattern_matches(matches: list[PatternMatch]) -> list[AnalysisResult]:
        """Convert pattern classification results to unified format."""
        results = []

        for match in matches:
            result = AnalysisResult(
                analysis_id=f"pat_{hash(match.file_path + match.pattern_name + str(match.start_line))}",
                analysis_type=AnalysisType.PATTERN_CLASSIFICATION,
                file_path=match.file_path,
                start_line=match.start_line,
                end_line=match.end_line,
                title=match.pattern_name,
                description=match.description,
                recommendation=match.recommendation,
                priority=ResultConverter._get_pattern_priority(match),
                confidence=match.confidence,
                code_snippet=match.code_snippet,
                metadata={
                    "pattern_type": match.pattern_type.value,
                    "severity": match.severity.value,
                    **match.metadata,
                },
            )
            results.append(result)

        return results

    @staticmethod
    def _get_duplicate_priority(match: DuplicateMatch) -> Priority:
        """Determine priority for duplicate code matches."""
        if match.similarity_score >= 0.95:
            return Priority.HIGH
        elif match.similarity_score >= 0.8:
            return Priority.MEDIUM
        else:
            return Priority.LOW

    @staticmethod
    def _get_pattern_priority(match: PatternMatch) -> Priority:
        """Determine priority for pattern matches."""
        severity_map = {
            PatternSeverity.CRITICAL: Priority.CRITICAL,
            PatternSeverity.HIGH: Priority.HIGH,
            PatternSeverity.MEDIUM: Priority.MEDIUM,
            PatternSeverity.LOW: Priority.LOW,
            PatternSeverity.INFO: Priority.INFO,
        }
        return severity_map.get(match.severity, Priority.LOW)


class ResultCorrelator:
    """Correlates related analysis results for better insights."""

    def __init__(self):
        self.correlation_rules = [
            self._correlate_duplicates_and_patterns,
            self._correlate_file_hotspots,
            self._correlate_similar_issues,
        ]

    def correlate_results(
        self, results: list[AnalysisResult]
    ) -> dict[str, list[AnalysisResult]]:
        """Find correlated results and group them."""
        correlations = {}

        for rule in self.correlation_rules:
            try:
                correlations.update(rule(results))
            except Exception as e:
                logger.debug(f"Correlation rule error: {e}")

        return correlations

    def _correlate_duplicates_and_patterns(
        self, results: list[AnalysisResult]
    ) -> dict[str, list[AnalysisResult]]:
        """Find files that have both duplicates and patterns."""
        correlations = {}

        # Group by file
        file_results = defaultdict(list)
        for result in results:
            file_results[result.file_path].append(result)

        # Find files with multiple issue types
        for file_path, file_results_list in file_results.items():
            analysis_types = {result.analysis_type for result in file_results_list}

            if (
                AnalysisType.DUPLICATE_DETECTION in analysis_types
                and AnalysisType.PATTERN_CLASSIFICATION in analysis_types
            ):
                correlations[f"multi_issue_file:{file_path}"] = file_results_list

        return correlations

    def _correlate_file_hotspots(
        self, results: list[AnalysisResult]
    ) -> dict[str, list[AnalysisResult]]:
        """Identify files with many issues (hotspots)."""
        correlations = {}

        # Count issues per file
        file_issue_counts = Counter(result.file_path for result in results)

        # Find hotspots (files with more than 5 issues)
        for file_path, count in file_issue_counts.items():
            if count >= 5:
                hotspot_results = [r for r in results if r.file_path == file_path]
                correlations[f"hotspot:{file_path}"] = hotspot_results

        return correlations

    def _correlate_similar_issues(
        self, results: list[AnalysisResult]
    ) -> dict[str, list[AnalysisResult]]:
        """Find similar issues across different files."""
        correlations = {}

        # Group by title/issue type
        title_groups = defaultdict(list)
        for result in results:
            title_groups[result.title].append(result)

        # Find recurring issues (same issue in multiple files)
        for title, title_results in title_groups.items():
            if len(title_results) >= 3:  # Same issue in 3+ files
                files = {result.file_path for result in title_results}
                if len(files) >= 2:  # Ensure it's across different files
                    correlations[f"recurring_issue:{title}"] = title_results

        return correlations


@register_analyzer("quality:aggregate")
class AnalysisAggregator(BaseAnalyzer):
    """Main aggregator that combines and organizes analysis results extending BaseAnalyzer infrastructure."""

    def __init__(self, config: AnalyzerConfig | None = None):
        # Create result aggregation-specific configuration
        aggregation_config = config or AnalyzerConfig(
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
                ".json",
                ".yaml",
                ".yml",
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
                "migrations",
                "test",
                "tests",
                "__tests__",
                "spec",
                "specs",
            },
        )

        # Initialize base analyzer
        super().__init__("quality", aggregation_config)

        # Initialize aggregation-specific components
        self.converter = ResultConverter()
        self.correlator = ResultCorrelator()
        self.results: list[AnalysisResult] = []

    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Implement result aggregation analysis logic for target path.

        Args:
            target_path: Path to analyze (single file - BaseAnalyzer handles directory iteration)

        Returns
        -------
            List of aggregation findings with summary statistics
        """
        target = Path(target_path)

        if target.is_file():
            try:
                relative_path = str(target.relative_to(Path.cwd()))
            except ValueError:
                relative_path = str(target)

            return self._analyze_file_aggregation(str(target), relative_path)

        return []

    def get_analyzer_metadata(self) -> dict[str, Any]:
        """
        Get result aggregator-specific metadata.

        Returns
        -------
            Dictionary with analyzer-specific metadata
        """
        return {
            "analysis_type": "result_aggregation",
            "aggregation_capabilities": {
                "duplicate_analysis": "DuplicateMatch integration and conversion",
                "pattern_analysis": "PatternMatch integration and conversion",
                "custom_analysis": "AnalysisResult direct integration",
                "correlation_analysis": "Cross-analysis correlation detection",
                "priority_classification": "Multi-level priority assignment",
            },
            "result_formats": {
                "analysis_result": "Unified AnalysisResult format",
                "file_summaries": "Per-file analysis summaries",
                "project_summaries": "Project-wide analysis summaries",
                "executive_reports": "High-level executive summaries",
                "action_plans": "Prioritized action recommendations",
            },
            "priority_levels": [p.name.lower() for p in Priority],
            "analysis_types": [at.value for at in AnalysisType],
            "supported_languages": [
                "Python",
                "JavaScript",
                "TypeScript",
                "Java",
                "C#",
                "PHP",
                "Ruby",
                "Go",
                "Rust",
                "C++",
                "C",
                "Swift",
                "Kotlin",
                "Scala",
                "Dart",
                "Vue",
                "JSON",
                "YAML",
            ],
            "dependencies": [
                "pattern_classifier",
                "Python standard library (json, datetime, pathlib, collections)",
            ],
            "use_cases": [
                "Comprehensive quality assessment report generation",
                "Multi-dimensional analysis result consolidation",
                "Executive reporting and actionable insights",
                "Development team quality dashboards",
            ],
        }

    def _analyze_file_aggregation(
        self, file_path: str, relative_path: str
    ) -> list[dict[str, Any]]:
        """Analyze aggregation capabilities and generate summary for a single file."""
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

            if not content.strip():
                return []

            findings = []

            # Generate aggregation metadata for this file
            # Since this is a result aggregator, we provide information about aggregation capabilities
            # rather than analyzing the file content directly

            findings.append(
                {
                    "title": "result_aggregation",
                    "severity": "info",
                    "description": "File ready for result aggregation analysis",
                    "file_path": relative_path,
                    "line_number": 1,
                    "recommendation": "File is ready to be analyzed by result aggregation system",
                    "metadata": {
                        "total_lines": len(content.splitlines()),
                        "file_size_bytes": len(content),
                        "aggregation_ready": True,
                        "supported_formats": [
                            "DuplicateMatch",
                            "PatternMatch",
                            "AnalysisResult",
                        ],
                        "aggregation_capabilities": {
                            "priority_classification": "5-level priority system (CRITICAL to INFO)",
                            "correlation_detection": "Cross-file pattern correlation",
                            "summary_generation": "File and project-level summaries",
                            "executive_reporting": "High-level insights and action plans",
                        },
                    },
                }
            )

            return findings

        except Exception as e:
            logger.error(f"Error analyzing file {file_path}: {e}")
            return [
                {
                    "title": "analysis_error",
                    "severity": "low",
                    "description": f"Failed to analyze file: {str(e)}",
                    "file_path": relative_path,
                    "line_number": 1,
                    "recommendation": "Check file permissions and encoding, then retry analysis",
                    "metadata": {"error_type": type(e).__name__},
                }
            ]

    def add_duplicate_analysis(self, matches: list[DuplicateMatch]) -> None:
        """Add duplicate detection results."""
        converted = self.converter.convert_duplicate_matches(matches)
        self.results.extend(converted)
        logger.info(f"Added {len(converted)} duplicate analysis results")

    def add_pattern_analysis(self, matches: list[PatternMatch]) -> None:
        """Add pattern classification results."""
        converted = self.converter.convert_pattern_matches(matches)
        self.results.extend(converted)
        logger.info(f"Added {len(converted)} pattern analysis results")

    def add_custom_analysis(self, results: list[AnalysisResult]) -> None:
        """Add custom analysis results."""
        self.results.extend(results)
        logger.info(f"Added {len(results)} custom analysis results")

    def generate_file_summaries(self) -> dict[str, FileAnalysisSummary]:
        """Generate summaries for each file."""
        file_summaries = {}

        # Group results by file
        file_groups = defaultdict(list)
        for result in self.results:
            file_groups[result.file_path].append(result)

        # Create summaries
        for file_path, file_results in file_groups.items():
            # Count by priority
            priority_counts = Counter(result.priority for result in file_results)

            # Calculate statistics
            confidences = [result.confidence for result in file_results]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

            analysis_types = {result.analysis_type for result in file_results}
            timestamps = [result.created_at for result in file_results]

            summary = FileAnalysisSummary(
                file_path=file_path,
                total_issues=len(file_results),
                critical_issues=priority_counts.get(Priority.CRITICAL, 0),
                high_issues=priority_counts.get(Priority.HIGH, 0),
                medium_issues=priority_counts.get(Priority.MEDIUM, 0),
                low_issues=priority_counts.get(Priority.LOW, 0),
                info_issues=priority_counts.get(Priority.INFO, 0),
                avg_confidence=avg_confidence,
                analysis_types=analysis_types,
                first_analyzed=min(timestamps),
                last_analyzed=max(timestamps),
            )

            file_summaries[file_path] = summary

        return file_summaries

    def generate_project_summary(self) -> ProjectAnalysisSummary:
        """Generate overall project summary."""
        if not self.results:
            return ProjectAnalysisSummary(
                project_path="",
                total_files_analyzed=0,
                total_issues=0,
                issues_by_priority={},
                issues_by_type={},
                files_with_issues=0,
                avg_confidence=0.0,
                top_problematic_files=[],
                analysis_duration=0.0,
            )

        # Count by priority and type
        priority_counts = Counter(result.priority for result in self.results)
        type_counts = Counter(result.analysis_type for result in self.results)

        # Calculate statistics
        unique_files = {result.file_path for result in self.results}
        confidences = [result.confidence for result in self.results]
        avg_confidence = sum(confidences) / len(confidences)

        # Top problematic files
        file_issue_counts = Counter(result.file_path for result in self.results)
        top_files = file_issue_counts.most_common(10)

        # Determine project path
        project_path = str(Path.cwd()) if unique_files else ""

        return ProjectAnalysisSummary(
            project_path=project_path,
            total_files_analyzed=len(unique_files),
            total_issues=len(self.results),
            issues_by_priority=dict(priority_counts),
            issues_by_type=dict(type_counts),
            files_with_issues=len(unique_files),
            avg_confidence=avg_confidence,
            top_problematic_files=top_files,
            analysis_duration=0.0,  # Would be calculated by timing the analysis
        )

    def get_filtered_results(
        self, filters: ResultFilter | None = None
    ) -> list[AnalysisResult]:
        """Get filtered analysis results."""
        filters = filters or ResultFilter()

        filtered = self.results

        if filters.priority is not None:
            filtered = [r for r in filtered if r.priority == filters.priority]

        if filters.analysis_type is not None:
            filtered = [r for r in filtered if r.analysis_type == filters.analysis_type]

        if filters.file_path_substring:
            filtered = [
                r for r in filtered if filters.file_path_substring in r.file_path
            ]

        if filters.min_confidence is not None:
            filtered = [r for r in filtered if r.confidence >= filters.min_confidence]

        return filtered

    def get_top_issues(self, limit: int = 10) -> list[AnalysisResult]:
        """Get top issues sorted by priority and confidence."""
        priority_order = {p: i for i, p in enumerate(Priority)}

        sorted_results = sorted(
            self.results, key=lambda r: (priority_order[r.priority], -r.confidence)
        )

        return sorted_results[:limit]

    def export_results(
        self, output_format: str = "json", output_path: str | None = None
    ) -> str:
        """Export results in specified format."""
        export_format = output_format.lower()
        if export_format == "json":
            return self._export_json(output_path)
        elif export_format == "csv":
            return self._export_csv(output_path)
        else:
            raise ValueError(f"Unsupported export format: {output_format}")

    def _export_json(self, output_path: str | None) -> str:
        """Export results as JSON."""
        data = {
            "project_summary": self._make_json_serializable(
                asdict(self.generate_project_summary())
            ),
            "file_summaries": {
                k: self._make_json_serializable(asdict(v))
                for k, v in self.generate_file_summaries().items()
            },
            "results": [
                self._make_json_serializable(result.to_dict())
                for result in self.results
            ],
            "correlations": self._make_json_serializable(
                self.correlator.correlate_results(self.results)
            ),
        }

        # Convert enums and other non-serializable objects
        json_data = json.dumps(data, default=str, indent=2)

        if output_path:
            Path(output_path).write_text(json_data)
            logger.info(f"Results exported to {output_path}")

        return json_data

    def _make_json_serializable(self, obj):
        """Recursively convert enum keys and values to strings for JSON serialization."""
        if isinstance(obj, dict):
            # Convert enum keys to strings and recursively process values
            return {
                str(k) if isinstance(k, Enum) else k: self._make_json_serializable(v)
                for k, v in obj.items()
            }
        elif isinstance(obj, list):
            return [self._make_json_serializable(item) for item in obj]
        elif isinstance(obj, Enum):
            return str(obj)
        else:
            return obj

    def _export_csv(self, output_path: str | None) -> str:
        """Export results as CSV."""
        import csv
        import io

        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=[
                "file_path",
                "line_start",
                "line_end",
                "title",
                "priority",
                "confidence",
                "analysis_type",
                "description",
                "recommendation",
            ],
        )

        writer.writeheader()
        for result in self.results:
            writer.writerow(
                {
                    "file_path": result.file_path,
                    "line_start": result.start_line,
                    "line_end": result.end_line,
                    "title": result.title,
                    "priority": result.priority.name,
                    "confidence": f"{result.confidence:.2f}",
                    "analysis_type": result.analysis_type.value,
                    "description": result.description,
                    "recommendation": result.recommendation,
                }
            )

        csv_data = output.getvalue()
        output.close()

        if output_path:
            Path(output_path).write_text(csv_data)
            logger.info(f"Results exported to {output_path}")

        return csv_data


class ComprehensiveAnalysisReport:
    """Generates comprehensive, actionable analysis reports."""

    def __init__(self, aggregator: AnalysisAggregator):
        self.aggregator = aggregator
        self.project_summary = aggregator.generate_project_summary()
        self.file_summaries = aggregator.generate_file_summaries()
        self.correlations = aggregator.correlator.correlate_results(aggregator.results)

    def generate_executive_summary(self) -> str:
        """Generate high-level executive summary."""
        summary = f"""
Code Quality Analysis - Executive Summary
========================================

Project Analysis Overview:
- Files Analyzed: {self.project_summary.total_files_analyzed}
- Total Issues Found: {self.project_summary.total_issues}
- Average Confidence: {self.project_summary.avg_confidence:.1%}

Issue Breakdown by Priority:
"""

        for priority, count in self.project_summary.issues_by_priority.items():
            summary += f"  {priority.name}: {count}\n"

        summary += """
Analysis Types Performed:
"""
        for analysis_type, count in self.project_summary.issues_by_type.items():
            summary += f"  {analysis_type.value.replace('_', ' ').title()}: {count}\n"

        # Top problematic files
        if self.project_summary.top_problematic_files:
            summary += "\nMost Problematic Files:\n"
            for file_path, count in self.project_summary.top_problematic_files[:5]:
                summary += f"  {file_path}: {count} issues\n"

        return summary

    def generate_detailed_report(self) -> str:
        """Generate detailed technical report."""
        report = self.generate_executive_summary()

        # Top critical issues
        critical_issues = self.aggregator.get_filtered_results(
            ResultFilter(priority=Priority.CRITICAL)
        )
        if critical_issues:
            report += f"\n\nCRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION ({len(critical_issues)}):\n"
            report += "=" * 60 + "\n"

            for i, issue in enumerate(critical_issues[:10], 1):
                report += f"\n{i}. {issue.title}\n"
                report += (
                    f"   File: {issue.file_path}:{issue.start_line}-{issue.end_line}\n"
                )
                report += f"   Confidence: {issue.confidence:.1%}\n"
                report += f"   Description: {issue.description}\n"
                report += f"   Recommendation: {issue.recommendation}\n"

        # Correlation insights
        if self.correlations:
            report += "\n\nCORRELATED ISSUES & INSIGHTS:\n"
            report += "=" * 40 + "\n"

            for correlation_name, correlated_results in list(self.correlations.items())[
                :5
            ]:
                report += f"\n{correlation_name}:\n"
                report += f"  Related Issues: {len(correlated_results)}\n"

                if "hotspot" in correlation_name:
                    report += "  This file appears to be a quality hotspot requiring refactoring.\n"
                elif "recurring_issue" in correlation_name:
                    report += "  This issue pattern appears across multiple files.\n"
                elif "multi_issue" in correlation_name:
                    report += "  This file has multiple types of quality issues.\n"

        return report

    def generate_action_plan(self) -> str:
        """Generate prioritized action plan."""
        plan = """
PRIORITIZED ACTION PLAN
=====================

Based on the analysis results, here's a recommended action plan:

"""

        # Critical actions
        critical_issues = self.aggregator.get_filtered_results(
            ResultFilter(priority=Priority.CRITICAL)
        )
        if critical_issues:
            plan += f"IMMEDIATE ACTIONS (Critical - {len(critical_issues)} issues):\n"
            plan += "1. Address all security vulnerabilities\n"
            plan += "2. Fix hardcoded secrets and credentials\n"
            plan += "3. Resolve dangerous code execution patterns\n\n"

        # High priority actions
        high_issues = self.aggregator.get_filtered_results(
            ResultFilter(priority=Priority.HIGH)
        )
        if high_issues:
            plan += f"SHORT-TERM ACTIONS (High Priority - {len(high_issues)} issues):\n"
            plan += "1. Refactor God classes and long methods\n"
            plan += "2. Address SQL injection risks\n"
            plan += "3. Remove exact code duplicates\n\n"

        # Medium priority actions
        medium_issues = self.aggregator.get_filtered_results(
            ResultFilter(priority=Priority.MEDIUM)
        )
        if medium_issues:
            plan += f"MEDIUM-TERM ACTIONS (Medium Priority - {len(medium_issues)} issues):\n"
            plan += "1. Improve code organization and structure\n"
            plan += "2. Reduce structural code duplication\n"
            plan += "3. Address code smells and anti-patterns\n\n"

        # File-specific recommendations
        if self.project_summary.top_problematic_files:
            plan += "FILE-SPECIFIC RECOMMENDATIONS:\n"
            for file_path, count in self.project_summary.top_problematic_files[:3]:
                plan += f"  {file_path} ({count} issues):\n"
                plan += "    - Consider comprehensive refactoring\n"
                plan += "    - Break into smaller, more focused modules\n"
                plan += "    - Add unit tests before refactoring\n\n"

        return plan


# Legacy function for backward compatibility
def aggregate_analysis_results(
    target_path: str,
    output_format: str = "json",
    analysis_results: list[AnalysisResult] | None = None,
) -> dict[str, Any]:
    """
    Legacy function wrapper for backward compatibility.

    Args:
        target_path: Path to analyze
        output_format: Output format (json, console, summary)
        analysis_results: Optional list of pre-computed analysis results

    Returns
    -------
        Analysis results
    """
    try:
        config = AnalyzerConfig(target_path=target_path, output_format=output_format)

        analyzer = AnalysisAggregator(config=config)

        # Add any provided analysis results
        if analysis_results:
            analyzer.add_custom_analysis(analysis_results)

        # Use BaseAnalyzer's analyze for full directory analysis
        results = analyzer.analyze()

        # Convert AnalysisResult to dict for backward compatibility
        return {
            "success": results.success if hasattr(results, "success") else True,
            "findings": [
                finding.__dict__ if hasattr(finding, "__dict__") else finding
                for finding in (
                    results.findings if hasattr(results, "findings") else []
                )
            ],
            "metadata": results.metadata if hasattr(results, "metadata") else {},
            "execution_time": results.execution_time
            if hasattr(results, "execution_time")
            else 0,
        }

    except Exception as e:
        logger.error(f"Error in legacy result aggregation: {e}")
        return {"success": False, "error": str(e), "findings": []}


if __name__ == "__main__":
    # CLI removed; this module is intended to be invoked via the orchestration layer
    sys.exit(0)
