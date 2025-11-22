"""
Integration test for sentiment classification task.

This test demonstrates the full workflow:
1. Define an objective (sentiment classification)
2. Provide training examples
3. Optimize the prompt using DSPy/GEPA
4. Evaluate the optimized prompt on held-out test data
"""

import pytest
import os
from prompt_optimizer import PromptOptimizer, PromptEvaluator
from prompt_optimizer.models import OptimizationRequest, Example


@pytest.mark.integration
@pytest.mark.skipif(not os.getenv("ANTHROPIC_API_KEY"), reason="ANTHROPIC_API_KEY not set")
class TestSentimentClassificationIntegration:
    """Integration test for sentiment classification optimization."""

    @pytest.fixture
    def training_examples(self):
        """Training examples for sentiment classification."""
        return [
            Example(
                input="I absolutely love this product! It's amazing!",
                output="positive",
                reasoning="Enthusiastic positive language with exclamation marks",
            ),
            Example(
                input="This is the worst experience I've ever had.",
                output="negative",
                reasoning="Strong negative sentiment with superlative",
            ),
            Example(
                input="It's okay, nothing special.",
                output="neutral",
                reasoning="Lukewarm response indicating neutrality",
            ),
            Example(
                input="Fantastic service! Would definitely recommend!",
                output="positive",
                reasoning="Positive endorsement with recommendation",
            ),
            Example(
                input="Terrible quality. Do not buy.",
                output="negative",
                reasoning="Warning against purchase indicates strong negative",
            ),
            Example(
                input="It works as described.",
                output="neutral",
                reasoning="Factual statement without emotional tone",
            ),
        ]

    @pytest.fixture
    def test_examples(self):
        """Held-out test examples for evaluation."""
        return [
            Example(input="This exceeded all my expectations!", output="positive"),
            Example(input="Completely disappointed with this purchase.", output="negative"),
            Example(input="It's fine, does what it needs to do.", output="neutral"),
            Example(input="Outstanding! Best decision ever!", output="positive"),
            Example(input="Waste of money and time.", output="negative"),
            Example(input="Average product, nothing noteworthy.", output="neutral"),
            Example(input="Highly recommend this to everyone!", output="positive"),
            Example(input="Avoid at all costs.", output="negative"),
        ]

    def test_optimize_and_evaluate_sentiment_classifier(self, training_examples, test_examples):
        """
        Test the full optimization and evaluation pipeline.

        This test:
        1. Creates an optimization request for sentiment classification
        2. Optimizes the prompt using Bootstrap (faster for testing)
        3. Evaluates the optimized prompt on held-out test data
        4. Asserts that accuracy exceeds a baseline threshold
        """
        # Create optimizer
        optimizer = PromptOptimizer()

        # Create optimization request
        request = OptimizationRequest(
            objective=(
                "Classify the sentiment of text into one of three categories: "
                "positive, negative, or neutral. Be precise and consistent."
            ),
            examples=training_examples,
            optimizer_type="bootstrap",  # Use Bootstrap for faster testing
            max_iterations=4,  # Limited iterations for testing
            num_threads=2,
        )

        # Optimize the prompt
        result = optimizer.optimize(request, verbose=True)

        # Verify optimization completed
        assert result.optimized_prompt is not None
        assert len(result.optimized_prompt) > 0
        assert result.final_score >= 0.0

        # Evaluate on held-out test set
        evaluator = PromptEvaluator()
        evaluation = evaluator.evaluate(result.optimized_prompt, test_examples, verbose=True)

        # Assert performance thresholds
        # We expect at least 50% accuracy (better than random for 3 classes)
        assert (
            evaluation.accuracy >= 0.5
        ), f"Expected accuracy >= 0.5, got {evaluation.accuracy:.2%}"

        # Verify evaluation details
        assert evaluation.test_cases == len(test_examples)
        assert evaluation.passed + evaluation.failed == len(test_examples)
        assert len(evaluation.details) == len(test_examples)

        # Print summary
        print(f"\n{'='*60}")
        print("Optimization Summary:")
        print(f"  Optimizer: {result.optimizer_used}")
        print(f"  Iterations: {result.num_iterations}")
        print(f"  Training Score: {result.final_score:.2%}")
        print("\nEvaluation Summary:")
        print(f"  Test Cases: {evaluation.test_cases}")
        print(f"  Passed: {evaluation.passed}")
        print(f"  Failed: {evaluation.failed}")
        print(f"  Accuracy: {evaluation.accuracy:.2%}")
        print(f"{'='*60}\n")

    def test_compare_optimizers(self, training_examples, test_examples):
        """
        Compare different optimizers on the same task.

        This test demonstrates how to compare multiple optimization
        strategies and select the best one.
        """
        optimizer = PromptOptimizer()
        evaluator = PromptEvaluator()

        results = {}

        # Test Bootstrap optimizer
        request_bootstrap = OptimizationRequest(
            objective="Classify sentiment as positive, negative, or neutral.",
            examples=training_examples,
            optimizer_type="bootstrap",
            max_iterations=3,
            num_threads=2,
        )

        result_bootstrap = optimizer.optimize(request_bootstrap, verbose=False)
        eval_bootstrap = evaluator.evaluate(
            result_bootstrap.optimized_prompt, test_examples, verbose=False
        )
        results["bootstrap"] = eval_bootstrap

        # Print comparison
        print(f"\n{'='*60}")
        print("Optimizer Comparison:")
        for name, eval_result in results.items():
            print(f"\n{name.upper()}:")
            print(f"  Accuracy: {eval_result.accuracy:.2%}")
            print(f"  Passed: {eval_result.passed}/{eval_result.test_cases}")
        print(f"{'='*60}\n")

        # At least one optimizer should achieve >50% accuracy
        best_accuracy = max(r.accuracy for r in results.values())
        assert best_accuracy >= 0.5


@pytest.mark.integration
class TestSentimentClassificationMocked:
    """
    Integration test with mocked LLM for CI/CD.

    This version doesn't require API keys and uses mocked responses
    to test the integration logic.
    """

    def test_optimization_flow_with_mock(self, monkeypatch):
        """Test the optimization flow with mocked DSPy components."""
        from unittest.mock import Mock, patch, MagicMock
        import dspy

        # Mock the LM
        mock_lm = Mock()
        mock_lm.model = "anthropic/claude-3-5-sonnet-20241022"

        # Mock settings.configure to do nothing
        original_configure = dspy.settings.configure
        dspy.settings.configure = MagicMock()

        try:
            with patch("dspy.LM", return_value=mock_lm):
                with patch("dspy.BootstrapFewShot") as mock_bootstrap:
                    # Setup mock optimizer
                    mock_optimizer = Mock()
                    mock_compiled = Mock()
                    mock_compiled.predictor = Mock()

                    # Mock the module to return appropriate predictions
                    def mock_forward(input):
                        # Simple rule-based mock
                        input_lower = input.lower()
                        if any(word in input_lower for word in ["love", "great", "amazing"]):
                            return Mock(output="positive")
                        elif any(word in input_lower for word in ["hate", "worst", "terrible"]):
                            return Mock(output="negative")
                        else:
                            return Mock(output="neutral")

                    mock_compiled.side_effect = mock_forward
                    mock_optimizer.compile.return_value = mock_compiled
                    mock_bootstrap.return_value = mock_optimizer

                    # Run optimization
                    optimizer = PromptOptimizer()
                    request = OptimizationRequest(
                        objective="Classify sentiment",
                        examples=[
                            Example(input="I love this", output="positive"),
                            Example(input="I hate this", output="negative"),
                        ],
                        optimizer_type="bootstrap",
                        max_iterations=2,
                    )

                    result = optimizer.optimize(request, verbose=False)

                    # Verify result structure
                    assert result is not None
                    assert result.original_objective == "Classify sentiment"
                    assert result.optimizer_used == "bootstrap"
                    assert isinstance(result.final_score, float)
        finally:
            # Restore original configure method
            dspy.settings.configure = original_configure
