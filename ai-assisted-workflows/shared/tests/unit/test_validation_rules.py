#!/usr/bin/env python3

import pytest
from core.base.analyzer_base import validate_finding


def test_validate_finding_success():
    finding = {
        "title": "SQL Injection Vulnerability",
        "description": "Unsanitized input used in SQL construction",
        "severity": "high",
        "file_path": "app/models/user.py",
        "line_number": 42,
        "recommendation": "Use parameterized queries",
        "metadata": {"pattern_type": "sql_injection", "confidence": 0.91},
    }
    assert validate_finding(finding) is True


@pytest.mark.parametrize(
    "missing_field",
    ["title", "description", "severity", "file_path", "line_number", "recommendation"],
)
def test_validate_finding_missing_required_field(missing_field):
    finding = {
        "title": "A",
        "description": "B",
        "severity": "low",
        "file_path": "x.py",
        "line_number": 1,
        "recommendation": "C",
    }
    finding.pop(missing_field)
    with pytest.raises(ValueError, match="Missing required field"):
        validate_finding(finding)


def test_validate_finding_placeholder_values_rejected():
    finding = {
        "title": "security finding",
        "description": "analysis issue detected",
        "severity": "medium",
        "file_path": "unknown",
        "line_number": 0,
        "recommendation": "Review issue",
        "metadata": {},
    }
    # Multiple placeholder violations are possible; accept either message
    with pytest.raises(ValueError, match="(Generic placeholder title|unknown)"):
        validate_finding(finding)


def test_validate_finding_line_zero_needs_error_metadata():
    finding = {
        "title": "Runtime error",
        "description": "Analyzer crashed",
        "severity": "low",
        "file_path": "x.py",
        "line_number": 0,
        "recommendation": "Check stacktrace",
        "metadata": {"error_type": "RuntimeError"},
    }
    # Should pass because error metadata is provided
    assert validate_finding(finding) is True


@pytest.mark.parametrize(
    ("field", "value", "errmsg"),
    [
        ("title", "", "non-empty string"),
        ("description", " ", "non-empty string"),
        ("recommendation", "", "non-empty string"),
        ("file_path", " ", "non-empty string"),
        ("line_number", -1, "non-negative"),
        ("severity", "urgent", "Invalid severity"),
    ],
)
def test_field_type_and_severity_errors(field, value, errmsg):
    finding = {
        "title": "t",
        "description": "d",
        "severity": "low",
        "file_path": "x.py",
        "line_number": 1,
        "recommendation": "r",
        "metadata": {},
    }
    finding[field] = value
    with pytest.raises(ValueError, match=errmsg):
        validate_finding(finding)
