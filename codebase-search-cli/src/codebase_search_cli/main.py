"""Main CLI application using Typer."""

from pathlib import Path
from typing import List, Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .config import Config
from .gemini_client import GeminiSearchClient

app = typer.Typer(
    name="codebase-search",
    help="Semantic codebase search using Google Gemini API",
    add_completion=False,
)
console = Console()


def get_config() -> Config:
    """Load and return configuration."""
    try:
        return Config.load_from_env()
    except Exception as e:
        console.print(f"[red]Error loading configuration: {e}[/red]")
        console.print("[yellow]Make sure you have a .env file with GOOGLE_API_KEY set.[/yellow]")
        raise typer.Exit(1)


def get_client() -> GeminiSearchClient:
    """Get configured Gemini client."""
    config = get_config()
    return GeminiSearchClient(config)


@app.command()
def init(
    name: str = typer.Option(..., "--name", "-n", help="Name for the file search store"),
    force: bool = typer.Option(False, "--force", "-f", help="Force recreate if exists"),
) -> None:
    """Initialize a new file search store for indexing."""
    config = get_config()

    if config.file_search_store_id and not force:
        console.print(f"[yellow]Store already exists: {config.file_search_store_name}[/yellow]")
        console.print("[yellow]Use --force to recreate.[/yellow]")
        raise typer.Exit(0)

    try:
        client = GeminiSearchClient(config)

        # Delete old store if force is enabled
        if force and config.file_search_store_name:
            console.print("[yellow]Deleting existing store...[/yellow]")
            try:
                client.delete_store(config.file_search_store_name)
            except Exception:
                pass  # Store might not exist

        console.print(f"[cyan]Creating file search store: {name}[/cyan]")
        store_id, store_name = client.create_store(name)

        config.save_store_info(store_id, store_name)

        console.print(
            Panel(
                f"[green]Store created successfully![/green]\n\n"
                f"Store ID: {store_id}\n"
                f"Store Name: {store_name}",
                title="Success",
                border_style="green",
            )
        )

    except Exception as e:
        console.print(f"[red]Error creating store: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def index(
    path: Path = typer.Argument(..., help="Path to codebase directory or file to index"),
    patterns: Optional[List[str]] = typer.Option(
        None,
        "--pattern",
        "-p",
        help="File patterns to include (e.g., '*.py', '*.js')",
    ),
    exclude: Optional[List[str]] = typer.Option(
        None,
        "--exclude",
        "-e",
        help="Patterns to exclude (e.g., 'node_modules', '.git')",
    ),
    recursive: bool = typer.Option(True, "--recursive/--no-recursive", "-r/-R"),
) -> None:
    """Index files from a codebase directory."""
    config = get_config()

    if not config.file_search_store_name:
        console.print("[red]No file search store initialized. Run 'init' first.[/red]")
        raise typer.Exit(1)

    if not path.exists():
        console.print(f"[red]Path does not exist: {path}[/red]")
        raise typer.Exit(1)

    try:
        client = GeminiSearchClient(config)

        # Collect files to index
        files_to_index: List[Path] = []

        if path.is_file():
            files_to_index.append(path)
        else:
            # Default patterns if none provided
            if not patterns:
                patterns = [
                    "*.py",
                    "*.js",
                    "*.ts",
                    "*.jsx",
                    "*.tsx",
                    "*.java",
                    "*.go",
                    "*.rs",
                    "*.c",
                    "*.cpp",
                    "*.h",
                    "*.hpp",
                    "*.cs",
                    "*.rb",
                    "*.php",
                    "*.swift",
                    "*.kt",
                    "*.scala",
                    "*.md",
                    "*.txt",
                ]

            # Default exclude patterns
            default_exclude = {
                ".git",
                "node_modules",
                "__pycache__",
                ".venv",
                "venv",
                "dist",
                "build",
            }
            if exclude:
                default_exclude.update(exclude)

            for pattern in patterns:
                if recursive:
                    found_files = path.rglob(pattern)
                else:
                    found_files = path.glob(pattern)

                for file_path in found_files:
                    # Check if file should be excluded
                    if any(excl in str(file_path) for excl in default_exclude):
                        continue
                    if file_path.is_file():
                        files_to_index.append(file_path)

        if not files_to_index:
            console.print("[yellow]No files found to index.[/yellow]")
            raise typer.Exit(0)

        console.print(f"[cyan]Found {len(files_to_index)} files to index[/cyan]")

        # Upload files with progress
        uploaded = 0
        failed = 0

        with console.status("[bold cyan]Indexing files...") as status:
            for file_path in files_to_index:
                try:
                    status.update(f"[cyan]Indexing: {file_path.name}[/cyan]")

                    # Add metadata
                    metadata = {
                        "file_path": str(file_path),
                        "extension": file_path.suffix,
                    }

                    client.upload_file(
                        file_path=file_path,
                        store_name=config.file_search_store_name,
                        display_name=str(file_path),
                        metadata=metadata,
                    )

                    uploaded += 1

                except Exception as e:
                    console.print(f"[red]Failed to index {file_path}: {e}[/red]")
                    failed += 1

        console.print(
            Panel(
                f"[green]Indexing complete![/green]\n\n"
                f"Successfully indexed: {uploaded}\n"
                f"Failed: {failed}",
                title="Summary",
                border_style="green",
            )
        )

    except Exception as e:
        console.print(f"[red]Error during indexing: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def search(
    query: str = typer.Argument(..., help="Search query (intent or phrase)"),
    top_k: int = typer.Option(5, "--top-k", "-k", help="Number of results to return"),
    filter_ext: Optional[str] = typer.Option(
        None,
        "--filter-ext",
        "-e",
        help="Filter by file extension (e.g., '.py')",
    ),
    show_sources: bool = typer.Option(True, "--sources/--no-sources", "-s/-S"),
) -> None:
    """Search the indexed codebase using semantic search."""
    config = get_config()

    if not config.file_search_store_name:
        console.print("[red]No file search store initialized. Run 'init' first.[/red]")
        raise typer.Exit(1)

    try:
        client = GeminiSearchClient(config)

        # Build metadata filter if needed
        metadata_filter = None
        if filter_ext:
            metadata_filter = f"extension={filter_ext}"

        console.print(f"[cyan]Searching for: {query}[/cyan]\n")

        with console.status("[bold cyan]Searching..."):
            result = client.search(
                query=query,
                store_name=config.file_search_store_name,
                top_k=top_k,
                metadata_filter=metadata_filter,
            )

        # Display results
        if result["text"]:
            console.print(
                Panel(
                    result["text"],
                    title="Search Result",
                    border_style="blue",
                )
            )
        else:
            console.print("[yellow]No results found.[/yellow]")

        # Display sources
        if show_sources and result["sources"]:
            console.print("\n[bold cyan]Sources:[/bold cyan]")
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("File", style="cyan")
            table.add_column("URI", style="dim")

            for source in result["sources"]:
                table.add_row(source.get("title", ""), source.get("uri", ""))

            console.print(table)

    except Exception as e:
        console.print(f"[red]Error during search: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def list_files() -> None:
    """List all files in the current file search store."""
    config = get_config()

    if not config.file_search_store_name:
        console.print("[red]No file search store initialized. Run 'init' first.[/red]")
        raise typer.Exit(1)

    try:
        client = GeminiSearchClient(config)
        files = client.list_files(config.file_search_store_name)

        if not files:
            console.print("[yellow]No files indexed yet.[/yellow]")
            raise typer.Exit(0)

        console.print(f"[cyan]Found {len(files)} indexed files:[/cyan]\n")

        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Display Name", style="cyan")
        table.add_column("Size", style="green", justify="right")
        table.add_column("State", style="yellow")

        for file_info in files:
            size_kb = file_info.get("size_bytes", 0) / 1024
            table.add_row(
                file_info.get("display_name", ""),
                f"{size_kb:.2f} KB",
                file_info.get("state", "unknown"),
            )

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error listing files: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def info() -> None:
    """Display information about the current configuration."""
    config = get_config()

    info_text = f"""
[cyan]Configuration:[/cyan]

API Key: {'*' * 10}{config.google_api_key[-4:] if config.google_api_key else 'Not set'}
Model: {config.model_name}
Store ID: {config.file_search_store_id or 'Not initialized'}
Store Name: {config.file_search_store_name or 'Not initialized'}

[cyan]Chunking Configuration:[/cyan]
Max Tokens per Chunk: {config.max_tokens_per_chunk}
Max Overlap Tokens: {config.max_overlap_tokens}
    """

    console.print(Panel(info_text.strip(), title="Codebase Search Info", border_style="blue"))


@app.command()
def clear(
    confirm: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation prompt"),
) -> None:
    """Delete the current file search store."""
    config = get_config()

    if not config.file_search_store_name:
        console.print("[yellow]No file search store to delete.[/yellow]")
        raise typer.Exit(0)

    if not confirm:
        delete = typer.confirm(
            f"Are you sure you want to delete store '{config.file_search_store_name}'?"
        )
        if not delete:
            console.print("[yellow]Cancelled.[/yellow]")
            raise typer.Exit(0)

    try:
        client = GeminiSearchClient(config)
        client.delete_store(config.file_search_store_name)

        # Clear from .env
        env_path = Path(".env")
        if env_path.exists():
            lines = []
            with open(env_path, "r") as f:
                lines = [
                    line for line in f.readlines() if not line.startswith("FILE_SEARCH_STORE_")
                ]
            with open(env_path, "w") as f:
                f.writelines(lines)

        console.print("[green]Store deleted successfully![/green]")

    except Exception as e:
        console.print(f"[red]Error deleting store: {e}[/red]")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
