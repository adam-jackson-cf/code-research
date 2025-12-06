Readiness snapshot shows strong progress on centralizing analyzers and prompts: shared prompt bodies already sit in `shared/prompts/`, matching system wrappers wait under `docs/system/<system>/templates/`, and the planned Typer-based `tools/enaible/` package promises to wrap `shared/core/cli/run_analyzer.py` so JSON output normalizes without ad-hoc PYTHONPATH hacks.

Gaps remain across templating and CI guardrails, making next steps urgent:

- Scaffold `tools/enaible/` now so prompts can call `enaible analyzers run` consistently.
- Land template adapters and render helpers to unblock automatic wrapper regeneration.
- Wire `enaible prompts render/diff` into CI so drift checks move from theory into enforced guardrails.
