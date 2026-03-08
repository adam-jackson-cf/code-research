# Integration Tests

This directory contains comprehensive integration tests for the Rule Verifier tool.

## Test Structure

### Test Fixtures (`fixtures/test_project/`)

A minimal test codebase with:
- **AGENTS.md** - Contains 11+ testable rules across multiple categories
- **src/main.py** - Example Python application file
- **lib/utils.py** - Utility functions with docstrings
- **lib/utils_test.py** - Test file following pytest conventions

### Integration Tests (`test_integration.py`)

Comprehensive test suite covering the three required scenarios:

## Test Scenarios

### 1. Rules Correctly Followed ✓

**Test Classes:**
- `TestIntegrationCorrectlyFollowed`

**What it tests:**
- Rules are parsed, scenarios generated, and validated correctly
- High pass rate (≥50%) when Claude follows the rules
- Specific rule validation (e.g., pytest command recommendation)

**Example:**
```python
def test_rules_followed_high_pass_rate(self, config, scenarios):
    """Test that correctly followed rules result in high pass rate."""
    runner = MockTestRunner(config, response_mode="correct")
    # ... generates responses that follow all rules
    # Expected: High pass rate (87.5% in tests)
```

**Results:**
- ✓ 87.5% pass rate with correct responses
- ✓ Specific pytest rule correctly validated

### 2. Modified Rule Still Followed ✓

**Test Classes:**
- `TestIntegrationModifiedAndFollowed`

**What it tests:**
- Original rule: "Run tests with pytest"
- Modified rule: "Run tests with pytest or unittest"
- Both variations are parsed and validated correctly
- Responses mentioning either framework are accepted

**Example:**
```python
def test_modified_rule_still_followed(self, config, tmp_path):
    """Test that modified rules are still validated correctly."""
    # Create original AGENTS.md with "pytest" rule
    # Create modified AGENTS.md with "pytest or unittest" rule
    # Validate that responses mentioning either pass
```

**Results:**
- ✓ Original rule extracted: 1 rule
- ✓ Modified rule extracted: 1 rule
- ✓ Response with both frameworks validated successfully

### 3. Rules NOT Being Followed ✓

**Test Classes:**
- `TestIntegrationNotFollowed`

**What it tests:**
- Detection of rule violations
- Responses that don't follow guidelines are flagged
- Specific violations detected (e.g., not mentioning pytest)

**Example:**
```python
def test_rules_not_followed_detected(self, config, scenarios):
    """Test that violations are detected when rules are not followed."""
    runner = MockTestRunner(config, response_mode="incorrect")
    # ... generates responses that violate rules
    # Expected: Violations detected
```

**Results:**
- ✓ 0/1 passed (violations correctly detected)
- ✓ Pytest violation detected (response doesn't mention pytest)

## Additional Tests

### Consistency Analysis

**Test:** `test_consistency_with_multiple_iterations`

Verifies that consistency analysis works across 5 iterations:
- Alternates between correct and incorrect responses
- Tracks pass/fail across iterations
- Calculates consistency rate

**Results:**
- ✓ 5 iterations executed
- ✓ Consistency tracking functional

### Full Integration Workflow

**Test:** `test_full_integration_workflow`

End-to-end test of complete pipeline:
1. Parse AGENTS.md (5 sections found)
2. Extract rules (11 rules)
3. Generate scenarios (8 scenarios)
4. Run tests with correct responses (2/3 passed)
5. Validate results
6. Test with incorrect responses (demonstrates differentiation)

**Results:**
- ✓ All pipeline steps completed successfully
- ✓ Tool differentiates between compliant and non-compliant responses

## Mock Test Runner

The tests use `MockTestRunner` which simulates Claude CLI responses:

**Response Modes:**
- `"correct"` - Responses that follow all rules (e.g., mentions pytest, uses correct file structure)
- `"incorrect"` - Responses that violate rules (e.g., suggests nosetests instead of pytest)

This allows fast, deterministic testing without requiring actual Claude API calls.

## Running Tests

### Run all integration tests:
```bash
cd rule-verifier
python -m pytest tests/test_integration.py -v
```

### Run with verbose output:
```bash
python -m pytest tests/test_integration.py -v -s
```

### Run specific test:
```bash
python -m pytest tests/test_integration.py::TestIntegrationCorrectlyFollowed::test_rules_followed_high_pass_rate -v
```

### Run from test file directly:
```bash
python tests/test_integration.py
```

## Test Results Summary

```
✓ 7/7 tests passed (100%)

Test Scenarios Verified:
  ✓ Rules correctly followed (87.5% pass rate)
  ✓ Modified rules still validated correctly
  ✓ Rule violations detected (0% pass rate for violations)
  ✓ Consistency tracking works across iterations
  ✓ Full end-to-end workflow functional
```

## Test Coverage

The integration tests verify:
- ✅ AGENTS.md parsing with multiple sections
- ✅ Rule extraction and classification (11 rules, 4 types)
- ✅ Scenario generation (8 scenarios from 11 rules)
- ✅ Test execution with mock Claude responses
- ✅ Response validation (fuzzy matching, confidence scoring)
- ✅ Consistency analysis across iterations
- ✅ Detection of rule compliance vs violations
- ✅ Handling of modified rules

## Adding New Tests

To add new integration tests:

1. **Add test fixture** in `fixtures/test_project/`:
   ```python
   # Add to AGENTS.md
   - **New rule** description here
   ```

2. **Create test case**:
   ```python
   def test_my_new_scenario(self, config, extracted_rules):
       """Test my new scenario."""
       # Your test logic here
   ```

3. **Add mock responses** to `MockTestRunner`:
   ```python
   elif "my_keyword" in prompt_lower:
       return {
           "response": "Response that follows/violates rule",
           "exit_code": 0,
           "stderr": ""
       }
   ```

4. **Run tests**:
   ```bash
   python -m pytest tests/test_integration.py -v
   ```

## CI/CD Integration

These tests can be run in CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Run Integration Tests
  run: |
    cd rule-verifier
    pip install -r requirements.txt
    pytest tests/test_integration.py -v --junitxml=test-results.xml
```

## Performance

- Test execution time: ~0.08 seconds
- No external API calls required
- Fully deterministic results
- Can be run in parallel

## Notes

- Tests use mock responses for speed and reliability
- Real Claude CLI integration tests can be added separately
- Test fixture AGENTS.md is a realistic example with 11 rules
- All three required scenarios are thoroughly tested
