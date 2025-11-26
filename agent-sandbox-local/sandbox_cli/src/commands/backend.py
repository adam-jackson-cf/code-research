"""Backend management commands."""

import click
from rich.console import Console
from rich.table import Table

from ..backends import BackendFactory
from ..config import load_config
from ..utils.logging import get_logger

logger = get_logger(__name__)
console = Console()


@click.group()
def backend():
    """Backend management commands."""
    pass


@backend.command("list")
def list_backends():
    """List available backends."""
    backends = BackendFactory.list_backends()

    config = load_config()
    default_backend = config.backend.default

    table = Table(title="Available Backends")
    table.add_column("Name", style="cyan")
    table.add_column("Default", style="green")
    table.add_column("Description")

    descriptions = {
        "orbstack": "Docker containers via OrbStack/Docker (isolated)",
        "tmux": "Tmux terminal sessions (lightweight, observable)",
    }

    for name in backends:
        is_default = "✓" if name == default_backend else ""
        desc = descriptions.get(name, "")
        table.add_row(name, is_default, desc)

    console.print(table)


@backend.command("health")
@click.option("--backend", "-b", default=None, help="Backend type (check all if not specified)")
def health(backend):
    """Check backend health."""
    config = load_config()

    if backend:
        backends_to_check = [backend]
    else:
        backends_to_check = BackendFactory.list_backends()

    table = Table(title="Backend Health")
    table.add_column("Backend", style="cyan")
    table.add_column("Status", style="green")
    table.add_column("Details")

    for backend_name in backends_to_check:
        try:
            backend_config = config.get_backend_config(backend_name)
            backend_instance = BackendFactory.create_backend(
                backend_name, backend_config, cache=False
            )
            health_info = backend_instance.health_check()

            status = health_info.get("status", "unknown")
            status_style = "green" if status == "healthy" else "red"

            # Build details string
            details = []
            for key, value in health_info.items():
                if key not in ("status", "backend"):
                    details.append(f"{key}={value}")

            table.add_row(
                backend_name,
                f"[{status_style}]{status}[/{status_style}]",
                ", ".join(details) if details else "",
            )

        except Exception as e:
            table.add_row(
                backend_name,
                "[red]error[/red]",
                str(e)[:50],
            )

    console.print(table)


@backend.command("info")
@click.argument("backend_name")
def info(backend_name):
    """Get detailed backend information."""
    try:
        config = load_config()
        backend_config = config.get_backend_config(backend_name)

        table = Table(title=f"Backend: {backend_name}")
        table.add_column("Setting", style="cyan")
        table.add_column("Value", style="green")

        def add_config_rows(d: dict, prefix: str = ""):
            for key, value in d.items():
                full_key = f"{prefix}{key}" if prefix else key
                if isinstance(value, dict):
                    add_config_rows(value, f"{full_key}.")
                else:
                    table.add_row(full_key, str(value))

        add_config_rows(backend_config)

        # Add health info
        try:
            backend_instance = BackendFactory.create_backend(
                backend_name, backend_config, cache=False
            )
            health_info = backend_instance.health_check()

            table.add_section()
            table.add_row("[bold]Health Check[/bold]", "")

            for key, value in health_info.items():
                table.add_row(f"  {key}", str(value))

        except Exception as e:
            table.add_section()
            table.add_row("[red]Health Check Failed[/red]", str(e))

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)
