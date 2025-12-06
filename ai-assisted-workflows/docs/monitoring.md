# Monitoring & Operational Notes

Enaible emphasizes traceable automation. This guide captures how to observe workflows, persist evidence, and keep quality gates transparent across environments.

## Artifact conventions

- All managed prompts write findings to `.enaible/artifacts/<task>/<timestamp>/`.
- Use UTC timestamps (`$(date -u +%Y%m%dT%H%M%SZ)`) when scripting to avoid collisions across time zones.
- Keep raw analyzer JSON alongside derived Markdown or summaries so reviewers can audit evidence.

Example structure created by the security workflow:

```
.enaible/
  artifacts/
    analyze-security/
      20251102T120000Z/
        semgrep.json
        detect-secrets.json
        gap-analysis.md
        risk-summary.md
```

## Capture development sessions

Automated context capture keeps longitudinal records of AI-assisted sessions. Wrap the helper around your target platform:

```bash
uv run --project tools/enaible enaible context_capture --platform codex --days 3 --output-format json
uv run --project tools/enaible enaible context_capture --platform claude --search-term "refactor sweep"
uv run --project tools/enaible enaible context_capture --platform claude --uuid <session-uuid>
```

Outputs redact sensitive data using the rules in `shared/context/context_capture_config.json` and respect the artifact root configured through `ENAIBLE_ARTIFACTS_DIR`.

## Health checks

Before shipping prompts or analyzers, run the diagnostics sweep:

```bash
uv run --project tools/enaible enaible doctor
uv run --project tools/enaible enaible doctor --json > .enaible/doctor.json
```

The report surfaces missing registry files, absent `.enaible/schema.json`, and Python environment mismatches.

## CI telemetry

The GitHub Actions workflow `.github/workflows/ci-quality-gates-incremental.yml` invokes the same commands recommended in local development:

- `uv run --project tools/enaible pytest tools/enaible/tests -v`
- `uv run --project tools/enaible ruff check tools/enaible/src`
- `uv run --project tools/enaible mypy tools/enaible/src`
- `uv run --project tools/enaible enaible prompts diff`

Pipe analyzer outputs into the `enaible ci` helpers to create CodeClimate or Markdown artifacts for dashboards.

## Long-running tasks

For services or analyzers that take longer than a single CLI session, follow the tmux guidance baked into the project rules:

```bash
tmux new-session -d -s enaible-longrun 'uv run --project tools/enaible enaible analyzers run quality:lizard --target . --out .enaible/artifacts/tmp/lizard.json'
tmux capture-pane -p -S -200 -t enaible-longrun
tmux kill-session -t enaible-longrun
```

This keeps ports from colliding with CLI-managed sessions and preserves logs for later inspection.

## Logging & troubleshooting tips

- Pass `--verbose` to analyzers that support it (security, performance) to include expanded metadata.
- Store generated Markdown summaries (e.g., risk reports) next to raw JSON to maintain traceability.
- When installing assets, run with `--dry-run` first to inspect planned writes:

  ```bash
  uv run --project tools/enaible enaible install codex --mode sync --dry-run
  ```

- Regenerate managed prompts any time `shared/prompts/` or `docs/system/**` is edited to avoid drift across environments.
