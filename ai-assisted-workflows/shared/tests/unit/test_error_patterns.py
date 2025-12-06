#!/usr/bin/env python3
"""
Unit tests for error_patterns.py - Error Pattern Analyzer.

Tests the error pattern detection, language-specific pattern matching,
and root cause analysis capabilities.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from analyzers.root_cause.error_patterns import (
    ErrorPatternAnalyzer,
    ErrorPatternConfigError,
    _load_error_pattern_bundle,
)


@pytest.fixture
def temp_error_config_dir():
    """Create a temporary error pattern config directory."""
    with tempfile.TemporaryDirectory() as temp_dir:
        config_dir = Path(temp_dir) / "config" / "patterns" / "error"
        config_dir.mkdir(parents=True)

        # Create test error patterns configuration
        error_patterns = {
            "schema_version": 1,
            "patterns": {
                "memory_leak": {
                    "patterns": [
                        r"(malloc|calloc|realloc)\s*\(",
                        r"new\s+\w+",
                        r"(open|fopen)\s*\(",
                        r"resource\s*=.*open",
                    ],
                    "severity": "high",
                    "category": "resource_management",
                    "description": "Potential memory leak detected",
                },
                "null_pointer": {
                    "patterns": [
                        r"\*\s*\w+\s*=\s*NULL",
                        r"\w+\s*->\s*\w+",
                        r"NullPointerException",
                        r"if\s*\(\s*\w+\s*==\s*NULL\s*\)",
                    ],
                    "severity": "critical",
                    "category": "pointer_errors",
                    "description": "Null pointer dereference risk",
                },
            },
        }

        # Create test language patterns configuration
        language_patterns = {
            "schema_version": 1,
            "languages": {
                ".py": {
                    "patterns": [
                        r"AttributeError:",
                        r"has\s+no\s+attribute",
                        r"object\s+has\s+no\s+attribute",
                    ],
                    "severity": "medium",
                }
            },
        }

        # Write config files
        (config_dir / "patterns.json").write_text(json.dumps(error_patterns))
        (config_dir / "language_patterns.json").write_text(
            json.dumps(language_patterns)
        )

        # Clear caches and patch config directory
        _load_error_pattern_bundle.cache_clear()
        with patch(
            "analyzers.root_cause.error_patterns._ERROR_PATTERN_DIR", config_dir
        ), patch(
            "analyzers.root_cause.error_patterns._ERROR_PATTERNS_PATH",
            config_dir / "patterns.json",
        ), patch(
            "analyzers.root_cause.error_patterns._LANGUAGE_PATTERNS_PATH",
            config_dir / "language_patterns.json",
        ):
            yield config_dir


class TestErrorPatternConfiguration:
    """Test configuration loading and validation."""

    def test_load_error_pattern_bundle_success(self, temp_error_config_dir):
        """Test successful loading of error pattern bundle."""
        general_patterns, language_patterns = _load_error_pattern_bundle()

        assert isinstance(general_patterns, dict)
        assert isinstance(language_patterns, dict)

        # Check general patterns
        assert "memory_leak" in general_patterns
        assert "null_pointer" in general_patterns
        assert general_patterns["memory_leak"]["severity"] == "high"

        # Check language patterns
        assert ".py" in language_patterns
        assert isinstance(language_patterns[".py"], dict)
        assert isinstance(language_patterns[".py"]["patterns"], list)

    def test_missing_config_file(self):
        """Test error handling for missing config file."""
        with patch(
            "analyzers.root_cause.error_patterns._ERROR_PATTERNS_PATH",
            Path("/nonexistent"),
        ):
            _load_error_pattern_bundle.cache_clear()
            with pytest.raises(
                ErrorPatternConfigError, match="Error pattern config not found"
            ):
                _load_error_pattern_bundle()

    def test_invalid_schema_version(self, temp_error_config_dir):
        """Test error handling for invalid schema version."""
        # Modify config to have invalid schema version
        patterns_file = temp_error_config_dir / "patterns.json"
        data = json.loads(patterns_file.read_text())
        data["schema_version"] = 999
        patterns_file.write_text(json.dumps(data))

        _load_error_pattern_bundle.cache_clear()
        with pytest.raises(
            ErrorPatternConfigError, match="Unsupported error pattern schema version"
        ):
            _load_error_pattern_bundle()

    def test_missing_required_fields(self, temp_error_config_dir):
        """Test error handling for missing required fields."""
        # Create invalid config
        invalid_config = {
            "schema_version": 1,
            "patterns": {
                "invalid_pattern": {
                    "patterns": [r"test"],
                    # Missing required fields
                }
            },
        }

        (temp_error_config_dir / "patterns.json").write_text(json.dumps(invalid_config))

        _load_error_pattern_bundle.cache_clear()
        with pytest.raises(ErrorPatternConfigError, match="missing keys"):
            _load_error_pattern_bundle()


class TestErrorPatternAnalyzer:
    """Test the main ErrorPatternAnalyzer class."""

    @pytest.fixture
    def analyzer(self, temp_error_config_dir):
        """Create analyzer instance with test config and generic error context."""
        # Provide generic error info (no specific file) to avoid file filtering
        return ErrorPatternAnalyzer(error_info="TypeError: something happened")

    def test_analyzer_initialization(self, analyzer):
        """Test analyzer initialization."""
        assert analyzer.analyzer_type == "root_cause"
        assert isinstance(analyzer.error_patterns, dict)
        assert isinstance(analyzer.language_patterns, dict)
        assert "memory_leak" in analyzer.error_patterns
        assert ".py" in analyzer.language_patterns

    def test_detect_memory_leak_patterns(self, analyzer):
        """Test memory leak pattern detection."""
        test_cases = [
            ("ptr = malloc(size);", "Memory Leak"),
            ("obj = new MyClass();", "Memory Leak"),
            ("file = open('test.txt', 'r')", "Memory Leak"),
        ]

        for code, expected_title in test_cases:
            lines = code.splitlines()
            results = analyzer._check_error_patterns(code, lines, "test.py")
            found = [r for r in results if expected_title in r.get("title", "")]
            assert len(found) > 0, f"Failed to detect {expected_title} in: {code}"

    def test_analyze_target_integration(self, analyzer):
        """Test integration of pattern detection in analyze_target."""
        test_code = """
def problematic_function():
    # Memory leak pattern
    data = []
    while True:
        data.append(open('file.txt').read())
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_code)
            f.flush()

            results = analyzer.analyze_target(f.name)
            assert isinstance(results, list)

            Path(f.name).unlink()

    def test_error_comment_detection(self, analyzer):
        """Test detection of error-related comments."""
        test_code = """
# TODO: Fix memory leak here
# FIXME: This might cause null pointer
def function():
    # HACK: This is a temporary workaround
    # BUG: Race condition possible
    pass
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_code)
            f.flush()

            # Use keyword scanning directly to assert behavior
            lines = test_code.splitlines()
            comment_findings = analyzer._check_error_keywords(lines, f.name)
            assert len(comment_findings) >= 2  # Should find TODO and FIXME at minimum

            Path(f.name).unlink()

    def test_get_analyzer_metadata(self, analyzer):
        """Test metadata generation."""
        metadata = analyzer.get_analyzer_metadata()

        assert metadata["name"] == "Error Pattern Analyzer"
        assert metadata["category"] == "root_cause"
        assert "capabilities" in metadata

    def test_case_insensitive_matching(self, analyzer):
        """Test that pattern matching is case-insensitive."""
        test_cases = [
            ("PTR = MALLOC(SIZE)", "memory_leak"),  # Uppercase
        ]

        for code, expected_pattern in test_cases:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
                f.write(code)
                f.flush()
                lines = code.splitlines()
                results = analyzer._check_error_patterns(code, lines, f.name)
                assert any(
                    expected_pattern.replace("_", " ").title() in r.get("title", "")
                    for r in results
                )
                Path(f.name).unlink()
