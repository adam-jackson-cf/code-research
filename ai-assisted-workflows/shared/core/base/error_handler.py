#!/usr/bin/env python3
"""
Centralized Error Handler for Continuous Improvement Framework.

Eliminates duplication of error handling patterns across modules.
"""

import sys
from pathlib import Path
from typing import Any


class CIErrorCode:
    """Standard error codes for CI framework operations."""

    # General errors
    SUCCESS = 0
    GENERAL_ERROR = 1

    # Import and setup errors
    IMPORT_ERROR = 2
    PATH_SETUP_ERROR = 3

    # File system errors
    FILE_NOT_FOUND = 4
    PERMISSION_ERROR = 5
    FILE_READ_ERROR = 6
    FILE_WRITE_ERROR = 7

    # Configuration errors
    CONFIG_ERROR = 8
    INVALID_CONFIG = 9

    # Network/API errors
    NETWORK_ERROR = 10
    API_ERROR = 11

    # Processing errors
    PROCESSING_ERROR = 12
    VALIDATION_ERROR = 13

    # Registry errors
    REGISTRY_READ_ERROR = 14
    REGISTRY_WRITE_ERROR = 15
    REGISTRY_CORRUPT = 16


class CIErrorHandler:
    """Centralized error handler for consistent error reporting and exit codes."""

    @staticmethod
    def fatal_error(
        message: str,
        error_code: int = CIErrorCode.GENERAL_ERROR,
        file_path: str | Path | None = None,
        exception: Exception | None = None,
        context: str | None = None,
    ) -> None:
        """
        Report a fatal error and exit the program.

        Args:
            message: Error message to display
            error_code: Exit code (use CIErrorCode constants)
            file_path: Optional file path related to the error
            exception: Optional exception that caused the error
            context: Optional context information
        """
        print(f"FATAL: {message}", file=sys.stderr)

        if file_path:
            print(f"File: {file_path}", file=sys.stderr)

        if context:
            print(f"Context: {context}", file=sys.stderr)

        if exception:
            print(
                f"Exception: {type(exception).__name__}: {exception}", file=sys.stderr
            )

        sys.exit(error_code)

    @staticmethod
    def import_error(module_name: str, error: Exception) -> None:
        """Handle import errors with standard messaging."""
        CIErrorHandler.fatal_error(
            f"Cannot import required module: {module_name}",
            error_code=CIErrorCode.IMPORT_ERROR,
            exception=error,
            context="Ensure all dependencies are installed",
        )

    @staticmethod
    def permission_error(
        operation: str, file_path: str | Path, error: Exception
    ) -> None:
        """Handle permission errors with standard messaging."""
        CIErrorHandler.fatal_error(
            f"Cannot {operation} due to insufficient permissions",
            error_code=CIErrorCode.PERMISSION_ERROR,
            file_path=file_path,
            exception=error,
            context="Check file/directory permissions",
        )

    @staticmethod
    def config_error(message: str, config_path: str | Path | None = None) -> None:
        """Handle configuration errors with standard messaging."""
        CIErrorHandler.fatal_error(
            f"Configuration error: {message}",
            error_code=CIErrorCode.CONFIG_ERROR,
            file_path=config_path,
            context="Check configuration file format and values",
        )

    @staticmethod
    def registry_error(
        operation: str, registry_path: str | Path, error: Exception
    ) -> None:
        """Handle registry-specific errors."""
        error_codes = {
            "read": CIErrorCode.REGISTRY_READ_ERROR,
            "write": CIErrorCode.REGISTRY_WRITE_ERROR,
            "corrupt": CIErrorCode.REGISTRY_CORRUPT,
        }

        CIErrorHandler.fatal_error(
            f"Registry {operation} failed",
            error_code=error_codes.get(operation, CIErrorCode.GENERAL_ERROR),
            file_path=registry_path,
            exception=error,
            context="Check registry file integrity and permissions",
        )

    @staticmethod
    def validation_error(field: str, value: Any, expected: str) -> None:
        """Handle validation errors with standard messaging."""
        CIErrorHandler.fatal_error(
            f"Validation failed for {field}: got {value}, expected {expected}",
            error_code=CIErrorCode.VALIDATION_ERROR,
            context="Check input parameters and configuration",
        )

    @staticmethod
    def warn(message: str, context: str | None = None) -> None:
        """Print warning message without exiting."""
        print(f"WARNING: {message}", file=sys.stderr)
        if context:
            print(f"Context: {context}", file=sys.stderr)

    @staticmethod
    def info(message: str) -> None:
        """Print informational message."""
        print(f"INFO: {message}")


class CIErrorContext:
    """Context manager for error handling with automatic cleanup."""

    def __init__(self, operation: str, context: str | None = None):
        self.operation = operation
        self.context = context

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            return

        if exc_type is PermissionError:
            CIErrorHandler.permission_error(
                self.operation, getattr(exc_val, "filename", "unknown"), exc_val
            )
        elif exc_type is FileNotFoundError:
            CIErrorHandler.fatal_error(
                f"File not found during {self.operation}",
                error_code=CIErrorCode.FILE_NOT_FOUND,
                file_path=getattr(exc_val, "filename", "unknown"),
                exception=exc_val,
                context=self.context,
            )
        elif exc_type is ImportError:
            CIErrorHandler.import_error(getattr(exc_val, "name", "unknown"), exc_val)
        else:
            CIErrorHandler.fatal_error(
                f"Unexpected error during {self.operation}",
                error_code=CIErrorCode.GENERAL_ERROR,
                exception=exc_val,
                context=self.context,
            )
