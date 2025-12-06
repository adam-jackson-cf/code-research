#!/usr/bin/env python3
"""
BaseAnalyzer - Shared Infrastructure for Analysis Tools.

PURPOSE: Abstract base class providing common functionality for all analysis tools.
Part of the shared/analyzers/ suite - eliminates duplication across analysis categories.

ELIMINATES DUPLICATION FROM:
- Manual sys.path manipulation and import setup across 20+ analyzer files
- Individual utility imports (ResultFormatter, TechStackDetector, PlatformDetector)
- Duplicated CLI argument parsing and error handling patterns
- Repeated file scanning and filtering logic
- Inconsistent result formatting and metadata handling

PROVIDES SHARED INFRASTRUCTURE:
- Automatic import path setup and common utility access
- Standardized configuration management via AnalyzerConfig
- File scanning with configurable extensions and skip patterns
- CLI interface with consistent argument parsing
- Result formatting and error handling
- Performance timing and logging
- Abstract interface for specific analysis implementations

EXTENDS: Similar to BaseProfiler but for general analysis tools
- Uses same architectural patterns and infrastructure approach
- Supports all analysis categories: security, quality, architecture, performance, root_cause
- Abstract interface for specific analysis implementations
"""

import fnmatch
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .module_base import CIAnalysisModule
from .validation_rules import (
    FieldTypesRule,
    PathAndLineRules,
    PlaceholderRule,
    RequiredFieldsRule,
    SeverityRule,
    ValidationRule,
)
from .vendor_detector import VendorDetector


@dataclass
class AnalyzerConfig:
    """Standard configuration for all analyzers with validation."""

    # Core settings
    target_path: str = "."
    output_format: str = "json"
    min_severity: str = "high"
    summary_mode: bool = False

    # File filtering
    code_extensions: set[str] = field(
        default_factory=lambda: {
            ".py",
            ".js",
            ".ts",
            ".java",
            ".cs",
            ".php",
            ".rb",
            ".go",
            ".sql",
            ".prisma",
            ".kt",
            ".scala",
            ".cpp",
            ".c",
            ".h",
            ".hpp",
            ".swift",
            ".rs",
            ".dart",
            ".vue",
            ".jsx",
            ".tsx",
            ".xml",
            ".json",
            ".yml",
            ".yaml",
        }
    )

    skip_patterns: set[str] = field(
        default_factory=lambda: {
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
            ".cache",
            ".tmp",
            "temp",
            "logs",
            "bin",
            "obj",
            "Debug",
            "Release",
        }
    )
    gitignore_patterns: list[str] = field(default_factory=list)
    exclude_globs: set[str] = field(default_factory=set)

    # Analysis settings
    max_files: int | None = None
    max_file_size_mb: int = 5
    batch_size: int = 200
    timeout_seconds: int | None = None

    # Severity filtering
    severity_thresholds: dict[str, float] = field(
        default_factory=lambda: {
            "critical": 0.9,
            "high": 0.7,
            "medium": 0.5,
            "low": 0.3,
        }
    )

    def __post_init__(self):
        """Validate configuration after initialization."""
        self._validate_config()

    def _validate_config(self):
        """Validate configuration values."""
        if self.max_files is not None and self.max_files <= 0:
            raise ValueError("max_files must be positive")
        if self.max_file_size_mb <= 0:
            raise ValueError("max_file_size_mb must be positive")
        if self.batch_size <= 0:
            raise ValueError("batch_size must be positive")
        if self.timeout_seconds is not None and self.timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")

        valid_formats = {"json", "console", "summary"}
        if self.output_format not in valid_formats:
            raise ValueError(f"output_format must be one of: {valid_formats}")

        valid_severities = {"critical", "high", "medium", "low"}
        if self.min_severity not in valid_severities:
            raise ValueError(f"min_severity must be one of: {valid_severities}")


class BaseAnalyzer(CIAnalysisModule, ABC):
    """
    Abstract base class for all analysis tools.

    Provides common infrastructure:
    - File scanning and filtering
    - Configuration management
    - CLI interface
    - Result formatting
    - Timing and logging
    - Error handling
    """

    def __init__(self, analyzer_type: str, config: AnalyzerConfig | None = None):
        super().__init__(f"{analyzer_type}_analyzer")

        self.analyzer_type = analyzer_type
        self.config = config or AnalyzerConfig()

        # Initialize common utilities (available from CIAnalysisModule)
        self.analysis_root = self._determine_analysis_root(
            Path(self.config.target_path)
        )
        self.tech_detector = self.TechStackDetector()

        # Initialize vendor detector with project root
        project_root = self.analysis_root if self.analysis_root.exists() else None
        self.vendor_detector = VendorDetector(project_root)
        self._gitignore_spec = self._build_gitignore_spec()
        self._exclude_globs = set(getattr(self.config, "exclude_globs", set()))

        # Analysis tracking
        self.files_processed = 0
        self.files_skipped = 0
        self.processing_errors = 0

        self.log_operation(
            "analyzer_initialized",
            {
                "type": analyzer_type,
                "max_files": self.config.max_files,
                "extensions": len(self.config.code_extensions),
            },
        )

    @abstractmethod
    def analyze_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Implement specific analysis logic for the target path.

        Args:
            target_path: Path to analyze

        Returns
        -------
            List of analysis findings as dictionaries
        """
        pass

    @abstractmethod
    def get_analyzer_metadata(self) -> dict[str, Any]:
        """
        Get analyzer-specific metadata for results.

        Returns
        -------
            Dictionary with analyzer-specific metadata
        """
        pass

    def should_scan_file(self, file_path: Path) -> bool:
        """
        Determine if file should be scanned based on configuration.

        Args:
            file_path: Path to check

        Returns
        -------
            True if file should be scanned
        """
        # Check if file path matches any skip patterns
        for skip_pattern in self.config.skip_patterns:
            # Check individual path parts for exact matches only
            if skip_pattern in file_path.parts:
                return False

        if self._matches_exclude_globs(file_path):
            return False

        if self._is_gitignored(file_path):
            return False

        # Enhanced skip pattern checking for dot directories and paths
        path_str = str(file_path).lower()
        path_parts = file_path.parts

        # Skip common build/cache directories that might not be in skip_patterns
        skip_path_patterns = [
            ".angular",
            ".next",
            ".nuxt",
            ".cache",
            ".tmp",
            "tmp",
            "cache",
            "generated",
            "__generated__",
            "auto",
            "node_modules/.cache",
            "dist/cache",
            "build/cache",
        ]

        for skip_pattern in skip_path_patterns:
            if skip_pattern in path_str or skip_pattern in path_parts:
                self.log_operation(
                    "file_skipped_pattern",
                    {"file": str(file_path), "pattern": skip_pattern},
                )
                return False

        # Check file extension
        suffix = file_path.suffix.lower()
        if suffix not in self.config.code_extensions:
            return False

        # Check file size
        try:
            file_size_mb = file_path.stat().st_size / (1024 * 1024)
            if file_size_mb > self.config.max_file_size_mb:
                self.log_operation(
                    "file_skipped_size",
                    {"file": str(file_path), "size_mb": round(file_size_mb, 2)},
                )
                return False
        except (OSError, FileNotFoundError):
            return False

        # Check for vendor/third-party code using vendor detector
        if self.vendor_detector.should_exclude_file(file_path):
            vendor_detection = self.vendor_detector.detect_vendor_code(file_path)
            self.log_operation(
                "file_skipped_vendor",
                {
                    "file": str(file_path),
                    "confidence": vendor_detection.confidence,
                    "reasons": vendor_detection.reasons[:2],  # Limit to first 2 reasons
                    "detected_library": vendor_detection.detected_library,
                },
            )
            return False

        return True

    def _matches_exclude_globs(self, file_path: Path) -> bool:
        """Return True if file_path matches configured exclusion globs."""
        if not self._exclude_globs:
            return False

        relative_path = self._relative_path_str(file_path)
        for pattern in self._exclude_globs:
            if fnmatch.fnmatch(relative_path, pattern) or fnmatch.fnmatch(
                file_path.name, pattern
            ):
                self.log_operation(
                    "file_skipped_pattern",
                    {"file": str(file_path), "pattern": pattern},
                )
                return True
        return False

    def _is_gitignored(self, file_path: Path) -> bool:
        """Return True if gitignore patterns exclude the file."""
        if not self._gitignore_spec:
            return False

        relative_path = self._relative_path_str(file_path)
        if self._gitignore_spec.match_file(relative_path):
            self.log_operation(
                "file_skipped_gitignore",
                {"file": str(file_path), "relative_path": relative_path},
            )
            return True
        return False

    def _relative_path_str(self, file_path: Path) -> str:
        """Return the file path relative to the analysis root for matching."""
        try:
            return str(file_path.resolve().relative_to(self.analysis_root))
        except Exception:
            return str(file_path)

    def _determine_analysis_root(self, target_path: Path) -> Path:
        """Best-effort determination of the root directory for analysis."""
        try:
            resolved = target_path.resolve()
        except FileNotFoundError:
            return Path.cwd()
        except Exception:
            return Path.cwd()

        if resolved.is_dir():
            return resolved
        if resolved.is_file():
            return resolved.parent
        return Path.cwd()

    def _build_gitignore_spec(self):
        """Compile gitignore patterns into a PathSpec matcher if available."""
        patterns = getattr(self.config, "gitignore_patterns", [])
        if not patterns:
            return None

        try:
            from pathspec import PathSpec
        except ImportError:
            self.log_operation(
                "gitignore_spec_unavailable",
                {"reason": "pathspec_not_installed"},
            )
            return None

        try:
            return PathSpec.from_lines("gitwildmatch", patterns)
        except Exception as exc:
            self.log_operation(
                "gitignore_spec_failed",
                {"error": str(exc)},
            )
            return None

    def scan_directory(self, target_path: str) -> list[Path]:
        """
        Scan directory for files matching analyzer criteria.

        Args:
            target_path: Directory to scan

        Returns
        -------
            List of file paths to analyze
        """
        target = Path(target_path)
        files_to_scan = []

        if target.is_file():
            if self.should_scan_file(target):
                files_to_scan.append(target)
        elif target.is_dir():
            for file_path in target.rglob("*"):
                if (
                    self.config.max_files is not None
                    and len(files_to_scan) >= self.config.max_files
                ):
                    self.log_operation(
                        "max_files_reached", {"limit": self.config.max_files}
                    )
                    break

                if file_path.is_file() and self.should_scan_file(file_path):
                    files_to_scan.append(file_path)

        self.log_operation(
            "directory_scanned",
            {"target": target_path, "files_found": len(files_to_scan)},
        )

        return files_to_scan

    def process_files_batch(self, files: list[Path]) -> list[dict[str, Any]]:
        """
        Process files in batches for memory efficiency.

        Args:
            files: List of files to process

        Returns
        -------
            Combined findings from all files
        """
        all_findings = []

        for i in range(0, len(files), self.config.batch_size):
            batch = files[i : i + self.config.batch_size]
            batch_findings = self._process_batch(batch)
            all_findings.extend(batch_findings)

            self.log_operation(
                "batch_processed",
                {
                    "batch_number": (i // self.config.batch_size) + 1,
                    "files_in_batch": len(batch),
                    "findings": len(batch_findings),
                },
            )

        return all_findings

    def _process_batch(self, batch: list[Path]) -> list[dict[str, Any]]:
        """Process a single batch of files."""
        batch_findings = []

        for file_path in batch:
            try:
                # Call the specific analyzer implementation
                file_findings = self.analyze_target(str(file_path))
                batch_findings.extend(file_findings)
                self.files_processed += 1

            except Exception as e:
                self.processing_errors += 1
                self.logger.warning(f"Error processing {file_path}: {e}")

        return batch_findings

    def analyze(self, target_path: str | None = None) -> Any:
        """
        Run main analysis entry point with full analysis pipeline.

        Args:
            target_path: Path to analyze (uses config.target_path if None)

        Returns
        -------
            AnalysisResult object with findings and metadata
        """
        self.start_analysis()

        analyze_path = target_path or self.config.target_path
        result = self.create_result("analysis")

        try:
            # Scan for files to analyze
            files_to_analyze = self.scan_directory(analyze_path)

            if not files_to_analyze:
                # Add info as metadata instead of calling non-existent add_info method
                result.metadata["info"] = "No files found matching analyzer criteria"
                return self.complete_analysis(result)

            # Process files in batches
            all_findings = self.process_files_batch(files_to_analyze)

            # Convert findings to Finding objects
            self._add_findings_to_result(result, all_findings)

            # Add comprehensive metadata
            self._add_metadata_to_result(
                result, analyze_path, files_to_analyze, all_findings
            )

        except Exception as e:
            result.set_error(f"{self.analyzer_type} analysis failed: {str(e)}")
            self.logger.error(f"Analysis failed: {e}")

        return self.complete_analysis(result)

    def _add_findings_to_result(
        self, result: Any, findings: list[dict[str, Any]]
    ) -> None:
        """Convert raw findings to Finding objects and add to result."""
        finding_id = 1

        for finding_data in findings:
            try:
                # Create Finding object - require all fields to be present
                finding = self.ResultFormatter.create_finding(
                    self.ResultFormatter.FindingInput(
                        finding_id=f"{self.analyzer_type.upper()}{finding_id:03d}",
                        title=finding_data["title"],
                        description=finding_data["description"],
                        severity=finding_data["severity"],
                        file_path=finding_data["file_path"],
                        line_number=finding_data["line_number"],
                        recommendation=finding_data["recommendation"],
                        evidence=finding_data.get("metadata", {}),
                    )
                )

                result.add_finding(finding)
                finding_id += 1

            except KeyError as e:
                self.logger.error(
                    f"Missing required field in finding {finding_id}: {e}"
                )
                self.logger.error(f"Finding data keys: {list(finding_data.keys())}")
                raise ValueError(
                    f"Analyzer {self.analyzer_type} returned finding missing required field: {e}"
                ) from e
            except Exception as e:
                self.logger.error(f"Error creating finding {finding_id}: {e}")
                raise

    def _add_metadata_to_result(
        self,
        result: Any,
        target_path: str,
        files: list[Path],
        findings: list[dict[str, Any]],
    ) -> None:
        """Add comprehensive metadata to result."""
        analyzer_metadata = self.get_analyzer_metadata()

        result.metadata = {
            "analyzer_type": self.analyzer_type,
            "target_path": target_path,
            "files_analyzed": len(files),
            "files_processed": self.files_processed,
            "files_skipped": self.files_skipped,
            "processing_errors": self.processing_errors,
            "total_findings": len(findings),
            "severity_breakdown": self._calculate_severity_breakdown(findings),
            "analyzer_config": {
                "max_files": self.config.max_files,
                "max_file_size_mb": self.config.max_file_size_mb,
                "extensions_count": len(self.config.code_extensions),
                "skip_patterns_count": len(self.config.skip_patterns),
            },
            **analyzer_metadata,
        }

    def _calculate_severity_breakdown(
        self, findings: list[dict[str, Any]]
    ) -> dict[str, int]:
        """Calculate breakdown of findings by severity."""
        breakdown = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}

        for finding in findings:
            severity = finding.get("severity", "medium")
            if severity in breakdown:
                breakdown[severity] += 1

        return breakdown

    # CLI functionality removed: analyzers are orchestrated by agents/commands in this project


def create_analyzer_config(**kwargs) -> AnalyzerConfig:
    """
    Create an AnalyzerConfig with validation.

    Args:
        **kwargs: Configuration parameters

    Returns
    -------
        Validated AnalyzerConfig instance
    """
    # ConfigFactory.create() expects a registered type; AnalyzerConfig is direct here
    return AnalyzerConfig(**kwargs)


# Standardized Helper Functions for Finding Creation and Validation


def create_standard_finding(
    title: str,
    description: str,
    severity: str,
    file_path: str,
    line_number: int,
    recommendation: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Create a properly formatted finding for BaseAnalyzer/BaseProfiler.

    This function ensures all findings have the required fields with proper naming
    and validation, preventing common implementation errors.

    Args:
        title: Human-readable finding title (specific, not generic like "security finding")
        description: Detailed description of the issue (specific, not "Analysis issue detected")
        severity: One of "critical", "high", "medium", "low", "info"
        file_path: Path to the affected file (actual path, not "unknown")
        line_number: Line number where issue occurs (actual line, not 0)
        recommendation: Suggested action to take (specific, not "Review issue")
        metadata: Additional context (optional)

    Returns
    -------
        Properly formatted finding dictionary with all required fields

    Raises
    ------
        ValueError: If severity is invalid or required fields are empty

    Example:
        finding = create_standard_finding(
            title="SQL Injection Vulnerability",
            description="Unsanitized user input used in SQL query construction",
            severity="high",
            file_path="models/user.py",
            line_number=42,
            recommendation="Use parameterized queries or ORM methods",
            metadata={"pattern_type": "sql_injection", "confidence": 0.9}
        )
    """
    # Validate severity
    valid_severities = {"critical", "high", "medium", "low", "info"}
    if severity not in valid_severities:
        raise ValueError(
            f"Invalid severity '{severity}'. Must be one of: {valid_severities}"
        )

    # Validate required fields are not empty/generic
    if not title or title.strip() == "":
        raise ValueError("Title cannot be empty")
    if not description or description.strip() == "":
        raise ValueError("Description cannot be empty")
    if not recommendation or recommendation.strip() == "":
        raise ValueError("Recommendation cannot be empty")

    # Check for generic placeholder values
    generic_titles = {
        "security finding",
        "quality finding",
        "performance finding",
        "analysis finding",
    }
    if title.lower() in generic_titles:
        raise ValueError(
            f"Generic title '{title}' not allowed. Provide specific finding title."
        )

    generic_descriptions = {
        "analysis issue detected",
        "issue found",
        "problem detected",
    }
    if description.lower() in generic_descriptions:
        raise ValueError(
            f"Generic description '{description}' not allowed. Provide specific issue description."
        )

    generic_recommendations = {
        "review issue",
        "fix issue",
        "review security issue",
        "review quality issue",
    }
    if recommendation.lower() in generic_recommendations:
        raise ValueError(
            f"Generic recommendation '{recommendation}' not allowed. Provide specific action to take."
        )

    return {
        "title": title,
        "description": description,
        "severity": severity,
        "file_path": file_path,
        "line_number": line_number,
        "recommendation": recommendation,
        "metadata": metadata or {},
    }


def validate_finding(finding: dict[str, Any]) -> bool:
    """
    Validate finding has all required fields with proper values.

    This function implements the strict validation that prevents placeholder
    findings and ensures all analyzer implementations return meaningful results.

    Args:
        finding: Finding dictionary to validate

    Returns
    -------
        True if valid

    Raises
    ------
        ValueError: If finding is invalid with specific error message

    Example:
        try:
            validate_finding(my_finding)
        except ValueError as e:
            logger.error(f"Invalid finding: {e}")
    """
    if not isinstance(finding, dict):
        raise ValueError(f"Finding must be a dictionary, got {type(finding)}")

    rules: list[ValidationRule] = [
        RequiredFieldsRule(
            [
                "title",
                "description",
                "severity",
                "file_path",
                "line_number",
                "recommendation",
            ]
        ),
        FieldTypesRule(),
        SeverityRule(),
        PlaceholderRule(),
        PathAndLineRules(),
    ]

    for rule in rules:
        rule.validate(finding)

    return True


def batch_validate_findings(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Validate a list of findings and return only valid ones.

    Args:
        findings: List of finding dictionaries to validate

    Returns
    -------
        List of valid findings (invalid ones are filtered out with logging)
    """
    import logging

    logger = logging.getLogger(__name__)
    valid_findings = []

    for i, finding in enumerate(findings):
        try:
            validate_finding(finding)
            valid_findings.append(finding)
        except ValueError as e:
            logger.warning(f"Skipping invalid finding {i+1}: {e}")

    if len(valid_findings) != len(findings):
        logger.info(
            f"Filtered {len(findings) - len(valid_findings)} invalid findings out of {len(findings)} total"
        )

    return valid_findings
