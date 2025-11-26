"""Settings dataclasses for configuration."""

from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path


@dataclass
class ResourceLimits:
    """Container resource limits."""

    memory: str = "512m"
    cpu_period: int = 100000
    cpu_quota: int = 50000


@dataclass
class NetworkConfig:
    """Network configuration."""

    port_range_start: int = 8000
    port_range_end: int = 9000


@dataclass
class OrbStackConfig:
    """OrbStack backend configuration."""

    image_prefix: str = "agent-sandbox"
    workspace_dir: str = "~/.agent-sandbox/orbstack-workspaces"
    cleanup_workspace: bool = False
    resource_limits: ResourceLimits = field(default_factory=ResourceLimits)
    network: NetworkConfig = field(default_factory=NetworkConfig)

    def get_workspace_path(self) -> Path:
        """Get expanded workspace path."""
        return Path(self.workspace_dir).expanduser()


@dataclass
class OrchestratorConfig:
    """Tmux orchestrator configuration."""

    check_interval: int = 5
    log_file: str = "~/.agent-sandbox/orchestrator.log"


@dataclass
class CaptureConfig:
    """Output capture configuration."""

    buffer_size: int = 10000
    history_file: bool = True


@dataclass
class TmuxConfig:
    """Tmux backend configuration."""

    workspace_dir: str = "~/.agent-sandbox/tmux-workspaces"
    capture_dir: str = "~/.agent-sandbox/tmux-captures"
    cleanup_workspace: bool = False
    orchestrator: OrchestratorConfig = field(default_factory=OrchestratorConfig)
    capture: CaptureConfig = field(default_factory=CaptureConfig)

    def get_workspace_path(self) -> Path:
        """Get expanded workspace path."""
        return Path(self.workspace_dir).expanduser()

    def get_capture_path(self) -> Path:
        """Get expanded capture path."""
        return Path(self.capture_dir).expanduser()


@dataclass
class BackendConfig:
    """Backend selection configuration."""

    default: str = "orbstack"
    fallback: str = "tmux"


@dataclass
class LoggingConfig:
    """Logging configuration."""

    level: str = "INFO"
    file: Optional[str] = "~/.agent-sandbox/sandbox-cli.log"
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"


@dataclass
class TimeoutConfig:
    """Timeout configuration."""

    default_sandbox: int = 1800  # 30 minutes
    default_command: int = 60  # 1 minute
    max_sandbox: int = 7200  # 2 hours


@dataclass
class Settings:
    """Main settings container."""

    backend: BackendConfig = field(default_factory=BackendConfig)
    orbstack: OrbStackConfig = field(default_factory=OrbStackConfig)
    tmux: TmuxConfig = field(default_factory=TmuxConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    timeouts: TimeoutConfig = field(default_factory=TimeoutConfig)

    def get_backend_config(self, backend_type: str) -> dict:
        """Get configuration for specific backend type."""
        if backend_type == "orbstack":
            return {
                "image_prefix": self.orbstack.image_prefix,
                "workspace_dir": str(self.orbstack.get_workspace_path()),
                "cleanup_workspace": self.orbstack.cleanup_workspace,
                "resource_limits": {
                    "memory": self.orbstack.resource_limits.memory,
                    "cpu_period": self.orbstack.resource_limits.cpu_period,
                    "cpu_quota": self.orbstack.resource_limits.cpu_quota,
                },
                "network": {
                    "port_range_start": self.orbstack.network.port_range_start,
                    "port_range_end": self.orbstack.network.port_range_end,
                },
            }
        elif backend_type == "tmux":
            return {
                "workspace_dir": str(self.tmux.get_workspace_path()),
                "capture_dir": str(self.tmux.get_capture_path()),
                "cleanup_workspace": self.tmux.cleanup_workspace,
                "orchestrator": {
                    "check_interval": self.tmux.orchestrator.check_interval,
                    "log_file": self.tmux.orchestrator.log_file,
                },
                "capture": {
                    "buffer_size": self.tmux.capture.buffer_size,
                    "history_file": self.tmux.capture.history_file,
                },
            }
        else:
            raise ValueError(f"Unknown backend type: {backend_type}")
