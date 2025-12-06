#!/usr/bin/env python3
"""Test data builders for shared unit tests."""

from typing import Any


def build_finding(
    title: str = "Test Finding",
    description: str = "Example description",
    severity: str = "medium",
    file_path: str = "src/app.py",
    line_number: int = 10,
    recommendation: str = "Do something helpful",
    **metadata: Any,
) -> dict[str, Any]:
    return {
        "title": title,
        "description": description,
        "severity": severity,
        "file_path": file_path,
        "line_number": line_number,
        "recommendation": recommendation,
        "metadata": metadata or {},
    }
