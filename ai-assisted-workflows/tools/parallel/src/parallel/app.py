"""Root Typer application for Parallel AI CLI."""

from __future__ import annotations

import typer

app = typer.Typer(
    name="parallel",
    help="Parallel AI Web Intelligence Tools.",
    no_args_is_help=True,
)


@app.callback()
def main() -> None:
    """Parallel AI CLI - Web intelligence and research tools."""
    pass


# Import commands to register them with the app
from parallel.commands import extract, findall, search, status, task  # noqa: E402, F401
