# Linear Integration Testing

Guide to running the `/plan-linear` integration tests locally. These tests exercise the full workflow using real Linear MCP tools and create/archives actual Linear issues.

## Prerequisites

### Environment Variables

Set the following environment variables before running tests:

```bash
export LINEAR_API_KEY="your_linear_api_key"
export LINEAR_TEAM_ID="your_team_id_or_key"
export LINEAR_TEST_PROJECT="existing_project_name_or_id"
```

- `LINEAR_API_KEY`: Your Linear personal API token
- `LINEAR_TEAM_ID`: The Linear team ID/key where the test project exists
- `LINEAR_TEST_PROJECT`: Name or ID of an existing Linear project to use for testing

### Test Project

The tests require an existing Linear project (specified by `LINEAR_TEST_PROJECT`). The project can be empty; tests will create and archive issues within it.

### OpenCode Installation

Ensure `opencode` CLI is installed and available in PATH:

```bash
# Verify installation
opencode --help
```

## Running Tests

### Run All Plan-Linear Integration Tests

```bash
# From project root
PYTHONPATH=shared pytest shared/tests/integration/test_integration_plan_linear.py -v
```

### Run Individual Test Cases

```bash
# Dry-run structure test
PYTHONPATH=shared pytest shared/tests/integration/test_integration_plan_linear.py::test_plan_linear_dry_run_structure -v

# Mutation test (creates issues)
PYTHONPATH=shared pytest shared/tests/integration/test_integration_plan_linear.py::test_plan_linear_mutation_creates_issues_and_preserves_hashes -v

# Idempotency test
PYTHONPATH=shared pytest shared/tests/integration/test_integration_plan_linear.py::test_plan_linear_idempotency_skips_existing_issues -v

# Diff mode test
PYTHONPATH=shared pytest shared/tests/integration/test_integration_plan_linear.py::test_plan_linear_diff_mode_detects_changes -v
```

## Test Behavior

### Fixtures

Tests use deterministic planning artifacts located in:

- `shared/tests/integration/fixtures/plan_linear/baseline.md`
- `shared/tests/integration/fixtures/plan_linear/variant.md`

These fixtures reference Juice Shop security hardening scenarios to ensure realistic, structured input.

### Test Modes

#### Dry-Run Test

- Validates `PlanLinearReport` schema and invariants
- Ensures `readiness.ready == true`
- Verifies hash fields are present and properly formatted
- Confirms no `mutation` section exists

#### Mutation Test

- Creates actual Linear issues in the test project
- Verifies `mutation.created_issue_ids` is populated
- Ensures plan hash remains unchanged from dry-run
- Archives created issues after test completion

#### Idempotency Test

- Runs mutation twice with same artifact
- Second run should skip existing issues (`skipped_issue_ids`)
- No new issues created on second run
- Plan hash remains stable

#### Diff Mode Test

- Compares baseline vs variant artifacts
- Detects added/removed/changed issues
- Verifies plan hash changes between versions
- Validates diff structure and content

### Cleanup

Tests automatically archive created issues after successful completion using the `archive_linear_issues()` helper. Currently, this is a placeholder that logs intent; when Linear MCP archive commands are available, it will perform actual archiving.

### Error Handling

- Missing environment variables → tests are skipped with descriptive message
- Linear API errors → tests fail with detailed output
- JSON parsing errors → tests fail with stdout/stderr context

## Debugging

### Enable Verbose Output

```bash
PYTHONPATH=shared pytest shared/tests/integration/test_integration_plan_linear.py -v -s
```

### Inspect Generated Reports

Tests capture full command output. To examine the generated `PlanLinearReport`:

```python
# Add temporary debugging in test
import json
print(json.dumps(report, indent=2))
```

### Check Linear Project State

After a failed mutation test, manually check your Linear test project for:

- Created issues (should have `planning:linear` or similar labels)
- Any orphaned issues from previous test runs

### Common Issues

1. **Authentication Errors**: Verify `LINEAR_API_KEY` is valid and has project permissions
2. **Project Not Found**: Ensure `LINEAR_TEST_PROJECT` exists and is accessible
3. **Permission Denied**: Confirm your Linear token has issue creation permissions
4. **Rate Limiting**: Linear API may rate limit; wait and retry if needed

## Contributing

When adding new test cases:

1. Follow the existing pattern of deterministic fixtures
2. Include proper cleanup via `request.addfinalizer`
3. Add environment variable checks for any new required vars
4. Update this documentation with new test descriptions

## Implementation Status

### Test Status

- ✅ `test_plan_linear_dry_run_structure` - Validates dry-run produces PlanLinearReport v2 with readiness=true (requires Linear env)
- ✅ `test_plan_linear_mutation_creates_issues_and_preserves_hashes` - Tests actual Linear issue creation (requires Linear env)
- ✅ `test_plan_linear_idempotency_skips_existing_issues` - Validates hash-based change detection (requires Linear env)
- ✅ `test_plan_linear_diff_mode_detects_changes` - Tests before/after comparison logic (requires Linear env)
- ✅ `test_plan_linear_error_handling_missing_env` - Ensures graceful failure without auth (skipped when opencode commands unavailable)

### Archive Function

- ✅ Implemented `archive_linear_issues()` function with batch GraphQL operations
- ✅ Uses Linear's `issueBatchUpdate` mutation for efficient cleanup
- ✅ Properly handles archived state detection and batch operations
- ✅ Validates with mock testing to ensure correct GraphQL query structure

### Opencode Integration

- ⚠️ Custom opencode commands require proper installation to load
- ✅ Tests gracefully skip when commands are unavailable
- ✅ Error handling prevents hanging tests with timeout mechanisms

To run the full test suite with Linear integration:

```bash
export LINEAR_API_KEY="your_api_key"
export LINEAR_TEAM_ID="your_team_id"
export LINEAR_TEST_PROJECT="your_test_project_id"
PYTHONPATH=shared pytest shared/tests/integration/test_integration_plan_linear.py -v
```

## Notes

- Tests use `--log-level ERROR` to reduce opencode noise
- All tests use `--auto` flag to avoid interactive prompts
- JSON output is parsed robustly from mixed stdout if needed
- Tests are designed to be independent and order-agnostic
