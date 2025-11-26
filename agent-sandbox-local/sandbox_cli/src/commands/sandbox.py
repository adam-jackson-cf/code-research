"""Sandbox lifecycle management commands."""

import click
from rich.console import Console
from rich.table import Table

from ..backends import BackendFactory, SandboxStatus
from ..config import load_config
from ..utils.logging import get_logger

logger = get_logger(__name__)
console = Console()


def get_backend(backend_type: str = None):
    """Get backend instance."""
    config = load_config()
    backend_type = backend_type or config.backend.default
    backend_config = config.get_backend_config(backend_type)
    return BackendFactory.create_backend(backend_type, backend_config)


@click.group()
def sandbox():
    """Sandbox lifecycle management commands."""
    pass


@sandbox.command("create")
@click.option("--template", "-t", default=None, help="Template name (base, python, node, full)")
@click.option("--timeout", type=int, default=1800, help="Timeout in seconds (default: 1800)")
@click.option("--env", "-e", multiple=True, help="Environment variable (KEY=VALUE)")
@click.option("--metadata", "-m", multiple=True, help="Metadata (KEY=VALUE)")
@click.option("--backend", "-b", default=None, help="Backend type (orbstack, tmux)")
def create(template, timeout, env, metadata, backend):
    """Create a new sandbox."""
    try:
        backend_instance = get_backend(backend)

        # Parse environment variables
        envs = {}
        for e in env:
            if "=" in e:
                key, value = e.split("=", 1)
                envs[key] = value

        # Parse metadata
        meta = {}
        for m in metadata:
            if "=" in m:
                key, value = m.split("=", 1)
                meta[key] = value

        sandbox_id = backend_instance.create_sandbox(
            template=template,
            timeout=timeout,
            envs=envs if envs else None,
            metadata=meta if meta else None,
        )

        console.print(f"[green]Created sandbox:[/green] {sandbox_id}")
        print(sandbox_id)  # Plain output for scripting

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@sandbox.command("kill")
@click.argument("sandbox_id")
@click.option("--backend", "-b", default=None, help="Backend type")
def kill(sandbox_id, backend):
    """Kill a sandbox."""
    try:
        backend_instance = get_backend(backend)
        result = backend_instance.kill_sandbox(sandbox_id)

        if result:
            console.print(f"[green]Killed sandbox:[/green] {sandbox_id}")
        else:
            console.print(f"[yellow]Sandbox not found or already killed:[/yellow] {sandbox_id}")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@sandbox.command("info")
@click.argument("sandbox_id")
@click.option("--backend", "-b", default=None, help="Backend type")
def info(sandbox_id, backend):
    """Get sandbox information."""
    try:
        backend_instance = get_backend(backend)
        info = backend_instance.get_sandbox_info(sandbox_id)

        table = Table(title=f"Sandbox: {sandbox_id}")
        table.add_column("Property", style="cyan")
        table.add_column("Value", style="green")

        table.add_row("ID", info.sandbox_id)
        table.add_row("Backend", info.backend_type)
        table.add_row("Status", info.status.value)
        table.add_row("Created", info.created_at)
        table.add_row("Template", info.template or "N/A")

        if info.metadata:
            for key, value in info.metadata.items():
                table.add_row(f"Meta: {key}", value)

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@sandbox.command("status")
@click.argument("sandbox_id")
@click.option("--backend", "-b", default=None, help="Backend type")
def status(sandbox_id, backend):
    """Check if sandbox is running."""
    try:
        backend_instance = get_backend(backend)
        is_running = backend_instance.is_sandbox_running(sandbox_id)

        if is_running:
            console.print(f"[green]running[/green]")
            print("running")
        else:
            console.print(f"[red]stopped[/red]")
            print("stopped")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@sandbox.command("list")
@click.option("--limit", "-n", default=20, help="Maximum number of sandboxes to list")
@click.option("--backend", "-b", default=None, help="Backend type")
def list_sandboxes(limit, backend):
    """List all sandboxes."""
    try:
        backend_instance = get_backend(backend)
        sandboxes = backend_instance.list_sandboxes(limit=limit)

        if not sandboxes:
            console.print("[yellow]No sandboxes found[/yellow]")
            return

        table = Table(title="Sandboxes")
        table.add_column("ID", style="cyan")
        table.add_column("Backend", style="blue")
        table.add_column("Status", style="green")
        table.add_column("Template", style="magenta")
        table.add_column("Created", style="dim")

        for sbx in sandboxes:
            status_style = "green" if sbx.status == SandboxStatus.RUNNING else "red"
            table.add_row(
                sbx.sandbox_id,
                sbx.backend_type,
                f"[{status_style}]{sbx.status.value}[/{status_style}]",
                sbx.template or "N/A",
                sbx.created_at[:19] if sbx.created_at else "N/A",
            )

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@sandbox.command("pause")
@click.argument("sandbox_id")
@click.option("--backend", "-b", default=None, help="Backend type")
def pause(sandbox_id, backend):
    """Pause a sandbox (OrbStack only)."""
    try:
        backend_instance = get_backend(backend)
        result = backend_instance.pause_sandbox(sandbox_id)

        if result:
            console.print(f"[green]Paused sandbox:[/green] {sandbox_id}")
        else:
            console.print(f"[yellow]Could not pause sandbox[/yellow]")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@sandbox.command("resume")
@click.argument("sandbox_id")
@click.option("--backend", "-b", default=None, help="Backend type")
def resume(sandbox_id, backend):
    """Resume a paused sandbox (OrbStack only)."""
    try:
        backend_instance = get_backend(backend)
        result = backend_instance.resume_sandbox(sandbox_id)

        if result:
            console.print(f"[green]Resumed sandbox:[/green] {sandbox_id}")
        else:
            console.print(f"[yellow]Could not resume sandbox[/yellow]")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@sandbox.command("get-host")
@click.argument("sandbox_id")
@click.option("--port", "-p", type=int, required=True, help="Port number")
@click.option("--backend", "-b", default=None, help="Backend type")
def get_host(sandbox_id, port, backend):
    """Get public URL for sandbox port."""
    try:
        backend_instance = get_backend(backend)
        host = backend_instance.get_host(sandbox_id, port)

        console.print(f"[green]{host}[/green]")
        print(host)

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)
