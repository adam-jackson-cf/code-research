"""Command execution facade module."""

from typing import Optional

from ..backends import get_backend, CommandResult


def run_command(
    sandbox_id: str,
    command: str,
    cwd: Optional[str] = None,
    envs: Optional[dict[str, str]] = None,
    timeout: Optional[float] = 60,
    shell: bool = True,
    backend_type: Optional[str] = None,
) -> CommandResult:
    """Run command in sandbox."""
    backend = get_backend(backend_type)
    return backend.run_command(
        sandbox_id=sandbox_id,
        command=command,
        cwd=cwd,
        envs=envs,
        timeout=timeout,
        shell=shell,
    )


def run_command_background(
    sandbox_id: str,
    command: str,
    cwd: Optional[str] = None,
    envs: Optional[dict[str, str]] = None,
    backend_type: Optional[str] = None,
) -> CommandResult:
    """Run command in background."""
    backend = get_backend(backend_type)
    return backend.run_command_background(
        sandbox_id=sandbox_id,
        command=command,
        cwd=cwd,
        envs=envs,
    )
