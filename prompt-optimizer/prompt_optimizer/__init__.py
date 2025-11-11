"""
Prompt Optimizer: A DSPy and GEPA-based prompt optimization system.

This package provides tools to optimize prompts by:
1. Defining an outcome/objective
2. Providing examples of good outcomes
3. Using DSPy optimizers (including GEPA) to generate optimized prompts
"""

from prompt_optimizer.models import OptimizationRequest, OptimizationResult, Example
from prompt_optimizer.optimizer import PromptOptimizer
from prompt_optimizer.evaluator import PromptEvaluator

__version__ = "0.1.0"

__all__ = [
    "PromptOptimizer",
    "PromptEvaluator",
    "OptimizationRequest",
    "OptimizationResult",
    "Example",
]
