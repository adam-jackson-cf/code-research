"""Setup command group for the Enaible CLI.

Provides portable wrappers for setup scripts in shared/setup/,
enabling prompts to call enaible CLI commands instead of repo-specific paths.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import typer

from ..app import app
from ..runtime.context import load_workspace

_setup_app = typer.Typer(help="Run setup utilities for development environments.")
app.add_typer(_setup_app, name="setup")


def _env_with_shared(shared_root: Path) -> dict[str, str]:
    """Return environment mapping that ensures shared/ is importable."""
    env = os.environ.copy()
    pythonpath = env.get("PYTHONPATH", "")
    if pythonpath:
        env["PYTHONPATH"] = f"{shared_root}{os.pathsep}{pythonpath}"
    else:
        env["PYTHONPATH"] = str(shared_root)
    return env


@_setup_app.command("monitoring-deps")
def monitoring_deps(
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Check for missing tools without installing.",
    ),
) -> None:
    """Install development monitoring dependencies (make, watchexec, foreman)."""
    workspace = load_workspace()
    script = (
        workspace.shared_root
        / "setup"
        / "monitoring"
        / "install_monitoring_dependencies.py"
    )

    if not script.exists():
        typer.echo(
            f"Monitoring dependencies script not found at {script}.\n"
            "Re-run `enaible install claude-code --sync-shared` to sync workspace assets.",
            err=True,
        )
        raise typer.Exit(code=1)

    args: list[str] = []
    if dry_run:
        args.append("--dry-run")

    env = _env_with_shared(workspace.shared_root)
    proc = subprocess.run([sys.executable, str(script), *args], env=env)
    raise typer.Exit(code=proc.returncode)


@_setup_app.command("package-monitoring")
def package_monitoring(
    audit_level: str = typer.Option(
        "critical",
        "--audit-level",
        help="Security audit severity level.",
    ),
    branch_protection: bool = typer.Option(
        False,
        "--branch-protection/--no-branch-protection",
        help="Setup branch protection rules.",
    ),
    package_file: str
    | None = typer.Option(
        None,
        "--package-file",
        help="Specify package file directly to skip ecosystem detection.",
    ),
    exclude: list[str] = typer.Option(
        [],
        "--exclude",
        "-x",
        help="Exclude directories/files from package search (repeatable).",
    ),
) -> None:
    """Configure Dependabot and path-triggered CI auditing for package security."""
    workspace = load_workspace()
    script = (
        workspace.shared_root / "setup" / "security" / "setup_package_monitoring.py"
    )

    if not script.exists():
        typer.echo(
            f"Package monitoring script not found at {script}.\n"
            "Re-run `enaible install claude-code --sync-shared` to sync workspace assets.",
            err=True,
        )
        raise typer.Exit(code=1)

    args: list[str] = [
        "--audit-level",
        audit_level,
        "--branch-protection",
        "true" if branch_protection else "false",
    ]

    if package_file:
        args.extend(["--package-file", package_file])

    for exc in exclude:
        args.extend(["--exclude", exc])

    env = _env_with_shared(workspace.shared_root)
    proc = subprocess.run([sys.executable, str(script), *args], env=env)
    raise typer.Exit(code=proc.returncode)
