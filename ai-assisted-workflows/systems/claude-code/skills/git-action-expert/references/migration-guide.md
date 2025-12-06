# GitHub Actions Migration Guide

Migration paths for artifact v4, cache v4, and modern GitHub Actions features.

## Artifact v4 Migration

### Deadline: January 30, 2025

Artifact v4 provides up to 10x faster upload/download performance.

### Breaking Changes

1. **No more artifact merging** - Each artifact must have a unique name
2. **Different API** - Must use `actions/download-artifact@v4` to download v4 artifacts
3. **No cross-run downloads** - Use workflow_run trigger or REST API

### Migration Steps

**Before (v3):**

```yaml
- uses: actions/upload-artifact@v3
  with:
    name: build
    path: |
      dist/
      coverage/

- uses: actions/download-artifact@v3
  with:
    name: build
```

**After (v4):**

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: dist
    path: dist/

- uses: actions/upload-artifact@v4
  with:
    name: coverage
    path: coverage/

- uses: actions/download-artifact@v4
  with:
    name: dist

- uses: actions/download-artifact@v4
  with:
    name: coverage
```

### Matrix Builds with Artifacts

**Before (v3) - Automatic merging:**

```yaml
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    steps:
      - uses: actions/upload-artifact@v3
        with:
          name: build
          path: dist/
```

**After (v4) - Unique names required:**

```yaml
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    steps:
      - uses: actions/upload-artifact@v4
        with:
          name: build-${{ matrix.os }}
          path: dist/

  combine:
    needs: build
    steps:
      - uses: actions/download-artifact@v4
        with:
          pattern: build-*
          merge-multiple: true
          path: dist/
```

### Cross-Workflow Artifact Access

**Using workflow_run trigger:**

```yaml
# consumer.yml
on:
  workflow_run:
    workflows: ["Build"]
    types: [completed]

jobs:
  use-artifact:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build
          github-token: ${{ secrets.GITHUB_TOKEN }}
          run-id: ${{ github.event.workflow_run.id }}
```

## Cache v4 Migration

### Deadline: February 1, 2025

### Changes

1. **Requires runner 2.231.0+**
2. **Improved performance** with new cache service v2
3. **Better restoration** with fallback keys

### Migration Example

**Before:**

```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

**After:**

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Cache with setup-node v4

setup-node v4 has built-in caching:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: "npm" # Automatically handles caching
```

## Runner Version Requirements

### Checking Runner Version

```yaml
jobs:
  check-runner:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Runner version: ${{ runner.version }}"
```

### Minimum Versions for Features

| Feature       | Minimum Runner Version |
| ------------- | ---------------------- |
| Artifact v4   | 2.231.0                |
| Cache v4      | 2.231.0                |
| Node.js 22    | 2.308.0                |
| ARM64 runners | 2.285.0                |

### Self-Hosted Runner Updates

```bash
# Check current version
./config.sh --version

# Update runner
./bin/installdependencies.sh
```

## Node.js Version Migration

### Node 20 to Node 22

GitHub-hosted runners support Node.js 22 as of late 2024.

```yaml
# Use Node 22 for actions
- uses: actions/setup-node@v4
  with:
    node-version: 22
```

### Action Node Version Updates

If maintaining custom actions:

```yaml
# action.yml
runs:
  using: "node20" # Update to node20 from node16
```

## Checkout v4 Migration

### Changes from v3

1. **Sparse checkout support**
2. **Improved submodule handling**
3. **Better performance**

### New Features

**Sparse checkout:**

```yaml
- uses: actions/checkout@v4
  with:
    sparse-checkout: |
      src/
      tests/
```

**Submodules:**

```yaml
- uses: actions/checkout@v4
  with:
    submodules: recursive
    fetch-depth: 0
```

## upload-artifact v4 New Features

### Compression Level

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: large-files
    path: data/
    compression-level: 9 # Max compression
```

### Retention Period

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: temp-files
    path: temp/
    retention-days: 1 # Min retention
```

### Overwrite Existing

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: report
    path: report.html
    overwrite: true # Replace existing artifact
```

## Setup Actions Migration

### setup-python with uv

```yaml
# Modern Python setup with uv
- uses: astral-sh/setup-uv@v4
  with:
    enable-cache: true

- run: uv sync
```

### setup-go v5

```yaml
- uses: actions/setup-go@v5
  with:
    go-version: "1.23"
    cache: true
```

### setup-java v4

```yaml
- uses: actions/setup-java@v4
  with:
    distribution: "temurin"
    java-version: "21"
    cache: "gradle"
```

## Workflow Syntax Updates

### Concurrency Improvements

```yaml
# Cancel previous runs
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Job Outputs

```yaml
jobs:
  build:
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - id: version
        run: echo "version=1.0.0" >> "$GITHUB_OUTPUT"

  deploy:
    needs: build
    steps:
      - run: echo "Deploying ${{ needs.build.outputs.version }}"
```

### Environment Files

```yaml
# Set environment variables for subsequent steps
- run: echo "MY_VAR=value" >> "$GITHUB_ENV"

# Set output
- run: echo "result=success" >> "$GITHUB_OUTPUT"

# Add to PATH
- run: echo "/custom/path" >> "$GITHUB_PATH"
```

## Deprecation Timeline

| Action/Feature               | Deprecated | End of Life      |
| ---------------------------- | ---------- | ---------------- |
| actions/upload-artifact@v3   | Now        | January 30, 2025 |
| actions/download-artifact@v3 | Now        | January 30, 2025 |
| actions/cache@v3             | Now        | February 1, 2025 |
| Node 16 actions              | Now        | Varies by action |
| save-state command           | 2022       | Removed          |
| set-output command           | 2022       | Removed          |

## Migration Checklist

- [ ] Update all `actions/upload-artifact` to v4
- [ ] Update all `actions/download-artifact` to v4
- [ ] Update all `actions/cache` to v4
- [ ] Update `actions/checkout` to v4
- [ ] Update `actions/setup-node` to v4
- [ ] Ensure unique artifact names per job
- [ ] Use `$GITHUB_OUTPUT` instead of `set-output`
- [ ] Use `$GITHUB_ENV` instead of `set-env`
- [ ] Verify runner version compatibility
- [ ] Test matrix builds with new artifact naming
- [ ] Update custom actions to node20

## External Resources

- [Artifact v4 Migration](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/)
- [Cache v4 Documentation](https://github.com/actions/cache)
- [Checkout v4 Documentation](https://github.com/actions/checkout)
- [GitHub Actions Changelog](https://github.blog/changelog/label/actions/)
