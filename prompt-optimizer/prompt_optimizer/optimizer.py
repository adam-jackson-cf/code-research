"""
Core prompt optimization system using DSPy and GEPA.
"""

import dspy
from typing import List, Optional, Callable
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from prompt_optimizer.models import (
    OptimizationRequest,
    OptimizationResult,
    Example,
)

console = Console()


class TaskSignature(dspy.Signature):
    """Generic task signature for the optimization target."""
    input: str = dspy.InputField(desc="The input to process")
    output: str = dspy.OutputField(desc="The expected output")


class TaskModule(dspy.Module):
    """A simple DSPy module that performs the task."""

    def __init__(self):
        super().__init__()
        self.predictor = dspy.ChainOfThought(TaskSignature)

    def forward(self, input: str) -> dspy.Prediction:
        """Execute the task with the given input."""
        return self.predictor(input=input)


class PromptOptimizer:
    """
    Optimizes prompts using DSPy and GEPA.

    This class takes an objective and examples, then uses DSPy's optimization
    algorithms (GEPA, MIPRO, or Bootstrap) to generate an optimized prompt.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: str = "claude-3-5-sonnet-20241022"
    ):
        """
        Initialize the prompt optimizer.

        Args:
            api_key: Anthropic API key (or None to use environment variable)
            default_model: Default Claude model to use
        """
        self.api_key = api_key
        self.default_model = default_model
        self._lm = None

    def _setup_language_model(self, model_name: str) -> None:
        """Setup the DSPy language model."""
        if self._lm is None or self._lm.model != f"anthropic/{model_name}":
            # DSPy uses LiteLLM under the hood, so we need "anthropic/model-name" format
            try:
                import os
                # Set API key if provided
                if self.api_key:
                    os.environ["ANTHROPIC_API_KEY"] = self.api_key

                self._lm = dspy.LM(
                    model=f"anthropic/{model_name}",
                    max_tokens=4000
                )
                dspy.settings.configure(lm=self._lm)
            except Exception as e:
                console.print(f"[yellow]Warning: Could not setup Anthropic model: {e}[/yellow]")
                console.print("[yellow]Falling back to default DSPy configuration[/yellow]")

    def _create_metric(self, examples: List[Example]) -> Callable:
        """
        Create an evaluation metric based on the examples.

        The metric compares the output against expected outputs from examples.
        """
        def metric(gold: dspy.Example, pred: dspy.Prediction, trace=None) -> float:
            """
            Evaluate prediction quality.

            Returns a score between 0 and 1, where 1 is perfect match.
            """
            # Simple exact match for now - can be enhanced
            if hasattr(pred, 'output') and hasattr(gold, 'output'):
                pred_output = str(pred.output).strip().lower()
                gold_output = str(gold.output).strip().lower()

                # Exact match gets score of 1.0
                if pred_output == gold_output:
                    return 1.0

                # Partial credit for substring match
                if gold_output in pred_output or pred_output in gold_output:
                    return 0.5

                # Check for keyword overlap
                pred_words = set(pred_output.split())
                gold_words = set(gold_output.split())
                if len(gold_words) > 0:
                    overlap = len(pred_words & gold_words) / len(gold_words)
                    return overlap * 0.3

            return 0.0

        return metric

    def _prepare_examples(self, examples: List[Example]) -> List[dspy.Example]:
        """Convert Example objects to DSPy examples."""
        dspy_examples = []
        for ex in examples:
            dspy_ex = dspy.Example(
                input=ex.input,
                output=ex.output
            ).with_inputs("input")
            dspy_examples.append(dspy_ex)
        return dspy_examples

    def optimize(
        self,
        request: OptimizationRequest,
        verbose: bool = True
    ) -> OptimizationResult:
        """
        Optimize a prompt based on the request.

        Args:
            request: The optimization request with objective and examples
            verbose: Whether to show progress output

        Returns:
            OptimizationResult with the optimized prompt and metrics
        """
        if verbose:
            console.print("\n[bold cyan]🚀 Starting Prompt Optimization[/bold cyan]")
            console.print(f"[cyan]Objective:[/cyan] {request.objective}")
            console.print(f"[cyan]Examples:[/cyan] {len(request.examples)}")
            console.print(f"[cyan]Optimizer:[/cyan] {request.optimizer_type.upper()}")

        # Setup language model
        self._setup_language_model(request.model_name)

        # Prepare examples
        train_examples = self._prepare_examples(request.examples)

        # Create the module to optimize
        module = TaskModule()

        # Create evaluation metric
        metric = self._create_metric(request.examples)

        # Select and configure optimizer
        optimizer = self._get_optimizer(
            request.optimizer_type,
            metric=metric,
            num_threads=request.num_threads,
            max_iterations=request.max_iterations
        )

        # Run optimization
        try:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console if verbose else None,
                transient=True
            ) as progress:
                if verbose:
                    task = progress.add_task(
                        f"Optimizing with {request.optimizer_type.upper()}...",
                        total=None
                    )

                optimized_module = optimizer.compile(
                    module,
                    trainset=train_examples,
                    metric=metric
                )

            # Extract the optimized prompt
            optimized_prompt = self._extract_prompt(optimized_module)

            # Evaluate final performance
            final_score = self._evaluate_module(optimized_module, train_examples, metric)

            if verbose:
                console.print(f"\n[bold green]✅ Optimization Complete![/bold green]")
                console.print(f"[green]Final Score:[/green] {final_score:.2%}")

            return OptimizationResult(
                original_objective=request.objective,
                optimized_prompt=optimized_prompt,
                optimization_history=[],  # Can be enhanced to track history
                final_score=final_score,
                metrics={
                    "num_examples": len(request.examples),
                    "model": request.model_name,
                },
                num_iterations=request.max_iterations,
                optimizer_used=request.optimizer_type
            )

        except Exception as e:
            console.print(f"[bold red]❌ Optimization failed:[/bold red] {str(e)}")
            raise

    def _get_optimizer(
        self,
        optimizer_type: str,
        metric: Callable,
        num_threads: int,
        max_iterations: int
    ):
        """Get the appropriate DSPy optimizer."""
        if optimizer_type == "gepa":
            # GEPA: Genetic-Pareto optimizer
            try:
                return dspy.GEPA(
                    metric=metric,
                    breadth=num_threads,
                    depth=max_iterations,
                    init_temperature=1.0
                )
            except (AttributeError, ImportError):
                console.print("[yellow]GEPA not available, falling back to MIPROv2[/yellow]")
                optimizer_type = "mipro"

        if optimizer_type == "mipro":
            # MIPROv2: Multi-prompt instruction proposal optimizer
            try:
                return dspy.MIPROv2(
                    metric=metric,
                    num_threads=num_threads,
                    max_bootstrapped_demos=max_iterations,
                    max_labeled_demos=len([]),  # No additional labeled demos
                )
            except (AttributeError, ImportError):
                console.print("[yellow]MIPROv2 not available, falling back to Bootstrap[/yellow]")
                optimizer_type = "bootstrap"

        # Default to Bootstrap (most widely available)
        return dspy.BootstrapFewShot(
            metric=metric,
            max_bootstrapped_demos=min(max_iterations, 8),
            max_labeled_demos=0
        )

    def _extract_prompt(self, module: dspy.Module) -> str:
        """Extract the optimized prompt from the compiled module."""
        try:
            # Try to get the prompt from the predictor
            if hasattr(module, 'predictor'):
                predictor = module.predictor

                # Check for prompt template
                if hasattr(predictor, 'extended_signature'):
                    sig = predictor.extended_signature
                    prompt_parts = []

                    # Get instructions if available
                    if hasattr(sig, 'instructions'):
                        prompt_parts.append(sig.instructions)

                    # Get field descriptions
                    if hasattr(sig, 'input_fields'):
                        for field_name, field in sig.input_fields.items():
                            if hasattr(field, 'desc'):
                                prompt_parts.append(f"Input ({field_name}): {field.desc}")

                    if hasattr(sig, 'output_fields'):
                        for field_name, field in sig.output_fields.items():
                            if hasattr(field, 'desc'):
                                prompt_parts.append(f"Output ({field_name}): {field.desc}")

                    if prompt_parts:
                        return "\n\n".join(prompt_parts)

            # Fallback: return module representation
            return str(module)

        except Exception as e:
            return f"[Could not extract prompt: {e}]"

    def _evaluate_module(
        self,
        module: dspy.Module,
        examples: List[dspy.Example],
        metric: Callable
    ) -> float:
        """Evaluate the module on examples using the metric."""
        if not examples:
            return 0.0

        total_score = 0.0
        for example in examples:
            try:
                prediction = module(input=example.input)
                score = metric(example, prediction)
                total_score += score
            except Exception:
                # Failed predictions get 0 score
                pass

        return total_score / len(examples)
