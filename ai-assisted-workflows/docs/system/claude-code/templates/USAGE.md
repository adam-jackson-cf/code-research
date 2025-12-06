# Claude Code Template Usage Notes

## Enaible Workflow

- Ensure the Enaible CLI workspace is synced before regenerating templates:
  ```bash
  uv sync --project tools/enaible
  ```
- Run the Enaible test suite and prompt drift gate locally:
  ```bash
  uv run --project tools/enaible pytest tools/enaible/tests -v
  uv run --project tools/enaible enaible prompts diff --system claude-code
  ```
- Capture optional diagnostics if installation issues arise:
  ```bash
  uv run --project tools/enaible enaible doctor --json
  ```

All claude-code command templates are rendered from `docs/system/claude-code/templates/*.j2` and emitted to `systems/claude-code/commands/` via `enaible prompts render`.
