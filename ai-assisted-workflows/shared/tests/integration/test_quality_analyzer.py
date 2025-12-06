from __future__ import annotations

from pathlib import Path

import pytest
from analyzers.quality.complexity_lizard import LizardComplexityAnalyzer
from core.base.analyzer_base import create_analyzer_config


@pytest.mark.slow
def test_quality_lizard_analyzer_smoke():
    """Smoke test to ensure quality analyzer returns findings on a known complex project."""
    project_root = Path(__file__).resolve().parents[3]
    target = project_root / "test_codebase" / "juice-shop-monorepo" / "frontend" / "src"

    assert target.is_dir(), f"Expected sample project at {target}"

    config = create_analyzer_config(
        target_path=str(target),
        min_severity="medium",
        output_format="json",
    )
    # limit runtime while still exercising parsing
    config.max_files = 400

    analyzer = LizardComplexityAnalyzer(config=config)
    if not getattr(analyzer, "lizard_available", True):
        pytest.skip("Lizard CLI is not installed in this environment")

    result = analyzer.analyze(str(target))

    assert result.success, result.error_message
    assert len(result.findings) > 0, "Expected at least one complexity finding"
    assert analyzer.files_processed > 0, "Analyzer should have processed files"
