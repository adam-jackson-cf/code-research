"""FindAll command for Parallel AI."""

from __future__ import annotations

from typing import Annotated

import typer

from parallel.app import app
from parallel.client import api_request


@app.command()
def findall(
    objective: Annotated[
        str, typer.Argument(help="Natural language discovery objective")
    ],
    entity: Annotated[
        str,
        typer.Option(
            "--entity", "-e", help="Entity type (e.g., company, person, product)"
        ),
    ],
    condition: Annotated[
        list[str] | None,
        typer.Option("--condition", "-c", help="Match conditions (repeatable)"),
    ] = None,
    limit: Annotated[
        int,
        typer.Option("--limit", "-l", help="Maximum matches (5-1000)"),
    ] = 100,
    generator: Annotated[
        str,
        typer.Option("--generator", "-g", help="Generator tier: base, core, or pro"),
    ] = "base",
) -> None:
    """Discover entities matching criteria (async).

    Returns a findall_id immediately. Use 'parallel status <findall_id>' to check
    progress and 'parallel result <findall_id>' to fetch matched entities.

    Examples
    --------
        parallel findall "AI startups in SF" --entity company --limit 50
        parallel findall "ML researchers" --entity person -c "works at university" -c "published papers"
    """
    if generator not in ("base", "core", "pro"):
        print(f"Error: Invalid generator '{generator}'. Use 'base', 'core', or 'pro'.")
        raise typer.Exit(1)

    if not 5 <= limit <= 1000:
        print(f"Error: Limit must be between 5 and 1000, got {limit}.")
        raise typer.Exit(1)

    # Build match conditions from the condition flags
    match_conditions = []
    if condition:
        for i, cond in enumerate(condition, 1):
            match_conditions.append(
                {
                    "name": f"condition_{i}",
                    "description": cond,
                }
            )
    else:
        # Default condition derived from objective
        match_conditions.append(
            {
                "name": "primary_criteria",
                "description": objective,
            }
        )

    payload = {
        "objective": objective,
        "entity_type": entity,
        "match_conditions": match_conditions,
        "generator": generator,
        "match_limit": limit,
    }

    try:
        result = api_request("POST", "/v1beta/findall/runs", json=payload)

        findall_id = result.get("findall_id", "unknown")
        status_info = result.get("status", {})
        status = (
            status_info.get("status", "unknown")
            if isinstance(status_info, dict)
            else "unknown"
        )

        print("FindAll task created successfully!")
        print(f"  FindAll ID: {findall_id}")
        print(f"  Status: {status}")
        print(f"  Generator: {generator}")
        print(f"  Limit: {limit}")
        print(f"\nCheck progress: parallel status {findall_id} --type findall")
        print(f"Get results:    parallel result {findall_id} --type findall")

    except Exception as e:
        print(f"Error: {e}", file=typer.get_text_stream("stderr"))
        raise typer.Exit(1) from None
