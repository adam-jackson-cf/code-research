"""Sandbox lifecycle facade module."""

from typing import Optional

from ..backends import get_backend, SandboxInfo


def create_sandbox(
    template: Optional[str] = None,
    timeout: Optional[int] = None,
    envs: Optional[dict[str, str]] = None,
    metadata: Optional[dict[str, str]] = None,
    backend_type: Optional[str] = None,
) -> str:
    """Create a new sandbox."""
    backend = get_backend(backend_type)
    return backend.create_sandbox(
        template=template,
        timeout=timeout,
        envs=envs,
        metadata=metadata,
    )


def kill_sandbox(sandbox_id: str, backend_type: Optional[str] = None) -> bool:
    """Kill a sandbox."""
    backend = get_backend(backend_type)
    return backend.kill_sandbox(sandbox_id)


def get_sandbox_info(
    sandbox_id: str, backend_type: Optional[str] = None
) -> SandboxInfo:
    """Get sandbox information."""
    backend = get_backend(backend_type)
    return backend.get_sandbox_info(sandbox_id)


def is_sandbox_running(sandbox_id: str, backend_type: Optional[str] = None) -> bool:
    """Check if sandbox is running."""
    backend = get_backend(backend_type)
    return backend.is_sandbox_running(sandbox_id)


def list_sandboxes(
    limit: int = 20, backend_type: Optional[str] = None
) -> list[SandboxInfo]:
    """List all sandboxes."""
    backend = get_backend(backend_type)
    return backend.list_sandboxes(limit=limit)
