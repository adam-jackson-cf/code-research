#!/usr/bin/env python3
"""Pytest wrapper for the root cause analysis CLI evaluator."""


def test_root_cause_cli_end_to_end():
    from integration.cli.evaluate_root_cause import (
        RootCauseAnalysisIntegrationTest,
    )

    tester = RootCauseAnalysisIntegrationTest()
    results = tester.run_all_tests()

    assert results["failed"] == 0
    assert results["passed"] == results["total_tests"]
