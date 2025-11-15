# 🎯 Prompt Optimizer

A Python system for optimizing prompts using **DSPy** and **GEPA** (Genetic-Pareto) optimization. Specify an outcome, provide examples of good results, and get an optimized prompt automatically.

## ✨ Features

- **🔬 Multiple Optimizers**: Support for GEPA, MIPRO, and Bootstrap optimizers from DSPy
- **📊 Comprehensive Evaluation**: Built-in evaluation framework to test optimized prompts
- **🎓 Example-Driven**: Learn from examples to generate optimal prompts
- **🧪 Well-Tested**: Extensive unit and integration test coverage
- **🚀 Easy to Use**: Simple API for optimization and evaluation
- **📈 Comparison Tools**: Compare different optimizers to find the best approach

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  User Input                         │
│  • Objective (desired outcome)                      │
│  • Examples (input/output pairs)                    │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│              Prompt Optimizer                       │
│  • DSPy Framework                                   │
│  • GEPA/MIPRO/Bootstrap                            │
│  • Iterative Refinement                            │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│            Optimized Prompt                         │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│              Evaluator                              │
│  • Test on held-out examples                       │
│  • Accuracy metrics                                │
│  • Detailed feedback                               │
└─────────────────────────────────────────────────────┘
```

## 📦 Installation

### Prerequisites

- Python 3.10 or higher
- Anthropic API key

### Setup

```bash
cd prompt-optimizer

# Install dependencies
pip install -r requirements.txt

# Or install in development mode
pip install -e .
```

### Environment Variables

Create a `.env` file or export:

```bash
export ANTHROPIC_API_KEY='your-api-key-here'
```

## 🚀 Quick Start

### Basic Usage

```python
from prompt_optimizer import PromptOptimizer, PromptEvaluator
from prompt_optimizer.models import OptimizationRequest, Example

# Define your training examples
examples = [
    Example(
        input="I love this product!",
        output="positive",
        reasoning="Enthusiastic language"
    ),
    Example(
        input="This is terrible.",
        output="negative",
        reasoning="Strong negative sentiment"
    ),
    Example(
        input="It's okay.",
        output="neutral",
        reasoning="Neutral response"
    ),
]

# Create optimization request
request = OptimizationRequest(
    objective="Classify text sentiment as positive, negative, or neutral",
    examples=examples,
    optimizer_type="gepa",  # or "mipro" or "bootstrap"
    max_iterations=10,
    num_threads=4,
)

# Optimize the prompt
optimizer = PromptOptimizer()
result = optimizer.optimize(request, verbose=True)

print(f"Optimized Prompt: {result.optimized_prompt}")
print(f"Training Score: {result.final_score:.2%}")

# Evaluate on test data
test_examples = [
    Example(input="Amazing experience!", output="positive"),
    Example(input="Waste of money.", output="negative"),
]

evaluator = PromptEvaluator()
evaluation = evaluator.evaluate(
    result.optimized_prompt,
    test_examples,
    verbose=True
)

print(f"Test Accuracy: {evaluation.accuracy:.2%}")
```

## 📚 Examples

See the `examples/` directory for complete examples:

- **`basic_usage.py`**: Simple sentiment classification example
- **`compare_optimizers.py`**: Compare different optimization strategies

Run an example:

```bash
python examples/basic_usage.py
```

## 🧪 Testing

The project includes comprehensive unit and integration tests.

### Run All Tests

```bash
pytest
```

### Run Only Unit Tests

```bash
pytest tests/unit/
```

### Run Only Integration Tests

Integration tests require an Anthropic API key:

```bash
export ANTHROPIC_API_KEY='your-key-here'
pytest tests/integration/ -v
```

### Run Tests with Coverage

```bash
pytest --cov=prompt_optimizer --cov-report=html
```

### Skip Integration Tests (for CI/CD)

```bash
pytest -m "not integration"
```

## 🔧 Optimizers

### GEPA (Genetic-Pareto)

**Best for**: Complex tasks requiring sophisticated prompt evolution

```python
OptimizationRequest(
    objective="Your objective",
    examples=examples,
    optimizer_type="gepa",
    max_iterations=20,
)
```

### MIPRO (Multi-prompt Instruction Proposal)

**Best for**: Tasks where instruction quality is critical

```python
OptimizationRequest(
    objective="Your objective",
    examples=examples,
    optimizer_type="mipro",
    max_iterations=15,
)
```

### Bootstrap Few-Shot

**Best for**: Fast optimization with limited examples

```python
OptimizationRequest(
    objective="Your objective",
    examples=examples,
    optimizer_type="bootstrap",
    max_iterations=10,
)
```

## 📊 API Reference

### `PromptOptimizer`

Main class for optimizing prompts.

**Methods:**

- `optimize(request: OptimizationRequest, verbose: bool = True) -> OptimizationResult`
  - Optimizes a prompt based on the request
  - Returns optimization results with the optimized prompt

### `PromptEvaluator`

Evaluates optimized prompts against test cases.

**Methods:**

- `evaluate(prompt: str, test_cases: List[Example], verbose: bool = True) -> EvaluationResult`
  - Evaluates a prompt on test cases
  - Returns pass/fail statistics and accuracy

- `compare_prompts(prompts: Dict[str, str], test_cases: List[Example], verbose: bool = True) -> Dict[str, EvaluationResult]`
  - Compares multiple prompts on the same test cases
  - Returns evaluation results for each prompt

### Models

#### `Example`

```python
Example(
    input: str,           # Input text
    output: str,          # Expected output
    reasoning: Optional[str] = None  # Why this is a good example
)
```

#### `OptimizationRequest`

```python
OptimizationRequest(
    objective: str,       # Description of desired outcome
    examples: List[Example],  # Training examples
    optimizer_type: Literal["gepa", "mipro", "bootstrap"] = "gepa",
    max_iterations: int = 10,
    num_threads: int = 4,
    model_name: str = "claude-3-5-sonnet-20241022"
)
```

#### `OptimizationResult`

```python
OptimizationResult(
    original_objective: str,
    optimized_prompt: str,
    final_score: float,
    num_iterations: int,
    optimizer_used: str,
    optimization_history: List[Dict[str, Any]],
    metrics: Dict[str, Any]
)
```

#### `EvaluationResult`

```python
EvaluationResult(
    prompt: str,
    test_cases: int,
    passed: int,
    failed: int,
    accuracy: float,
    details: List[Dict[str, Any]]
)
```

## 🎓 Use Cases

### Sentiment Classification

```python
objective = "Classify sentiment as positive, negative, or neutral"
examples = [
    Example(input="I love it!", output="positive"),
    Example(input="Terrible product", output="negative"),
    Example(input="It's okay", output="neutral"),
]
```

### Entity Extraction

```python
objective = "Extract named entities (people, places, organizations)"
examples = [
    Example(
        input="John works at Acme in NYC",
        output="Person: John, Company: Acme, Location: NYC"
    ),
]
```

### Question Answering

```python
objective = "Answer questions concisely and accurately"
examples = [
    Example(
        input="What is the capital of France?",
        output="Paris"
    ),
]
```

### Text Summarization

```python
objective = "Summarize text in one sentence"
examples = [
    Example(
        input="Long article text...",
        output="Brief one-sentence summary"
    ),
]
```

## 🔬 How It Works

1. **Input Phase**: You provide an objective and examples of desired input/output pairs

2. **Optimization Phase**:
   - DSPy creates a task module based on your examples
   - The selected optimizer (GEPA/MIPRO/Bootstrap) iteratively refines the prompt
   - Each iteration is evaluated using a metric that compares outputs to examples
   - The optimizer uses reflection and evolution to improve the prompt

3. **Output Phase**: You receive an optimized prompt that performs well on your examples

4. **Evaluation Phase**: Test the optimized prompt on held-out test data to validate performance

## 📈 Performance Tips

- **More Examples**: 5-10 examples usually work well; more examples can improve results
- **Diverse Examples**: Include edge cases and diverse input patterns
- **Clear Objective**: Be specific about the desired outcome
- **Appropriate Optimizer**:
  - Use GEPA for complex tasks (slower but more thorough)
  - Use MIPRO for instruction-heavy tasks
  - Use Bootstrap for quick iterations
- **Iterations**: Start with 10 iterations; increase if needed
- **Test Set**: Always evaluate on held-out test data

## 🐛 Troubleshooting

### "ANTHROPIC_API_KEY not set"

```bash
export ANTHROPIC_API_KEY='your-key-here'
```

### "GEPA not available"

GEPA may not be in all DSPy versions. The system will fall back to MIPRO or Bootstrap automatically.

### Low Accuracy

- Try more training examples
- Increase max_iterations
- Try a different optimizer
- Make sure examples are high quality and diverse

### Import Errors

```bash
pip install --upgrade dspy-ai anthropic
```

## 🤝 Contributing

Contributions welcome! Areas for enhancement:

- Additional optimizers
- Custom metrics
- More evaluation strategies
- Performance optimizations
- Documentation improvements

## 📄 License

MIT License

## 🙏 Acknowledgments

- **[DSPy](https://github.com/stanfordnlp/dspy)**: Stanford NLP's framework for programming language models
- **[GEPA](https://arxiv.org/abs/2507.19457)**: Reflective prompt evolution research
- **[Anthropic](https://www.anthropic.com/)**: Claude LLM API

## 📞 Support

For issues and questions:
- Check the examples in `examples/`
- Review test cases in `tests/`
- Check DSPy documentation: https://dspy.ai/

---

**Built with DSPy and GEPA for automated prompt optimization** 🚀
