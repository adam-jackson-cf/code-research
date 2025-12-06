## Testing

Frameworks: `pytest` (unit + integration) plus the Enaible CLI (`uv run --project tools/enaible ...`). Prefer the CLI wrappers—they bootstrap the analyzer registry, honor gitignore patterns, and normalize JSON output automatically.

### Integration Suites

- **All analyzers smoke** (`shared/tests/integration/test_integration_all_analyzers.py:1-21`)

  ```bash
  NO_EXTERNAL=true uv run --project tools/enaible \
    pytest shared/tests/integration/test_integration_all_analyzers.py -q
  ```

  Clears external dependencies by default; unset `NO_EXTERNAL` to include tools like Semgrep or Detect-Secrets.

- **Security CLI adapters** (`shared/tests/integration/test_integration_security_cli.py:1-64`)

  ```bash
  uv run --project tools/enaible pytest shared/tests/integration/test_integration_security_cli.py -k semgrep
  uv run --project tools/enaible pytest shared/tests/integration/test_integration_security_cli.py -k detect_secrets
  ```

  Each test spins up `integration.cli.evaluate_security` for a small subset; make sure the corresponding binaries (`semgrep`, `detect-secrets`) exist on PATH or the test skips.

- **Root-cause CLI** (`shared/tests/integration/test_integration_root_cause_cli.py:1-14`)
  ```bash
  uv run --project tools/enaible pytest shared/tests/integration/test_integration_root_cause_cli.py -q
  ```
  Validates `integration.cli.evaluate_root_cause` end-to-end.

### Targeted Analyzer Runs

Use the Typer command instead of invoking modules manually:

```bash
uv run --project tools/enaible enaible analyzers list
uv run --project tools/enaible enaible analyzers run quality:lizard --target test_codebase --summary
uv run --project tools/enaible enaible analyzers run security:semgrep --target test_codebase/test-python --max-files 10 --min-severity medium
```

- `--no-external` sets `ENAIBLE_DISABLE_EXTERNAL=1` for the run.
- `--exclude` can be repeated to add repo-specific ignore globs.
- Use `--out .enaible/artifacts/<task>/<timestamp>/result.json` to persist normalized payloads for CI evidence.
