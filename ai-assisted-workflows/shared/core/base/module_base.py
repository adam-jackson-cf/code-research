#!/usr/bin/env python3
"""
Base Module Class for Continuous Improvement Framework.

Eliminates duplication of import setup and path management patterns.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any

from .error_handler import CIErrorHandler


class CIModuleBase:
    """Base class for all CI framework modules with common setup functionality."""

    # High-volume operational events that should be logged at DEBUG level
    _LOW_LEVEL_OPS = {
        "file_skipped_vendor",
        "file_skipped_pattern",
        "file_skipped_size",
        "batch_processed",
    }

    def __init__(self, module_name: str, project_root: str | None = None):
        self.module_name = module_name
        self.project_root = Path(project_root) if project_root else Path.cwd()
        # Initialize logger early to satisfy type checkers
        self.logger: logging.Logger = logging.getLogger(f"ci.{module_name}")

        # Setup common logging and common utilities
        self._setup_logging()
        self._import_common_utilities()

    def _setup_logging(self) -> None:
        """Set up module-specific logging."""
        self.logger = logging.getLogger(f"ci.{self.module_name}")
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                f"%(asctime)s - {self.module_name} - %(levelname)s - %(message)s"
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

            # Use CI_LOG_LEVEL environment variable if set, default to WARNING
            log_level_name = os.getenv("CI_LOG_LEVEL", "WARNING").upper()
            log_level = getattr(logging, log_level_name, logging.WARNING)
            self.logger.setLevel(log_level)

    def _import_common_utilities(self) -> None:
        """Import commonly used utilities with error handling."""
        # Setup import paths and import utilities
        try:
            from core.utils.cross_platform import PlatformDetector
            from core.utils.output_formatter import AnalysisResult, ResultFormatter
            from core.utils.tech_stack_detector import TechStackDetector

            # Extract classes/functions (all are always present)
            self.ResultFormatter = ResultFormatter
            self.AnalysisResult = AnalysisResult
            self.TechStackDetector = TechStackDetector
            self.PlatformDetector = PlatformDetector

        except ImportError as e:
            CIErrorHandler.import_error("common utilities", e)

    def get_config_path(self, config_name: str) -> Path:
        """Get path to configuration file."""
        return self.project_root / ".ci-registry" / config_name

    def get_cache_path(self, cache_name: str) -> Path:
        """Get path to cache file."""
        cache_dir = self.project_root / ".cache" / "ci-framework"
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir / cache_name

    def get_output_path(self, output_name: str) -> Path:
        """Get path to output file."""
        output_dir = self.project_root / ".ci-output"
        output_dir.mkdir(parents=True, exist_ok=True)
        return output_dir / output_name

    def create_result(self, result_type: str = "analysis") -> Any:
        """Create appropriate result object for this module."""
        if result_type == "analysis":
            return self.ResultFormatter.create_performance_result(
                f"{self.module_name}.py", str(self.project_root)
            )
        elif result_type == "architecture":
            return self.ResultFormatter.create_architecture_result(
                f"{self.module_name}.py", str(self.project_root)
            )
        elif result_type == "monitoring":
            return self.ResultFormatter.create_monitoring_result(
                f"{self.module_name}.py", f"CI Framework - {self.module_name}"
            )
        elif result_type == "performance":
            return self.ResultFormatter.create_performance_result(
                f"{self.module_name}.py", str(self.project_root)
            )
        else:
            return self.ResultFormatter.create_performance_result(
                f"{self.module_name}.py", str(self.project_root)
            )

    def validate_threshold(
        self, name: str, value: float, min_val: float = 0.0, max_val: float = 1.0
    ) -> None:
        """Validate threshold values with standard error handling."""
        if not (min_val <= value <= max_val):
            CIErrorHandler.validation_error(
                name, value, f"number between {min_val} and {max_val}"
            )

    def validate_config(self, config: dict[str, Any], required_keys: list) -> None:
        """Validate configuration dictionary has required keys."""
        missing_keys = [key for key in required_keys if key not in config]
        if missing_keys:
            CIErrorHandler.config_error(
                f"Missing required configuration keys: {missing_keys}",
                self.get_config_path("config.json"),
            )

    def safe_file_read(self, file_path: Path, encoding: str = "utf-8") -> str:
        """Safely read file with error handling."""
        try:
            return file_path.read_text(encoding=encoding)
        except PermissionError as e:
            CIErrorHandler.permission_error("read file", file_path, e)
        except FileNotFoundError:
            CIErrorHandler.fatal_error(
                f"Required file not found: {file_path}",
                error_code=4,  # CIErrorCode.FILE_NOT_FOUND
                file_path=file_path,
            )
        # Unreachable due to fatal_error, but satisfies type checker
        return ""

    def safe_file_write(
        self, file_path: Path, content: str, encoding: str = "utf-8"
    ) -> None:
        """Safely write file with error handling."""
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding=encoding)
        except PermissionError as e:
            CIErrorHandler.permission_error("write file", file_path, e)

    def log_operation(
        self, operation: str, details: dict[str, Any] | None = None
    ) -> None:
        """Log operation with consistent format."""
        message = f"{operation}"
        if details:
            detail_str = ", ".join(f"{k}={v}" for k, v in details.items())
            message += f" ({detail_str})"

        # Log high-volume operations at DEBUG level, others at INFO
        if operation in self._LOW_LEVEL_OPS:
            self.logger.debug(message)
        else:
            self.logger.info(message)


class CIAnalysisModule(CIModuleBase):
    """Base class for analysis modules with additional analysis-specific functionality."""

    def __init__(self, module_name: str, project_root: str | None = None):
        super().__init__(module_name, project_root)
        self.analysis_start_time: float | None = None

    def start_analysis(self) -> None:
        """Start timing analysis operation."""
        import time

        self.analysis_start_time = time.time()
        self.log_operation("analysis_started")

    def complete_analysis(self, result: Any) -> Any:
        """Complete analysis and set timing metadata."""
        if self.analysis_start_time is not None:
            import time

            execution_time = time.time() - self.analysis_start_time
            result.set_execution_time(self.analysis_start_time)
            self.log_operation(
                "analysis_completed", {"execution_time": f"{execution_time:.3f}s"}
            )

        # Add summary WARNING log for lifecycle visibility when level is WARNING or higher
        if self.logger.isEnabledFor(logging.WARNING):
            summary_msg = f"Analysis completed: {self.module_name}"
            if hasattr(result, "metadata") and "total_findings" in result.metadata:
                summary_msg += f" - {result.metadata['total_findings']} findings"
            self.logger.warning(summary_msg)

        return result


class CIConfigModule(CIModuleBase):
    """Base class for configuration-related modules."""

    def __init__(self, module_name: str, project_root: str | None = None):
        super().__init__(module_name, project_root)
        self.config_cache: dict[str, Any] = {}

    def load_config(
        self, config_name: str, required_keys: list | None = None
    ) -> dict[str, Any]:
        """Load and cache configuration with validation."""
        if config_name in self.config_cache:
            return self.config_cache[config_name]

        config_path = self.get_config_path(config_name)

        try:
            config_content = self.safe_file_read(config_path)
            config = json.loads(config_content)

            if required_keys:
                self.validate_config(config, required_keys)

            self.config_cache[config_name] = config
            self.log_operation(
                "config_loaded", {"config": config_name, "keys": len(config)}
            )
            return config

        except json.JSONDecodeError as e:
            CIErrorHandler.config_error(
                f"Invalid JSON in configuration file: {e}", config_path
            )
        # Unreachable due to fatal_error above, but satisfies type checker
        return {}

    def save_config(self, config_name: str, config: dict[str, Any]) -> None:
        """Save configuration and update cache."""
        config_path = self.get_config_path(config_name)
        config_content = json.dumps(config, indent=2)
        self.safe_file_write(config_path, config_content)
        self.config_cache[config_name] = config
        self.log_operation("config_saved", {"config": config_name, "keys": len(config)})
