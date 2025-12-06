# Enaible CLI Readiness Snapshot

## Constraints

- Generate a concise readiness snapshot (two short paragraphs max) focused on analyzer centralization, prompt templating, and CI guardrails.
- Rely solely on this brief; do **not** run shell commands, repo scans, or git history queries.
- After writing the Markdown report to the requested `OUT` path, end the conversation by replying with the single word `DONE`.

## Current Position

- Shared prompt bodies already live in `shared/prompts/` with system wrappers staged under `docs/system/<system>/templates/`.
- Plans call for a Typer-based `tools/enaible/` package that wraps `shared/core/cli/run_analyzer.py`, normalizes JSON output, and removes per-system path discovery.
- Existing exec plans highlight the migration steps: scaffold the CLI, migrate templates, refactor prompts to call `enaible analyzers run`, and wire CI drift checks.

## Gaps & Risks

- No `tools/enaible/` scaffold yet; prompts still shell out with brittle PYTHONPATH logic.
- Template adapters and render helpers are pending, so system wrappers cannot yet be regenerated automatically.
- CI guardrails exist only on paper; `enaible prompts render/diff` isn’t wired into workflows.

## Deliverable

- Provide a readiness snapshot that calls out what’s in place, what’s missing, and the most urgent follow-up steps (scaffold CLI, migrate templates, add CI gates).
- Use structured bullets where helpful; omit evidence citations.
