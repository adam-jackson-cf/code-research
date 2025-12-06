"""Prompt command group for Enaible CLI."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from pathlib import Path, Path as _Path

import typer

from ..app import app
from ..prompts.catalog import PromptDefinition
from ..prompts.lint import lint_files
from ..prompts.renderer import PromptRenderer
from ..runtime.context import load_workspace

_prompts_app = typer.Typer(help="Render and validate managed prompts.")
app.add_typer(_prompts_app, name="prompts")


def _resolve_prompt_ids(
    catalog: dict[str, PromptDefinition], prompts: Sequence[str]
) -> list[str]:
    if not prompts or prompts == ["all"]:
        return list(catalog.keys())

    catalog_ids = set(catalog.keys())
    unknown = [prompt for prompt in prompts if prompt not in catalog_ids]
    if unknown:
        available = ", ".join(sorted(catalog_ids))
        raise typer.BadParameter(
            f"Unknown prompt(s): {', '.join(unknown)}. Available: {available}"
        )
    return list(prompts)


def _resolve_systems(
    catalog: dict[str, PromptDefinition],
    prompt_ids: Iterable[str],
    systems: Sequence[str],
) -> list[str]:
    if not systems or systems == ["all"]:
        supported: set[str] = set()
        for prompt_id in prompt_ids:
            definition = catalog[prompt_id]
            supported.update(definition.systems.keys())  # type: ignore[attr-defined]
        return sorted(supported)

    return list(systems)


def _build_overrides(
    selected_systems: list[str], out: Path | None
) -> dict[str, Path | None]:
    if out is None:
        return dict.fromkeys(selected_systems)

    overrides: dict[str, Path | None] = {}
    if len(selected_systems) == 1:
        overrides[selected_systems[0]] = out
        return overrides

    for system in selected_systems:
        overrides[system] = out / system
    return overrides


def _split_csv(value: str) -> list[str]:
    if not value or value.lower() == "all":
        return ["all"]
    return [item.strip() for item in value.split(",") if item.strip()]


@_prompts_app.command("list")
def prompts_list() -> None:
    """List prompts known to the catalog."""
    context = load_workspace()
    renderer = PromptRenderer(context)
    for definition in renderer.list_prompts():
        systems = ", ".join(sorted(definition.systems.keys()))
        typer.echo(f"{definition.prompt_id}: {definition.title} [{systems}]")


@_prompts_app.command("render")
def prompts_render(
    prompts: str = typer.Option(
        "all",
        "--prompt",
        help="Comma-separated prompt identifiers or 'all'.",
    ),
    systems: str = typer.Option(
        "all",
        "--system",
        help="Comma-separated system identifiers or 'all'.",
    ),
    out: Path
    | None = typer.Option(
        None,
        "--out",
        "-o",
        help="Optional override directory for rendered output.",
    ),
) -> None:
    """Render prompts for the selected systems."""
    context = load_workspace()
    renderer = PromptRenderer(context)
    catalog = {
        definition.prompt_id: definition for definition in renderer.list_prompts()
    }

    prompt_args = _split_csv(prompts)
    system_args = _split_csv(systems)

    selected_prompts = _resolve_prompt_ids(catalog, prompt_args)
    selected_systems = _resolve_systems(catalog, selected_prompts, system_args)
    overrides = _build_overrides(selected_systems, out)

    results = renderer.render(selected_prompts, selected_systems, overrides)

    for result in results:
        result.write()
        typer.echo(
            f"Rendered {result.prompt_id} for {result.system} → {result.output_path}"
        )


@_prompts_app.command("diff")
def prompts_diff(
    prompts: str = typer.Option("all", "--prompt"),
    systems: str = typer.Option("all", "--system"),
) -> None:
    """Show diffs between catalog output and current files."""
    context = load_workspace()
    renderer = PromptRenderer(context)
    catalog = {
        definition.prompt_id: definition for definition in renderer.list_prompts()
    }

    prompt_args = _split_csv(prompts)
    system_args = _split_csv(systems)

    selected_prompts = _resolve_prompt_ids(catalog, prompt_args)
    selected_systems = _resolve_systems(catalog, selected_prompts, system_args)

    results = renderer.render(selected_prompts, selected_systems)

    has_diff = False
    for result in results:
        diff_output = result.diff()
        if diff_output:
            has_diff = True
            typer.echo(diff_output)

    if has_diff:
        raise typer.Exit(code=1)


@_prompts_app.command("validate")
def prompts_validate(
    prompts: str = typer.Option("all", "--prompt"),
    systems: str = typer.Option("all", "--system"),
) -> None:
    """Validate that rendered prompts match committed files."""
    try:
        prompts_diff(prompts=prompts, systems=systems)
    except typer.Exit as exc:
        if exc.exit_code != 0:
            typer.echo("Prompt drift detected. Run `enaible prompts render` to update.")
        raise


@_prompts_app.command("lint")
def prompts_lint(
    prompts: str = typer.Option("all", "--prompt"),
) -> None:
    """Lint prompt sources for @TOKEN usage and variable mapping rules."""
    context = load_workspace()
    renderer = PromptRenderer(context)
    catalog = {
        definition.prompt_id: definition for definition in renderer.list_prompts()
    }

    selected_prompts = _resolve_prompt_ids(catalog, _split_csv(prompts))
    # Collect unique source files for selected prompts
    files = {
        (context.repo_root / catalog[p].source_path).resolve() for p in selected_prompts
    }

    # Also lint unmanaged, hand-authored system prompts in systems/*
    GENERATED_SENTINEL = "<!-- generated: enaible -->"
    system_dirs = [
        context.repo_root / _Path("systems/claude-code/commands"),
        context.repo_root / _Path("systems/codex/prompts"),
        context.repo_root / _Path("systems/copilot/prompts"),
        context.repo_root / _Path("systems/cursor/rules"),
    ]
    for d in system_dirs:
        if not d.exists():
            continue
        for p in d.glob("*.md"):
            if p.name.lower() == "agents.md":
                # Skip helper docs meant for the LLM, not renderable prompts
                continue
            try:
                head = p.read_text().splitlines()[:3]
            except Exception:
                continue
            if any(GENERATED_SENTINEL in line for line in head):
                # Managed, rendered file — skip
                continue
            files.add(p.resolve())

    issues = lint_files(files)
    if not issues:
        typer.echo("prompts: lint passed")
        return
    for issue in issues:
        typer.echo(f"{issue.path}:{issue.line}: {issue.message}")
    raise typer.Exit(code=1)
