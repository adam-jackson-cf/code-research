"""Search command for Parallel AI."""

from __future__ import annotations

import json
from typing import Annotated

import typer

from parallel.app import app
from parallel.client import api_request


@app.command()
def search(
    objective: Annotated[str, typer.Argument(help="Natural language search objective")],
    query: Annotated[
        list[str] | None,
        typer.Option("-q", "--query", help="Search queries (repeatable)"),
    ] = None,
    max_results: Annotated[int, typer.Option(help="Maximum results to return")] = 10,
    output_format: Annotated[
        str,
        typer.Option("--format", help="Output format"),
    ] = "json",
) -> None:
    """Search the web with a natural language objective.

    Examples
    --------
        parallel search "latest AI research on RAG"
        parallel search "climate change news" -q "climate 2024" -q "global warming"
    """
    queries = list(query) if query else [objective]

    payload = {
        "objective": objective,
        "search_queries": queries,
        "max_results": max_results,
        "excerpts": {"max_chars_per_result": 10000},
    }

    try:
        result = api_request("POST", "/v1beta/search", json=payload)

        if output_format == "markdown":
            _print_search_markdown(result)
        else:
            print(json.dumps(result, indent=2))

    except Exception as e:
        print(f"Error: {e}", file=typer.get_text_stream("stderr"))
        raise typer.Exit(1) from None


def _print_search_markdown(result: dict) -> None:
    """Print search results in markdown format."""
    print("# Search Results\n")
    print(f"**Search ID:** {result.get('search_id', 'N/A')}\n")

    results = result.get("results", [])
    if not results:
        print("No results found.")
        return

    for i, item in enumerate(results, 1):
        print(f"## {i}. {item.get('title', 'Untitled')}\n")
        print(f"**URL:** {item.get('url', 'N/A')}")
        if item.get("publish_date"):
            print(f"**Published:** {item['publish_date']}")
        print()
        excerpts = item.get("excerpts", [])
        if excerpts:
            print("### Excerpts\n")
            for excerpt in excerpts:
                print(f"> {excerpt}\n")
        print("---\n")
