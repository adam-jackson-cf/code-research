# Enaible CLI - Rust Implementation

This is a Rust port of the Enaible CLI from Python, providing a unified command-line interface for AI-Assisted Workflows.

## Project Structure

```
enaible-rs/
├── Cargo.toml                 # Workspace manifest
├── crates/
│   ├── enaible-core/         # Core types, context, and workspace discovery
│   ├── enaible-prompts/      # Prompt rendering and catalog management
│   ├── enaible-analyzers/    # Analyzer base infrastructure and registry
│   └── enaible-cli/          # CLI binary with all commands
└── tests/
    └── integration/          # Integration tests for CLI compatibility
```

## Features Ported

### Core Infrastructure (enaible-core)
- ✅ Constants (`MANAGED_SENTINEL`)
- ✅ WorkspaceContext for path discovery
- ✅ Environment variable support (`ENAIBLE_REPO_ROOT`, etc.)
- ✅ Shared workspace detection

### Prompt System (enaible-prompts)
- ✅ Prompt catalog with definitions
- ✅ System contexts (claude-code, codex, copilot, cursor, gemini, antigravity)
- ✅ Prompt renderer with Tera templating
- ✅ Variable extraction from prompts
- ✅ Prompt linting for @TOKEN usage

### Analyzer Infrastructure (enaible-analyzers)
- ✅ AnalyzerConfig with validation
- ✅ Base analyzer trait
- ✅ Analyzer registry with dynamic registration
- ✅ File collection with gitignore support
- ✅ Finding and result structures

### CLI Commands (enaible-cli)
- ✅ `enaible version` - Display version information
- ✅ `enaible doctor [--json]` - Environment diagnostics
- ✅ `enaible prompts list` - List available prompts
- ✅ `enaible prompts render` - Render prompts for systems
- ✅ `enaible prompts diff` - Show diffs between rendered and committed
- ✅ `enaible prompts validate` - Validate prompt consistency
- ✅ `enaible prompts lint` - Lint prompt sources
- ✅ `enaible analyzers list [--json]` - List registered analyzers
- ✅ `enaible analyzers run` - Run analysis tools
- ✅ `enaible install` - Install dependencies and sync workspace
- ✅ `enaible context-capture` - Capture session context
- ✅ `enaible docs-scrape` - Scrape documentation
- ✅ `enaible auth-check` - Verify CLI authentication

## Building

```bash
# Build the project
cargo build --release

# Run tests
cargo test

# Run the CLI
./target/release/enaible --help
```

## Installation

```bash
# Install to system
cargo install --path crates/enaible-cli

# Or copy the binary
cp target/release/enaible ~/.local/bin/
```

## Usage Examples

```bash
# Check environment
enaible doctor --json

# List prompts
enaible prompts list

# Render specific prompts
enaible prompts render --prompt analyze-security --system claude-code

# List analyzers
enaible analyzers list --json

# Run analyzer
enaible analyzers run security:basic --target ./src
```

## Compatibility Notes

This Rust implementation aims to be a drop-in replacement for the Python CLI with identical command-line interfaces. Key compatibility points:

1. **Command Structure**: All commands and flags match the Python version
2. **JSON Output**: Doctor and analyzer commands produce compatible JSON
3. **Environment Variables**: Same environment variables are respected
4. **File Paths**: Same workspace discovery logic
5. **Exit Codes**: Matching exit codes for success/failure

## Known Limitations

1. **Template Engine**: Uses Tera instead of Jinja2, which may have slight syntax differences for complex templates
2. **Python Integration**: Some commands still delegate to Python scripts (context-capture, docs-scrape)
3. **Analyzer Implementations**: Only stub analyzers are included; full implementations would need porting
4. **Prompt Catalog**: Partial catalog implementation for demonstration

## Dependencies

Key Rust crates used:
- `clap` - Command-line argument parsing (replaces Typer)
- `tera` - Template rendering (replaces Jinja2)
- `serde` - Serialization/deserialization
- `reqwest` - HTTP client (replaces httpx)
- `walkdir` - Directory traversal
- `regex` - Pattern matching
- `chrono` - Date/time handling
- `thiserror` - Error handling

## Testing

Integration tests verify CLI compatibility:

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_version_command
```

## Performance

The Rust implementation provides significant performance improvements:
- Faster startup time (no Python interpreter overhead)
- Parallel file processing capabilities
- Lower memory footprint
- Native binary distribution

## Future Enhancements

- Complete all prompt catalog entries
- Port analyzer implementations from Python
- Add async/parallel processing for analyzers
- Implement native Python script functionality
- Add shell completion generation
- Create automated migration tools