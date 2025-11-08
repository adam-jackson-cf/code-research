# Integration Tests

This directory contains comprehensive integration tests for the smoke-test-oracle project.

## Test Files

### 1. storage-integration.test.ts (520 lines, 18 tests)
Tests the complete storage workflow with real temp directories:
- **DOM Storage Workflow**: Store/retrieve HTML, query by selector, get statistics
- **Screenshot Storage Workflow**: Store/retrieve screenshots, generate thumbnails, compare screenshots, detect visual differences
- **Console Log Storage Workflow**: Store/retrieve console logs, filter by level, get summaries
- **Checkpoint Storage Workflow**: Create/retrieve complete checkpoints, query by filters
- **Cross-Store Integration**: Maintain referential integrity, handle partial checkpoint data
- **Storage Management**: Get statistics, export/import data, clear storage

### 2. checkpoint-flow.test.ts (609 lines, 19 tests)
Tests the complete checkpoint workflow:
- **Checkpoint Creation Flow**: Create complete checkpoints with all artifacts, minimal checkpoints, direct state storage
- **Checkpoint Retrieval and Querying**: Retrieve by name, query by URL/tags/time range/artifact presence, limit results
- **Checkpoint Comparison**: Compare checkpoints, detect identical checkpoints
- **Checkpoint Updates and Cloning**: Update metadata, clone checkpoints
- **Checkpoint History**: Track history for URLs, limit history results
- **Checkpoint Deletion**: Delete checkpoints, handle all artifact types
- **Complex Workflows**: Multi-page test flows, state change tracking

### 3. visual-diff.test.ts (652 lines, 18 tests)
Tests visual diff with real images:
- **Screenshot Creation**: Solid colors, patterns with gradients
- **Identical Image Comparison**: Detect identical screenshots, handle re-encoded images
- **Color Difference Detection**: Detect color differences, subtle differences
- **Partial Differences**: Differences in specific regions, text differences
- **Screenshot Transformations**: Resize, format conversion, aspect ratio preservation
- **Thumbnail Generation**: Auto-generation, quality preservation
- **Complex Visual Diff Scenarios**: Progressive changes, different content layouts, comparison thresholds
- **Screenshot Querying**: Query by dimensions, by URL

### 4. test-builder.test.ts (668 lines, 19 tests)
Tests the fluent API integration:
- **Fluent API Test Creation**: Basic configuration, chained methods
- **Test Steps Creation**: Navigation, interactions, wait conditions
- **Checkpoint Creation**: Basic checkpoints, checkpoints with validations, multiple checkpoints
- **Complete Test Flows**: Login flow, search flow, e-commerce checkout
- **Before/After Hooks**: beforeAll, afterAll, both hooks
- **Test Definition Conversion**: Convert to definition and back, preserve step details
- **Complex Test Scenarios**: Multi-page forms, data-driven tests, responsive design tests

## Running Tests

Run all integration tests:
```bash
npm test -- tests/integration/
```

Run a specific test file:
```bash
npm test -- tests/integration/storage-integration.test.ts
npm test -- tests/integration/checkpoint-flow.test.ts
npm test -- tests/integration/visual-diff.test.ts
npm test -- tests/integration/test-builder.test.ts
```

## Key Features

- **Real Storage**: All tests use real temp directories, not mocks
- **Complete Workflows**: Tests verify end-to-end functionality
- **Module Integration**: Tests verify data flows correctly between modules
- **Proper Cleanup**: Uses beforeEach/afterEach for setup/teardown
- **Real Images**: Visual diff tests use actual image creation and comparison
- **Comprehensive Coverage**: 74 tests covering all major integration points

## Test Data

Tests use temporary directories created in `/tmp` with unique timestamps to avoid conflicts:
- Storage tests: `tmp/test-storage-{timestamp}`
- Checkpoint tests: `tmp/test-checkpoint-{timestamp}`
- Visual diff tests: `tmp/test-visual-{timestamp}`
- Test builder tests: `tmp/test-builder-{timestamp}`

All temporary directories are cleaned up automatically after each test.
