"""
Unit tests for the PromptEvaluator class.
"""

import pytest
from unittest.mock import Mock, patch

from prompt_optimizer.evaluator import PromptEvaluator
from prompt_optimizer.models import Example


class TestPromptEvaluator:
    """Tests for the PromptEvaluator class."""

    def test_evaluator_initialization(self):
        """Test that PromptEvaluator initializes correctly."""
        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator(api_key="test_key", model="claude-3-opus-20240229")
            assert evaluator.api_key == "test_key"
            assert evaluator.model == "claude-3-opus-20240229"

    def test_evaluate_output_exact_match(self):
        """Test output evaluation with exact match."""
        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            # Exact match
            assert evaluator._evaluate_output("hello world", "hello world") is True

            # Case insensitive exact match (both lowercased)
            assert evaluator._evaluate_output("hello world", "hello world") is True

    def test_evaluate_output_substring_match(self):
        """Test output evaluation with substring match."""
        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            # Substring in predicted
            assert evaluator._evaluate_output("hello world today", "hello world") is True

            # Substring in expected
            assert evaluator._evaluate_output("hello", "hello world") is True

    def test_evaluate_output_keyword_overlap(self):
        """Test output evaluation with keyword overlap."""
        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            # High keyword overlap (>70%)
            predicted = "the quick brown fox"
            expected = "quick brown fox jumps"
            # 3 out of 4 words match = 75% overlap
            assert evaluator._evaluate_output(predicted, expected) is True

    def test_evaluate_output_no_match(self):
        """Test output evaluation with no match."""
        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            # No overlap
            assert evaluator._evaluate_output("completely different", "nothing similar") is False

            # Low overlap (<70%)
            assert evaluator._evaluate_output("one two", "three four five") is False

    def test_evaluate_output_empty_strings(self):
        """Test output evaluation with empty strings."""
        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            # Both empty
            assert evaluator._evaluate_output("", "") is True

            # One empty
            assert evaluator._evaluate_output("", "test") is False
            assert evaluator._evaluate_output("test", "") is False

    @patch('prompt_optimizer.evaluator.dspy.Predict')
    def test_evaluate_single_test_case(self, mock_predict):
        """Test evaluating a single test case."""
        # Setup mock predictor
        mock_predictor = Mock()
        mock_prediction = Mock()
        mock_prediction.output = "positive"
        mock_predictor.return_value = mock_prediction
        mock_predict.return_value = mock_predictor

        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            test_cases = [
                Example(input="I love this!", output="positive")
            ]

            result = evaluator.evaluate("Test prompt", test_cases, verbose=False)

            assert result.test_cases == 1
            assert result.passed == 1
            assert result.failed == 0
            assert result.accuracy == 1.0
            assert len(result.details) == 1

    @patch('prompt_optimizer.evaluator.dspy.Predict')
    def test_evaluate_multiple_test_cases(self, mock_predict):
        """Test evaluating multiple test cases."""
        # Setup mock predictor with different responses
        mock_predictor = Mock()
        predictions = [
            Mock(output="positive"),
            Mock(output="negative"),
            Mock(output="neutral"),
        ]
        mock_predictor.side_effect = predictions
        mock_predict.return_value = mock_predictor

        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            test_cases = [
                Example(input="I love this!", output="positive"),
                Example(input="I hate this!", output="negative"),
                Example(input="It's okay", output="neutral"),
            ]

            result = evaluator.evaluate("Test prompt", test_cases, verbose=False)

            assert result.test_cases == 3
            assert result.passed == 3
            assert result.failed == 0
            assert result.accuracy == 1.0

    @patch('prompt_optimizer.evaluator.dspy.Predict')
    def test_evaluate_with_failures(self, mock_predict):
        """Test evaluation with some failures."""
        mock_predictor = Mock()
        predictions = [
            Mock(output="positive"),
            Mock(output="positive"),  # Wrong, should be negative
        ]
        mock_predictor.side_effect = predictions
        mock_predict.return_value = mock_predictor

        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            test_cases = [
                Example(input="I love this!", output="positive"),
                Example(input="I hate this!", output="negative"),
            ]

            result = evaluator.evaluate("Test prompt", test_cases, verbose=False)

            assert result.test_cases == 2
            assert result.passed == 1
            assert result.failed == 1
            assert result.accuracy == 0.5

    @patch('prompt_optimizer.evaluator.dspy.Predict')
    def test_evaluate_with_error(self, mock_predict):
        """Test evaluation when prediction raises an error."""
        mock_predictor = Mock()
        mock_predictor.side_effect = Exception("Prediction failed")
        mock_predict.return_value = mock_predictor

        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            test_cases = [
                Example(input="test", output="result")
            ]

            result = evaluator.evaluate("Test prompt", test_cases, verbose=False)

            assert result.test_cases == 1
            assert result.passed == 0
            assert result.failed == 1
            assert result.accuracy == 0.0
            assert "ERROR" in result.details[0]["predicted"]

    @patch('prompt_optimizer.evaluator.dspy.Predict')
    def test_compare_prompts(self, mock_predict):
        """Test comparing multiple prompts."""
        # Setup mock predictor
        mock_predictor = Mock()
        mock_prediction = Mock(output="positive")
        mock_predictor.return_value = mock_prediction
        mock_predict.return_value = mock_predictor

        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            prompts = {
                "prompt1": "First prompt",
                "prompt2": "Second prompt",
            }

            test_cases = [
                Example(input="test", output="positive")
            ]

            results = evaluator.compare_prompts(prompts, test_cases, verbose=False)

            assert len(results) == 2
            assert "prompt1" in results
            assert "prompt2" in results
            assert all(r.test_cases == 1 for r in results.values())

    @patch('prompt_optimizer.evaluator.dspy.Predict')
    def test_evaluate_empty_test_cases(self, mock_predict):
        """Test evaluation with empty test cases."""
        with patch.object(PromptEvaluator, '_setup_lm'):
            evaluator = PromptEvaluator()

            result = evaluator.evaluate("Test prompt", [], verbose=False)

            assert result.test_cases == 0
            assert result.passed == 0
            assert result.failed == 0
            assert result.accuracy == 0.0
