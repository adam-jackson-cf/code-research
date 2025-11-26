"""File operation commands."""

import sys

import click
from rich.console import Console
from rich.table import Table

from ..backends import BackendFactory
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
def files():
    """File operation commands."""
    pass


@files.command("ls")
@click.argument("sandbox_id")
@click.option("--path", "-p", default="/workspace", help="Directory path")
@click.option("--depth", "-d", default=1, help="Directory depth")
@click.option("--backend", "-b", default=None, help="Backend type")
def ls(sandbox_id, path, depth, backend):
    """List files in sandbox directory."""
    try:
        backend_instance = get_backend(backend)
        files_list = backend_instance.list_files(sandbox_id, path, depth)

        if not files_list:
            console.print("[yellow]No files found[/yellow]")
            return

        table = Table(title=f"Files in {path}")
        table.add_column("Type", style="cyan", width=4)
        table.add_column("Name", style="green")
        table.add_column("Size", style="blue", justify="right")
        table.add_column("Permissions", style="dim")

        for f in files_list:
            type_icon = "📁" if f.type == "dir" else "📄"
            size_str = f"{f.size:,}" if f.size else "-"
            table.add_row(type_icon, f.name, size_str, f.permissions)

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@files.command("read")
@click.argument("sandbox_id")
@click.argument("path")
@click.option("--backend", "-b", default=None, help="Backend type")
def read(sandbox_id, path, backend):
    """Read file content from sandbox."""
    try:
        backend_instance = get_backend(backend)
        content = backend_instance.read_file(sandbox_id, path)
        print(content)

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@files.command("write")
@click.argument("sandbox_id")
@click.argument("path")
@click.option("--content", "-c", default=None, help="Content to write")
@click.option("--stdin", is_flag=True, help="Read content from stdin")
@click.option("--backend", "-b", default=None, help="Backend type")
def write(sandbox_id, path, content, stdin, backend):
    """Write content to file in sandbox."""
    try:
        backend_instance = get_backend(backend)

        if stdin:
            content = sys.stdin.read()
        elif content is None:
            console.print("[red]Error:[/red] Provide --content or --stdin")
            raise SystemExit(1)

        file_info = backend_instance.write_file(sandbox_id, path, content)
        console.print(f"[green]Written:[/green] {file_info.path} ({file_info.size} bytes)")

    except SystemExit:
        raise
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@files.command("exists")
@click.argument("sandbox_id")
@click.argument("path")
@click.option("--backend", "-b", default=None, help="Backend type")
def exists(sandbox_id, path, backend):
    """Check if file exists in sandbox."""
    try:
        backend_instance = get_backend(backend)
        file_exists = backend_instance.file_exists(sandbox_id, path)

        if file_exists:
            console.print("[green]true[/green]")
            print("true")
        else:
            console.print("[red]false[/red]")
            print("false")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@files.command("info")
@click.argument("sandbox_id")
@click.argument("path")
@click.option("--backend", "-b", default=None, help="Backend type")
def info(sandbox_id, path, backend):
    """Get file information."""
    try:
        backend_instance = get_backend(backend)
        file_info = backend_instance.get_file_info(sandbox_id, path)

        table = Table(title=f"File: {path}")
        table.add_column("Property", style="cyan")
        table.add_column("Value", style="green")

        table.add_row("Name", file_info.name)
        table.add_row("Path", file_info.path)
        table.add_row("Type", file_info.type)
        table.add_row("Size", f"{file_info.size:,} bytes")
        table.add_row("Permissions", file_info.permissions)
        if file_info.modified_at:
            table.add_row("Modified", file_info.modified_at)

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@files.command("rm")
@click.argument("sandbox_id")
@click.argument("path")
@click.option("--backend", "-b", default=None, help="Backend type")
def rm(sandbox_id, path, backend):
    """Remove file or directory from sandbox."""
    try:
        backend_instance = get_backend(backend)
        backend_instance.remove_file(sandbox_id, path)
        console.print(f"[green]Removed:[/green] {path}")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@files.command("mkdir")
@click.argument("sandbox_id")
@click.argument("path")
@click.option("--backend", "-b", default=None, help="Backend type")
def mkdir(sandbox_id, path, backend):
    """Create directory in sandbox."""
    try:
        backend_instance = get_backend(backend)
        backend_instance.make_directory(sandbox_id, path)
        console.print(f"[green]Created directory:[/green] {path}")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


@files.command("mv")
@click.argument("sandbox_id")
@click.argument("old_path")
@click.argument("new_path")
@click.option("--backend", "-b", default=None, help="Backend type")
def mv(sandbox_id, old_path, new_path, backend):
    """Rename/move file in sandbox."""
    try:
        backend_instance = get_backend(backend)
        file_info = backend_instance.rename_file(sandbox_id, old_path, new_path)
        console.print(f"[green]Moved:[/green] {old_path} -> {file_info.path}")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)
