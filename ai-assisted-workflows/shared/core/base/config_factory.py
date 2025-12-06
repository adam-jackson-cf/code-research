#!/usr/bin/env python3
"""
Configuration Factory for Continuous Improvement Framework.

Eliminates duplication of configuration dataclass patterns.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypeVar

from .error_handler import CIErrorHandler

T = TypeVar("T")


class ConfigBase:
    """Base class for all configuration objects with common validation."""

    def __post_init__(self):
        """Override in subclasses to set defaults and validate."""
        self._set_defaults()
        self._validate()

    def _set_defaults(self):
        """Set default values. Override in subclasses."""
        pass

    def _validate(self):
        """Validate configuration. Override in subclasses."""
        pass

    def validate_threshold(
        self, name: str, value: float, min_val: float = 0.0, max_val: float = 1.0
    ):
        """Validate threshold values."""
        if not (min_val <= value <= max_val):
            CIErrorHandler.validation_error(
                name, value, f"number between {min_val} and {max_val}"
            )

    def validate_required(self, name: str, value: Any):
        """Validate required field is not None."""
        if value is None:
            CIErrorHandler.validation_error(name, value, "non-null value")

    def validate_list_not_empty(self, name: str, value: list[Any]):
        """Validate list is not empty."""
        if not value:
            CIErrorHandler.validation_error(name, value, "non-empty list")

    def to_dict(self) -> dict[str, Any]:
        """Convert configuration to dictionary."""
        from dataclasses import asdict

        return asdict(self)  # type: ignore[call-overload]


@dataclass
class EmbeddingConfig(ConfigBase):
    """Configuration for embedding operations."""

    model_name: str = "all-MiniLM-L6-v2"
    cache_embeddings: bool = True
    batch_size: int = 32
    max_sequence_length: int = 512
    include_symbol_types: list[str] | None = None
    exclude_files: list[str] | None = None
    similarity_threshold: float = 0.85

    def _set_defaults(self):
        if self.include_symbol_types is None:
            self.include_symbol_types = ["function", "class", "method", "interface"]

        if self.exclude_files is None:
            self.exclude_files = ["test_*.py", "*_test.py", "*.spec.py"]

    def _validate(self):
        self.validate_threshold("similarity_threshold", self.similarity_threshold)
        self.validate_required("model_name", self.model_name)
        self.validate_list_not_empty("include_symbol_types", self.include_symbol_types)

        if self.batch_size <= 0:
            CIErrorHandler.validation_error(
                "batch_size", self.batch_size, "positive integer"
            )

        if self.max_sequence_length <= 0:
            CIErrorHandler.validation_error(
                "max_sequence_length", self.max_sequence_length, "positive integer"
            )


@dataclass
class SimilarityConfig(ConfigBase):
    """Configuration for similarity detection."""

    exact_duplicate_threshold: float = 0.95
    near_duplicate_threshold: float = 0.85
    similar_pattern_threshold: float = 0.75
    min_tokens: int = 10
    ignore_whitespace: bool = True
    ignore_comments: bool = True
    case_sensitive: bool = False
    algorithm: str = "hybrid"

    def _validate(self):
        self.validate_threshold(
            "exact_duplicate_threshold", self.exact_duplicate_threshold
        )
        self.validate_threshold(
            "near_duplicate_threshold", self.near_duplicate_threshold
        )
        self.validate_threshold(
            "similar_pattern_threshold", self.similar_pattern_threshold
        )

        if self.min_tokens <= 0:
            CIErrorHandler.validation_error(
                "min_tokens", self.min_tokens, "positive integer"
            )

        valid_algorithms = ["hybrid", "semantic", "structural", "textual"]
        if self.algorithm not in valid_algorithms:
            CIErrorHandler.validation_error(
                "algorithm", self.algorithm, f"one of {valid_algorithms}"
            )


@dataclass
class RegistryConfig(ConfigBase):
    """Configuration for registry operations."""

    enable_caching: bool = True
    cache_ttl_hours: int = 24
    max_entries: int = 10000
    backup_enabled: bool = True
    backup_frequency_hours: int = 6
    compression_enabled: bool = True

    def _set_defaults(self):
        pass

    def _validate(self):
        if self.cache_ttl_hours <= 0:
            CIErrorHandler.validation_error(
                "cache_ttl_hours", self.cache_ttl_hours, "positive integer"
            )

        if self.max_entries <= 0:
            CIErrorHandler.validation_error(
                "max_entries", self.max_entries, "positive integer"
            )

        if self.backup_frequency_hours <= 0:
            CIErrorHandler.validation_error(
                "backup_frequency_hours",
                self.backup_frequency_hours,
                "positive integer",
            )


@dataclass
class DetectionConfig(ConfigBase):
    """Configuration for duplicate detection."""

    exact_duplicate_threshold: float = 0.95
    near_duplicate_threshold: float = 0.85
    similar_pattern_threshold: float = 0.75
    min_line_length: int = 5
    ignore_test_files: bool = True
    ignore_generated_files: bool = True
    file_extensions: list[str] | None = None
    exclude_patterns: list[str] | None = None
    include_patterns: list[str] | None = None

    def _set_defaults(self):
        if self.file_extensions is None:
            self.file_extensions = [".py", ".js", ".ts", ".java", ".cpp", ".c", ".h"]

        if self.exclude_patterns is None:
            self.exclude_patterns = [
                "test_*.py",
                "*_test.py",
                "*.spec.py",
                "*.test.js",
                "__pycache__",
                "node_modules",
                ".git",
                ".cache",
                "*.min.js",
                "*.bundle.js",
                "dist/",
                "build/",
            ]

        if self.include_patterns is None:
            self.include_patterns = ["**/*"]

    def _validate(self):
        self.validate_threshold(
            "exact_duplicate_threshold", self.exact_duplicate_threshold
        )
        self.validate_threshold(
            "near_duplicate_threshold", self.near_duplicate_threshold
        )
        self.validate_threshold(
            "similar_pattern_threshold", self.similar_pattern_threshold
        )

        if self.min_line_length <= 0:
            CIErrorHandler.validation_error(
                "min_line_length", self.min_line_length, "positive integer"
            )


@dataclass
class QualityGateConfig(ConfigBase):
    """Configuration for quality gate detection."""

    timeout_seconds: int = 300
    retry_attempts: int = 3
    fail_fast: bool = False
    parallel_execution: bool = True
    capture_output: bool = True
    truncate_output_lines: int = 1000
    prototype_mode_gates: list[str] | None = None
    production_mode_gates: list[str] | None = None

    def _set_defaults(self):
        if self.prototype_mode_gates is None:
            self.prototype_mode_gates = ["lint", "typecheck", "build"]

        if self.production_mode_gates is None:
            self.production_mode_gates = [
                "lint",
                "typecheck",
                "build",
                "test",
                "coverage",
                "security",
            ]

    def _validate(self):
        if self.timeout_seconds <= 0:
            CIErrorHandler.validation_error(
                "timeout_seconds", self.timeout_seconds, "positive integer"
            )

        if self.retry_attempts < 0:
            CIErrorHandler.validation_error(
                "retry_attempts", self.retry_attempts, "non-negative integer"
            )

        if self.truncate_output_lines <= 0:
            CIErrorHandler.validation_error(
                "truncate_output_lines", self.truncate_output_lines, "positive integer"
            )


@dataclass
class MetricsConfig(ConfigBase):
    """Configuration for metrics collection."""

    database_path: Path | None = None
    enable_metrics: bool = True
    retention_days: int = 90
    aggregation_interval_hours: int = 1
    export_formats: list[str] | None = None
    alert_thresholds: dict[str, float] | None = None

    def _set_defaults(self):
        if self.database_path is None:
            self.database_path = Path.cwd() / ".claude" / "ci_metrics.db"

        if self.export_formats is None:
            self.export_formats = ["json", "csv"]

        if self.alert_thresholds is None:
            self.alert_thresholds = {
                "quality_score_min": 50.0,
                "error_rate_max": 0.1,
                "build_time_max_minutes": 30.0,
            }

    def _validate(self):
        self.validate_required("database_path", self.database_path)

        if self.retention_days <= 0:
            CIErrorHandler.validation_error(
                "retention_days", self.retention_days, "positive integer"
            )

        if self.aggregation_interval_hours <= 0:
            CIErrorHandler.validation_error(
                "aggregation_interval_hours",
                self.aggregation_interval_hours,
                "positive integer",
            )


class ConfigFactory:
    """Factory for creating and managing configuration objects."""

    _config_classes = {
        "embedding": EmbeddingConfig,
        "similarity": SimilarityConfig,
        "registry": RegistryConfig,
        "detection": DetectionConfig,
        "quality_gate": QualityGateConfig,
        "metrics": MetricsConfig,
    }

    @classmethod
    def create(cls, config_type: str, **kwargs) -> ConfigBase:
        """
        Create a configuration object of the specified type.

        Args:
            config_type: Type of configuration to create
            **kwargs: Configuration parameters

        Returns
        -------
            Configuration object instance
        """
        if config_type not in cls._config_classes:
            valid_types = list(cls._config_classes.keys())
            CIErrorHandler.validation_error(
                "config_type", config_type, f"one of {valid_types}"
            )

        config_class = cls._config_classes[config_type]
        return config_class(**kwargs)

    @classmethod
    def create_from_dict(
        cls, config_type: str, config_dict: dict[str, Any]
    ) -> ConfigBase:
        """Create configuration from dictionary."""
        return cls.create(config_type, **config_dict)

    @classmethod
    def create_from_file(cls, config_type: str, config_path: Path) -> ConfigBase:
        """Create configuration from JSON file."""
        import json

        try:
            with open(config_path) as f:
                config_dict = json.load(f)
            return cls.create_from_dict(config_type, config_dict)
        except FileNotFoundError:
            CIErrorHandler.fatal_error(
                f"Configuration file not found: {config_path}",
                error_code=4,  # CIErrorCode.FILE_NOT_FOUND
                file_path=config_path,
            )
        except json.JSONDecodeError as e:
            CIErrorHandler.config_error(
                f"Invalid JSON in configuration file: {e}", config_path
            )
        except Exception as e:
            CIErrorHandler.config_error(
                f"Error loading configuration: {e}", config_path
            )
        # Unreachable due to fatal_error, but satisfies type checker
        return cls.create(config_type)

    @classmethod
    def save_to_file(cls, config: ConfigBase, config_path: Path) -> None:
        """Save configuration to JSON file."""
        import json

        try:
            config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(config_path, "w") as f:
                json.dump(config.to_dict(), f, indent=2, default=str)
        except PermissionError as e:
            CIErrorHandler.permission_error("write configuration", config_path, e)
        except Exception as e:
            CIErrorHandler.config_error(f"Error saving configuration: {e}", config_path)

    @classmethod
    def get_available_types(cls) -> list[str]:
        """Get list of available configuration types."""
        return list(cls._config_classes.keys())

    @classmethod
    def register_config_type(cls, name: str, config_class: type[ConfigBase]) -> None:
        """Register a new configuration type."""
        if not issubclass(config_class, ConfigBase):
            CIErrorHandler.validation_error(
                "config_class", config_class, "subclass of ConfigBase"
            )

        cls._config_classes[name] = config_class
