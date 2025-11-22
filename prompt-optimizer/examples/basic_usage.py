"""
Basic usage example for the Prompt Optimizer.

This example demonstrates:
1. Creating an optimization request
2. Running the optimization
3. Evaluating the results
"""

import os
from prompt_optimizer import PromptOptimizer, PromptEvaluator
from prompt_optimizer.models import OptimizationRequest, Example


def main():
    """Run a basic sentiment classification optimization."""

    # Check for API key
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY environment variable not set")
        print("Please set it with: export ANTHROPIC_API_KEY='your-key-here'")
        return

    print("=" * 70)
    print("Prompt Optimizer - Basic Usage Example")
    print("=" * 70)

    # Define training examples
    training_examples = [
        Example(
            input="I love this product! It's amazing!",
            output="positive",
            reasoning="Enthusiastic language with exclamation marks",
        ),
        Example(
            input="This is terrible. Waste of money.",
            output="negative",
            reasoning="Strong negative sentiment",
        ),
        Example(
            input="It's okay, nothing special.",
            output="neutral",
            reasoning="Lukewarm, neutral response",
        ),
        Example(
            input="Highly recommend! Best purchase ever!",
            output="positive",
            reasoning="Strong positive recommendation",
        ),
        Example(
            input="Disappointed. Would not buy again.",
            output="negative",
            reasoning="Expression of disappointment",
        ),
    ]

    # Define test examples
    test_examples = [
        Example(input="Fantastic! Exceeded expectations!", output="positive"),
        Example(input="Complete waste of time and money.", output="negative"),
        Example(input="It works fine. Does the job.", output="neutral"),
    ]

    # Create optimizer
    print("\nInitializing optimizer...")
    optimizer = PromptOptimizer()

    # Create optimization request
    request = OptimizationRequest(
        objective=(
            "Classify text sentiment as positive, negative, or neutral. "
            "Be accurate and consistent in your classifications."
        ),
        examples=training_examples,
        optimizer_type="bootstrap",  # Options: gepa, mipro, bootstrap
        max_iterations=5,
        num_threads=2,
    )

    # Run optimization
    print("\nOptimizing prompt...")
    result = optimizer.optimize(request, verbose=True)

    # Display results
    print("\n" + "=" * 70)
    print("OPTIMIZATION RESULTS")
    print("=" * 70)
    print("\nOriginal Objective:")
    print(f"  {result.original_objective}")
    print("\nOptimized Prompt:")
    print(f"  {result.optimized_prompt[:200]}...")
    print("\nTraining Performance:")
    print(f"  Score: {result.final_score:.2%}")
    print(f"  Optimizer: {result.optimizer_used}")
    print(f"  Iterations: {result.num_iterations}")

    # Evaluate on test set
    print("\n" + "=" * 70)
    print("EVALUATION ON TEST SET")
    print("=" * 70)

    evaluator = PromptEvaluator()
    evaluation = evaluator.evaluate(result.optimized_prompt, test_examples, verbose=True)

    print("\nTest Set Performance:")
    print(f"  Accuracy: {evaluation.accuracy:.2%}")
    print(f"  Passed: {evaluation.passed}/{evaluation.test_cases}")
    print(f"  Failed: {evaluation.failed}/{evaluation.test_cases}")

    # Show detailed results
    print("\nDetailed Results:")
    for i, detail in enumerate(evaluation.details, 1):
        status = "✅" if detail["passed"] else "❌"
        print(f"\n  {status} Test {i}:")
        print(f"     Input: {detail['input']}")
        print(f"     Expected: {detail['expected']}")
        print(f"     Predicted: {detail['predicted']}")

    print("\n" + "=" * 70)
    print("Example Complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
