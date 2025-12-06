"""Tests for the `enaible doctor` command."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from typer.testing import CliRunner

PACKAGE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

REPO_ROOT = Path(__file__).resolve().parents[3]
SHARED_ROOT = REPO_ROOT / "shared"

from enaible import app  # noqa: E402

runner = CliRunner()


def _prime_workspace_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENAIBLE_SHARED_ROOT", str(SHARED_ROOT))
    monkeypatch.setenv("ENAIBLE_REPO_ROOT", str(REPO_ROOT))


def test_doctor_json_output(monkeypatch: pytest.MonkeyPatch) -> None:
    _prime_workspace_env(monkeypatch)
    result = runner.invoke(app, ["doctor", "--json"])
    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["checks"]["shared_workspace"] is True
    assert payload["checks"]["analyzer_registry"] is True
    assert payload["checks"]["workspace"] in (True, False)
    assert "schema_exists" in payload["checks"]
    assert "enaible_version" in payload
    assert payload["checks"]["analyzer_registry"] is True


def test_doctor_text_output(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _prime_workspace_env(monkeypatch)
    result = runner.invoke(app, ["doctor"])
    assert result.exit_code == 0
    assert "Enaible Diagnostics" in result.stdout
    assert "Shared Workspace: OK" in result.stdout
    assert "Analyzer Registry: OK" in result.stdout
