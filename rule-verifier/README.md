# Rule Verifier

A comprehensive tool for testing whether rules placed in `AGENTS.md` or `CLAUDE.md` files are being followed by Claude and evaluating their effectiveness in guiding code implementation.

## Overview

Rule Verifier helps you:
- **Identify** all rules in your AGENTS.md/CLAUDE.md files
- **Generate** minimal test scenarios for each rule
- **Execute** tests multiple times (default: 5) with zero context between sessions
- **Isolate** each test run in separate tmux sessions for true independence
- **Analyze** rule compliance and consistency across iterations
- **Report** results in multiple formats (console, JSON, HTML, Markdown)

## Features

- 🔍 **Intelligent Rule Parsing** - Extracts and classifies rules from markdown files
- 🎯 **Minimal Scenario Generation** - Creates lean, focused test cases for each rule
- 🔒 **Session Isolation** - Uses tmux to ensure zero context bleeding between tests
- 🔁 **Multiple Iterations** - Runs each scenario 5 times (configurable) to test consistency
- 📊 **Comprehensive Reporting** - Generates beautiful reports in multiple formats
- ⚡ **Fast Execution** - Optional non-isolated mode for quick testing
- 🎨 **Colored Output** - Easy-to-read console output with color-coded results

## Installation

### Prerequisites

- Python 3.9+
- tmux 3.0+ (for session isolation)
- Claude CLI installed and configured

### Setup

1. **Install dependencies:**

```bash
cd rule-verifier
pip install -r requirements.txt
```

2. **Verify tmux is installed:**

```bash
tmux -V
```

3. **Verify Claude CLI is available:**

```bash
claude --version
```

## Quick Start

### Basic Usage

Test rules in an AGENTS.md file:

```bash
python run_verifier.py examples/example_AGENTS.md
```

### Common Use Cases

**Test with custom iterations:**
```bash
python run_verifier.py examples/example_AGENTS.md --iterations 10
```

**Test without isolation (faster):**
```bash
python run_verifier.py examples/example_AGENTS.md --no-isolation
```

**Test only high-priority rules:**
```bash
python run_verifier.py examples/example_AGENTS.md --priority high critical
```

**Generate only JSON report:**
```bash
python run_verifier.py examples/example_AGENTS.md --format json
```

**Dry run (parse and generate scenarios without testing):**
```bash
python run_verifier.py examples/example_AGENTS.md --dry-run
```

## Configuration

The tool uses `config.yaml` for default settings. You can create a custom config file:

```yaml
# Test Settings
test:
  iterations: 5        # Number of times to run each scenario
  timeout: 60          # Timeout per test in seconds
  parallel: false      # Parallel execution (future feature)

# Claude CLI Settings
claude:
  cli_path: "claude"   # Path to Claude CLI
  print_mode: true     # Use print mode (-p flag)
  model: "sonnet"      # Model to use

# Session Management
session:
  base_dir: "/tmp/rule-verifier-sessions"
  cleanup_after_test: true
  isolation_method: "tmux"
  tmux_prefix: "rule-verify-"

# Validation
validation:
  strict_mode: false      # Strict vs. fuzzy matching
  case_sensitive: false
  min_confidence: 0.7     # Minimum confidence for fuzzy matching

# Reporting
reporting:
  formats:
    - console
    - json
    - html
    - markdown
  output_dir: "./results"
  verbose: true
```

Use custom config:
```bash
python run_verifier.py examples/example_AGENTS.md --config my_config.yaml
```

## How It Works

### 1. Rule Parsing

The tool parses your AGENTS.md/CLAUDE.md file and extracts rules:

```markdown
## Development Server
- **Always run** `npm run dev` when starting development
- **Never run** `npm run build` in interactive sessions
```

Extracted rules are classified by:
- **Type**: command_requirement, command_prohibition, preference, workflow, etc.
- **Priority**: critical, high, medium, low
- **Testability**: whether the rule can be automatically tested

### 2. Scenario Generation

For each rule, minimal test scenarios are generated:

**Rule**: "Always run `npm run dev` when starting development"

**Generated Scenario**:
```
Prompt: "I need to start the development server for this project. What command should I run?"
Expected: Response should contain "npm run dev"
```

### 3. Test Execution

Each scenario is executed 5 times (configurable) with:
- **Isolated tmux sessions** - Zero context between runs
- **Fresh environment** - Clean directory for each test
- **Independent Claude CLI calls** - No memory from previous tests

### 4. Validation

Responses are validated against expected behavior:
- ✅ **should_contain**: Expected strings/commands are present
- ❌ **should_not_contain**: Prohibited strings/commands are absent
- 📝 **Pattern matching**: Fuzzy matching for flexibility
- 📊 **Confidence scoring**: How well the response matches expectations

### 5. Consistency Analysis

Results across iterations are analyzed:
- **Pass rate per scenario**: % of iterations that passed
- **Consistent scenarios**: ≥80% pass rate
- **Inconsistent scenarios**: <80% pass rate (indicates unclear or unreliable rules)

### 6. Reporting

Reports are generated in multiple formats:

**Console** - Real-time colored output
**JSON** - Machine-readable for CI/CD
**HTML** - Beautiful visual dashboard
**Markdown** - Human-readable for PRs

## Rule Categories

The tool recognizes and tests various rule types:

### Command Rules
- **command_requirement**: Commands that must be used
- **command_prohibition**: Commands that must not be used

```markdown
- Run `npm run dev` during development
- Never run `npm run build` in interactive sessions
```

### Preference Rules
- **preference**: Recommended tools/approaches

```markdown
- Prefer TypeScript (.tsx/.ts) for new components
- Use single quotes for strings
```

### Workflow Rules
- **workflow**: Multi-step processes

```markdown
- Run tests before committing
- Update lockfiles after dependency changes
```

### Other Categories
- **code_style**: Formatting and style conventions
- **documentation**: Documentation requirements
- **file_structure**: File organization rules

## Understanding Results

### Console Output

```
================================================================================
                        RULE VERIFIER TEST REPORT
================================================================================

OVERALL RESULTS
  Total Tests:     25
  Passed:          22
  Failed:          3
  Pass Rate:       88.0%

SCENARIO CONSISTENCY
  Total Scenarios:       5
  Consistent (≥80%):     4
  Inconsistent (<80%):   1

RULE BREAKDOWN

  ✓ developmen_a1b2c3d4
    Run `npm run dev` during interactive sessions
    Pass Rate: 100.0% (5/5)

  ✗ developmen_e5f6g7h8
    Never run `npm run build` inside agent sessions
    Pass Rate: 60.0% (3/5)
```

### Interpreting Results

- **High pass rate (≥80%)**: Rule is clear and consistently followed
- **Medium pass rate (60-79%)**: Rule may be ambiguous or context-dependent
- **Low pass rate (<60%)**: Rule is unclear, contradictory, or ineffective

### Improving Rules

If a rule has low consistency:

1. **Make it more explicit** - Add specific examples
2. **Reduce ambiguity** - Use clear language like "always" or "never"
3. **Add context** - Explain when the rule applies
4. **Test edge cases** - Consider unusual scenarios

## Advanced Usage

### Testing Multiple Files

Create a script to test multiple AGENTS.md files:

```bash
#!/bin/bash
for file in **/AGENTS.md; do
  echo "Testing $file..."
  python run_verifier.py "$file"
done
```

### CI/CD Integration

Use in GitHub Actions:

```yaml
name: Test Agent Rules
on: [push, pull_request]

jobs:
  test-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          cd rule-verifier
          pip install -r requirements.txt
      - name: Test rules
        run: |
          cd rule-verifier
          python run_verifier.py ../AGENTS.md --format json markdown
      - name: Upload reports
        uses: actions/upload-artifact@v2
        with:
          name: rule-reports
          path: rule-verifier/results/
```

### Custom Scenarios

You can extend the scenario generator in `src/scenario_generator.py` to create custom test scenarios for your specific needs.

## Project Structure

```
rule-verifier/
├── src/
│   ├── parser.py              # Parse AGENTS.md/CLAUDE.md files
│   ├── rule_extractor.py      # Extract and classify rules
│   ├── scenario_generator.py  # Generate test scenarios
│   ├── session_manager.py     # Manage tmux sessions
│   ├── test_runner.py         # Execute tests via Claude CLI
│   ├── validator.py           # Validate responses
│   └── reporter.py            # Generate reports
├── examples/
│   ├── example_AGENTS.md      # Example AGENTS.md file
│   └── example_CLAUDE.md      # Example CLAUDE.md file
├── results/                   # Generated reports (gitignored)
├── scenarios/                 # Generated scenarios (gitignored)
├── config.yaml                # Configuration file
├── requirements.txt           # Python dependencies
├── run_verifier.py            # Main entry point
└── README.md                  # This file
```

## Troubleshooting

### Claude CLI not found

Make sure Claude CLI is installed and in your PATH:
```bash
which claude
```

If not found, install it or specify the path in `config.yaml`:
```yaml
claude:
  cli_path: "/path/to/claude"
```

### tmux session errors

Check if tmux is running:
```bash
tmux ls
```

Clean up stale sessions:
```bash
tmux kill-server
```

Or run without isolation:
```bash
python run_verifier.py examples/example_AGENTS.md --no-isolation
```

### Import errors

Make sure all dependencies are installed:
```bash
pip install -r requirements.txt
```

### Slow execution

- Use `--no-isolation` for faster testing (but less accurate)
- Reduce iterations: `--iterations 3`
- Test only high-priority rules: `--priority high critical`

## Contributing

This tool is designed to be extensible. Key areas for contribution:

1. **Rule Classifiers** - Add more sophisticated rule detection in `rule_extractor.py`
2. **Scenario Generators** - Improve scenario generation in `scenario_generator.py`
3. **Validators** - Add more validation methods in `validator.py`
4. **Reporters** - Create new report formats in `reporter.py`

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ to help improve AI agent instructions**
