"""
Data models for the prompt optimization system.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


class Example(BaseModel):
    """
    An example demonstrating a good outcome for the desired task.

    Attributes:
        input: The input provided to the model
        output: The expected/desired output
        reasoning: Optional explanation of why this is a good example
    """

    input: str = Field(..., description="Input text for the example")
    output: str = Field(..., description="Expected/desired output")
    reasoning: Optional[str] = Field(None, description="Why this is a good example")


class OptimizationRequest(BaseModel):
    """
    A request to optimize a prompt for a specific outcome.

    Attributes:
        objective: Clear description of the desired outcome
        examples: List of examples demonstrating good outcomes
        optimizer_type: Which DSPy optimizer to use (gepa, mipro, bootstrap)
        metric: Optional custom metric function name
        max_iterations: Maximum optimization iterations
        num_threads: Number of parallel threads for optimization
    """

    objective: str = Field(..., description="Clear description of desired outcome")
    examples: List[Example] = Field(..., min_length=1, description="Examples of good outcomes")
    optimizer_type: Literal["gepa", "mipro", "bootstrap"] = Field(
        default="gepa", description="DSPy optimizer to use"
    )
    metric: Optional[str] = Field(None, description="Custom metric function name")
    max_iterations: int = Field(default=10, ge=1, le=100, description="Max optimization iterations")
    num_threads: int = Field(default=4, ge=1, le=16, description="Number of parallel threads")
    model_name: str = Field(default="claude-3-5-sonnet-20241022", description="LLM model to use")


class OptimizationResult(BaseModel):
    """
    Result of prompt optimization.

    Attributes:
        original_objective: The original objective provided
        optimized_prompt: The final optimized prompt
        optimization_history: History of prompts tried during optimization
        final_score: Final evaluation score
        metrics: Additional metrics collected during optimization
        num_iterations: Number of iterations performed
    """

    original_objective: str
    optimized_prompt: str
    optimization_history: List[Dict[str, Any]] = Field(default_factory=list)
    final_score: float
    metrics: Dict[str, Any] = Field(default_factory=dict)
    num_iterations: int
    optimizer_used: str


class EvaluationResult(BaseModel):
    """
    Result of evaluating a prompt against test cases.

    Attributes:
        prompt: The prompt being evaluated
        test_cases: Number of test cases evaluated
        passed: Number of test cases passed
        failed: Number of test cases failed
        accuracy: Accuracy score (0-1)
        details: Detailed results for each test case
    """

    prompt: str
    test_cases: int
    passed: int
    failed: int
    accuracy: float = Field(ge=0.0, le=1.0)
    details: List[Dict[str, Any]] = Field(default_factory=list)
