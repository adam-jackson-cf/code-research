#!/usr/bin/env python3
"""
Composable validation rules for analyzer findings.

Each rule is a small class with a single responsibility. `validate_finding`
composes these rules to replace the previous monolithic validator.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any


class ValidationRule:
    def validate(self, finding: dict[str, Any]) -> None:  # pragma: no cover
        raise NotImplementedError


class RequiredFieldsRule(ValidationRule):
    def __init__(self, required: Iterable[str]):
        self.required = list(required)

    def validate(self, finding: dict[str, Any]) -> None:
        for f in self.required:
            if f not in finding:
                available = list(finding.keys())
                raise ValueError(
                    f"Missing required field: '{f}'. Available fields: {available}"
                )


class FieldTypesRule(ValidationRule):
    def validate(self, finding: dict[str, Any]) -> None:
        if not isinstance(finding["title"], str) or not finding["title"].strip():
            raise ValueError("Field 'title' must be a non-empty string")
        if (
            not isinstance(finding["description"], str)
            or not finding["description"].strip()
        ):
            raise ValueError("Field 'description' must be a non-empty string")
        if (
            not isinstance(finding["recommendation"], str)
            or not finding["recommendation"].strip()
        ):
            raise ValueError("Field 'recommendation' must be a non-empty string")
        if (
            not isinstance(finding["file_path"], str)
            or not finding["file_path"].strip()
        ):
            raise ValueError("Field 'file_path' must be a non-empty string")
        if not isinstance(finding["line_number"], int) or finding["line_number"] < 0:
            raise ValueError("Field 'line_number' must be a non-negative integer")


class SeverityRule(ValidationRule):
    VALID = {"critical", "high", "medium", "low", "info"}

    def validate(self, finding: dict[str, Any]) -> None:
        if finding["severity"] not in self.VALID:
            raise ValueError(
                f"Invalid severity '{finding['severity']}'. Must be one of: {self.VALID}"
            )


class PlaceholderRule(ValidationRule):
    GENERIC_TITLES = {
        "security finding",
        "quality finding",
        "performance finding",
        "analysis finding",
    }
    GENERIC_DESCRIPTIONS = {
        "analysis issue detected",
        "issue found",
        "problem detected",
    }

    def validate(self, finding: dict[str, Any]) -> None:
        if finding["title"].lower() in self.GENERIC_TITLES:
            raise ValueError(
                f"Generic placeholder title '{finding['title']}' not allowed. Use specific finding title."
            )
        if finding["description"].lower() in self.GENERIC_DESCRIPTIONS:
            raise ValueError(
                f"Generic placeholder description '{finding['description']}' not allowed. Use specific issue description."
            )


class PathAndLineRules(ValidationRule):
    def validate(self, finding: dict[str, Any]) -> None:
        if finding["file_path"] == "unknown":
            raise ValueError(
                "Placeholder file_path 'unknown' not allowed. Use actual file path."
            )
        metadata = finding.get("metadata", {})
        error_type = str(metadata.get("error_type", ""))
        if finding["line_number"] == 0 and "error" not in error_type.lower():
            raise ValueError(
                "Placeholder line_number 0 not allowed unless it's an error case. Use actual line number."
            )
