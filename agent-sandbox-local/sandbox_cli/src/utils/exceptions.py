"""Custom exception types for sandbox CLI."""


class SandboxError(Exception):
    """Base exception for sandbox operations."""

    pass


class SandboxCreationError(SandboxError):
    """Failed to create sandbox."""

    pass


class SandboxNotFoundError(SandboxError):
    """Sandbox not found."""

    pass


class CommandExecutionError(SandboxError):
    """Command execution failed."""

    pass


class FileOperationError(SandboxError):
    """File operation failed."""

    pass


class ConfigurationError(SandboxError):
    """Configuration error."""

    pass


class InvalidBackendError(SandboxError):
    """Invalid or unknown backend type."""

    pass
