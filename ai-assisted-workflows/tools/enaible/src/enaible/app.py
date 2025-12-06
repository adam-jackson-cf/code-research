"""Root Typer application for the Enaible CLI."""

from __future__ import annotations

import typer

app = typer.Typer(help="Unified CLI for AI-Assisted Workflows.")


@app.callback()
def main() -> None:
    """Configure top-level CLI callbacks if needed."""
    # Intentionally empty: subcommands are registered via modules.
    return None
