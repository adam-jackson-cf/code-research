# Shared Prompt Authoring Guide

1. Author the source prompt in `shared/prompts/<name>.md`. Edit `docs/system/<system>/templates/` only when you need new frontmatter/layout tokens.
2. Run guards after any edit:

```bash
uv run --project tools/enaible enaible prompts lint
uv run --project tools/enaible enaible prompts render --prompt all --system all
uv run --project tools/enaible enaible prompts diff
```

3. Validate end-to-end: reinstall each affected system

```bash
uv run --project tools/enaible enaible install <system> --mode sync --scope project
```

Then exercise any analyzer calls via `enaible analyzers run ...` and keep artifacts under `.enaible/artifacts/<task>/<timestamp>/`. 4) Tests: add or update deterministic prompt fixtures in `shared/tests` when outputs are stable; otherwise rely on the drift checks above.

## Format conventions (required)

- System-agnostic source: keep wording neutral; system wrappers add frontmatter during render.
- Variables section: use the standard bullet layout under `## Variables` with `### Required / ### Optional (derived from $ARGUMENTS) / ### Derived (internal)` and `@TOKEN = $N` / `@TOKEN = --flag` mappings. No `$` tokens elsewhere in the body.
- Token usage: all placeholders are `@TOKEN` and must be declared in Variables; lint enforces this.
- Managed sentinel: don’t add it manually—the renderer injects `<!-- generated: enaible -->` into system outputs.
- Use the exact template and pattern to mirror can be found here `docs/system/templates/prompt.md`.
