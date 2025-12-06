#!/usr/bin/env python3
"""
Base Profiler Class for Performance Analysis.

PURPOSE: Shared infrastructure for performance profiling tools, eliminating common code duplication.
Part of the shared/core/base suite for consistent analyzer patterns.

FEATURES:
- Common initialization patterns (TechStackDetector, ResultFormatter, timing)
- Standard file scanning and filtering logic
- Consistent CLI argument parsing for all profilers
- Shared configuration patterns and error handling
- Abstract interface for specific profiling implementations

ELIMINATES DUPLICATION FROM:
- shared/analyzers/performance/profile_code.py (initialization, CLI, timing)
- shared/analyzers/performance/sqlfluff_analyzer.py (SQL performance analysis with established tools)
- shared/analyzers/performance/performance_baseline.py (platform detection, configuration)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .module_base import CIAnalysisModule


@dataclass
class ProfilerConfig:
    """Standard configuration for all profilers with validation."""

    # Core settings
    target_path: str = "."
    output_format: str = "json"
    min_severity: str = "low"
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
            ".swift",
            ".rs",
            ".dart",
            ".vue",
            ".jsx",
            ".tsx",
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
        }
    )

    # Performance settings
    max_files: int | None = None
    max_file_size_mb: int = 10
    batch_size: int = 100
    timeout_seconds: int | None = None

    # Analysis settings
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


class BaseProfiler(CIAnalysisModule, ABC):
    """
    Abstract base class for all performance profilers.

    Provides common infrastructure:
    - File scanning and filtering
    - Configuration management
    - CLI interface
    - Result formatting
    - Timing and logging
    - Error handling
    """

    def __init__(self, profiler_type: str, config: ProfilerConfig | None = None):
        super().__init__(f"{profiler_type}_profiler")

        self.profiler_type = profiler_type
        self.config = config or ProfilerConfig()

        # Initialize common utilities (available from CIAnalysisModule)
        self.tech_detector = self.TechStackDetector()

        # Performance tracking
        self.files_processed = 0
        self.files_skipped = 0
        self.processing_errors = 0

        self.log_operation(
            "profiler_initialized",
            {
                "type": profiler_type,
                "max_files": self.config.max_files,
                "extensions": len(self.config.code_extensions),
            },
        )

    @abstractmethod
    def profile_target(self, target_path: str) -> list[dict[str, Any]]:
        """
        Implement specific profiling logic for the target path.

        Args:
            target_path: Path to analyze

        Returns
        -------
            List of profiling findings as dictionaries
        """
        pass

    @abstractmethod
    def get_profiler_metadata(self) -> dict[str, Any]:
        """
        Get profiler-specific metadata for results.

        Returns
        -------
            Dictionary with profiler-specific metadata
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
        # Check if file is in skip patterns
        for part in file_path.parts:
            if part in self.config.skip_patterns:
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

        return True

    def scan_directory(self, target_path: str) -> list[Path]:
        """
        Scan directory for files matching profiler criteria.

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
                # Call the specific profiler implementation
                file_findings = self.profile_target(str(file_path))
                batch_findings.extend(file_findings)
                self.files_processed += 1

            except Exception as e:
                self.processing_errors += 1
                self.logger.warning(f"Error processing {file_path}: {e}")

        return batch_findings

    def analyze(self, target_path: str | None = None) -> Any:
        """
        Run main analysis entry point with full profiling pipeline.

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
                result.add_info("No files found matching profiler criteria")
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
            result.set_error(f"{self.profiler_type} profiling failed: {str(e)}")
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
                        finding_id=f"{self.profiler_type.upper()}{finding_id:03d}",
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
                    f"Profiler {self.profiler_type} returned finding missing required field: {e}"
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
        profiler_metadata = self.get_profiler_metadata()

        result.metadata = {
            "profiler_type": self.profiler_type,
            "target_path": target_path,
            "files_analyzed": len(files),
            "files_processed": self.files_processed,
            "files_skipped": self.files_skipped,
            "processing_errors": self.processing_errors,
            "total_findings": len(findings),
            "severity_breakdown": self._calculate_severity_breakdown(findings),
            "profiler_config": {
                "max_files": self.config.max_files,
                "max_file_size_mb": self.config.max_file_size_mb,
                "extensions_count": len(self.config.code_extensions),
                "skip_patterns_count": len(self.config.skip_patterns),
            },
            **profiler_metadata,
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

    # CLI functionality removed: profilers are orchestrated by agents/commands in this project


def create_profiler_config(**kwargs) -> ProfilerConfig:
    """
    Create a ProfilerConfig with validation.

    Args:
        **kwargs: Configuration parameters

    Returns
    -------
        Validated ProfilerConfig instance
    """
    return ProfilerConfig(**kwargs)
