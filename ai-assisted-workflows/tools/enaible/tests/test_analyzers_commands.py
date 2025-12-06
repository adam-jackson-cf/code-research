"""Tests for analyzer command group."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

import pytest
from typer.testing import CliRunner

PACKAGE_ROOT = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(PACKAGE_ROOT))

from enaible import app  # noqa: E402
from enaible.models.results import (  # noqa: E402
    AnalysisResultContext,
    AnalyzerRunResponse,
)

runner = CliRunner()


class _StubAnalysisType:
    value = "demo"


class _StubResult:
    def __init__(self, target: str):
        self.analysis_type = _StubAnalysisType()
        self.success = True
        self.error_message = None
        self.target_path = target
        self.execution_time = 0.123
        self.files_processed = 1
        self.processing_errors = 0

    def to_dict(self, summary_mode: bool, min_severity: str) -> dict[str, Any]:
        return {
            "findings": [
                {
                    "id": "DEMO001",
                    "title": "Demo finding",
                    "description": "Example",
                    "severity": "low",
                    "recommendation": "Review",
                    "file_path": None,
                    "line_number": None,
                    "evidence": {},
                }
            ],
            "summary": {"low": 1},
            "metadata": {"source": "stub"},
        }

    def get_summary(self) -> dict[str, int]:
        return {"low": 1}


class _StubAnalyzer:
    def __init__(self, config: Any):
        self.config = config
        self.verbose = False

    def analyze(self, target: str) -> _StubResult:
        return _StubResult(target)


class _StubRegistry:
    _registry = {
        "demo:stub": type(
            "StubAnalyzerCls",
            (),
            {
                "__doc__": "Stub analyzer",
                "__module__": "tests",
                "__name__": "StubAnalyzer",
            },
        )
    }

    @staticmethod
    def create(name: str, config: Any) -> _StubAnalyzer:
        if name != "demo:stub":
            raise KeyError(name)
        return _StubAnalyzer(config)


@pytest.fixture(autouse=True)
def _patch_registry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "enaible.commands.analyzers._ensure_registry_loaded", lambda ctx: None
    )
    monkeypatch.setattr(
        "enaible.commands.analyzers._resolve_analyzer_registry", lambda: _StubRegistry
    )


def test_analyzers_list_json() -> None:
    result = runner.invoke(app, ["analyzers", "list"])
    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["analyzers"][0]["tool"] == "demo:stub"


def test_analyzers_run_json(tmp_path: Path) -> None:
    result = runner.invoke(
        app,
        [
            "analyzers",
            "run",
            "demo:stub",
            "--target",
            str(tmp_path),
        ],
    )
    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert payload["tool"] == "demo:stub"
    assert payload["summary"] == {"low": 1}


def test_analyzers_run_out_file(tmp_path: Path) -> None:
    out_path = tmp_path / "result.json"
    result = runner.invoke(
        app,
        [
            "analyzers",
            "run",
            "demo:stub",
            "--target",
            str(tmp_path),
            "--out",
            str(out_path),
            "--no-json",
        ],
    )
    assert result.exit_code == 0
    assert out_path.exists()
    payload = json.loads(out_path.read_text())
    assert payload["tool"] == "demo:stub"
    assert result.stdout.strip() == ""


def test_from_analysis_result_with_context_success() -> None:
    """Test AnalyzerRunResponse.from_analysis_result with successful result."""
    result = _StubResult("test-target")
    started = time.time()
    finished = started + 0.5

    ctx = AnalysisResultContext(
        tool="demo:stub",
        result=result,
        started_at=started,
        finished_at=finished,
        summary_mode=False,
        min_severity="high",
    )

    response = AnalyzerRunResponse.from_analysis_result(ctx)

    assert response.tool == "demo:stub"
    assert response.success is True
    assert response.exit_code == 0
    assert response.duration_ms == 500
    assert len(response.findings) == 1
    assert response.findings[0].id == "DEMO001"
    assert response.summary == {"low": 1}


def test_from_analysis_result_with_context_failure() -> None:
    """Test AnalyzerRunResponse.from_analysis_result with failed result."""
    result = _StubResult("test-target")
    result.success = False
    result.error_message = "Analysis failed"

    started = time.time()
    finished = started + 0.1

    ctx = AnalysisResultContext(
        tool="demo:stub",
        result=result,
        started_at=started,
        finished_at=finished,
        summary_mode=False,
        min_severity="high",
    )

    response = AnalyzerRunResponse.from_analysis_result(ctx)

    assert response.success is False
    assert response.exit_code == 1
    assert len(response.errors) == 1
    assert "Analysis failed" in response.errors[0]


def test_from_analysis_result_empty_findings() -> None:
    """Test AnalyzerRunResponse.from_analysis_result with empty findings."""
    result = _StubResult("test-target")

    def empty_findings_dict(summary_mode: bool, min_severity: str) -> dict[str, Any]:
        return {
            "findings": [],
            "summary": {},
            "metadata": {"info": "No issues found"},
        }

    result.to_dict = empty_findings_dict

    started = time.time()
    finished = started + 0.2

    ctx = AnalysisResultContext(
        tool="demo:stub",
        result=result,
        started_at=started,
        finished_at=finished,
        summary_mode=False,
        min_severity="high",
    )

    response = AnalyzerRunResponse.from_analysis_result(ctx)

    assert len(response.findings) == 0
    assert response.summary == {}
    assert "notes" in response.stats
    assert response.stats["notes"] == "No issues found"


def test_from_analysis_result_summary_mode() -> None:
    """Test AnalyzerRunResponse.from_analysis_result with summary_mode enabled."""
    result = _StubResult("test-target")
    started = time.time()
    finished = started + 0.3

    ctx = AnalysisResultContext(
        tool="demo:stub",
        result=result,
        started_at=started,
        finished_at=finished,
        summary_mode=True,
        min_severity="medium",
    )

    response = AnalyzerRunResponse.from_analysis_result(ctx)

    assert response.tool == "demo:stub"
    assert response.summary == {"low": 1}
