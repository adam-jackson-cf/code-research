"""Configuration loader with multiple source support."""

import os
import re
from pathlib import Path
from typing import Any, Optional

import yaml

from .settings import (
    Settings,
    BackendConfig,
    OrbStackConfig,
    TmuxConfig,
    LoggingConfig,
    TimeoutConfig,
    ResourceLimits,
    NetworkConfig,
    OrchestratorConfig,
    CaptureConfig,
)
from ..utils.exceptions import ConfigurationError


class ConfigLoader:
    """Load and merge configuration from multiple sources."""

    DEFAULT_CONFIG_PATHS = [
        Path(__file__).parent.parent.parent.parent / "config" / "config.yaml",
        Path.cwd() / "config.yaml",
        Path.home() / ".agent-sandbox" / "config.yaml",
    ]

    @classmethod
    def load(cls, config_path: Optional[Path] = None) -> Settings:
        """
        Load configuration from file and environment.

        Priority (highest to lowest):
        1. Environment variables (SBX_*)
        2. Specified config file
        3. User config (~/.agent-sandbox/config.yaml)
        4. Local config (./config.yaml)
        5. Default config

        Args:
            config_path: Optional explicit config file path

        Returns:
            Settings instance with merged configuration
        """
        config: dict[str, Any] = {}

        # Load from default locations (lowest priority first)
        for path in cls.DEFAULT_CONFIG_PATHS:
            if path.exists():
                loaded = cls._load_yaml(path)
                config = cls._merge_config(config, loaded)

        # Load from specified path (higher priority)
        if config_path and config_path.exists():
            loaded = cls._load_yaml(config_path)
            config = cls._merge_config(config, loaded)

        # Override with environment variables (highest priority)
        config = cls._apply_env_overrides(config)

        # Expand variables like ${HOME}
        config = cls._expand_variables(config)

        # Convert to Settings dataclass
        return cls._dict_to_settings(config)

    @staticmethod
    def _load_yaml(path: Path) -> dict[str, Any]:
        """Load YAML file."""
        try:
            with open(path, "r") as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            raise ConfigurationError(f"Failed to load config from {path}: {e}")

    @staticmethod
    def _merge_config(base: dict, override: dict) -> dict:
        """Recursively merge configuration dictionaries."""
        result = base.copy()
        for key, value in override.items():
            if (
                key in result
                and isinstance(result[key], dict)
                and isinstance(value, dict)
            ):
                result[key] = ConfigLoader._merge_config(result[key], value)
            else:
                result[key] = value
        return result

    @staticmethod
    def _apply_env_overrides(config: dict) -> dict:
        """Apply environment variable overrides (SBX_* variables)."""
        env_mapping = {
            "SBX_BACKEND": ("backend", "default"),
            "SBX_WORKSPACE_DIR": ("orbstack", "workspace_dir"),
            "SBX_TMUX_WORKSPACE_DIR": ("tmux", "workspace_dir"),
            "SBX_LOG_LEVEL": ("logging", "level"),
        }

        for env_var, path in env_mapping.items():
            if env_var in os.environ:
                ConfigLoader._set_nested_key(config, path, os.environ[env_var])

        return config

    @staticmethod
    def _expand_variables(config: dict) -> dict:
        """Expand ${VAR} and ~ variables in config values."""

        def expand_value(value: Any) -> Any:
            if isinstance(value, str):
                # Replace ${VAR} with environment variable
                pattern = r"\$\{([^}]+)\}"
                result = re.sub(
                    pattern,
                    lambda m: os.environ.get(m.group(1), m.group(0)),
                    value,
                )
                # Expand ~ to home directory
                if result.startswith("~"):
                    result = str(Path(result).expanduser())
                return result
            elif isinstance(value, dict):
                return {k: expand_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [expand_value(v) for v in value]
            else:
                return value

        return expand_value(config)

    @staticmethod
    def _set_nested_key(d: dict, keys: tuple, value: Any) -> None:
        """Set nested dictionary key using tuple of keys."""
        current = d
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        current[keys[-1]] = value

    @classmethod
    def _dict_to_settings(cls, config: dict) -> Settings:
        """Convert dictionary to Settings dataclass."""
        # Backend config
        backend_dict = config.get("backend", {})
        backend = BackendConfig(
            default=backend_dict.get("default", "orbstack"),
            fallback=backend_dict.get("fallback", "tmux"),
        )

        # OrbStack config
        orbstack_dict = config.get("orbstack", {})
        resource_dict = orbstack_dict.get("resource_limits", {})
        network_dict = orbstack_dict.get("network", {})
        orbstack = OrbStackConfig(
            image_prefix=orbstack_dict.get("image_prefix", "agent-sandbox"),
            workspace_dir=orbstack_dict.get(
                "workspace_dir", "~/.agent-sandbox/orbstack-workspaces"
            ),
            cleanup_workspace=orbstack_dict.get("cleanup_workspace", False),
            resource_limits=ResourceLimits(
                memory=resource_dict.get("memory", "512m"),
                cpu_period=resource_dict.get("cpu_period", 100000),
                cpu_quota=resource_dict.get("cpu_quota", 50000),
            ),
            network=NetworkConfig(
                port_range_start=network_dict.get("port_range_start", 8000),
                port_range_end=network_dict.get("port_range_end", 9000),
            ),
        )

        # Tmux config
        tmux_dict = config.get("tmux", {})
        orch_dict = tmux_dict.get("orchestrator", {})
        capture_dict = tmux_dict.get("capture", {})
        tmux = TmuxConfig(
            workspace_dir=tmux_dict.get(
                "workspace_dir", "~/.agent-sandbox/tmux-workspaces"
            ),
            capture_dir=tmux_dict.get(
                "capture_dir", "~/.agent-sandbox/tmux-captures"
            ),
            cleanup_workspace=tmux_dict.get("cleanup_workspace", False),
            orchestrator=OrchestratorConfig(
                check_interval=orch_dict.get("check_interval", 5),
                log_file=orch_dict.get("log_file", "~/.agent-sandbox/orchestrator.log"),
            ),
            capture=CaptureConfig(
                buffer_size=capture_dict.get("buffer_size", 10000),
                history_file=capture_dict.get("history_file", True),
            ),
        )

        # Logging config
        logging_dict = config.get("logging", {})
        logging_config = LoggingConfig(
            level=logging_dict.get("level", "INFO"),
            file=logging_dict.get("file"),
            format=logging_dict.get(
                "format", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            ),
        )

        # Timeout config
        timeout_dict = config.get("timeouts", {})
        timeouts = TimeoutConfig(
            default_sandbox=timeout_dict.get("default_sandbox", 1800),
            default_command=timeout_dict.get("default_command", 60),
            max_sandbox=timeout_dict.get("max_sandbox", 7200),
        )

        return Settings(
            backend=backend,
            orbstack=orbstack,
            tmux=tmux,
            logging=logging_config,
            timeouts=timeouts,
        )


# Convenience function
def load_config(config_path: Optional[Path] = None) -> Settings:
    """Load configuration from default locations."""
    return ConfigLoader.load(config_path)
