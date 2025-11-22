# WordPress VIP Content Categorization

> AI-powered content categorization system that ingests data from WordPress VIP, stores it in Supabase, and runs a cascading semantic → LLM workflow to map taxonomy pages to content.

## ✨ Highlights

- 🔗 **WordPress VIP Connector** – Pagination and retry-aware ingestion
- 💾 **Supabase-backed Persistence** – CSV exports for review workflows
- 🤖 **Dual-stage AI Workflow** – OpenRouter/OpenAI compatible with configurable thresholds
- 🧠 **DSPy-based Optimization** – Prompt optimization and CLI tooling for every step
- 🚧 **Quality Gates** – Pre-commit + `make quality-check` covering format, lint, types, and tests

## Workflow Overview

1. **Semantic matching (default ≥0.85)** – Embed taxonomy + content, run cosine similarity, and store matches immediately.
2. **LLM categorization fallback (default ≥0.9)** – Ask the chat model to pick the best remaining candidate per taxonomy page.
3. **Human review** – Anything still unmatched is exported with blank target URLs for manual action.

Both AI stages can be toggled independently via environment variables or CLI flags.

## Operator Shortcuts

- `python -m src.cli full-run --output redirects.csv` chains taxonomy load → incremental ingestion → cascading matching → CSV export in one go.
- `python -m src.cli ingest --resume` resumes each site from the last published date we captured; use `--since 2025-11-01` for explicit recovery windows.
- `python -m src.cli match --only-unmatched --skip-semantic --force-llm` reruns only the backlog below the semantic threshold and forces new LLM judgments without touching previously matched rows.
- Targeted fixes are supported via `--taxonomy-ids <uuid,...>` or by pointing `--taxonomy-file subset.csv` (expects a `url` column) at a hand-curated list of taxonomy entries.

## Get Started

1. **Need a one-command experience?** Follow the [Quick Start](docs/QUICKSTART.md) to create the schema and run `python -m src.cli full-run --output results/results.csv`.
2. **Want the full install + CLI workflow?** Use the detailed [Setup Guide](docs/SETUP.md) for prerequisites, environment configuration, and command recipes.
3. **Building or extending the system?** Read [AGENTS.md](AGENTS.md) for architecture, component responsibilities, and development guidelines.

### Core Setup Commands

- `python -m src.cli init-db` – Apply `src/data/schema.sql` to your Supabase project (uses SQL RPC when available, otherwise prints copy-paste instructions).
- `python scripts/test_setup.py` – Dry-run verification of environment, Supabase connectivity, WordPress connector, and embeddings.
- `python -m src.cli full-run --output results/results.csv` – One-shot taxonomy load → ingestion → cascading matching → CSV export.

## Documentation Map

- [QUICKSTART.md](docs/QUICKSTART.md) – Fast path: Supabase SQL, automated ingestion/matching, and quick validation.
- [SETUP.md](docs/SETUP.md) – Deep dive into environment variables, CLI commands, customization, cost management, and troubleshooting.
- [AGENTS.md](AGENTS.md) – Authoritative reference for architecture, services, database schema, and quality expectations.
- [CODE_REVIEW.md](CODE_REVIEW.md) – Code standards and review checklist.
- [docs/CODE_REVIEW_GUIDE.md](docs/CODE_REVIEW_GUIDE.md) – AI/human review workflow.
- [src/data/schema.sql](src/data/schema.sql) – Canonical Supabase schema (also reproduced inside the quick start guide).

## Quality & Tooling

- Run `make quality-check` locally to execute Black, Ruff, mypy, and pytest with coverage (54% minimum enforced).
- Install the bundled hooks with `pre-commit install` to block commits until the full gate passes.
- See [AGENTS.md](AGENTS.md) for additional testing strategies, integration markers, and development conventions.

## Need Help?

Troubleshooting tips (Supabase auth, OpenRouter limits, low match quality, etc.) live in [SETUP.md](docs/SETUP.md).
