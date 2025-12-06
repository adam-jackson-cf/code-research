# System Adapter Playbook

1. Scaffold `systems/<new>/` with the required footprint (rules plus prompts/commands/templates as appropriate).
2. Register in the installer: update `SYSTEM_RULES` and `ALWAYS_MANAGED_PREFIXES` in `tools/enaible/src/enaible/commands/install.py`.
3. Register in the prompt renderer: add the system to `tools/enaible/src/enaible/prompts/catalog.py` (and adapters if needed).
4. Provide templates under `docs/system/<new>/templates/` that match shared prompt tokens.
5. Drift guards:

```bash
uv run --project tools/enaible enaible prompts render --prompt all --system all
uv run --project tools/enaible enaible prompts diff
```

6. Smoke installs:

```bash
uv run --project tools/enaible enaible install <new> --scope project --mode sync
uv run --project tools/enaible enaible install <new> --scope user --mode sync
```

Open a minimal prompt to confirm managed assets load and sentinels are present.
