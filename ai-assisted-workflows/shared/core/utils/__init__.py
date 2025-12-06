"""Core utilities for shared functionality."""

from .analysis_environment import (
    ValidationError,
    require_git_repo,
    require_valid_path,
    validate_environment_config,
    validate_file_access,
    validate_git_repository,
    validate_target_directory,
)
from .architectural_pattern_detector import ArchitecturalPatternDetector
from .cross_platform import (
    CommandExecutor,
    DependencyChecker,
    PathUtils,
    PlatformDetector,
)
from .output_formatter import ResultFormatter
from .tech_stack_detector import TechStackDetector

__all__ = [
    "validate_target_directory",
    "validate_git_repository",
    "validate_file_access",
    "validate_environment_config",
    "ValidationError",
    "require_valid_path",
    "require_git_repo",
    "ArchitecturalPatternDetector",
    "PlatformDetector",
    "CommandExecutor",
    "PathUtils",
    "DependencyChecker",
    "ResultFormatter",
    "TechStackDetector",
]
