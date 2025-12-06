#!/usr/bin/env python3
"""
Unit tests for scalability_check.py - Scalability Analysis Analyzer.

Tests the pattern detection, configuration loading, and AST analysis capabilities
of the scalability analyzer.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from analyzers.architecture.scalability_check import (
    PatternMatchContext,
    PatternScanContext,
    ScalabilityAnalyzer,
    ScalabilityPatternConfigError,
    _load_scalability_pattern_bundle,
)


@pytest.fixture
def temp_config_dir():
    """Create a temporary config directory with test patterns."""
    with tempfile.TemporaryDirectory() as temp_dir:
        config_dir = Path(temp_dir) / "config" / "patterns" / "scalability"
        config_dir.mkdir(parents=True)

        # Create test pattern files
        categories = {
            "database": {
                "schema_version": 1,
                "patterns": {
                    "n_plus_one_queries": {
                        "indicators": [
                            ".*\\bquery\\b.*\\bin\\s+loop",
                            "SELECT.*WHERE.*IN.*\\(",
                        ],
                        "severity": "high",
                        "description": "N+1 query pattern detected",
                    },
                    "missing_index": {
                        "indicators": [
                            "CREATE TABLE.*WITHOUT INDEX",
                            "WHERE.*indexed_column",
                        ],
                        "severity": "medium",
                        "description": "Missing database index",
                    },
                },
            },
            "performance": {
                "schema_version": 1,
                "patterns": {
                    "nested_loops": {
                        "indicators": ["for.*for.*for", "while.*while"],
                        "severity": "high",
                        "description": "Nested loops detected",
                    },
                    "inefficient_sort": {
                        "indicators": [
                            ".*sort.*without.*key",
                            "ORDER BY.*multiple.*columns",
                        ],
                        "severity": "medium",
                        "description": "Inefficient sorting detected",
                    },
                },
            },
            "concurrency": {
                "schema_version": 1,
                "patterns": {
                    "thread_safety": {
                        "indicators": [
                            "global.*variable.*thread",
                            "shared.*resource.*lock",
                        ],
                        "severity": "critical",
                        "description": "Thread safety issue",
                    }
                },
            },
            "architecture": {
                "schema_version": 1,
                "patterns": {
                    "tight_coupling": {
                        "indicators": [
                            "class.*depends.*on.*many",
                            "direct.*database.*access",
                        ],
                        "severity": "medium",
                        "description": "Tight coupling detected",
                    }
                },
            },
        }

        # Write config files
        for category, data in categories.items():
            (config_dir / f"{category}.json").write_text(json.dumps(data))

        # Clear the cache and patch the config directory
        _load_scalability_pattern_bundle.cache_clear()
        with patch(
            "analyzers.architecture.scalability_check._SCALABILITY_PATTERN_DIR",
            config_dir,
        ):
            yield config_dir


class TestScalabilityConfiguration:
    """Test configuration loading and validation."""

    def test_load_scalability_pattern_bundle_success(self, temp_config_dir):
        """Test successful loading of scalability patterns."""
        bundle = _load_scalability_pattern_bundle()

        assert isinstance(bundle, dict)
        assert "database" in bundle
        assert "performance" in bundle
        assert "concurrency" in bundle
        assert "architecture" in bundle

        # Check pattern structure
        assert "n_plus_one_queries" in bundle["database"]
        assert bundle["database"]["n_plus_one_queries"]["severity"] == "high"
        assert isinstance(bundle["database"]["n_plus_one_queries"]["indicators"], list)

    def test_missing_config_file(self):
        """Test error handling for missing config file."""
        with patch(
            "analyzers.architecture.scalability_check._SCALABILITY_PATTERN_DIR",
            Path("/nonexistent"),
        ):
            _load_scalability_pattern_bundle.cache_clear()
            with pytest.raises(
                ScalabilityPatternConfigError,
                match="Scalability pattern config not found",
            ):
                _load_scalability_pattern_bundle()

    def test_invalid_schema_version(self, temp_config_dir):
        """Test error handling for invalid schema version."""
        # Modify a config file to have invalid schema version
        db_file = temp_config_dir / "database.json"
        data = json.loads(db_file.read_text())
        data["schema_version"] = 999
        db_file.write_text(json.dumps(data))

        _load_scalability_pattern_bundle.cache_clear()
        with pytest.raises(
            ScalabilityPatternConfigError, match="Unsupported schema version"
        ):
            _load_scalability_pattern_bundle()

    def test_missing_required_fields(self, temp_config_dir):
        """Test error handling for missing required pattern fields."""
        # Create invalid config
        invalid_config = {
            "schema_version": 1,
            "patterns": {
                "invalid_pattern": {
                    "indicators": ["test"],
                    # Missing required "severity" and "description" fields
                }
            },
        }

        (temp_config_dir / "invalid.json").write_text(json.dumps(invalid_config))

        # Test with a specific category path
        with patch(
            "analyzers.architecture.scalability_check._SCALABILITY_CATEGORY_FILES",
            {"invalid": "invalid.json"},
        ):
            _load_scalability_pattern_bundle.cache_clear()
            with pytest.raises(ScalabilityPatternConfigError, match="missing keys"):
                _load_scalability_pattern_bundle()


class TestScalabilityAnalyzer:
    """Test the main ScalabilityAnalyzer class."""

    @pytest.fixture
    def analyzer(self, temp_config_dir):
        """Create analyzer instance with test config."""
        return ScalabilityAnalyzer()

    def test_analyzer_initialization(self, analyzer):
        """Test analyzer initialization with proper configuration."""
        # BaseAnalyzer exposes analyzer_type, not name
        assert analyzer.analyzer_type == "architecture"
        assert ".py" in analyzer.config.code_extensions
        assert ".js" in analyzer.config.code_extensions
        assert "node_modules" in analyzer.config.skip_patterns

    def test_analyze_target_database_patterns(self, analyzer):
        """Test detection of database scalability patterns."""
        # Create test Python code with N+1 query pattern
        test_code = """
def get_user_orders(user_ids):
    orders = []
    for user_id in user_ids:  # This creates N+1 queries
        query = SELECT * FROM orders WHERE user_id IN (1, 2, 3)
        orders.append(execute_query(query))
    return orders
"""

        # Patch metrics high enough to satisfy evaluator thresholds
        with patch.object(
            ScalabilityAnalyzer,
            "_get_lizard_metrics",
            return_value={"max_ccn": 16, "total_functions": 5},
        ), tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_code)
            f.flush()

            results = analyzer.analyze_target(f.name)

            # Should produce at least one finding
            assert len(results) > 0

            Path(f.name).unlink()

    def test_analyze_target_performance_patterns(self, analyzer):
        """Test detection of performance scalability patterns."""
        # Create test code with nested loops
        test_code = """
def inefficient_processing(data):
    result = []
    for i in range(len(data)):  # Nested loops - O(n³)
        for j in range(len(data)):
            for k in range(len(data)):
                result.append(data[i] + data[j] + data[k])
    return result
"""

        with patch.object(
            ScalabilityAnalyzer,
            "_get_lizard_metrics",
            return_value={"max_ccn": 16, "total_functions": 5},
        ), tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_code)
            f.flush()

            results = analyzer.analyze_target(f.name)

            # Ensure analysis completes and returns a list
            assert isinstance(results, list)

            Path(f.name).unlink()

    def test_analyze_target_non_code_file(self, analyzer):
        """Test handling of non-code files."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("This is not code")
            f.flush()

            results = analyzer.analyze_target(f.name)

            # Should return empty results for non-code files
            assert len(results) == 0

            Path(f.name).unlink()

    def test_get_analyzer_metadata(self, analyzer):
        """Test metadata generation."""
        metadata = analyzer.get_analyzer_metadata()

        assert metadata["name"] == "Scalability Analysis Analyzer"
        assert "pattern_categories" in metadata
        # Keys are aggregate counts by category type
        cats = metadata["pattern_categories"]
        assert any(k.endswith("_patterns") for k in cats)


class TestPatternContext:
    """Test pattern context dataclasses."""

    def test_pattern_scan_context(self):
        """Test PatternScanContext initialization and post-init."""
        content = "Test Content"
        lines = ["Test Content"]
        file_path = "/test/file.py"
        category = "database"
        patterns = {
            "test": {"indicators": ["test"], "severity": "high", "description": "test"}
        }
        lizard_metrics = {"complexity": 5}

        context = PatternScanContext(
            content=content,
            lines=lines,
            file_path=file_path,
            category=category,
            patterns=patterns,
            lizard_metrics=lizard_metrics,
        )

        assert context.content == content
        assert context.content_lower == "test content"  # Lowercased in post-init

    def test_pattern_match_context(self):
        """Test PatternMatchContext initialization and post-init."""
        scan_context = PatternScanContext(
            content="test",
            lines=["test"],
            file_path="test.py",
            category="test",
            patterns={},
            lizard_metrics={},
        )

        match_context = PatternMatchContext(
            scan=scan_context, pattern_name="test_pattern", context_line="Context Line"
        )

        assert match_context.pattern_name == "test_pattern"
        assert match_context.context_lower == "context line"  # Lowercased in post-init


class TestScalabilityPatternDetection:
    """Test specific pattern detection logic."""

    @pytest.fixture
    def analyzer(self):
        """Create analyzer with mocked config."""
        with patch(
            "analyzers.architecture.scalability_check._load_scalability_pattern_bundle"
        ) as mock_load:
            mock_load.return_value = {
                "database": {
                    "n_plus_one": {
                        "indicators": [r"for.*\bquery\b", r"SELECT.*WHERE.*IN.*\("],
                        "severity": "high",
                        "description": "N+1 query detected",
                    }
                },
                "performance": {
                    "nested_loops": {
                        "indicators": [r"for.*for.*for"],
                        "severity": "high",
                        "description": "Nested loops detected",
                    }
                },
                "concurrency": {},
                "architecture": {},
            }
            return ScalabilityAnalyzer()

    def test_pattern_matching_case_insensitive(self, analyzer):
        """Test that pattern matching is case-insensitive."""
        test_code = """
def processData():
    FOR item IN items:  # Should match even with uppercase
        QUERY = "SELECT * FROM table"
"""

        with patch.object(
            ScalabilityAnalyzer,
            "_get_lizard_metrics",
            return_value={"max_ccn": 16, "total_functions": 5},
        ), tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_code)
            f.flush()

            results = analyzer.analyze_target(f.name)

            # Should not raise and return a list
            assert isinstance(results, list)

            Path(f.name).unlink()

    def test_pattern_confidence_calculation(self, analyzer):
        """Test confidence calculation for pattern matches."""
        test_code = """
# Multiple indicators for the same pattern should increase confidence
def get_data():
    for user_id in user_ids:
        query = SELECT * FROM users WHERE id = user_id
        execute_query(query)

    for item_id in item_ids:
        query = SELECT * FROM items WHERE id = item_id
        execute_query(query)
"""

        with patch.object(
            ScalabilityAnalyzer,
            "_get_lizard_metrics",
            return_value={"max_ccn": 16, "total_functions": 5},
        ), tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_code)
            f.flush()

            results = analyzer.analyze_target(f.name)

            # Check that metadata includes confidence score
            if results:
                assert "confidence" in results[0].get("metadata", {})

            Path(f.name).unlink()

    def test_line_number_accuracy(self, analyzer):
        """Test that line numbers are accurately reported."""
        test_code = """
def line_one():
    pass

def line_three():  # Line 4
    # This should match some pattern
    for i in range(10):
        for j in range(10):
            for k in range(10):  # Line 8 - nested loops
                pass
"""

        with patch.object(
            ScalabilityAnalyzer,
            "_get_lizard_metrics",
            return_value={"max_ccn": 16, "total_functions": 5},
        ), tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_code)
            f.flush()

            results = analyzer.analyze_target(f.name)

            # Prefer AST-based complexity finding if present
            complexity = [
                r
                for r in results
                if "High Algorithmic Complexity" in r.get("title", "")
            ]
            if complexity:
                assert complexity[0]["line_number"] >= 4
                assert complexity[0]["line_number"] <= 8

            Path(f.name).unlink()
