"""Abstract base class for sandbox backends."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class SandboxStatus(Enum):
    """Sandbox lifecycle states."""

    CREATING = "creating"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


@dataclass
class SandboxInfo:
    """Sandbox information."""

    sandbox_id: str
    backend_type: str
    status: SandboxStatus
    created_at: str
    metadata: dict[str, Any] = field(default_factory=dict)
    template: Optional[str] = None
    ports: Optional[dict[int, str]] = None


@dataclass
class CommandResult:
    """Command execution result."""

    stdout: str
    stderr: str
    exit_code: int
    pid: Optional[str] = None


@dataclass
class FileInfo:
    """File/directory information."""

    name: str
    path: str
    type: str  # 'file' or 'dir'
    size: int
    permissions: str
    modified_at: Optional[str] = None


class SandboxBackend(ABC):
    """
    Abstract base class for sandbox backends.

    All backend implementations (OrbStack, Tmux) must implement this interface.
    This ensures consistent behavior across different sandbox technologies.
    """

    def __init__(self, config: dict[str, Any]):
        """
        Initialize backend with configuration.

        Args:
            config: Backend-specific configuration dictionary
        """
        self.config = config
        self._validate_config()

    @abstractmethod
    def _validate_config(self) -> None:
        """Validate backend configuration. Raise exception if invalid."""
        pass

    # =========================================================================
    # Lifecycle Operations
    # =========================================================================

    @abstractmethod
    def create_sandbox(
        self,
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        envs: Optional[dict[str, str]] = None,
        metadata: Optional[dict[str, str]] = None,
    ) -> str:
        """
        Create a new sandbox.

        Args:
            template: Template name (e.g., 'python', 'node', 'full')
            timeout: Timeout in seconds (auto-kill after timeout)
            envs: Environment variables
            metadata: Custom metadata

        Returns:
            sandbox_id: Unique identifier for the sandbox
        """
        pass

    @abstractmethod
    def connect_sandbox(self, sandbox_id: str) -> bool:
        """
        Connect to existing sandbox.

        Args:
            sandbox_id: Sandbox to connect to

        Returns:
            True if connection successful
        """
        pass

    @abstractmethod
    def get_sandbox_info(self, sandbox_id: str) -> SandboxInfo:
        """Get sandbox information."""
        pass

    @abstractmethod
    def is_sandbox_running(self, sandbox_id: str) -> bool:
        """Check if sandbox is running."""
        pass

    @abstractmethod
    def kill_sandbox(self, sandbox_id: str) -> bool:
        """Kill sandbox. Returns True if killed."""
        pass

    @abstractmethod
    def pause_sandbox(self, sandbox_id: str) -> bool:
        """Pause sandbox (if supported). Returns True if paused."""
        pass

    @abstractmethod
    def resume_sandbox(self, sandbox_id: str) -> bool:
        """Resume paused sandbox. Returns True if resumed."""
        pass

    @abstractmethod
    def list_sandboxes(self, limit: int = 20) -> list[SandboxInfo]:
        """List all sandboxes."""
        pass

    # =========================================================================
    # Command Execution
    # =========================================================================

    @abstractmethod
    def run_command(
        self,
        sandbox_id: str,
        command: str,
        cwd: Optional[str] = None,
        envs: Optional[dict[str, str]] = None,
        timeout: Optional[float] = 60,
        shell: bool = True,
    ) -> CommandResult:
        """
        Run command and wait for completion.

        Args:
            sandbox_id: Target sandbox
            command: Command to execute
            cwd: Working directory
            envs: Environment variables
            timeout: Command timeout
            shell: Whether to run in shell context

        Returns:
            CommandResult with stdout, stderr, exit_code
        """
        pass

    @abstractmethod
    def run_command_background(
        self,
        sandbox_id: str,
        command: str,
        cwd: Optional[str] = None,
        envs: Optional[dict[str, str]] = None,
    ) -> CommandResult:
        """
        Run command in background, return immediately.

        Returns:
            CommandResult with pid (stdout/stderr may be empty)
        """
        pass

    # =========================================================================
    # File Operations
    # =========================================================================

    @abstractmethod
    def list_files(
        self, sandbox_id: str, path: str = "/", depth: int = 1
    ) -> list[FileInfo]:
        """List files in directory."""
        pass

    @abstractmethod
    def read_file(self, sandbox_id: str, path: str) -> str:
        """Read text file content."""
        pass

    @abstractmethod
    def read_file_bytes(self, sandbox_id: str, path: str) -> bytes:
        """Read binary file content."""
        pass

    @abstractmethod
    def write_file(self, sandbox_id: str, path: str, content: str) -> FileInfo:
        """Write text file."""
        pass

    @abstractmethod
    def write_file_bytes(self, sandbox_id: str, path: str, data: bytes) -> FileInfo:
        """Write binary file."""
        pass

    @abstractmethod
    def file_exists(self, sandbox_id: str, path: str) -> bool:
        """Check if file exists."""
        pass

    @abstractmethod
    def get_file_info(self, sandbox_id: str, path: str) -> FileInfo:
        """Get file information."""
        pass

    @abstractmethod
    def remove_file(self, sandbox_id: str, path: str) -> None:
        """Remove file or directory."""
        pass

    @abstractmethod
    def make_directory(self, sandbox_id: str, path: str) -> bool:
        """Create directory. Returns True if created."""
        pass

    @abstractmethod
    def rename_file(self, sandbox_id: str, old_path: str, new_path: str) -> FileInfo:
        """Rename/move file."""
        pass

    # =========================================================================
    # Network Operations
    # =========================================================================

    @abstractmethod
    def get_host(self, sandbox_id: str, port: int) -> str:
        """
        Get public URL for exposed port.

        Args:
            sandbox_id: Target sandbox
            port: Port number to expose

        Returns:
            Public URL (e.g., 'http://localhost:8080')
        """
        pass

    # =========================================================================
    # Health Check
    # =========================================================================

    @abstractmethod
    def health_check(self) -> dict[str, Any]:
        """
        Check backend health.

        Returns:
            Dictionary with status, version, capabilities
        """
        pass
