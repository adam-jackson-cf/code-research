"""
Example demonstrating how to compare different optimizers.

This example compares Bootstrap and MIPRO optimizers on the same task.
"""

import os
from prompt_optimizer import PromptOptimizer, PromptEvaluator
from prompt_optimizer.models import OptimizationRequest, Example


def main():
    """Compare different optimization strategies."""

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY environment variable not set")
        return

    print("="*70)
    print("Comparing Different Optimizers")
    print("="*70)

    # Prepare examples
    training_examples = [
        Example(input="2 + 2 = ?", output="4"),
        Example(input="5 + 3 = ?", output="8"),
        Example(input="10 - 4 = ?", output="6"),
        Example(input="7 + 1 = ?", output="8"),
        Example(input="9 - 5 = ?", output="4"),
    ]

    test_examples = [
        Example(input="3 + 4 = ?", output="7"),
        Example(input="8 - 2 = ?", output="6"),
        Example(input="6 + 6 = ?", output="12"),
    ]

    optimizer = PromptOptimizer()
    evaluator = PromptEvaluator()

    results = {}

    # Test different optimizers
    optimizer_types = ["bootstrap"]  # Can add "mipro", "gepa" if available

    for opt_type in optimizer_types:
        print(f"\n{'='*70}")
        print(f"Testing {opt_type.upper()} Optimizer")
        print(f"{'='*70}")

        request = OptimizationRequest(
            objective="Solve simple arithmetic problems. Provide only the numerical answer.",
            examples=training_examples,
            optimizer_type=opt_type,
            max_iterations=4,
            num_threads=2,
        )

        # Optimize
        opt_result = optimizer.optimize(request, verbose=True)

        # Evaluate
        eval_result = evaluator.evaluate(
            opt_result.optimized_prompt,
            test_examples,
            verbose=True
        )

        results[opt_type] = {
            "optimization": opt_result,
            "evaluation": eval_result,
        }

    # Compare results
    print(f"\n{'='*70}")
    print("COMPARISON SUMMARY")
    print(f"{'='*70}")

    for opt_type, result in results.items():
        opt_result = result["optimization"]
        eval_result = result["evaluation"]

        print(f"\n{opt_type.upper()}:")
        print(f"  Training Score: {opt_result.final_score:.2%}")
        print(f"  Test Accuracy: {eval_result.accuracy:.2%}")
        print(f"  Test Passed: {eval_result.passed}/{eval_result.test_cases}")

    # Find best optimizer
    best_optimizer = max(
        results.items(),
        key=lambda x: x[1]["evaluation"].accuracy
    )

    print(f"\n{'='*70}")
    print(f"Best Optimizer: {best_optimizer[0].upper()}")
    print(f"Test Accuracy: {best_optimizer[1]['evaluation'].accuracy:.2%}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
