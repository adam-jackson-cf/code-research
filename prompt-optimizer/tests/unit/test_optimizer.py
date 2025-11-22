"""
Unit tests for the PromptOptimizer class.
"""

from unittest.mock import Mock, patch
import dspy

from prompt_optimizer.optimizer import PromptOptimizer, TaskModule
from prompt_optimizer.models import OptimizationRequest, Example


class TestTaskModule:
    """Tests for the TaskModule class."""

    def test_task_module_initialization(self):
        """Test that TaskModule initializes correctly."""
        module = TaskModule()
        assert hasattr(module, "predictor")
        assert isinstance(module.predictor, dspy.ChainOfThought)

    @patch("dspy.ChainOfThought")
    def test_task_module_forward(self, mock_cot):
        """Test that forward method calls the predictor."""
        mock_prediction = Mock()
        mock_cot.return_value = Mock(return_value=mock_prediction)

        module = TaskModule()
        result = module.forward("test input")

        # Verify the predictor was called
        module.predictor.assert_called_once_with(input="test input")


class TestPromptOptimizer:
    """Tests for the PromptOptimizer class."""

    def test_optimizer_initialization(self):
        """Test that PromptOptimizer initializes correctly."""
        optimizer = PromptOptimizer(api_key="test_key", default_model="claude-3-opus-20240229")
        assert optimizer.api_key == "test_key"
        assert optimizer.default_model == "claude-3-opus-20240229"
        assert optimizer._lm is None

    def test_prepare_examples(self):
        """Test converting Examples to DSPy examples."""
        optimizer = PromptOptimizer()
        examples = [
            Example(input="hello", output="world"),
            Example(input="foo", output="bar"),
        ]

        dspy_examples = optimizer._prepare_examples(examples)

        assert len(dspy_examples) == 2
        assert all(isinstance(ex, dspy.Example) for ex in dspy_examples)
        assert dspy_examples[0].input == "hello"
        assert dspy_examples[0].output == "world"

    def test_create_metric(self):
        """Test metric creation."""
        optimizer = PromptOptimizer()
        examples = [Example(input="test", output="result")]

        metric = optimizer._create_metric(examples)

        # Test exact match
        gold = Mock(output="result")
        pred = Mock(output="result")
        assert metric(gold, pred) == 1.0

        # Test no match
        pred_fail = Mock(output="different")
        score = metric(gold, pred_fail)
        assert 0.0 <= score < 1.0

    def test_evaluate_module(self):
        """Test module evaluation."""
        optimizer = PromptOptimizer()

        # Create a mock module
        mock_module = Mock()
        mock_module.return_value = Mock(output="result")

        # Create mock examples
        examples = [dspy.Example(input="test", output="result").with_inputs("input")]

        # Create simple metric
        def metric(gold, pred, trace=None):
            return 1.0 if pred.output == gold.output else 0.0

        score = optimizer._evaluate_module(mock_module, examples, metric)
        assert score == 1.0

    def test_evaluate_module_empty_examples(self):
        """Test that evaluating with no examples returns 0.0."""
        optimizer = PromptOptimizer()
        mock_module = Mock()
        metric = Mock()

        score = optimizer._evaluate_module(mock_module, [], metric)
        assert score == 0.0

    def test_get_optimizer_gepa(self):
        """Test getting GEPA optimizer."""
        optimizer = PromptOptimizer()
        metric = Mock()

        with patch("dspy.GEPA") as mock_gepa:
            mock_gepa.return_value = Mock()
            result = optimizer._get_optimizer("gepa", metric, 4, 10)
            mock_gepa.assert_called_once()

    def test_get_optimizer_mipro(self):
        """Test getting MIPRO optimizer."""
        optimizer = PromptOptimizer()
        metric = Mock()

        with patch("dspy.MIPROv2") as mock_mipro:
            mock_mipro.return_value = Mock()
            result = optimizer._get_optimizer("mipro", metric, 4, 10)
            mock_mipro.assert_called_once()

    def test_get_optimizer_bootstrap(self):
        """Test getting Bootstrap optimizer."""
        optimizer = PromptOptimizer()
        metric = Mock()

        with patch("dspy.BootstrapFewShot") as mock_bootstrap:
            mock_bootstrap.return_value = Mock()
            result = optimizer._get_optimizer("bootstrap", metric, 4, 10)
            mock_bootstrap.assert_called_once()

    def test_extract_prompt_with_predictor(self):
        """Test extracting prompt from module with predictor."""
        optimizer = PromptOptimizer()

        # Create a mock module with predictor
        mock_module = Mock()
        mock_module.predictor = Mock()
        mock_module.predictor.extended_signature = Mock()
        mock_module.predictor.extended_signature.instructions = "Test instructions"
        mock_module.predictor.extended_signature.input_fields = {}
        mock_module.predictor.extended_signature.output_fields = {}

        prompt = optimizer._extract_prompt(mock_module)
        assert "Test instructions" in prompt

    def test_extract_prompt_fallback(self):
        """Test prompt extraction fallback."""
        optimizer = PromptOptimizer()

        # Module without predictor
        mock_module = Mock()
        mock_module.__str__ = Mock(return_value="Module string representation")

        prompt = optimizer._extract_prompt(mock_module)
        assert isinstance(prompt, str)

    @patch("prompt_optimizer.optimizer.dspy.LM")
    @patch("prompt_optimizer.optimizer.dspy.settings")
    def test_setup_language_model(self, mock_settings, mock_lm_class):
        """Test language model setup."""
        mock_lm = Mock()
        mock_lm.model = "anthropic/claude-3-opus-20240229"
        mock_lm_class.return_value = mock_lm

        optimizer = PromptOptimizer(api_key="test_key")
        optimizer._setup_language_model("claude-3-opus-20240229")

        mock_lm_class.assert_called_once_with(
            model="anthropic/claude-3-opus-20240229", max_tokens=4000
        )
        mock_settings.configure.assert_called_once_with(lm=mock_lm)

    @patch("prompt_optimizer.optimizer.dspy.LM")
    @patch("prompt_optimizer.optimizer.dspy.settings")
    @patch("prompt_optimizer.optimizer.dspy.BootstrapFewShot")
    def test_optimize_full_flow(self, mock_bootstrap, mock_settings, mock_lm_class):
        """Test the full optimization flow."""
        # Setup mocks
        mock_lm = Mock()
        mock_lm.model = "anthropic/claude-3-5-sonnet-20241022"
        mock_lm_class.return_value = mock_lm

        mock_optimizer = Mock()
        mock_compiled_module = Mock()
        mock_compiled_module.predictor = Mock()
        mock_optimizer.compile.return_value = mock_compiled_module
        mock_bootstrap.return_value = mock_optimizer

        # Create optimizer and request
        optimizer = PromptOptimizer(api_key="test_key")
        request = OptimizationRequest(
            objective="Test objective",
            examples=[
                Example(input="test1", output="result1"),
                Example(input="test2", output="result2"),
            ],
            optimizer_type="bootstrap",
        )

        # Mock the evaluation
        with patch.object(optimizer, "_evaluate_module", return_value=0.85):
            result = optimizer.optimize(request, verbose=False)

        # Verify result
        assert result.original_objective == "Test objective"
        assert result.optimizer_used == "bootstrap"
        assert result.final_score == 0.85
        assert result.metrics["num_examples"] == 2
