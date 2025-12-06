"""CI helper commands for the Enaible CLI.

Wraps repo-local converters under a stable CLI so GitHub Actions
do not import Python modules directly.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import typer

from ..app import app

_ci_app = typer.Typer(help="CI utilities: format converters and renderers")
app.add_typer(_ci_app, name="ci")


def _emit(payload: Any, out: Path | None) -> None:
    rendered = (
        payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    )
    if out is None:
        typer.echo(rendered)
    else:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(rendered)


@_ci_app.command("convert-codeclimate")
def convert_codeclimate(
    artifacts: Path = typer.Argument(
        Path("artifacts"), help="Directory containing analyzer JSON files."
    ),
    out: Path
    | None = typer.Option(
        None, "--out", "-o", help="Optional output path for CodeClimate JSON array."
    ),
) -> None:
    """Convert analyzer JSONs to a CodeClimate-compatible array."""
    # PYTHONPATH must include repo's shared/ root (workflow does this)
    from generators.ci.convert_analyzers_to_codeclimate import (
        convert as cc_convert,  # type: ignore[import, attr-defined]
    )

    items = cc_convert(artifacts)
    _emit(items, out)


@_ci_app.command("security-markdown")
def security_markdown(
    artifacts: Path = typer.Argument(
        Path("artifacts"), help="Directory containing security analyzer JSON files."
    ),
    out: Path
    | None = typer.Option(
        None, "--out", "-o", help="Optional output path for Markdown."
    ),
) -> None:
    """Render prioritized security plan in Markdown with strict markers."""
    from generators.ci.security_findings_to_markdown import (  # type: ignore[import, attr-defined]
        _group,
        _load_findings,
        _md,
    )

    findings = _load_findings(artifacts)
    if not findings:
        _emit(
            "=== BEGIN_SECURITY_MD ===\nNo parsable SAST/security findings detected.\n=== END_SECURITY_MD ===",
            out,
        )
        raise typer.Exit(code=0)

    groups = _group(findings)
    content = _md(groups, len(findings))
    _emit(content, out)
