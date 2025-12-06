# Test Commands for Duplicate Detection

This directory contains permanent test fixtures for the continuous improvement system's duplicate detection capabilities. Below are the correct commands for testing.

## Prerequisites

- Run from the **project root directory** (`/Users/adamjackson/LocalDev/ai-assisted-workflows`)
- Ensure `TESTING=true` environment variable is set
- Use `PYTHONPATH=.` to ensure correct imports
- **Important**: All modules use `shared.` prefix imports for consistency

## Test Commands

### 1. Run Duplicate Detection on Test Fixtures

```bash
# From project root - test our duplicate detector fixtures
TESTING=true PYTHONPATH=. python shared/ci/integration/orchestration_bridge.py \
  --project-root test_codebase/duplicate_detectors \
  --config-path shared/tests/integration/ci_config_test.json
```

This should detect duplications between:

- `language_detector.py` and `tech_stack_detector.py` (our permanent test fixtures)

### 2. Run Full E2E Integration Test

```bash
# From project root - runs complete test suite
TESTING=true PYTHONPATH=. python shared/tests/integration/test_continuous_improvement_e2e.py
```

This runs all integration tests including:

- Duplicate detection integration
- Decision matrix evaluation
- Orchestration bridge workflows
- GitHub issue creation simulation
- Performance and error handling

### 3. Test with Different Similarity Thresholds

To test detection sensitivity, edit the similarity threshold in `shared/tests/integration/ci_config_test.json`:

```json
{
  "project": {
    "analysis": {
      "similarity_threshold": 0.65, // Change this value
      "medium_similarity_threshold": 0.65,
      "low_similarity_threshold": 0.45
    }
  }
}
```

Then run:

```bash
TESTING=true PYTHONPATH=. python shared/ci/integration/orchestration_bridge.py \
  --project-root test_codebase/duplicate_detectors \
  --config-path shared/tests/integration/ci_config_test.json
```

**Recommended thresholds for testing:**

- `0.85` - High precision (fewer, more exact duplicates)
- `0.65` - Medium precision (our current test threshold)
- `0.45` - Low precision (more potential duplicates detected)

### 4. Test New Indexing Flag System

```bash
# Test ChromaDB indexing status check
PYTHONPATH=. python shared/ci/core/chromadb_storage.py \
  --project-root test_codebase/duplicate_detectors \
  --check-indexing

# Test full scan functionality
PYTHONPATH=. python shared/ci/core/chromadb_storage.py \
  --project-root test_codebase/duplicate_detectors \
  --full-scan

# Verify indexing completed
PYTHONPATH=. python shared/ci/core/chromadb_storage.py \
  --project-root test_codebase/duplicate_detectors \
  --check-indexing
```

### 5. Quick Validation Test

```bash
# Simple test to verify system is working
TESTING=true PYTHONPATH=. python -c "
from shared.ci.integration.orchestration_bridge import OrchestrationBridge
bridge = OrchestrationBridge('test_codebase/duplicate_detectors', test_mode=True, config_path='shared/tests/integration/ci_config_test.json')
print('✅ OrchestrationBridge initialized successfully')
"
```

## Configuration Details

### Test CI Config (`shared/tests/integration/ci_config_test.json`)

- **Unified config** (no separate registry_config.json since commit ff540f8)
- Excludes main project directories, focuses only on `test_codebase/duplicate_detectors`
- Medium similarity threshold (0.65) for reliable duplicate detection
- Full analysis mode for comprehensive testing
- **Used directly via --config-path parameter** (no copying required)

### Directory Structure

```
test_codebase/duplicate_detectors/
├── language_detector.py          # Test fixture 1
├── tech_stack_detector.py        # Test fixture 2
├── README.md                     # Documentation
├── TEST_COMMANDS.md              # This file
└── .ci-registry/                  # Created dynamically for caching
    └── (cache files, reports)    # No config files here!

# Config is at:
shared/tests/integration/ci_config_test.json  # ← Used directly
```

## Troubleshooting

### Common Issues

1. **"No module named 'shared'"**
   - Solution: Run from project root with `PYTHONPATH=.`
   - All modules consistently use `shared.` prefix imports

2. **"Registry initialization failed"** or **"Symbol not available"**
   - Solution: Ensure the config path is correct and PYTHONPATH is set
   - No need to copy config - it's passed directly via `--config-path`

3. **"ChromaDB not available"**
   - Solution: Install required dependencies:

   ```bash
   pip install transformers torch chromadb
   ```

   - Note: ChromaDB replaced faiss-cpu in the latest implementation

4. **"Failed to initialize go/csharp language server"** (warnings, not errors)
   - These are informational warnings for optional language support
   - **Go language support**: Install Go runtime and gopls

   ```bash
   brew install go
   go install golang.org/x/tools/gopls@latest
   ```

   - **C# language support**: Install .NET or Mono runtime

   ```bash
   brew install --cask dotnet  # or: brew install mono
   ```

   - **Impact**: Without these, Go/C# files won't be analyzed (Python/JS/TS still work perfectly)

5. **Path confusion**
   - Always run from `/Users/adamjackson/LocalDev/ai-assisted-workflows` (project root)
   - Use relative paths in commands as shown above
   - **Critical**: All imports use `shared.` prefix for consistency

### Debug Commands

```bash
# Check if test config exists
ls -la shared/tests/integration/ci_config_test.json

# Verify test fixtures exist
ls -la test_codebase/duplicate_detectors/

# Check PYTHONPATH
python -c "import sys; print('\\n'.join(sys.path))"
```

## Expected Results

When running duplicate detection on our test fixtures, you should see:

- Multiple duplicate findings detected (language detection functionality overlap)
- Automatic fix recommendations for high-similarity cases
- Analysis report saved to `.ci-registry/reports/latest-analysis.json`
- Summary showing processed findings

This validates that our continuous improvement system can detect real-world code duplication patterns.
