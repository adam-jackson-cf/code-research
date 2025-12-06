"""CLI tests for prompts command group using stubs."""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import pytest
from typer.testing import CliRunner

PACKAGE_ROOT = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(PACKAGE_ROOT))

from enaible import app  # noqa: E402

runner = CliRunner()


@dataclass
class _StubDefinition:
    prompt_id: str
    title: str
    systems: dict[str, object]


@dataclass
class _StubResult:
    prompt_id: str
    system: str
    content: str
    output_path: Path

    def write(self) -> None:
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.output_path.write_text(self.content)

    def diff(self) -> str:
        return ""


class _StubRenderer:
    def __init__(self, context: object):
        self._definitions = [
            _StubDefinition(
                prompt_id="demo",
                title="demo title",
                systems={"claude-code": object()},
            )
        ]

    def list_prompts(self) -> list[_StubDefinition]:
        return self._definitions

    def render(self, prompt_ids, systems, overrides=None):
        base = overrides.get("claude-code") if overrides else Path.cwd()
        output_path = base / "demo.md"
        return [
            _StubResult(
                prompt_id="demo",
                system="claude-code",
                content="demo content\n",
                output_path=output_path,
            )
        ]


@pytest.fixture(autouse=True)
def _patch_renderer(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("enaible.commands.prompts.PromptRenderer", _StubRenderer)
    monkeypatch.setattr("enaible.commands.prompts.load_workspace", lambda: object())


def test_prompts_list() -> None:
    result = runner.invoke(app, ["prompts", "list"])
    assert result.exit_code == 0
    assert "demo" in result.stdout


def test_prompts_render(tmp_path: Path) -> None:
    result = runner.invoke(
        app,
        [
            "prompts",
            "render",
            "--prompt",
            "demo",
            "--system",
            "claude-code",
            "--out",
            str(tmp_path),
        ],
    )
    assert result.exit_code == 0
    assert (tmp_path / "demo.md").exists()


def test_prompts_diff(tmp_path: Path) -> None:
    result = runner.invoke(
        app, ["prompts", "diff", "--prompt", "demo", "--system", "claude-code"]
    )
    assert result.exit_code == 0
