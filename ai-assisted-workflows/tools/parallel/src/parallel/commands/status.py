"""Status and result commands for Parallel AI."""

from __future__ import annotations

import json
from typing import Annotated

import typer

from parallel.app import app
from parallel.client import api_request


@app.command()
def status(
    run_id: Annotated[str, typer.Argument(help="Task run_id or FindAll findall_id")],
    run_type: Annotated[
        str | None,
        typer.Option(
            "--type",
            "-t",
            help="Run type: task or findall (auto-detected if not specified)",
        ),
    ] = None,
) -> None:
    """Check the status of an async operation.

    Examples
    --------
        parallel status trun_abc123
        parallel status fa_xyz789 --type findall
    """
    # Auto-detect type from ID prefix
    if run_type is None:
        if run_id.startswith("trun_"):
            run_type = "task"
        elif run_id.startswith("fa_"):
            run_type = "findall"
        else:
            print(
                "Error: Could not auto-detect run type. Please specify --type task or --type findall"
            )
            raise typer.Exit(1)

    try:
        if run_type == "task":
            result = api_request("GET", f"/v1/tasks/runs/{run_id}", use_beta=False)
        else:
            result = api_request("GET", f"/v1beta/findall/runs/{run_id}")

        print(json.dumps(result, indent=2))

    except Exception as e:
        print(f"Error: {e}", file=typer.get_text_stream("stderr"))
        raise typer.Exit(1) from None


@app.command()
def result(
    run_id: Annotated[str, typer.Argument(help="Task run_id or FindAll findall_id")],
    run_type: Annotated[
        str | None,
        typer.Option(
            "--type",
            "-t",
            help="Run type: task or findall (auto-detected if not specified)",
        ),
    ] = None,
    output_file: Annotated[
        str | None,
        typer.Option("--output", "-o", help="Write results to file"),
    ] = None,
    output_format: Annotated[
        str,
        typer.Option("--format", help="Output format"),
    ] = "json",
) -> None:
    """Fetch results of a completed async operation.

    For tasks, this blocks until completion and returns the enriched data.
    For findall, this returns the matched candidates.

    Examples
    --------
        parallel result trun_abc123
        parallel result fa_xyz789 --type findall --output results.json
    """
    # Auto-detect type from ID prefix
    if run_type is None:
        if run_id.startswith("trun_"):
            run_type = "task"
        elif run_id.startswith("fa_"):
            run_type = "findall"
        else:
            print(
                "Error: Could not auto-detect run type. Please specify --type task or --type findall"
            )
            raise typer.Exit(1)

    try:
        if run_type == "task":
            # Task result endpoint blocks until completion
            result = api_request(
                "GET", f"/v1/tasks/runs/{run_id}/result", use_beta=False
            )
        else:
            # FindAll returns candidates
            result = api_request("GET", f"/v1beta/findall/runs/{run_id}/candidates")

        output = json.dumps(result, indent=2)

        if output_file:
            with open(output_file, "w") as f:
                f.write(output)
            print(f"Results written to {output_file}")
        else:
            if output_format == "markdown" and run_type == "task":
                _print_task_result_markdown(result)
            elif output_format == "markdown" and run_type == "findall":
                _print_findall_result_markdown(result)
            else:
                print(output)

    except Exception as e:
        print(f"Error: {e}", file=typer.get_text_stream("stderr"))
        raise typer.Exit(1) from None


def _print_task_result_markdown(result: dict) -> None:
    """Print task results in markdown format."""
    print("# Task Result\n")

    run_info = result.get("run", {})
    if run_info:
        print(f"**Status:** {run_info.get('status', 'N/A')}\n")

    output = result.get("output", {})
    if output:
        content = output.get("content", {})
        print("## Output\n")
        print(json.dumps(content, indent=2))

        basis = output.get("basis", [])
        if basis:
            print("\n## Basis & Citations\n")
            for item in basis:
                field = item.get("field", "unknown")
                confidence = item.get("confidence", "N/A")
                reasoning = item.get("reasoning", "")
                print(f"### {field} (confidence: {confidence})\n")
                if reasoning:
                    print(f"{reasoning}\n")
                citations = item.get("citations", [])
                if citations:
                    print("**Sources:**")
                    for cite in citations:
                        print(f"- [{cite.get('title', 'N/A')}]({cite.get('url', '')})")
                    print()


def _print_findall_result_markdown(result: dict) -> None:
    """Print findall results in markdown format."""
    print("# FindAll Results\n")

    candidates = result.get("candidates", [])
    if not candidates:
        print("No candidates found.")
        return

    print(f"**Total Candidates:** {len(candidates)}\n")

    for i, candidate in enumerate(candidates, 1):
        name = candidate.get("name", f"Candidate {i}")
        print(f"## {i}. {name}\n")

        # Print all fields except name
        for key, value in candidate.items():
            if key != "name":
                print(f"- **{key}:** {value}")
        print()
