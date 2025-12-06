"""Extract command for Parallel AI."""

from __future__ import annotations

import json
from typing import Annotated

import typer

from parallel.app import app
from parallel.client import api_request


@app.command()
def extract(
    url: Annotated[str, typer.Argument(help="URL to extract content from")],
    objective: Annotated[
        str | None,
        typer.Option("--objective", "-o", help="What to focus on when extracting"),
    ] = None,
    full_content: Annotated[
        bool,
        typer.Option("--full-content", "-f", help="Return full page content"),
    ] = False,
    output_format: Annotated[
        str,
        typer.Option("--format", help="Output format"),
    ] = "json",
) -> None:
    """Extract content from a URL.

    Examples
    --------
        parallel extract https://example.com
        parallel extract https://example.com --objective "key findings"
        parallel extract https://example.com --full-content
    """
    payload: dict = {
        "urls": [url],
        "excerpts": not full_content,
        "full_content": full_content,
    }
    if objective:
        payload["objective"] = objective

    try:
        result = api_request("POST", "/v1beta/extract", json=payload)

        if output_format == "markdown":
            _print_extract_markdown(result)
        else:
            print(json.dumps(result, indent=2))

    except Exception as e:
        print(f"Error: {e}", file=typer.get_text_stream("stderr"))
        raise typer.Exit(1) from None


def _print_extract_markdown(result: dict) -> None:
    """Print extraction results in markdown format."""
    print("# Extraction Results\n")
    print(f"**Extract ID:** {result.get('extract_id', 'N/A')}\n")

    results = result.get("results", [])
    if not results:
        print("No content extracted.")
        return

    for item in results:
        print(f"## {item.get('title', 'Untitled')}\n")
        print(f"**URL:** {item.get('url', 'N/A')}")
        if item.get("publish_date"):
            print(f"**Published:** {item['publish_date']}")
        print()

        if item.get("full_content"):
            print("### Content\n")
            print(item["full_content"])
        elif item.get("excerpts"):
            print("### Excerpts\n")
            for excerpt in item["excerpts"]:
                print(f"> {excerpt}\n")
        print("---\n")
