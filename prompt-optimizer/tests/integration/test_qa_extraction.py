"""
Integration test for question answering / entity extraction task.

This demonstrates optimizing prompts for extracting specific information.
"""

import pytest
import os
from prompt_optimizer import PromptOptimizer, PromptEvaluator
from prompt_optimizer.models import OptimizationRequest, Example


@pytest.mark.integration
@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set"
)
class TestQAExtractionIntegration:
    """Integration test for question answering optimization."""

    @pytest.fixture
    def training_examples(self):
        """Training examples for entity extraction."""
        return [
            Example(
                input="John Smith works at Acme Corp in New York.",
                output="Person: John Smith, Company: Acme Corp, Location: New York",
                reasoning="Extract all named entities with their types"
            ),
            Example(
                input="The meeting is scheduled for Monday at 3 PM.",
                output="Day: Monday, Time: 3 PM",
                reasoning="Extract temporal information"
            ),
            Example(
                input="Contact Jane Doe at jane@example.com for more details.",
                output="Person: Jane Doe, Email: jane@example.com",
                reasoning="Extract person and contact information"
            ),
            Example(
                input="The product costs $99.99 and ships from California.",
                output="Price: $99.99, Location: California",
                reasoning="Extract price and location information"
            ),
        ]

    @pytest.fixture
    def test_examples(self):
        """Test examples for evaluation."""
        return [
            Example(
                input="Sarah Johnson lives in Seattle and works at Tech Inc.",
                output="Person: Sarah Johnson, Location: Seattle, Company: Tech Inc"
            ),
            Example(
                input="The event starts at 6 PM on Friday.",
                output="Time: 6 PM, Day: Friday"
            ),
            Example(
                input="Email bob@test.com or call 555-1234.",
                output="Email: bob@test.com, Phone: 555-1234"
            ),
        ]

    def test_optimize_entity_extraction(self, training_examples, test_examples):
        """
        Test optimization for entity extraction task.

        This demonstrates a more complex task than sentiment classification.
        """
        optimizer = PromptOptimizer()

        request = OptimizationRequest(
            objective=(
                "Extract named entities and structured information from text. "
                "Identify people, companies, locations, dates, times, prices, "
                "and contact information. Format output as 'Type: Value' pairs "
                "separated by commas."
            ),
            examples=training_examples,
            optimizer_type="bootstrap",
            max_iterations=4,
            num_threads=2,
        )

        # Optimize
        result = optimizer.optimize(request, verbose=True)

        assert result.optimized_prompt is not None
        assert result.final_score >= 0.0

        # Evaluate
        evaluator = PromptEvaluator()
        evaluation = evaluator.evaluate(
            result.optimized_prompt,
            test_examples,
            verbose=True
        )

        # For this more complex task, we expect at least 30% accuracy
        # (entity extraction is harder than sentiment classification)
        assert evaluation.accuracy >= 0.3, (
            f"Expected accuracy >= 0.3, got {evaluation.accuracy:.2%}"
        )

        print(f"\n{'='*60}")
        print("Entity Extraction Results:")
        print(f"  Training Score: {result.final_score:.2%}")
        print(f"  Test Accuracy: {evaluation.accuracy:.2%}")
        print(f"  Passed: {evaluation.passed}/{evaluation.test_cases}")
        print(f"{'='*60}\n")


@pytest.mark.integration
class TestQAExtractionMocked:
    """Mocked integration test for CI/CD."""

    def test_qa_extraction_flow_with_mock(self):
        """Test QA extraction flow with mocked components."""
        from unittest.mock import Mock, patch, MagicMock
        import dspy

        mock_lm = Mock()
        mock_lm.model = "anthropic/claude-3-5-sonnet-20241022"

        # Mock settings.configure to do nothing
        original_configure = dspy.settings.configure
        dspy.settings.configure = MagicMock()

        try:
            with patch('dspy.LM', return_value=mock_lm):
                with patch('dspy.BootstrapFewShot') as mock_bootstrap:
                    mock_optimizer = Mock()
                    mock_compiled = Mock()
                    mock_compiled.predictor = Mock()

                    # Mock simple extraction
                    def mock_forward(input):
                        # Simple mock that extracts obvious patterns
                        return Mock(output="Extracted entities")

                    mock_compiled.side_effect = mock_forward
                    mock_optimizer.compile.return_value = mock_compiled
                    mock_bootstrap.return_value = mock_optimizer

                    optimizer = PromptOptimizer()
                    request = OptimizationRequest(
                        objective="Extract named entities",
                        examples=[
                            Example(
                                input="John works at Acme",
                                output="Person: John, Company: Acme"
                            ),
                        ],
                        optimizer_type="bootstrap",
                    )

                    result = optimizer.optimize(request, verbose=False)

                    assert result is not None
                    assert result.original_objective == "Extract named entities"
        finally:
            # Restore original configure method
            dspy.settings.configure = original_configure
