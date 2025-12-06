"""Tests for prompt utilities."""

from __future__ import annotations

import pytest
from enaible.prompts.utils import _parse_variables_bullets, extract_variables


def test_extract_variables_parses_table_and_strips_section() -> None:
    markdown = """Intro text

## Variables
| Token | Type | Description |
| ----- | ---- | ----------- |
| `@TARGET_PATH` | positional #1 (REQUIRED) | Path to analyze. |
| `@VERBOSE` | flag --verbose (OPTIONAL) | Enable verbose output. |

## Remaining
Body continues.
"""

    variables, body = extract_variables(markdown)

    assert [var.token for var in variables] == ["@TARGET_PATH", "@VERBOSE"]
    assert variables[0].kind == "positional"
    assert variables[0].required is True
    assert variables[0].positional_index == 1
    assert variables[1].kind == "flag"
    assert variables[1].flag_name == "--verbose"
    assert "## Variables" in body
    assert "### Required" in body
    assert "## Remaining" in body


def test_parse_variables_bullets_invalid_token() -> None:
    """Test that invalid tokens raise ValueError."""
    lines = [
        "### Required",
        "- @invalid-token = $1 — description",
    ]
    with pytest.raises(ValueError, match="Invalid token.*@UPPER_SNAKE_CASE"):
        _parse_variables_bullets(lines)


def test_parse_variables_bullets_duplicate_positional_index() -> None:
    """Test that duplicate positional indices raise ValueError."""
    lines = [
        "### Required",
        "- @FIRST = $1 — first",
        "- @SECOND = $1 — duplicate",
    ]
    with pytest.raises(ValueError, match="Duplicate positional index"):
        _parse_variables_bullets(lines)


def test_parse_variables_bullets_derived_only() -> None:
    """Test parsing derived-only variables without explicit mapping."""
    lines = [
        "### Derived (internal)",
        "- @MAX_CHARS — Maximum character count",
    ]
    variables = _parse_variables_bullets(lines)
    assert len(variables) == 1
    assert variables[0].token == "@MAX_CHARS"
    assert variables[0].kind == "derived"
    assert variables[0].description == "Maximum character count"
    assert variables[0].positional_index is None
    assert variables[0].flag_name is None


def test_parse_variables_bullets_repeatable_flag() -> None:
    """Test parsing repeatable optional flags."""
    lines = [
        "### Optional (derived from $ARGUMENTS)",
        "- @EXCLUDE = --exclude [repeatable] — Additional patterns to exclude",
    ]
    variables = _parse_variables_bullets(lines)
    assert len(variables) == 1
    assert variables[0].token == "@EXCLUDE"
    assert variables[0].kind == "flag"
    assert variables[0].flag_name == "--exclude"
    assert variables[0].repeatable is True


def test_parse_variables_bullets_malformed_required_missing_mapping() -> None:
    """Test that required variables without mapping raise ValueError."""
    lines = [
        "### Required",
        "- @TARGET_PATH — Missing mapping",
    ]
    with pytest.raises(ValueError, match="must have a mapping"):
        _parse_variables_bullets(lines)


def test_parse_variables_bullets_malformed_optional_invalid_flag() -> None:
    """Test that optional variables with invalid flags raise ValueError."""
    lines = [
        "### Optional (derived from $ARGUMENTS)",
        "- @VERBOSE = invalid-flag — Invalid flag format",
    ]
    with pytest.raises(ValueError, match="must map to a --flag"):
        _parse_variables_bullets(lines)


def test_parse_variables_bullets_skip_none_placeholder() -> None:
    """Test that (none) placeholders are skipped."""
    lines = [
        "### Required",
        "(none)",
        "### Optional (derived from $ARGUMENTS)",
        "- @VERBOSE = --verbose — Enable verbose output",
    ]
    variables = _parse_variables_bullets(lines)
    assert len(variables) == 1
    assert variables[0].token == "@VERBOSE"


def test_parse_variables_bullets_all_sections() -> None:
    """Test parsing all three sections (required, optional, derived)."""
    lines = [
        "### Required",
        "- @TARGET = $1 — Target path",
        "### Optional (derived from $ARGUMENTS)",
        "- @VERBOSE = --verbose — Enable verbose",
        "### Derived (internal)",
        "- @MAX_CHARS — Maximum characters",
    ]
    variables = _parse_variables_bullets(lines)
    assert len(variables) == 3
    assert variables[0].kind == "positional"
    assert variables[0].positional_index == 1
    assert variables[1].kind == "flag"
    assert variables[1].flag_name == "--verbose"
    assert variables[2].kind == "derived"
