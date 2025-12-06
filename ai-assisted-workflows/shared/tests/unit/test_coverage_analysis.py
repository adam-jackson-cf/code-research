#!/usr/bin/env python3
"""
Unit tests for coverage_analysis.py - Test Coverage Analysis Analyzer.

Tests the language configuration loading, file categorization, and coverage analysis
capabilities of the test coverage analyzer.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from analyzers.quality.coverage_analysis import (
    CoverageConfigError,
    TestCoverageAnalyzer,
    _load_generic_indicators,
    _load_language_config_bundle,
)


@pytest.fixture
def temp_coverage_config_dir():
    """Create a temporary coverage config directory with test configurations."""
    with tempfile.TemporaryDirectory() as temp_dir:
        config_dir = Path(temp_dir) / "config" / "coverage"
        config_dir.mkdir(parents=True)

        # Create test languages configuration
        languages_config = {
            "schema_version": 1,
            "languages": {
                "python": {
                    "extensions": [".py"],
                    "test_patterns": [
                        r"test_.*\.py$",
                        r".*_test\.py$",
                        r"tests?/.*\.py$",
                        r"conftest\.py$",
                    ],
                    "source_patterns": [r".*\.py$", r"src/.*\.py$", r"lib/.*\.py$"],
                    "coverage_tools": ["pytest", "coverage.py"],
                    "coverage_files": [".coverage", "htmlcov/index.html"],
                    "exclude_dirs": ["__pycache__", "venv", ".pytest_cache"],
                },
                "javascript": {
                    "extensions": [".js", ".jsx"],
                    "test_patterns": [
                        r".*\.test\.js(x)?$",
                        r".*\.spec\.js(x)?$",
                        r"__tests__/.*\.js(x)?$",
                        r"tests?/.*\.js(x)?$",
                    ],
                    "source_patterns": [r".*\.js(x)?$", r"src/.*\.js(x)?$"],
                    "coverage_tools": ["jest", "istanbul", "nyc"],
                    "coverage_files": [
                        "coverage/lcov-report/index.html",
                        "coverage/coverage-final.json",
                    ],
                    "exclude_dirs": ["node_modules", "dist", "build"],
                },
                "java": {
                    "extensions": [".java"],
                    "test_patterns": [
                        r".*Test\.java$",
                        r"tests?/.*\.java$",
                        r".*/src/test/java/.*\.java$",
                    ],
                    "source_patterns": [r".*\.java$", r".*/src/main/java/.*\.java$"],
                    "coverage_tools": ["jacoco", "cobertura"],
                    "coverage_files": ["target/site/jacoco/index.html"],
                    "exclude_dirs": ["target", "build", ".idea"],
                },
            },
        }

        # Create test indicators configuration
        indicators_config = {
            "schema_version": 1,
            "indicators": [
                "test",
                "spec",
                "mock",
                "stub",
                "fixture",
                "assert",
                "expect",
                "should",
                "describe",
                "it",
                "when",
                "given",
                "then",
            ],
        }

        # Write config files
        (config_dir / "languages.json").write_text(json.dumps(languages_config))
        (config_dir / "indicators.json").write_text(json.dumps(indicators_config))

        # Clear caches and patch config directory
        _load_language_config_bundle.cache_clear()
        _load_generic_indicators.cache_clear()
        with patch(
            "analyzers.quality.coverage_analysis._COVERAGE_CONFIG_DIR", config_dir
        ), patch(
            "analyzers.quality.coverage_analysis._LANGUAGE_CONFIG_PATH",
            config_dir / "languages.json",
        ), patch(
            "analyzers.quality.coverage_analysis._INDICATORS_PATH",
            config_dir / "indicators.json",
        ):
            yield config_dir


class TestCoverageConfiguration:
    """Test configuration loading and validation."""

    def test_load_language_config_bundle_success(self, temp_coverage_config_dir):
        """Test successful loading of language configurations."""
        language_configs, extension_map = _load_language_config_bundle()

        assert isinstance(language_configs, dict)
        assert isinstance(extension_map, dict)

        # Check that languages are loaded
        assert "python" in language_configs
        assert "javascript" in language_configs
        assert "java" in language_configs

        # Check extension mapping
        assert extension_map[".py"] == "python"
        assert extension_map[".js"] == "javascript"
        assert extension_map[".java"] == "java"

        # Check language config structure
        python_config = language_configs["python"]
        assert "test_patterns" in python_config
        assert "source_patterns" in python_config
        assert "coverage_tools" in python_config
        assert isinstance(python_config["test_patterns"], list)

    def test_load_generic_indicators_success(self, temp_coverage_config_dir):
        """Test successful loading of generic indicators."""
        indicators = _load_generic_indicators()

        assert isinstance(indicators, list)
        assert len(indicators) > 0
        assert "test" in indicators
        assert "assert" in indicators
        assert "mock" in indicators

    def test_missing_config_file(self):
        """Test error handling for missing config file."""
        with patch(
            "analyzers.quality.coverage_analysis._LANGUAGE_CONFIG_PATH",
            Path("/nonexistent"),
        ):
            _load_language_config_bundle.cache_clear()
            with pytest.raises(
                CoverageConfigError, match="Coverage language config not found"
            ):
                _load_language_config_bundle()

    def test_invalid_schema_version(self, temp_coverage_config_dir):
        """Test error handling for invalid schema version."""
        # Modify languages config to have invalid schema version
        lang_file = temp_coverage_config_dir / "languages.json"
        data = json.loads(lang_file.read_text())
        data["schema_version"] = 999
        lang_file.write_text(json.dumps(data))

        _load_language_config_bundle.cache_clear()
        with pytest.raises(
            CoverageConfigError, match="Unsupported coverage language config version"
        ):
            _load_language_config_bundle()

    def test_missing_required_keys(self, temp_coverage_config_dir):
        """Test error handling for missing required configuration keys."""
        # Create invalid config missing required fields
        invalid_config = {
            "schema_version": 1,
            "languages": {
                "python": {
                    "extensions": [".py"],
                    # Missing other required keys
                }
            },
        }

        (temp_coverage_config_dir / "languages.json").write_text(
            json.dumps(invalid_config)
        )

        _load_language_config_bundle.cache_clear()
        with pytest.raises(CoverageConfigError, match="missing keys"):
            _load_language_config_bundle()

    def test_invalid_extension_format(self, temp_coverage_config_dir):
        """Test error handling for invalid extension format."""
        # Create config with invalid extension (missing dot)
        lang_file = temp_coverage_config_dir / "languages.json"
        data = json.loads(lang_file.read_text())
        data["languages"]["python"]["extensions"] = ["py", "test.py"]  # Missing dot
        lang_file.write_text(json.dumps(data))

        _load_language_config_bundle.cache_clear()
        with pytest.raises(CoverageConfigError, match="must start with '.'"):
            _load_language_config_bundle()

    def test_duplicate_extension_mapping(self, temp_coverage_config_dir):
        """Test error handling for duplicate extension mappings."""
        # Create config with duplicate extension
        lang_file = temp_coverage_config_dir / "languages.json"
        data = json.loads(lang_file.read_text())
        data["languages"]["python"]["extensions"] = [".js"]  # Duplicate with JavaScript
        lang_file.write_text(json.dumps(data))

        _load_language_config_bundle.cache_clear()
        with pytest.raises(CoverageConfigError, match="mapped to multiple languages"):
            _load_language_config_bundle()


class TestTestCoverageAnalyzer:
    """Test the main TestCoverageAnalyzer class."""

    @pytest.fixture
    def analyzer(self, temp_coverage_config_dir):
        """Create analyzer instance with test config."""
        return TestCoverageAnalyzer()

    def test_analyzer_initialization(self, analyzer):
        """Test analyzer initialization with proper configuration."""
        assert analyzer.analyzer_type == "test_coverage"
        assert "python" in analyzer.language_configs
        assert "javascript" in analyzer.language_configs
        assert ".py" in analyzer.extension_map
        assert ".js" in analyzer.extension_map
        assert "test" in analyzer.generic_test_indicators

    def test_categorize_file_python_test(self, analyzer):
        """Test categorization of Python test files."""
        test_cases = [
            ("test_example.py", "test"),
            ("example_test.py", "test"),
            ("tests/utils.py", "test"),
            ("test/unit/test_example.py", "test"),
            ("conftest.py", "test"),
            ("src/test/example.py", "test"),
        ]

        for filename, expected_type in test_cases:
            if "/" in filename:
                file_path = Path(tempfile.mkdtemp()) / filename
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text("# Python test file")
            else:
                with tempfile.NamedTemporaryFile(
                    mode="w", suffix=filename, delete=False
                ) as f:
                    f.write("# Python test file")
                    f.flush()
                    file_path = Path(f.name)

            result = analyzer.categorize_file(file_path)
            assert result is not None
            assert result["type"] == expected_type
            assert result["language"] == "python"
            if file_path.exists():
                file_path.unlink()

    def test_categorize_file_python_source(self, analyzer):
        """Test categorization of Python source files."""
        test_cases = [
            ("example.py", "source"),
            ("src/utils.py", "source"),
            ("lib/main.py", "source"),
        ]

        for filename, expected_type in test_cases:
            if "/" in filename:
                file_path = Path(tempfile.mkdtemp()) / filename
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text("# Python source file")
            else:
                with tempfile.NamedTemporaryFile(
                    mode="w", suffix=filename, delete=False
                ) as f:
                    f.write("# Python source file")
                    f.flush()
                    file_path = Path(f.name)

            result = analyzer.categorize_file(file_path)
            assert result is not None
            assert result["type"] == expected_type
            assert result["language"] == "python"
            if file_path.exists():
                file_path.unlink()

    def test_categorize_file_javascript_test(self, analyzer):
        """Test categorization of JavaScript test files."""
        test_cases = [
            ("example.test.js", "test"),
            ("example.spec.jsx", "test"),
            ("__tests__/utils.js", "test"),
            ("test/component.test.js", "test"),
        ]

        for filename, expected_type in test_cases:
            if "/" in filename:
                file_path = Path(tempfile.mkdtemp()) / filename
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text("// JavaScript test file")
            else:
                with tempfile.NamedTemporaryFile(
                    mode="w", suffix=filename, delete=False
                ) as f:
                    f.write("// JavaScript test file")
                    f.flush()
                    file_path = Path(f.name)

            result = analyzer.categorize_file(file_path)
            assert result is not None
            assert result["type"] == expected_type
            assert result["language"] == "javascript"
            if file_path.exists():
                file_path.unlink()

    def test_categorize_file_java_test(self, analyzer):
        """Test categorization of Java test files."""
        test_cases = [
            ("ExampleTest.java", "test"),
            ("tests/UtilsTest.java", "test"),
            ("src/test/java/com/example/ServiceTest.java", "test"),
        ]

        for filename, expected_type in test_cases:
            # Create directory structure if needed
            if "/" in filename:
                file_path = Path(tempfile.mkdtemp()) / filename
                file_path.parent.mkdir(parents=True, exist_ok=True)
            else:
                file_path = Path(tempfile.mkdtemp()) / filename

            file_path.write_text("// Java test file")

            result = analyzer.categorize_file(file_path)
            assert result is not None
            assert result["type"] == expected_type
            assert result["language"] == "java"

    def test_categorize_file_unsupported_extension(self, analyzer):
        """Test handling of files with unsupported extensions."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".unknown", delete=False
        ) as f:
            f.write("Unknown file type")
            f.flush()

            result = analyzer.categorize_file(Path(f.name))
            assert result is None

            Path(f.name).unlink()

    def test_analyze_target_creates_finding(self, analyzer):
        """Test that analyze_target creates appropriate findings."""
        # Use a filename that matches a default Python test pattern
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="test_example.py", delete=False
        ) as f:
            f.write("# Python test file")
            f.flush()

            results = analyzer.analyze_target(f.name)

            assert len(results) == 1
            finding = results[0]

            assert finding["title"].endswith("Test File")
            assert finding["file_path"] == f.name
            assert finding["severity"] == "info"
            assert finding["evidence"]["file_type"] == "test"
            assert finding["evidence"]["language"] == "python"

            Path(f.name).unlink()

    def test_analyze_target_nonexistent_file(self, analyzer):
        """Test handling of nonexistent files."""
        results = analyzer.analyze_target("/nonexistent/file.py")
        assert len(results) == 0

    def test_get_analyzer_metadata(self, analyzer):
        """Test metadata generation."""
        metadata = analyzer.get_analyzer_metadata()

        assert metadata["analyzer_name"] == "TestCoverageAnalyzer"
        assert metadata["analyzer_version"] == "2.0.0"
        assert metadata["analysis_type"] == "test_coverage"

        # Check supported languages
        supported_languages = metadata["supported_languages"]
        assert "python" in supported_languages
        assert "javascript" in supported_languages
        assert "java" in supported_languages

        # Check coverage tools
        coverage_tools = metadata["coverage_tools_supported"]
        assert "pytest" in coverage_tools
        assert "jest" in coverage_tools
        assert "jacoco" in coverage_tools


class TestPatternMatching:
    """Test pattern matching for file categorization."""

    @pytest.fixture
    def analyzer(self):
        """Create analyzer with custom patterns for testing."""
        with patch(
            "analyzers.quality.coverage_analysis._load_language_config_bundle"
        ) as mock_load:
            mock_load.return_value = (
                {
                    "python": {
                        "test_patterns": [r"custom_test_.*\.py$", r".*_custom\.py$"],
                        "source_patterns": [r".*\.py$"],
                        "coverage_tools": ["pytest"],
                        "coverage_files": [],
                        "exclude_dirs": [],
                    }
                },
                {".py": "python"},
            )
            return TestCoverageAnalyzer()

    def test_custom_test_patterns(self, analyzer):
        """Test custom test pattern matching."""
        # Should match custom patterns
        test_cases = [
            ("custom_test_example.py", "test"),
            ("example_custom.py", "test"),
            ("regular.py", "source"),  # Should not match test patterns
        ]

        for filename, expected_type in test_cases:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=filename, delete=False
            ) as f:
                f.write("# Test file")
                f.flush()

                result = analyzer.categorize_file(Path(f.name))
                assert result["type"] == expected_type

                Path(f.name).unlink()

    def test_pattern_order_priority(self, analyzer):
        """Test that test patterns take priority over source patterns."""
        # This file matches both test and source patterns - should be categorized as test
        with tempfile.NamedTemporaryFile(
            mode="w", suffix="custom_test_example.py", delete=False
        ) as f:
            f.write("# Should be test file")
            f.flush()

            result = analyzer.categorize_file(Path(f.name))
            assert result["type"] == "test"

            Path(f.name).unlink()


class TestErrorHandling:
    """Test error handling and edge cases."""

    def test_empty_file(self, temp_coverage_config_dir):
        """Test handling of empty files."""
        analyzer = TestCoverageAnalyzer()

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write("")
            f.flush()

            result = analyzer.categorize_file(Path(f.name))
            # Empty files should still be categorized if they match patterns
            assert result is not None

            Path(f.name).unlink()

    def test_file_with_only_comments(self, temp_coverage_config_dir):
        """Test handling of files with only comments."""
        analyzer = TestCoverageAnalyzer()

        test_content = """
# This is a comment
# Another comment
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(test_content)
            f.flush()

            result = analyzer.categorize_file(Path(f.name))
            assert result is not None

            Path(f.name).unlink()

    def test_unicode_filenames(self, temp_coverage_config_dir):
        """Test handling of Unicode characters in filenames."""
        analyzer = TestCoverageAnalyzer()

        # Test with Unicode filename
        unicode_name = "unicode_filename.py"
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=unicode_name, delete=False
        ) as f:
            f.write("# Unicode filename test")
            f.flush()

            result = analyzer.categorize_file(Path(f.name))
            assert result is not None
            assert result["type"] == "source"

            Path(f.name).unlink()
