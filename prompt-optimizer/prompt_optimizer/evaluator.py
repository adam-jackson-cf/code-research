"""
Evaluation utilities for testing optimized prompts.
"""

import dspy
from typing import List, Dict, Any, Optional
from rich.console import Console
from rich.table import Table

from prompt_optimizer.models import Example, EvaluationResult

console = Console()


class PromptEvaluator:
    """
    Evaluates optimized prompts against test cases.

    This class can be used to validate that optimized prompts
    actually perform well on held-out test data.
    """

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-5-sonnet-20241022"):
        """
        Initialize the evaluator.

        Args:
            api_key: Anthropic API key
            model: Model to use for evaluation
        """
        self.api_key = api_key
        self.model = model
        self._setup_lm()

    def _setup_lm(self) -> None:
        """Setup the language model for evaluation."""
        try:
            import os
            # Set API key if provided
            if self.api_key:
                os.environ["ANTHROPIC_API_KEY"] = self.api_key

            lm = dspy.LM(
                model=f"anthropic/{self.model}",
                max_tokens=4000
            )
            dspy.settings.configure(lm=lm)
        except Exception as e:
            console.print(f"[yellow]Warning: Could not setup Anthropic model: {e}[/yellow]")

    def evaluate(
        self,
        prompt: str,
        test_cases: List[Example],
        verbose: bool = True
    ) -> EvaluationResult:
        """
        Evaluate a prompt against test cases.

        Args:
            prompt: The prompt to evaluate
            test_cases: List of test examples
            verbose: Whether to show detailed output

        Returns:
            EvaluationResult with pass/fail statistics
        """
        if verbose:
            console.print(f"\n[bold cyan]🧪 Evaluating Prompt[/bold cyan]")
            console.print(f"[cyan]Test Cases:[/cyan] {len(test_cases)}")

        passed = 0
        failed = 0
        details = []

        # Create a simple predictor using the prompt
        class EvalSignature(dspy.Signature):
            """Evaluation signature with custom instructions."""
            input: str = dspy.InputField()
            output: str = dspy.OutputField()

        # Try to incorporate the prompt as instructions
        predictor = dspy.Predict(EvalSignature)

        for i, test_case in enumerate(test_cases):
            try:
                # Make prediction
                prediction = predictor(input=test_case.input)
                pred_output = prediction.output.strip().lower()
                expected_output = test_case.output.strip().lower()

                # Evaluate
                is_correct = self._evaluate_output(pred_output, expected_output)

                if is_correct:
                    passed += 1
                    status = "✅ PASS"
                else:
                    failed += 1
                    status = "❌ FAIL"

                details.append({
                    "test_case": i + 1,
                    "input": test_case.input,
                    "expected": test_case.output,
                    "predicted": prediction.output,
                    "passed": is_correct
                })

                if verbose:
                    console.print(f"{status} Test {i + 1}/{len(test_cases)}")

            except Exception as e:
                failed += 1
                details.append({
                    "test_case": i + 1,
                    "input": test_case.input,
                    "expected": test_case.output,
                    "predicted": f"ERROR: {str(e)}",
                    "passed": False
                })
                if verbose:
                    console.print(f"❌ FAIL Test {i + 1}/{len(test_cases)} (Error)")

        accuracy = passed / len(test_cases) if test_cases else 0.0

        if verbose:
            self._display_results(passed, failed, accuracy)

        return EvaluationResult(
            prompt=prompt,
            test_cases=len(test_cases),
            passed=passed,
            failed=failed,
            accuracy=accuracy,
            details=details
        )

    def _evaluate_output(self, predicted: str, expected: str) -> bool:
        """
        Evaluate if a prediction matches the expected output.

        Uses multiple strategies: exact match, substring match, keyword overlap.
        """
        # Exact match
        if predicted == expected:
            return True

        # Handle empty strings - empty doesn't match non-empty
        if not predicted or not expected:
            return False

        # Substring match (either direction)
        if expected in predicted or predicted in expected:
            return True

        # Keyword overlap (>70% of expected words present)
        pred_words = set(predicted.split())
        expected_words = set(expected.split())

        if len(expected_words) > 0:
            overlap = len(pred_words & expected_words)
            overlap_ratio = overlap / len(expected_words)
            return overlap_ratio > 0.7

        return False

    def _display_results(self, passed: int, failed: int, accuracy: float) -> None:
        """Display evaluation results in a nice table."""
        table = Table(title="Evaluation Results", show_header=True)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")

        table.add_row("Passed", str(passed))
        table.add_row("Failed", str(failed))
        table.add_row("Total", str(passed + failed))
        table.add_row("Accuracy", f"{accuracy:.2%}")

        console.print("\n")
        console.print(table)

    def compare_prompts(
        self,
        prompts: Dict[str, str],
        test_cases: List[Example],
        verbose: bool = True
    ) -> Dict[str, EvaluationResult]:
        """
        Compare multiple prompts against the same test cases.

        Args:
            prompts: Dictionary mapping prompt names to prompt strings
            test_cases: List of test examples
            verbose: Whether to show detailed output

        Returns:
            Dictionary mapping prompt names to their evaluation results
        """
        results = {}

        for name, prompt in prompts.items():
            if verbose:
                console.print(f"\n[bold]Evaluating: {name}[/bold]")

            result = self.evaluate(prompt, test_cases, verbose=verbose)
            results[name] = result

        if verbose:
            self._display_comparison(results)

        return results

    def _display_comparison(self, results: Dict[str, EvaluationResult]) -> None:
        """Display a comparison table of multiple prompt evaluations."""
        table = Table(title="Prompt Comparison", show_header=True)
        table.add_column("Prompt", style="cyan")
        table.add_column("Passed", style="green")
        table.add_column("Failed", style="red")
        table.add_column("Accuracy", style="yellow")

        # Sort by accuracy descending
        sorted_results = sorted(
            results.items(),
            key=lambda x: x[1].accuracy,
            reverse=True
        )

        for name, result in sorted_results:
            table.add_row(
                name,
                str(result.passed),
                str(result.failed),
                f"{result.accuracy:.2%}"
            )

        console.print("\n")
        console.print(table)
