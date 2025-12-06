"""Core shared libraries and utilities."""

# Re-export from base for convenience
from .base import (
    CIAnalysisModule,
    CIConfigModule,
    CIErrorCode,
    CIErrorContext,
    CIErrorHandler,
    CIModuleBase,
    ConfigBase,
    ConfigFactory,
    FileSystemUtils,
    atomic_write,
    time_operation,
    # CLI utilities intentionally not re-exported in this project
    timed_operation,
)

# Re-export from utils for convenience
from .utils import (
    ArchitecturalPatternDetector,
    CommandExecutor,
    DependencyChecker,
    PathUtils,
    PlatformDetector,
    ResultFormatter,
    TechStackDetector,
    ValidationError,
    validate_git_repository,
    validate_target_directory,
)

__all__ = [
    # Base exports
    "CIErrorHandler",
    "CIErrorCode",
    "CIErrorContext",
    "CIModuleBase",
    "CIAnalysisModule",
    "CIConfigModule",
    "ConfigFactory",
    "ConfigBase",
    # (CLI utilities removed)
    "timed_operation",
    "time_operation",
    "FileSystemUtils",
    "atomic_write",
    # Utils exports
    "validate_target_directory",
    "validate_git_repository",
    "ValidationError",
    "ArchitecturalPatternDetector",
    "PlatformDetector",
    "CommandExecutor",
    "PathUtils",
    "DependencyChecker",
    "ResultFormatter",
    "TechStackDetector",
]
