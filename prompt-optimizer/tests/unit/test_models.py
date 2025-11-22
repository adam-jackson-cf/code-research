"""
Unit tests for data models.
"""

import pytest
from pydantic import ValidationError

from prompt_optimizer.models import (
    Example,
    OptimizationRequest,
    OptimizationResult,
    EvaluationResult,
)


class TestExample:
    """Tests for the Example model."""

    def test_create_example_with_required_fields(self):
        """Test creating an example with required fields."""
        example = Example(input="What is 2+2?", output="4")
        assert example.input == "What is 2+2?"
        assert example.output == "4"
        assert example.reasoning is None

    def test_create_example_with_reasoning(self):
        """Test creating an example with optional reasoning."""
        example = Example(input="What is 2+2?", output="4", reasoning="Simple arithmetic")
        assert example.reasoning == "Simple arithmetic"

    def test_example_requires_input_and_output(self):
        """Test that Example requires input and output fields."""
        with pytest.raises(ValidationError):
            Example(input="test")  # Missing output

        with pytest.raises(ValidationError):
            Example(output="test")  # Missing input


class TestOptimizationRequest:
    """Tests for the OptimizationRequest model."""

    def test_create_request_with_defaults(self):
        """Test creating a request with default values."""
        request = OptimizationRequest(
            objective="Classify sentiment",
            examples=[
                Example(input="I love this!", output="positive"),
                Example(input="This is terrible", output="negative"),
            ],
        )
        assert request.objective == "Classify sentiment"
        assert len(request.examples) == 2
        assert request.optimizer_type == "gepa"
        assert request.max_iterations == 10
        assert request.num_threads == 4

    def test_create_request_with_custom_values(self):
        """Test creating a request with custom values."""
        request = OptimizationRequest(
            objective="Extract entities",
            examples=[Example(input="John lives in NYC", output="John, NYC")],
            optimizer_type="mipro",
            max_iterations=20,
            num_threads=8,
            model_name="claude-3-opus-20240229",
        )
        assert request.optimizer_type == "mipro"
        assert request.max_iterations == 20
        assert request.num_threads == 8
        assert request.model_name == "claude-3-opus-20240229"

    def test_request_requires_at_least_one_example(self):
        """Test that OptimizationRequest requires at least one example."""
        with pytest.raises(ValidationError):
            OptimizationRequest(objective="Test", examples=[])

    def test_request_validates_optimizer_type(self):
        """Test that optimizer_type is validated."""
        with pytest.raises(ValidationError):
            OptimizationRequest(
                objective="Test",
                examples=[Example(input="a", output="b")],
                optimizer_type="invalid",
            )

    def test_request_validates_max_iterations(self):
        """Test that max_iterations is validated."""
        with pytest.raises(ValidationError):
            OptimizationRequest(
                objective="Test",
                examples=[Example(input="a", output="b")],
                max_iterations=0,  # Must be >= 1
            )

        with pytest.raises(ValidationError):
            OptimizationRequest(
                objective="Test",
                examples=[Example(input="a", output="b")],
                max_iterations=101,  # Must be <= 100
            )


class TestOptimizationResult:
    """Tests for the OptimizationResult model."""

    def test_create_result(self):
        """Test creating an optimization result."""
        result = OptimizationResult(
            original_objective="Classify sentiment",
            optimized_prompt="You are a sentiment classifier...",
            final_score=0.85,
            num_iterations=10,
            optimizer_used="gepa",
        )
        assert result.original_objective == "Classify sentiment"
        assert result.final_score == 0.85
        assert result.num_iterations == 10
        assert result.optimizer_used == "gepa"
        assert result.optimization_history == []
        assert result.metrics == {}

    def test_create_result_with_history(self):
        """Test creating a result with optimization history."""
        result = OptimizationResult(
            original_objective="Test",
            optimized_prompt="Prompt",
            final_score=0.9,
            num_iterations=5,
            optimizer_used="mipro",
            optimization_history=[
                {"iteration": 1, "score": 0.5},
                {"iteration": 2, "score": 0.7},
            ],
            metrics={"time": 10.5},
        )
        assert len(result.optimization_history) == 2
        assert result.metrics["time"] == 10.5


class TestEvaluationResult:
    """Tests for the EvaluationResult model."""

    def test_create_evaluation_result(self):
        """Test creating an evaluation result."""
        result = EvaluationResult(
            prompt="Test prompt", test_cases=10, passed=8, failed=2, accuracy=0.8
        )
        assert result.test_cases == 10
        assert result.passed == 8
        assert result.failed == 2
        assert result.accuracy == 0.8

    def test_accuracy_validation(self):
        """Test that accuracy is validated to be between 0 and 1."""
        with pytest.raises(ValidationError):
            EvaluationResult(
                prompt="Test", test_cases=10, passed=8, failed=2, accuracy=1.5  # Invalid: > 1
            )

        with pytest.raises(ValidationError):
            EvaluationResult(
                prompt="Test", test_cases=10, passed=8, failed=2, accuracy=-0.1  # Invalid: < 0
            )
