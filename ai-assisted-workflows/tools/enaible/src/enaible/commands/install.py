"""System installer command for Enaible CLI."""

from __future__ import annotations

import os
import shutil
import subprocess
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from importlib import metadata
from pathlib import Path

import typer

from ..app import app
from ..constants import MANAGED_SENTINEL
from ..prompts.adapters import SYSTEM_CONTEXTS, SystemRenderContext
from ..prompts.renderer import PromptRenderer
from ..runtime.context import load_workspace

SKIP_FILES = {
    "install.sh",
    "install.ps1",
    "uninstall.sh",
    ".DS_Store",
}

SYSTEM_RULES = {
    "claude-code": ("rules/global.claude.rules.md", "CLAUDE.md"),
    "codex": ("rules/global.codex.rules.md", "AGENTS.md"),
    "copilot": ("rules/global.copilot.rules.md", "AGENTS.md"),
    "cursor": ("rules/global.cursor.rules.md", "user-rules-setting.md"),
    "gemini": ("rules/global.gemini.rules.md", "GEMINI.md"),
    "antigravity": ("rules/global.antigravity.rules.md", "GEMINI.md"),
}

ALWAYS_MANAGED_PREFIXES: dict[str, tuple[str, ...]] = {
    "claude-code": ("commands/", "agents/", "rules/"),
    "codex": ("prompts/", "rules/"),
    "copilot": ("prompts/",),
    "cursor": ("commands/", "rules/"),
    "gemini": ("commands/",),
    "antigravity": ("workflows/", "rules/"),
}


class InstallMode(str, Enum):
    MERGE = "merge"
    UPDATE = "update"
    SYNC = "sync"
    FRESH = "fresh"


@dataclass(slots=True)
class InstallSummary:
    actions: list[tuple[str, str]]
    skipped: list[str]

    def record(self, action: str, path: Path) -> None:
        self.actions.append((action, path.as_posix()))

    def record_skip(self, path: Path) -> None:
        self.skipped.append(path.as_posix())


def _setup_installation_context(
    context, system: str, target: Path, scope: str
) -> tuple[SystemRenderContext, Path, Path]:
    """Set up installation context and validate source assets."""
    system_ctx = _get_system_context(system)
    source_root = context.repo_root / "systems" / system
    if not source_root.exists():
        raise typer.BadParameter(f"Source assets missing for system '{system}'.")
    destination_root = _resolve_destination(system_ctx, target, scope)
    return system_ctx, source_root, destination_root


def _prepare_installation_environment(
    context,
    install_cli: bool,
    cli_source: Path,
    sync_shared: bool,
    backup: bool,
    destination_root: Path,
    system: str,
    mode: InstallMode,
    dry_run: bool,
    summary: InstallSummary,
) -> None:
    """Prepare installation environment: CLI, shared workspace, backups."""
    if install_cli:
        _install_cli(context.repo_root, cli_source, dry_run, summary)

    if sync_shared:
        _sync_shared_workspace(context.repo_root, dry_run, summary)

    if backup:
        _backup_destination_folder(destination_root, dry_run, summary)

    if mode is InstallMode.FRESH:
        _clear_destination_for_fresh_install(system, destination_root, dry_run, summary)


def _should_skip_file(
    source_file: Path,
    destination_file: Path,
    relative_posix: str,
    system: str,
    mode: InstallMode,
    always_managed_prefixes: tuple[str, ...],
) -> bool:
    """Determine if a file should be skipped based on mode and managed status."""
    # Skip rules directory for copilot/cursor
    if system in ("copilot", "cursor") and relative_posix.startswith("rules/"):
        return True

    managed = _has_managed_sentinel(source_file) or any(
        relative_posix.startswith(prefix) for prefix in always_managed_prefixes
    )
    dest_exists = destination_file.exists()
    dest_managed = _has_managed_sentinel(destination_file) if dest_exists else managed
    if any(relative_posix.startswith(prefix) for prefix in always_managed_prefixes):
        dest_managed = True

    if mode is InstallMode.UPDATE and (not dest_exists or not dest_managed):
        return True

    return (
        mode in {InstallMode.MERGE, InstallMode.SYNC}
        and dest_exists
        and not dest_managed
    )


def _process_source_files(
    source_root: Path,
    destination_root: Path,
    system: str,
    mode: InstallMode,
    dry_run: bool,
    summary: InstallSummary,
) -> None:
    """Process and copy source files to destination based on installation mode."""
    files = _iter_source_files(source_root, system)
    always_managed_prefixes = ALWAYS_MANAGED_PREFIXES.get(system, ())

    for source_file in files:
        relative = source_file.relative_to(source_root)
        destination_file = destination_root / relative
        relative_posix = relative.as_posix()

        if _should_skip_file(
            source_file,
            destination_file,
            relative_posix,
            system,
            mode,
            always_managed_prefixes,
        ):
            summary.record_skip(relative)
            continue

        if dry_run:
            summary.record("write", destination_file)
            continue

        destination_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, destination_file)
        summary.record("write", destination_file)


def _complete_installation(
    context,
    system: str,
    source_root: Path,
    destination_root: Path,
    sync: bool,
    mode: InstallMode,
    dry_run: bool,
    summary: InstallSummary,
) -> None:
    """Complete installation: render prompts, sync, post-install, emit summary."""
    _render_managed_prompts(context, system, destination_root, mode, dry_run, summary)

    if sync:
        _sync_enaible_env(context.repo_root, dry_run, summary)

    _post_install(system, source_root, destination_root, dry_run, summary)
    _emit_summary(system, destination_root, mode, summary, dry_run)


@app.command("install")
def install(
    system: str = typer.Argument(
        ..., help="System adapter to install (claude-code|codex|copilot|cursor)."
    ),
    install_cli: bool = typer.Option(
        True,
        "--install-cli/--no-install-cli",
        help="Install the Enaible CLI with `uv tool install` before copying assets.",
    ),
    cli_source: Path = typer.Option(
        Path("tools/enaible"),
        "--cli-source",
        help="Path or URL passed to `uv tool install --from`. Defaults to the local tools/enaible folder.",
    ),
    target: Path = typer.Option(
        Path("."), "--target", "-t", help="Destination root for installation."
    ),
    mode: InstallMode = typer.Option(
        InstallMode.MERGE, "--mode", "-m", case_sensitive=False
    ),
    scope: str = typer.Option(
        "project",
        "--scope",
        "-s",
        help="Installation scope (project|user). Defaults to project-level directories.",
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Preview actions without writing files."
    ),
    backup: bool = typer.Option(
        True,
        "--backup/--no-backup",
        help="Create timestamped backup of target folder before install.",
    ),
    sync: bool = typer.Option(
        True,
        "--sync/--no-sync",
        help="Run `uv sync --project tools/enaible` to provision Enaible dependencies before copying assets.",
    ),
    sync_shared: bool = typer.Option(
        True,
        "--sync-shared/--no-sync-shared",
        help="Copy shared/ workspace files to ~/.enaible/workspace/shared for analyzer execution.",
    ),
) -> None:
    """Install rendered system assets into project or user configuration directories."""
    context = load_workspace()
    summary = InstallSummary(actions=[], skipped=[])
    system_ctx, source_root, destination_root = _setup_installation_context(
        context, system, target, scope
    )

    _prepare_installation_environment(
        context,
        install_cli,
        cli_source,
        sync_shared,
        backup,
        destination_root,
        system,
        mode,
        dry_run,
        summary,
    )

    _process_source_files(source_root, destination_root, system, mode, dry_run, summary)

    _complete_installation(
        context, system, source_root, destination_root, sync, mode, dry_run, summary
    )


def _install_cli(
    repo_root: Path, cli_source: Path, dry_run: bool, summary: InstallSummary
) -> None:
    """Install the Enaible CLI using uv tool install from the given source."""
    source = cli_source if cli_source.is_absolute() else (repo_root / cli_source)
    if not source.exists():
        raise typer.BadParameter(
            f"CLI source not found at {source}. Provide a valid path with --cli-source."
        )

    cmd = ["uv", "tool", "install", "--from", str(source), "enaible"]

    if dry_run:
        summary.record("install-cli", source)
        return

    proc = subprocess.run(cmd, cwd=repo_root)
    if proc.returncode != 0:
        raise typer.Exit(code=proc.returncode)

    summary.record("install-cli", source)


def _sync_shared_workspace(
    repo_root: Path, dry_run: bool, summary: InstallSummary
) -> None:
    """Copy shared workspace assets to ~/.enaible/workspace/shared."""
    source = repo_root / "shared"
    target = Path.home() / ".enaible" / "workspace" / "shared"
    allowed_paths = [
        Path("core"),
        Path("analyzers"),
        Path("config"),
        Path("utils"),
        Path("tools") / "ai_docs_changelog.py",
        Path("setup") / "install_dependencies.py",
        Path("setup") / "requirements.txt",
        Path("setup") / "monitoring",
        Path("setup") / "security",
    ]

    if not source.exists():
        raise typer.BadParameter(
            f"Shared folder missing at {source}; cannot sync workspace."
        )

    summary_path = target if target.exists() else target.parent

    if dry_run:
        summary.record("sync-shared", summary_path)
        return

    # Reset existing workspace copy to avoid stale or excess files
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True, exist_ok=True)

    # Copy while ignoring caches and pyc files
    def _ignore(_dir: str, names: list[str]) -> set[str]:
        ignored = {"__pycache__", ".pytest_cache", ".DS_Store"}
        ignored.update({name for name in names if name.endswith((".pyc", ".pyo"))})
        return ignored

    for rel_path in allowed_paths:
        src = source / rel_path
        dest = target / rel_path
        if not src.exists():
            continue
        if src.is_dir():
            shutil.copytree(src, dest, dirs_exist_ok=True, ignore=_ignore)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)

    summary.record("sync-shared", target)


def _iter_source_files(root: Path, system: str) -> Iterable[Path]:
    for path in root.rglob("*"):
        if path.is_file():
            if path.name in SKIP_FILES:
                continue
            yield path


def _resolve_destination(
    system_ctx: SystemRenderContext, target: Path, scope: str
) -> Path:
    if scope.lower() == "user":
        return Path(system_ctx.user_scope_dir).expanduser()
    if scope.lower() != "project":  # pragma: no cover - input validation
        raise typer.BadParameter("Scope must be either 'project' or 'user'.")
    return (target / system_ctx.project_scope_dir).resolve()


def _has_managed_sentinel(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        with path.open("r", encoding="utf-8") as handle:
            return MANAGED_SENTINEL in handle.read()
    except UnicodeDecodeError:  # pragma: no cover - binary safety
        return False


def _emit_summary(
    system: str,
    destination_root: Path,
    mode: InstallMode,
    summary: InstallSummary,
    dry_run: bool,
) -> None:
    action_label = "Planned" if dry_run else "Completed"
    typer.echo(
        f"{action_label} Enaible install for {system} ({mode.value}) → {destination_root}"
    )
    if summary.actions:
        for action, rel_path in summary.actions:
            typer.echo(f"  {action:8} {rel_path}")
    else:
        typer.echo("  No changes required.")

    if summary.skipped:
        typer.echo("  Skipped (unmanaged or missing targets):")
        for rel_path in summary.skipped:
            typer.echo(f"    - {rel_path}")


def _get_system_context(system: str) -> SystemRenderContext:
    try:
        return SYSTEM_CONTEXTS[system]
    except KeyError as exc:  # pragma: no cover - input validation
        available = ", ".join(sorted(SYSTEM_CONTEXTS.keys()))
        raise typer.BadParameter(
            f"Unknown system '{system}'. Available adapters: {available}."
        ) from exc


def _post_install(
    system: str,
    source_root: Path,
    destination_root: Path,
    dry_run: bool,
    summary: InstallSummary,
) -> None:
    rules_info = SYSTEM_RULES.get(system)
    if not rules_info:
        return

    source_rules_rel, target_name = rules_info
    source_rules = source_root / source_rules_rel
    if not source_rules.exists():
        return

    # For claude-code, CLAUDE.md goes in project root (parent of .claude/)
    # For antigravity, GEMINI.md goes in ~/.gemini/ (parent of ~/.gemini/antigravity/)
    # For codex/copilot, target goes inside their respective directories
    if system in ("claude-code", "antigravity"):
        target_path = destination_root.parent / target_name
    else:
        target_path = destination_root / target_name

    if dry_run:
        summary.record("merge", target_path)
        return

    if system == "codex":
        _merge_codex_agents(target_path, source_rules)
        summary.record("merge", target_path)
        return

    if system == "copilot":
        _merge_copilot_agents(target_path, source_rules)
        summary.record("merge", target_path)
        return

    if system == "cursor":
        _create_cursor_user_rules(target_path, source_rules)
        summary.record("write", target_path)
        typer.echo(
            "\n>>> Cursor requires manual configuration:\n"
            f"    Copy the contents of {target_path}\n"
            "    into Cursor > Settings > Rules > User Rules\n"
        )
        return

    header = (
        f"# AI-Assisted Workflows v{_enaible_version()} - Auto-generated, do not edit"
    )
    rules_body = source_rules.read_text(encoding="utf-8").strip()

    if target_path.exists():
        existing = target_path.read_text(encoding="utf-8")
        if "# AI-Assisted Workflows v" in existing:
            summary.record("merged", target_path)
            return
        updated = f"{existing.rstrip()}\n\n---\n\n{header}\n\n{rules_body}\n"
    else:
        updated = f"{header}\n\n{rules_body}\n"

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(updated, encoding="utf-8")
    summary.record("merge", target_path)


def _render_managed_prompts(
    context,
    system: str,
    destination_root: Path,
    mode: InstallMode,
    dry_run: bool,
    summary: InstallSummary,
) -> None:
    renderer = PromptRenderer(context)
    definitions = [
        definition.prompt_id
        for definition in renderer.list_prompts()
        if system in definition.systems
    ]
    if not definitions:
        return

    overrides: dict[str, Path] = {system: destination_root}
    results = renderer.render(definitions, [system], overrides)

    if not dry_run:
        destination_root.mkdir(parents=True, exist_ok=True)

    for result in results:
        output_path = result.output_path
        try:
            relative = output_path.relative_to(destination_root)
        except ValueError:
            relative = output_path

        if dry_run:
            summary.record("render", output_path)
            continue

        dest_exists = output_path.exists()
        dest_managed = _has_managed_sentinel(output_path) if dest_exists else False

        if mode is InstallMode.UPDATE and (not dest_exists or not dest_managed):
            summary.record_skip(relative)
            continue

        if (
            mode in {InstallMode.MERGE, InstallMode.SYNC}
            and dest_exists
            and not dest_managed
        ):
            summary.record_skip(relative)
            continue

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(result.content, encoding="utf-8")
        summary.record("render", output_path)


def _merge_codex_agents(target_path: Path, source_rules: Path) -> None:
    start_marker = "<!-- CODEx_GLOBAL_RULES_START -->"
    end_marker = "<!-- CODEx_GLOBAL_RULES_END -->"
    header = f"# AI-Assisted Workflows (Codex Global Rules) v{_enaible_version()} - Auto-generated, do not edit"
    body = source_rules.read_text(encoding="utf-8").strip()
    block = f"{start_marker}\n{header}\n\n{body}\n{end_marker}\n"

    existing = target_path.read_text(encoding="utf-8") if target_path.exists() else ""

    if start_marker in existing and end_marker in existing:
        start = existing.index(start_marker)
        end = existing.index(end_marker) + len(end_marker)
        updated = existing[:start] + block + existing[end:]
    else:
        updated = (existing.rstrip() + "\n\n" if existing.strip() else "") + block

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(updated.rstrip() + "\n", encoding="utf-8")


def _merge_copilot_agents(target_path: Path, source_rules: Path) -> None:
    start_marker = "<!-- COPILOT_GLOBAL_RULES_START -->"
    end_marker = "<!-- COPILOT_GLOBAL_RULES_END -->"
    header = f"# AI-Assisted Workflows (Copilot Global Rules) v{_enaible_version()} - Auto-generated, do not edit"
    body = source_rules.read_text(encoding="utf-8").strip()
    block = f"{start_marker}\n{header}\n\n{body}\n{end_marker}\n"

    existing = target_path.read_text(encoding="utf-8") if target_path.exists() else ""

    if start_marker in existing and end_marker in existing:
        start = existing.index(start_marker)
        end = existing.index(end_marker) + len(end_marker)
        updated = existing[:start] + block + existing[end:]
    else:
        updated = (existing.rstrip() + "\n\n" if existing.strip() else "") + block

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(updated.rstrip() + "\n", encoding="utf-8")


def _create_cursor_user_rules(target_path: Path, source_rules: Path) -> None:
    """Create user-rules-setting.md for Cursor with instructions to copy to IDE settings."""
    header = f"# Cursor User Rules v{_enaible_version()} - Copy to Cursor > Settings > Rules > User"
    instruction = "Copy the contents below into Cursor > Settings > Rules > User Rules."
    body = source_rules.read_text(encoding="utf-8").strip()

    content = f"{header}\n\n{instruction}\n\n---\n\n{body}\n"

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(content, encoding="utf-8")


def _enaible_version() -> str:
    try:
        return metadata.version("enaible")
    except metadata.PackageNotFoundError:  # pragma: no cover - editable installs
        return "local"


def _sync_enaible_env(repo_root: Path, dry_run: bool, summary: InstallSummary) -> None:
    if dry_run:
        summary.record("sync", repo_root / "tools" / "enaible")
        return

    if os.environ.get("ENAIBLE_INSTALL_SKIP_SYNC") == "1":
        summary.record_skip(Path("tools/enaible (sync skipped)"))
        return

    cmd = ["uv", "sync", "--project", str(repo_root / "tools" / "enaible")]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except (
        subprocess.CalledProcessError,
        FileNotFoundError,
    ) as exc:  # pragma: no cover - passthrough
        raise typer.BadParameter(
            "Failed to run 'uv sync --project tools/enaible'. Ensure `uv` is installed and accessible."
        ) from exc

    summary.record("sync", repo_root / "tools" / "enaible")


def _backup_destination_folder(
    destination_root: Path,
    dry_run: bool,
    summary: InstallSummary,
) -> None:
    """Create a timestamped backup copy of the destination folder before any install operations."""
    if not destination_root.exists():
        return

    backup_path = _next_stash_path(destination_root, ".bak")
    if dry_run:
        summary.record("backup", backup_path)
        return

    if destination_root.is_dir():
        shutil.copytree(
            destination_root,
            backup_path,
            dirs_exist_ok=False,
            copy_function=shutil.copy2,
        )
    else:
        shutil.copy2(destination_root, backup_path)
    summary.record("backup", backup_path)


def _clear_destination_for_fresh_install(
    system: str,
    destination_root: Path,
    dry_run: bool,
    summary: InstallSummary,
) -> None:
    """Remove the destination directory for FRESH mode installs.

    For codex, the destination is preserved to retain unmanaged files (sessions, auth).
    """
    if not destination_root.exists():
        return

    # Codex preserves unmanaged files - don't clear the destination
    if system == "codex":
        return

    if dry_run:
        summary.record("remove", destination_root)
        return

    temp_path = _next_stash_path(destination_root, ".tmp")
    destination_root.rename(temp_path)
    if temp_path.is_dir():
        shutil.rmtree(temp_path)
    else:
        temp_path.unlink()
    summary.record("remove", destination_root)


def _next_stash_path(path: Path, suffix: str) -> Path:
    base_name = path.name
    candidate = path.with_name(f"{base_name}{suffix}")
    if not candidate.exists():
        return candidate

    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    candidate = path.with_name(f"{base_name}{suffix}-{timestamp}")
    if not candidate.exists():
        return candidate

    counter = 1
    while True:
        candidate = path.with_name(f"{base_name}{suffix}-{timestamp}-{counter}")
        if not candidate.exists():
            return candidate
        counter += 1
