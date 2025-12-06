# ruff: noqa: E402
"""Integration tests for prompt renderer."""

from __future__ import annotations

import sys
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(PACKAGE_ROOT))

from enaible.constants import MANAGED_SENTINEL
from enaible.prompts.renderer import PromptRenderer
from enaible.runtime.context import load_workspace


def test_render_analyze_security_claude(tmp_path: Path) -> None:
    context = load_workspace()
    renderer = PromptRenderer(context)
    overrides = {"claude-code": tmp_path}
    results = renderer.render(["analyze-security"], ["claude-code"], overrides)
    assert len(results) == 1
    result = results[0]
    assert result.output_path == tmp_path / "commands" / "analyze-security.md"
    assert result.content.strip().endswith(MANAGED_SENTINEL)
    result.write()
    assert result.output_path.exists()
