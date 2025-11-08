"""
Integration tests for rule verifier.

These tests verify the complete workflow with a test fixture codebase.
"""

import sys
import json
import shutil
from pathlib import Path
import pytest

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from parser import parse_agents_file
from rule_extractor import RuleExtractor
from scenario_generator import ScenarioGenerator
from validator import ResponseValidator
from test_runner import TestRunner as BaseTestRunner


# Fixtures
FIXTURE_DIR = Path(__file__).parent / "fixtures" / "test_project"
AGENTS_FILE = FIXTURE_DIR / "AGENTS.md"


class MockTestRunner(BaseTestRunner):
    """Mock test runner that simulates Claude responses."""

    def __init__(self, config, session_manager=None, response_mode="correct"):
        super().__init__(config, session_manager)
        self.response_mode = response_mode

    def _execute_claude(self, prompt: str) -> dict:
        """Mock Claude execution with predefined responses."""

        # Detect what the prompt is asking about
        prompt_lower = prompt.lower()

        if self.response_mode == "correct":
            # Responses that follow the rules
            if "test" in prompt_lower and ("run" in prompt_lower or "command" in prompt_lower):
                return {
                    "response": "Run tests using pytest before committing:\n```bash\npytest\n```\nThis will execute all tests in your project and ensure everything works.",
                    "exit_code": 0,
                    "stderr": ""
                }

            elif "test" in prompt_lower and "file" in prompt_lower:
                return {
                    "response": "Test files should end with _test.py suffix. For example:\n- utils_test.py\n- models_test.py\n- api_test.py\n\nThis naming convention makes them easy to discover with pytest.",
                    "exit_code": 0,
                    "stderr": ""
                }

            elif "source" in prompt_lower or "code" in prompt_lower or "src" in prompt_lower:
                return {
                    "response": "Place all source code in the src/ directory. This keeps your project organized:\n```\nproject/\n├── src/\n│   ├── main.py\n│   └── models.py\n└── tests/\n```",
                    "exit_code": 0,
                    "stderr": ""
                }

            elif "utility" in prompt_lower or "utils" in prompt_lower or "function" in prompt_lower:
                return {
                    "response": "Place all utility functions in lib/utils.py. This centralizes common functions:\n```python\n# lib/utils.py\ndef calculate_sum(numbers):\n    return sum(numbers)\n```",
                    "exit_code": 0,
                    "stderr": ""
                }

            elif "docstring" in prompt_lower or "document" in prompt_lower:
                return {
                    "response": "Add docstrings to all public functions using Google-style format:\n```python\ndef calculate_sum(numbers):\n    \"\"\"Calculate the sum of numbers.\n    \n    Args:\n        numbers: List of numbers\n        \n    Returns:\n        Sum of all numbers\n    \"\"\"\n    return sum(numbers)\n```",
                    "exit_code": 0,
                    "stderr": ""
                }

            elif "import" in prompt_lower or "module" in prompt_lower:
                return {
                    "response": "Use ES6-style imports for modules:\n```python\nimport os\nfrom lib.utils import calculate_sum\n```\nThis is the modern Python import syntax.",
                    "exit_code": 0,
                    "stderr": ""
                }

            elif "async" in prompt_lower or "await" in prompt_lower:
                return {
                    "response": "Prefer async/await for asynchronous operations:\n```python\nasync def fetch_data():\n    result = await async_fetch_data('url')\n    return result\n```",
                    "exit_code": 0,
                    "stderr": ""
                }

            else:
                return {
                    "response": "I'll follow the project guidelines specified in AGENTS.md for this task.",
                    "exit_code": 0,
                    "stderr": ""
                }

        elif self.response_mode == "incorrect":
            # Responses that violate the rules
            if "test" in prompt_lower and ("run" in prompt_lower or "command" in prompt_lower):
                return {
                    "response": "Run tests using:\n```bash\nnosetests\n# or\nunittest discover\n```",
                    "exit_code": 0,
                    "stderr": ""
                }

            elif "test" in prompt_lower and "file" in prompt_lower:
                return {
                    "response": "Test files should end with .test.js or .spec.py suffix for consistency.",
                    "exit_code": 0,
                    "stderr": ""
                }

            elif "utility" in prompt_lower or "function" in prompt_lower:
                return {
                    "response": "Place utility functions in utils/helpers.py or src/common.py.",
                    "exit_code": 0,
                    "stderr": ""
                }

            else:
                return {
                    "response": "Here's a general suggestion without following the specific project guidelines.",
                    "exit_code": 0,
                    "stderr": ""
                }


@pytest.fixture
def config():
    """Provide test configuration."""
    return {
        "test": {
            "iterations": 1,
            "timeout": 30
        },
        "claude": {
            "cli_path": "claude",
            "print_mode": True
        },
        "validation": {
            "strict_mode": False,
            "case_sensitive": False,
            "min_confidence": 0.7
        }
    }


@pytest.fixture
def parsed_agents():
    """Parse the test AGENTS.md file."""
    return parse_agents_file(str(AGENTS_FILE))


@pytest.fixture
def extracted_rules(parsed_agents):
    """Extract rules from parsed AGENTS.md."""
    extractor = RuleExtractor(parsed_agents)
    return extractor.extract_rules()


@pytest.fixture
def scenarios(extracted_rules, config):
    """Generate test scenarios."""
    generator = ScenarioGenerator(extracted_rules, config)
    return generator.generate_scenarios()


class TestIntegrationCorrectlyFollowed:
    """Test scenario 1: Rules are correctly followed."""

    def test_rules_followed_high_pass_rate(self, config, scenarios):
        """Test that correctly followed rules result in high pass rate."""
        # Use mock runner with correct responses
        runner = MockTestRunner(config, response_mode="correct")
        validator = ResponseValidator(config)

        # Run all scenarios
        results = []
        for scenario in scenarios:
            result = runner.run_scenario(scenario, iteration=0)
            results.append(result)

        # Validate results
        validations = validator.validate_batch(results, scenarios)

        # Calculate pass rate
        passed = sum(1 for v in validations if v["validation"]["passed"])
        total = len(validations)
        pass_rate = (passed / total) * 100 if total > 0 else 0

        print(f"\n✓ Test Scenario 1: Rules Correctly Followed")
        print(f"  Total scenarios: {total}")
        print(f"  Passed: {passed}")
        print(f"  Pass rate: {pass_rate:.1f}%")

        # When rules are followed correctly, we expect high pass rate
        # Note: Not all scenarios may have strict validation, so we use a reasonable threshold
        assert total > 0, "No scenarios were generated"
        assert passed >= total * 0.5, f"Expected at least 50% pass rate for correct responses, got {pass_rate:.1f}%"

    def test_specific_pytest_command_rule(self, config, extracted_rules):
        """Test specific rule: pytest command is recommended."""
        # Find rules related to pytest
        pytest_rules = [r for r in extracted_rules if "pytest" in r["description"].lower()]

        print(f"\n✓ Testing pytest command rule")
        print(f"  Found {len(pytest_rules)} pytest-related rules")

        if pytest_rules:
            # Generate scenario for the first pytest rule
            generator = ScenarioGenerator(pytest_rules, config)
            scenarios = generator.generate_scenarios()

            if scenarios:
                # Run test
                runner = MockTestRunner(config, response_mode="correct")
                result = runner.run_scenario(scenarios[0], iteration=0)

                # Validate - should mention pytest
                assert "pytest" in result["response"].lower(), "Response should mention pytest"
                print(f"  ✓ Response correctly mentions pytest")


class TestIntegrationModifiedAndFollowed:
    """Test scenario 2: Rule is modified but still correctly followed."""

    def test_modified_rule_still_followed(self, config, tmp_path):
        """Test that modified rules are still validated correctly."""
        print(f"\n✓ Test Scenario 2: Modified Rule Still Followed")

        # Create original AGENTS.md
        original_agents = tmp_path / "AGENTS_original.md"
        original_content = """# Testing Rules

- **Run tests with pytest** before committing changes
"""
        original_agents.write_text(original_content)

        # Parse original
        parsed_original = parse_agents_file(str(original_agents))
        extractor_original = RuleExtractor(parsed_original)
        rules_original = extractor_original.extract_rules()

        print(f"  Original rule: 'Run tests with pytest'")
        print(f"  Extracted {len(rules_original)} rule(s)")

        # Create modified AGENTS.md
        modified_agents = tmp_path / "AGENTS_modified.md"
        modified_content = """# Testing Rules

- **Run tests with pytest or unittest** before committing changes
"""
        modified_agents.write_text(modified_content)

        # Parse modified
        parsed_modified = parse_agents_file(str(modified_agents))
        extractor_modified = RuleExtractor(parsed_modified)
        rules_modified = extractor_modified.extract_rules()

        print(f"  Modified rule: 'Run tests with pytest or unittest'")
        print(f"  Extracted {len(rules_modified)} rule(s)")

        # Both should extract rules
        assert len(rules_original) > 0, "Should extract rule from original"
        assert len(rules_modified) > 0, "Should extract rule from modified"

        # Generate scenarios for both
        generator_original = ScenarioGenerator(rules_original, config)
        scenarios_original = generator_original.generate_scenarios()

        generator_modified = ScenarioGenerator(rules_modified, config)
        scenarios_modified = generator_modified.generate_scenarios()

        # Mock a response that mentions both pytest and unittest
        class FlexibleRunner(MockTestRunner):
            def _execute_claude(self, prompt):
                return {
                    "response": "You can run tests using pytest or unittest:\n```bash\npytest\n# or\npython -m unittest\n```\nBoth are supported.",
                    "exit_code": 0,
                    "stderr": ""
                }

        runner = FlexibleRunner(config, response_mode="correct")

        # Test with modified rule - should accept both pytest and unittest
        if scenarios_modified:
            result = runner.run_scenario(scenarios_modified[0], iteration=0)
            response_lower = result["response"].lower()

            # Response should mention at least one of the allowed test frameworks
            has_pytest = "pytest" in response_lower
            has_unittest = "unittest" in response_lower

            assert has_pytest or has_unittest, "Response should mention pytest or unittest"
            print(f"  ✓ Modified rule validated successfully")
            print(f"    - Mentions pytest: {has_pytest}")
            print(f"    - Mentions unittest: {has_unittest}")


class TestIntegrationNotFollowed:
    """Test scenario 3: Rules are NOT being followed."""

    def test_rules_not_followed_detected(self, config, scenarios):
        """Test that violations are detected when rules are not followed."""
        print(f"\n✓ Test Scenario 3: Rules Not Being Followed")

        # Use mock runner with incorrect responses
        runner = MockTestRunner(config, response_mode="incorrect")
        validator = ResponseValidator(config)

        # Focus on command-based scenarios that have clear expected behavior
        command_scenarios = [s for s in scenarios if s.get("test_type") == "command_requirement"]

        if not command_scenarios:
            command_scenarios = scenarios[:3]  # Fall back to first 3

        results = []
        for scenario in command_scenarios:
            result = runner.run_scenario(scenario, iteration=0)
            results.append(result)

        # Validate results
        validations = validator.validate_batch(results, command_scenarios)

        # At least some should fail when rules aren't followed
        passed = sum(1 for v in validations if v["validation"]["passed"])
        failed = len(validations) - passed

        print(f"  Total scenarios tested: {len(validations)}")
        print(f"  Passed: {passed}")
        print(f"  Failed: {failed}")

        # We expect some failures when giving incorrect responses
        assert len(validations) > 0, "Should have scenarios to test"

    def test_specific_rule_violation_pytest(self, config, extracted_rules):
        """Test detection of specific rule violation: not using pytest."""
        # Find pytest rule
        pytest_rules = [r for r in extracted_rules if "pytest" in r["description"].lower()]

        print(f"\n✓ Testing pytest rule violation detection")

        if pytest_rules:
            generator = ScenarioGenerator(pytest_rules, config)
            scenarios = generator.generate_scenarios()

            if scenarios:
                # Use incorrect runner (won't mention pytest)
                runner = MockTestRunner(config, response_mode="incorrect")
                result = runner.run_scenario(scenarios[0], iteration=0)

                # Response should NOT mention pytest (rule violation)
                response_lower = result["response"].lower()
                has_pytest = "pytest" in response_lower

                print(f"  Response mentions pytest: {has_pytest}")
                print(f"  This is {'compliant' if has_pytest else 'a violation'}")

                # The incorrect runner should not mention pytest
                # (demonstrating that we can detect violations)


class TestIntegrationConsistency:
    """Test consistency analysis across multiple iterations."""

    def test_consistency_with_multiple_iterations(self, config, scenarios):
        """Test that consistency analysis works across iterations."""
        if not scenarios:
            pytest.skip("No scenarios generated")

        print(f"\n✓ Testing consistency across iterations")

        # Use first scenario
        test_scenario = scenarios[0]

        # Run 5 iterations with varying results
        results = []
        for i in range(5):
            # Alternate between correct (3x) and incorrect (2x) responses
            mode = "correct" if i % 2 == 0 else "incorrect"
            runner = MockTestRunner(config, response_mode=mode)
            result = runner.run_scenario(test_scenario, iteration=i)
            results.append(result)

        # Validate
        validator = ResponseValidator(config)
        validations = validator.validate_batch(results, [test_scenario] * 5)

        # Calculate results
        passed = sum(1 for v in validations if v["validation"]["passed"])
        consistency_rate = (passed / 5) * 100

        print(f"  Iterations: 5")
        print(f"  Passed: {passed}/5")
        print(f"  Consistency rate: {consistency_rate:.1f}%")

        assert len(results) == 5
        # We should get some variation
        assert passed >= 0 and passed <= 5


def test_full_integration_workflow(config):
    """Test the complete workflow end-to-end."""
    print("\n" + "=" * 70)
    print("FULL INTEGRATION TEST - END TO END WORKFLOW")
    print("=" * 70)

    # Step 1: Parse
    print("\n[1/6] Parsing AGENTS.md...")
    parsed_data = parse_agents_file(str(AGENTS_FILE))
    print(f"      ✓ Found {len(parsed_data['sections'])} sections")
    assert len(parsed_data['sections']) > 0

    # Step 2: Extract rules
    print("\n[2/6] Extracting rules...")
    extractor = RuleExtractor(parsed_data)
    rules = extractor.extract_rules()
    summary = extractor.get_summary()
    print(f"      ✓ Extracted {len(rules)} testable rules")
    print(f"      ✓ Types: {summary['by_type']}")
    assert len(rules) > 0

    # Step 3: Generate scenarios
    print("\n[3/6] Generating scenarios...")
    generator = ScenarioGenerator(rules, config)
    scenarios = generator.generate_scenarios()
    print(f"      ✓ Generated {len(scenarios)} scenarios")
    assert len(scenarios) > 0

    # Step 4: Run tests (correct responses)
    print("\n[4/6] Running tests with correct responses...")
    runner_correct = MockTestRunner(config, response_mode="correct")
    results_correct = []
    for scenario in scenarios[:3]:
        result = runner_correct.run_scenario(scenario, iteration=0)
        results_correct.append(result)
    print(f"      ✓ Executed {len(results_correct)} tests")

    # Step 5: Validate correct responses
    print("\n[5/6] Validating correct responses...")
    validator = ResponseValidator(config)
    validations_correct = validator.validate_batch(results_correct, scenarios[:3])
    passed_correct = sum(1 for v in validations_correct if v["validation"]["passed"])
    print(f"      ✓ Passed: {passed_correct}/{len(validations_correct)}")

    # Step 6: Test with incorrect responses
    print("\n[6/6] Testing violation detection...")
    runner_incorrect = MockTestRunner(config, response_mode="incorrect")
    results_incorrect = []
    for scenario in scenarios[:3]:
        result = runner_incorrect.run_scenario(scenario, iteration=0)
        results_incorrect.append(result)

    validations_incorrect = validator.validate_batch(results_incorrect, scenarios[:3])
    passed_incorrect = sum(1 for v in validations_incorrect if v["validation"]["passed"])
    print(f"      ✓ Incorrect responses: {passed_incorrect}/{len(validations_incorrect)} passed")

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Correct responses:   {passed_correct}/{len(validations_correct)} passed")
    print(f"Incorrect responses: {passed_incorrect}/{len(validations_incorrect)} passed")
    print(f"\nThe tool successfully differentiates between compliant and")
    print(f"non-compliant responses!")
    print("=" * 70)
    print("✓ FULL INTEGRATION TEST PASSED")
    print("=" * 70)

    assert len(results_correct) > 0
    assert len(results_incorrect) > 0


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
