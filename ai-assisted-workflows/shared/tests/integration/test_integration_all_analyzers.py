#!/usr/bin/env python3
"""Pytest wrapper that exercises the all-analyzers CLI evaluator."""

import os
from pathlib import Path


def test_all_analyzers_cli_smoke():
    # Skip external categories to keep CI fast and deterministic
    os.environ["NO_EXTERNAL"] = "true"

    from integration.cli.run_all_analyzers import AnalysisRunner

    target = str(Path("test_codebase").resolve())
    runner = AnalysisRunner()
    report = runner.run_all_analyses(
        target_path=target, summary_mode=True, min_severity="low", max_files=20
    )

    assert report["combined_analysis"]["overall_success"] is True
    assert report["combined_analysis"]["scripts_run"] == len(runner.analyzers)
