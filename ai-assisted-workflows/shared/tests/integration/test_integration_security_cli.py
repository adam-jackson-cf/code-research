#!/usr/bin/env python3
"""Pytest wrappers for the security CLI evaluator (Semgrep and Detect-Secrets)."""

import shutil
from pathlib import Path

import pytest


def _config_path() -> str:
    return str(
        Path("shared/tests/integration/security_expected_findings.json").resolve()
    )


@pytest.mark.timeout(60)
def test_security_cli_semgrep_small_subset():
    if shutil.which("semgrep") is None:
        pytest.skip("semgrep not installed in environment")

    from integration.cli.evaluate_security import main as run_security_evaluator

    # Limit to a tiny, representative subset to keep CI fast
    res = run_security_evaluator(
        [
            "--analyzer",
            "semgrep",
            "--config",
            _config_path(),
            "--max-files",
            "10",
            "--applications",
            "test-python",
            "clean-python",
        ]
    )

    assert res["summary"]["failed_runs"] == 0
    assert res["summary"]["total_evaluations"] >= 2


@pytest.mark.timeout(60)
def test_security_cli_detect_secrets_small_subset():
    if shutil.which("detect-secrets") is None:
        pytest.skip("detect-secrets not installed in environment")

    from integration.cli.evaluate_security import main as run_security_evaluator

    res = run_security_evaluator(
        [
            "--analyzer",
            "detect_secrets",
            "--config",
            _config_path(),
            "--max-files",
            "10",
            "--applications",
            "test-python",
            "clean-python",
        ]
    )

    assert res["summary"]["failed_runs"] == 0
    assert res["summary"]["total_evaluations"] >= 2
