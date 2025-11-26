"""Factory for creating sandbox backends."""

from typing import Any, Optional

from .base import SandboxBackend
from ..utils.exceptions import InvalidBackendError
from ..utils.logging import get_logger

logger = get_logger(__name__)


class BackendFactory:
    """Factory for creating sandbox backends."""

    _backends: dict[str, type] = {}
    _instances: dict[str, SandboxBackend] = {}

    @classmethod
    def register_backend(cls, name: str, backend_class: type) -> None:
        """
        Register a backend class.

        Args:
            name: Backend name (e.g., 'orbstack', 'tmux')
            backend_class: Backend class implementing SandboxBackend
        """
        cls._backends[name.lower()] = backend_class
        logger.debug(f"Registered backend: {name}")

    @classmethod
    def create_backend(
        cls,
        backend_type: str,
        config: dict[str, Any],
        cache: bool = True,
    ) -> SandboxBackend:
        """
        Create backend instance.

        Args:
            backend_type: 'orbstack' or 'tmux'
            config: Backend configuration
            cache: Whether to cache the instance

        Returns:
            Configured backend instance

        Raises:
            InvalidBackendError: If backend_type is unknown
        """
        backend_type = backend_type.lower()

        # Return cached instance if available
        if cache and backend_type in cls._instances:
            return cls._instances[backend_type]

        # Lazy import to avoid circular dependencies
        if not cls._backends:
            cls._register_default_backends()

        backend_class = cls._backends.get(backend_type)

        if not backend_class:
            available = ", ".join(cls._backends.keys())
            raise InvalidBackendError(
                f"Unknown backend: {backend_type}. Available: {available}"
            )

        logger.info(f"Creating backend: {backend_type}")
        instance = backend_class(config)

        if cache:
            cls._instances[backend_type] = instance

        return instance

    @classmethod
    def _register_default_backends(cls) -> None:
        """Register default backends."""
        from .orbstack.backend import OrbStackBackend
        from .tmux.backend import TmuxBackend

        cls.register_backend("orbstack", OrbStackBackend)
        cls.register_backend("tmux", TmuxBackend)

    @classmethod
    def list_backends(cls) -> list[str]:
        """List available backend types."""
        if not cls._backends:
            cls._register_default_backends()
        return list(cls._backends.keys())

    @classmethod
    def clear_cache(cls) -> None:
        """Clear cached backend instances."""
        cls._instances.clear()


# Global backend instance
_current_backend: Optional[SandboxBackend] = None


def get_backend(
    backend_type: Optional[str] = None,
    config: Optional[dict[str, Any]] = None,
) -> SandboxBackend:
    """
    Get or create a backend instance.

    This is a convenience function for getting a backend without
    explicitly using the factory.

    Args:
        backend_type: Backend type ('orbstack' or 'tmux')
        config: Backend configuration

    Returns:
        Backend instance
    """
    global _current_backend

    if backend_type is None and _current_backend is not None:
        return _current_backend

    if backend_type is None:
        backend_type = "orbstack"  # Default

    if config is None:
        # Use minimal default config
        if backend_type == "orbstack":
            config = {
                "image_prefix": "agent-sandbox",
                "workspace_dir": "~/.agent-sandbox/orbstack-workspaces",
            }
        else:
            config = {
                "workspace_dir": "~/.agent-sandbox/tmux-workspaces",
                "capture_dir": "~/.agent-sandbox/tmux-captures",
            }

    backend = BackendFactory.create_backend(backend_type, config)
    _current_backend = backend
    return backend
