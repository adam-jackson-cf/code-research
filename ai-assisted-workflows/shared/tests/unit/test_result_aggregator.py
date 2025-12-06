#!/usr/bin/env python3
"""
Unit tests for result_aggregator.py - Analysis Result Aggregation System.

Tests the result aggregation, conversion, filtering, and reporting capabilities
of the result aggregator.
"""

import tempfile
from datetime import datetime
from pathlib import Path

import pytest


@pytest.fixture
def sample_analysis_results():
    """Create sample analysis results for testing."""
    # Import locally to avoid import errors
    from analyzers.quality.result_aggregator import (
        AnalysisResult,
        AnalysisType,
        Priority,
    )

    return [
        AnalysisResult(
            analysis_id="dup_001",
            analysis_type=AnalysisType.DUPLICATE_DETECTION,
            file_path="test.py",
            start_line=10,
            end_line=20,
            title="Duplicate Code",
            description="Code block is 95% similar to file2.py:30-40",
            recommendation="Consider extracting common code",
            priority=Priority.MEDIUM,
            confidence=0.8,
            code_snippet="def hello():\n    return 'world'",
            metadata={"similarity_score": 0.95},
        ),
        AnalysisResult(
            analysis_id="pattern_001",
            analysis_type=AnalysisType.PATTERN_CLASSIFICATION,
            file_path="test.py",
            start_line=5,
            end_line=100,
            title="God Class",
            description="Class has too many responsibilities",
            recommendation="Split class into smaller, focused classes",
            priority=Priority.HIGH,
            confidence=0.9,
            code_snippet="class MyClass:\n    def method1(self): pass\n    def method2(self): pass",
            metadata={"complexity": 15},
        ),
    ]


class TestAnalysisResult:
    """Test cases for AnalysisResult dataclass."""

    def test_analysis_result_creation(self):
        """Test creating AnalysisResult with required fields."""
        from analyzers.quality.result_aggregator import (
            AnalysisResult,
            AnalysisType,
            Priority,
        )

        result = AnalysisResult(
            analysis_id="test_001",
            analysis_type=AnalysisType.DUPLICATE_DETECTION,
            file_path="test.py",
            start_line=10,
            end_line=20,
            title="Test Finding",
            description="Test description",
            recommendation="Test recommendation",
            priority=Priority.MEDIUM,
            confidence=0.8,
            code_snippet="def test():\n    pass",
        )

        assert result.analysis_id == "test_001"
        assert result.analysis_type == AnalysisType.DUPLICATE_DETECTION
        assert result.priority == Priority.MEDIUM
        assert result.confidence == 0.8


class TestFileAnalysisSummary:
    """Test cases for FileAnalysisSummary class."""

    def test_file_summary_creation(self):
        """Test creating FileAnalysisSummary."""
        from analyzers.quality.result_aggregator import (
            AnalysisType,
            FileAnalysisSummary,
        )

        summary = FileAnalysisSummary(
            file_path="test.py",
            total_issues=2,
            critical_issues=0,
            high_issues=1,
            medium_issues=1,
            low_issues=0,
            info_issues=0,
            avg_confidence=0.85,
            analysis_types={
                AnalysisType.DUPLICATE_DETECTION,
                AnalysisType.PATTERN_CLASSIFICATION,
            },
            first_analyzed=datetime.now(),
            last_analyzed=datetime.now(),
        )

        assert summary.file_path == "test.py"
        assert summary.total_issues == 2
        assert summary.high_issues == 1
        assert summary.medium_issues == 1

    def test_get_severity_distribution(self):
        """Test getting severity distribution."""
        from analyzers.quality.result_aggregator import (
            AnalysisType,
            FileAnalysisSummary,
        )

        summary = FileAnalysisSummary(
            file_path="test.py",
            total_issues=4,
            critical_issues=1,
            high_issues=1,
            medium_issues=1,
            low_issues=1,
            info_issues=0,
            avg_confidence=0.85,
            analysis_types={AnalysisType.DUPLICATE_DETECTION},
            first_analyzed=datetime.now(),
            last_analyzed=datetime.now(),
        )

        distribution = summary.get_severity_distribution()

        assert distribution["critical"] == 1
        assert distribution["high"] == 1
        assert distribution["medium"] == 1
        assert distribution["low"] == 1
        assert distribution["info"] == 0


class TestEnums:
    """Test cases for enum classes."""

    def test_analysis_type_values(self):
        """Test AnalysisType enum values."""
        from analyzers.quality.result_aggregator import AnalysisType

        assert AnalysisType.DUPLICATE_DETECTION.value == "duplicate_detection"
        assert AnalysisType.PATTERN_CLASSIFICATION.value == "pattern_classification"
        assert AnalysisType.SECURITY_SCAN.value == "security_scan"

    def test_priority_values(self):
        """Test Priority enum values."""
        from analyzers.quality.result_aggregator import Priority

        assert Priority.CRITICAL.value == 1
        assert Priority.HIGH.value == 2
        assert Priority.MEDIUM.value == 3
        assert Priority.LOW.value == 4
        assert Priority.INFO.value == 5


class TestResultCorrelator:
    """Test cases for ResultCorrelator class."""

    def test_correlate_results_empty(self):
        """Test correlating empty results."""
        from analyzers.quality.result_aggregator import ResultCorrelator

        correlator = ResultCorrelator()
        correlations = correlator.correlate_results([])

        assert len(correlations) == 0

    def test_correlate_results(self, sample_analysis_results):
        """Test result correlation functionality."""
        from analyzers.quality.result_aggregator import ResultCorrelator

        correlator = ResultCorrelator()
        correlations = correlator.correlate_results(sample_analysis_results)

        # The method returns a dictionary, not a list
        assert isinstance(correlations, dict)


class TestResultConverter:
    """Test cases for ResultConverter class."""

    def test_result_converter_exists(self):
        """Test that ResultConverter class exists and has expected methods."""
        from analyzers.quality.result_aggregator import ResultConverter

        converter = ResultConverter()
        assert hasattr(converter, "convert_duplicate_matches")
        assert hasattr(converter, "convert_pattern_matches")


class TestAnalysisAggregator:
    """Test cases for AnalysisAggregator class."""

    def test_analysis_aggregator_creation(self):
        """Test creating AnalysisAggregator with proper config."""
        from analyzers.quality.result_aggregator import AnalysisAggregator
        from core.base.analyzer_base import AnalyzerConfig

        config = AnalyzerConfig(
            target_path=".", output_format="json", min_severity="medium"
        )

        aggregator = AnalysisAggregator(config)
        assert aggregator.config.target_path == "."
        assert aggregator.config.output_format == "json"

    def test_analyze_target_empty_directory(self):
        """Test analyzing empty directory."""
        from analyzers.quality.result_aggregator import AnalysisAggregator
        from core.base.analyzer_base import AnalyzerConfig

        config = AnalyzerConfig()
        aggregator = AnalysisAggregator(config)

        with tempfile.TemporaryDirectory() as temp_dir:
            results = aggregator.analyze_target(Path(temp_dir))
            assert isinstance(results, list)
