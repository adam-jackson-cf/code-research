# ruff: noqa: E402
"""Smoke tests for the Enaible CLI entrypoint."""

from __future__ import annotations

import sys
from pathlib import Path

from typer.testing import CliRunner

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_ROOT = PROJECT_ROOT / "src"
sys.path.insert(0, str(PACKAGE_ROOT))

from enaible import app

runner = CliRunner()


def test_cli_help() -> None:
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "Unified CLI for AI-Assisted Workflows" in result.stdout


def test_cli_version_command_placeholder() -> None:
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert "enaible" in result.stdout
