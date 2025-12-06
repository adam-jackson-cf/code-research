# analyze-repo-orchestrator v1.1

# Purpose

Run a parallel, tmux-based repository analysis that reuses existing deterministic workflows (architecture, code quality, security) and adds quality-gates, tests, and history. The analysis should enable to go from 0 to 1 in the understanding of the tech stack, approach, patterns, strenths and failings of a target codebase. Produce a single 0–10 score per section with attached evidence using the KPI scoring guide. Use the Output section as the final report formatting guide.

## Variables

### Required

- @TARGET_PATH = $1 — path to analyze; defaults to repo root

### Optional (derived from @ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @TIMEOUT_SEC = --timeout — overall wait timeout per session (default 3600)
- @EXCLUDE = --exclude [repeatable] — additional glob patterns to exclude (passed to child prompts where applicable)

### Derived (internal)

- @ORCH_ROOT — timestamped orchestrator artifact directory
- @TARGET_ABS — absolute path to the target directory resolved from @TARGET_PATH
- @EXCLUDE_ARGS — shell-formatted exclusion arguments built from @EXCLUDE options
- @ORCH_TS — UTC timestamp (YYYYMMDDTHHMMSSZ) for this orchestration run
- @ARCH_ROOT — architecture analyzer artifact directory
- @QUALITY_ROOT — code quality analyzer artifact directory
- @SECURITY_ROOT — security analyzer artifact directory
- @PERF_ROOT — performance analyzer artifact directory
- @HISTORY_ROOT — git history analyzer artifact directory
- @STATUS_LOG — CSV/JSON status log file for tracking tmux session completion
- @SCOPE — iteration variable for directory scopes in JSCPD analysis loops
- @DAYS — number of days for git history analysis window

## Instructions

- ALWAYS call Enaible analyzers via the CLI (uv + enaible); do not call other prompts from this prompt.
- Launch each analysis in its own tmux session to run in parallel and avoid blocking on long tasks.
- Persist all outputs under @ORCH_ROOT and the analyzer-specific directories; capture paths to a manifest for traceability.
- Use the Output section to compute scores deterministically from artifacts (anchors, normalization, and final format).

## Workflow

0. **Preflight checks**

   - Resolve `@TARGET_ABS=$(cd '@TARGET_PATH' && pwd)`; all analyzer shells must `cd '@TARGET_ABS'` and pass `--target '.'` so findings never mix in the orchestrator repo.
   - Verify required tools: `uv`, `tmux`, `npm`, `npx jscpd`, `git`, `pytest`, `ruff`, `mypy`. If any command is missing, write the failure reason to `@ORCH_ROOT/preflight-error.txt` and exit this workflow instead of launching tmux jobs.
   - Build a reusable exclusion string such as `@EXCLUDE_ARGS="--exclude .git --exclude .venv ..."` plus any user-provided `@EXCLUDE` tokens; keep it in shell variables (no helper files) and apply the same list to every analyzer.
   - Detect the dominant languages/frameworks in `@TARGET_ABS` (e.g., inspect `pyproject.toml`, `package.json`, `Cargo.toml`, `requirements.txt`, `.sql` files) - use this inventory to decide which performance analyzers should run (skip irrelevant ones to save time).

1. **Init artifacts**

   - Compute `@ORCH_TS` (UTC `YYYYMMDDTHHMMSSZ`).
   - Create `@ORCH_ROOT = .enaible/artifacts/orchestrator/@ORCH_TS`.
   - Initialize dedicated analyzer roots:
     - `@ARCH_ROOT = .enaible/artifacts/analyze-architecture/@ORCH_TS`
     - `@QUALITY_ROOT = .enaible/artifacts/analyze-code-quality/@ORCH_TS`
     - `@SECURITY_ROOT = .enaible/artifacts/analyze-security/@ORCH_TS`
     - `@PERF_ROOT = .enaible/artifacts/analyze-performance/@ORCH_TS`
     - `@HISTORY_ROOT = .enaible/artifacts/analyze-history/@ORCH_TS`
   - Declare `@STATUS_LOG=@ORCH_ROOT/session-status.log`. Every tmux job must append `session,status,timestamp` (CSV or JSON) to this log instead of touching `.done/.failed` files. After synthesizing the final report, delete `@STATUS_LOG` to keep the artifact tree clean.

2. **Launch core analyses (parallel via tmux; analyzers only via uv/enaible)**

   - Architecture:
     ```bash
     tmux new-session -d -s ra-arch "\
       set -euo pipefail; \
       cd '@TARGET_ABS'; \
       uv run --project tools/enaible enaible analyzers run architecture:patterns \
         --target '.' --out '@ARCH_ROOT/architecture-patterns.json' @EXCLUDE_ARGS; \
       uv run --project tools/enaible enaible analyzers run architecture:dependency \
         --target '.' --out '@ARCH_ROOT/architecture-dependency.json' @EXCLUDE_ARGS; \
       uv run --project tools/enaible enaible analyzers run architecture:coupling \
         --target '.' --out '@ARCH_ROOT/architecture-coupling.json' @EXCLUDE_ARGS; \
       uv run --project tools/enaible enaible analyzers run architecture:scalability \
          --target '.' --out '@ARCH_ROOT/architecture-scalability.json' @EXCLUDE_ARGS; \
        printf 'ra-arch,success,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'" \
      || printf 'ra-arch,failed,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'
     ```
   - Code Quality (complexity):
     ```bash
     tmux new-session -d -s ra-quality "\
       set -euo pipefail; \
       cd '@TARGET_ABS'; \
       uv run --project tools/enaible enaible analyzers run quality:lizard \
          --target '.' --out '@QUALITY_ROOT/quality-lizard.json' @EXCLUDE_ARGS; \
        printf 'ra-quality,success,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'" \
      || printf 'ra-quality,failed,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'
     ```
   - Code Quality (duplication):
     - Full-repo JSCPD runs commonly exceed the 300s limit. Instead, scan curated scopes in a single tmux session so each completes quickly:
       ```bash
       tmux new-session -d -s ra-quality-jscpd "\
         set -euo pipefail; \
         cd '@TARGET_ABS'; \
         for @SCOPE in cli indexer extractors embeddings storage detect config utils tests; do \
           if [ \"@SCOPE\" = 'tests' ]; then \
             uv run --project tools/enaible enaible analyzers run quality:jscpd \
               --target \"@SCOPE\" \
               --out \"@QUALITY_ROOT/quality-jscpd-@SCOPE.json\" \
               --min-severity low \
               --exclude 'fixtures/**' \
               @EXCLUDE_ARGS; \
           else \
             uv run --project tools/enaible enaible analyzers run quality:jscpd \
               --target \"@SCOPE\" \
               --out \"@QUALITY_ROOT/quality-jscpd-@SCOPE.json\" \
               --min-severity low \
               @EXCLUDE_ARGS; \
           fi; \
         done; \
         printf 'ra-quality-jscpd,success,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'" \
       || printf 'ra-quality-jscpd,failed,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'
       ```
     - Note the directories included/excluded and summarize cross-scope duplication hotspots in your report.
   - Security:
     ```bash
     tmux new-session -d -s ra-sec "\
       set -euo pipefail; \
       cd '@TARGET_ABS'; \
       uv run --project tools/enaible enaible analyzers run security:semgrep \
         --target '.' --out '@SECURITY_ROOT/semgrep.json' @EXCLUDE_ARGS; \
       uv run --project tools/enaible enaible analyzers run security:detect_secrets \
         --target '.' --out '@SECURITY_ROOT/detect-secrets.json' @EXCLUDE_ARGS; \
        printf 'ra-sec,success,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'" \
      || printf 'ra-sec,failed,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'
     ```
   - Performance (reuse decisions from the language scan; only launch analyzers that match the stack). For each chosen tool (e.g., `performance:ruff` for Python services, `performance:frontend` for JS bundles, `performance:sqlglot` when SQL is present, `performance:semgrep` as a baseline), start a tmux session rooted at `@TARGET_ABS` and log status lines in `@STATUS_LOG`:

     ```bash
     tmux new-session -d -s ra-perf-ruff "\
       set -euo pipefail; \
       cd '@TARGET_ABS'; \
       uv run --project tools/enaible enaible analyzers run performance:ruff \
         --target '.' --out '@PERF_ROOT/performance-ruff.json' --min-severity high @EXCLUDE_ARGS; \
       printf 'ra-perf-ruff,success,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'" \
     || printf 'ra-perf-ruff,failed,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'
     ```

     - Repeat the same pattern (unique session names + `@STATUS_LOG` entries) for any other performance analyzers deemed relevant. Document skipped tools and justification in the final notes so downstream reviewers know what was (or wasn’t) executed.

3. **Git History Review (smells, churn, ownership)**

- Launch a single tmux session that writes all required history evidence under `@HISTORY_ROOT/` for later synthesis:

  ```bash
  tmux new-session -d -s ra-history "\
    set -euo pipefail; \
    cd '@TARGET_ABS'; \
    (git log --since='120 days ago' --pretty=format:'%h %ad %an %s' --date=iso --numstat || true) \
      > '@HISTORY_ROOT/git-numstat.txt'; \
    (git log --name-only --pretty=format: | sort | uniq -c | sort -nr | head -200 || true) \
      > '@HISTORY_ROOT/top-touched-files.txt'; \
    (git shortlog -sn --since='90 days ago' || true) \
      > '@HISTORY_ROOT/top-authors.txt'; \
    (git log --stat --date=iso --max-count 50 || true) \
      > '@HISTORY_ROOT/recent-stat.txt'; \
    (git log --grep='\\bfix\\b' --since='30 days ago' --pretty=format:'%h %ad %an %s' --date=iso || true) \
      > '@HISTORY_ROOT/fix-events.txt'; \
    printf 'ra-history,success,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'" \
  || printf 'ra-history,failed,%s\n' "$(date -u +%FT%TZ)" >> '@STATUS_LOG'
  ```

4. Deep LLM driven analysis (file-driven)

- Review the project across:
  - Backend Patterns & Practices
  - Frontend Patterns & Practices
  - Data & State
  - Observability
  - Quality gates and Testing Practices
  - Entry points, services, CLIs, routing surfaces, configurations, manifests, and framework signals
- Capture supporting facts with repository commands (`ls`, `rg`, `git`, `sed`, etc.) and convert them into concise documentation-ready notes.

5. Await completion / timeout

- Monitor `ra-arch ra-quality ra-quality-jscpd ra-sec ra-perf ra-tests ra-history`.
- Poll until `@TIMEOUT_SEC`: a session is considered complete when `tmux has-session -t <name>` fails **and** a matching line exists in `@STATUS_LOG`.
- On timeout or missing entry: append `<name>,failed,<timestamp>` to `@STATUS_LOG`, surface any partial artifacts, and call out the timeout in the final report.

6. Baesd on the produced analysis, produce KPI Scoring using the below formulae

Scoring Primer (once)

- Formula: `S = round(0.7*O + 0.3*A, 1)`
- Anchor A (single definition): `10/8/5/2/0 = Excellent/Strong/Adequate/Weak/Critical`
- Normalization: each signal → `[0,1]` by clamping between good (=1) and bad (=0)
- Lower‑is‑better signals: `norm = clamp((bad − x)/(bad − good))`; higher‑is‑better flips
- Objective score: `O = Σ w_i * norm_i` (weights per KPI sum to `1`)
- Use artifact‑derived signals only; anchors are reviewer judgment applied once per KPI

Maintainability

- Signals (w): duplication `0.4`; long_functions `0.2`; param_p95 `0.2`; cc_outliers `0.2`
- Thresholds (good/bad): dup `5/20`; long_fn `0/20`; p95 `3/8`; cc_outliers `0/10`
- Normalization: lower is better for all; long functions & outliers ideal `0`

Robustness

- Signals (w): scalability `0.35`; tests_enforced `0.35`; cycles `0.30`
- Thresholds (good/bad): scalability `0/50`; cycles `0/10`; tests_enforced is binary
- Normalization: counts map to `[0,1]`; tests_enforced already `0/1`

Security

- Signals (w): critical `1.0`; high `0.6`; medium `0.3` (ignore `info`)
- Thresholds (bad ≥): crit `10`; high `25`; medium `50`; good = `0` for all
- Normalization: invert counts vs bad thresholds; `0` findings → `1`

Performance

- Signals (w): sync_io `0.4`; global_state `0.3`; n_plus_one `0.3`
- Thresholds (bad ≥): `20` each; good = `0`; penalty‑only signals
- Normalization: invert counts vs bad thresholds; `0` findings → `1`

Velocity

- Signals (w): gates_strict `0.35`; hooks `0.25`; format_enforced `0.25`; one_command `0.15`
- Thresholds: booleans map to `0/1`; optional rule_density good `≥0.8`, bad `≤0.2`
- Normalization: binary or density to `[0,1]`; `one_command` is binary (e.g., `make dev`)

Agentic Readiness

- Signals (w): consistency `0.30`; parallelizability `0.30`; guidelines `0.15`; guardrails `0.15`; docs_freshness `0.10`
- Thresholds (bad ≥): dup `20%`; coupling `2.0`; concentration `0.5`; docs_age `180d`
- Normalization: invert vs bad thresholds; lower than bad scales up toward `1`

7. Using the KPI scoring, analysis and context gathered across the whole process output the findings to `@ORCH_ROOT/report.md` using the markdown ## Output template format specified below.

8. Clean up the transient helper files after `report.md` is written: delete `@STATUS_LOG`, temporary exclusion snippets, or other scratch artifacts so that `@ORCH_ROOT` only contains `report.md` (plus optional debug files when explicitly requested).

## Output

````md
# Executive Summary

- Application Purpose

- KPIs:
  <m> <badge> Maintainability
  <r> <badge> Robustness
  <s> <badge> Security
  <p> <badge> Performance
  <v> <badge> Velocity
  <ar> <badge> Agentic Readiness
- KPI legend: 🟢 7–10 Good, 🟠 4–6 Watch, 🔴 0–3 Risk.

## Features

- [Key feature 1]
- [Key feature 2]
- [Additional features...]

## System Overview

## Tech Stack

- **Languages**: [e.g., TypeScript, Python, Rust]
- **Frameworks**: [e.g., React, FastAPI, Actix]
- **Build Tools**: [e.g., Webpack, Poetry, Cargo]
- **Package Managers**: [e.g., npm, pip, cargo]
- **Testing**: [e.g., Jest, pytest, cargo test]

## Structure

```md
project-root/
├── src/ # [Description]
├── tests/ # [Description]
├── docs/ # [Description]
└── ... # [Other key directories]
```
````

**Key Files**:

- `[file]` - [Purpose]
- `[file]` - [Purpose]

**Entry Points**:

- `[file]` - [Description]

## Architecture

<!-- observations to capture - guidance only -->

- Identify the primary domains, layers, shared libraries, and external interfaces referenced by architecture:patterns.
- Note whether observed patterns (CQRS, hexagonal, micro-frontends) align with project standards.
- Highlight modules with excessive in-degree/out-degree, circular dependencies, or boundary violations surfaced by architecture:dependency and architecture:coupling.
- Map findings to concrete files/services and describe user-visible risk (regression blast radius, deployment friction, scalability constraints).
- Review architecture:scalability signals for bottlenecks (synchronous fan-out, global locks, shared state) and capture recommended guardrails or capacity tests.
<!-- end guidance -->

### Key Components:

- **[Component]**: [Role and responsibility]
- **[Component]**: [Role and responsibility]

## Backend Patterns and Practices

- <observation1>
- <observation2>
- <...>

## Frontend Patterns and Practices

- <observation1>
- <observation2>
- <...>

## Data & State

- <observation1>
- <observation2>
- <...>

## Architecture Top 10 issues

| Finding | Risk  | Modules/Area | Why it matters | Evidence | Fix      |
| ------- | ----- | ------------ | -------------- | -------- | -------- |
| <desc>  | <sev> | <scope>      | <impact>       | <path>   | <action> |

## Performance

<!-- observations to capture - guidance only -->

- Parse hotspots across layers: backend N+1 patterns, frontend re-render costs, SQL anti-patterns, lint warnings.
- Map each issue to system components (API endpoints, React routes, migrations, jobs).
- Inspect flagged areas for caching gaps, over-fetching, synchronous IO, or configuration constraints.
- Consider infrastructure contributors (rate limits, autoscaling thresholds, memory footprints).
- Group issues by impact (critical, high, medium) and outline validation experiments (profiling, load tests).
<!-- end guidance -->

- <observation1>
- <observation2>
- <...>

## Performance Top 10 issues

| Finding | Category | Area    | Impact   | Evidence | Fix      |
| ------- | -------- | ------- | -------- | -------- | -------- |
| <desc>  | <class>  | <scope> | <impact> | <path>   | <action> |

## Security

<!-- observations to capture - guidance only -->

    - Summary of Critical and High severity issues
    - Risk impact

<!-- end guidance -->

- <observation1>
- <observation2>
- <...>

## Security Top 10 issues

| Severity | OWASP Category | Location / Asset | Description | Evidence               |
| -------- | -------------- | ---------------- | ----------- | ---------------------- |
| <sev>    | <cat>          | <path#L>         | <desc>      | semgrep/detect-secrets |

## Observability

| Aspect          | Current State | Note |
| --------------- | ------------- | ---- |
| Logging         | <…>           | <…>  |
| Metrics         | <…>           | <…>  |
| Analytics/Flags | <…>           | <…>  |

## Build & Quality Gates

| Purpose     | Command | Notes         |
| ----------- | ------- | ------------- |
| Lint        | `<cmd>` | <tool/config> |
| Type        | `<cmd>` | <tool/config> |
| Test        | `<cmd>` | <scope>       |
| Duplication | `<cmd>` | <threshold>   |
| Complexity  | `<cmd>` | <threshold>   |

## Testing Practices

| Test type          | File path / location | Command     |
| ------------------ | -------------------- | ----------- |
| Unit tests         | `<path>`             | `<command>` |
| Integration tests  | `<path>`             | `<command>` |
| System / E2E tests | `<path>`             | `<command>` |
| Coverage           | `<path>`             | `<command>` |

## Git History Insights (<@DAYS> days)

- Timeline theme or initiative • cite `git-numstat.txt` / `recent-stat.txt`
- Ownership or churn hotspot • reference `top-authors.txt` / `top-touched-files.txt`
- Notable fix/regression or risky area • reference `fix-events.txt` or targeted `git log --follow`
- (Optional) Pattern search / blame insight • mention `git log -S` or `git blame` findings when relevant

## Top 10 Recommendations (impact-first)

Ranked by Impact Score = max(security, architecture) × 0.5 + velocity_gain × 0.3 + maintainability × 0.2; Effort is a 1–5 estimate.

| #   | Recommendation | Why it matters | Impact | Effort | Owner | Evidence |
| --- | -------------- | -------------- | ------ | ------ | ----- | -------- |

## Attachments

- Architecture → `.enaible/artifacts/analyze-architecture/@ORCH_TS/...`
- Code Quality → `.enaible/artifacts/analyze-code-quality/@ORCH_TS/...`
- Performance → `.enaible/artifacts/analyze-performance/@ORCH_TS/...`
- Security → `.enaible/artifacts/analyze-security/@ORCH_TS/...`
- History → `.enaible/artifacts/analyze-history/@ORCH_TS/...`

````

## Examples

```bash
# Run orchestrator on entire repository
/analyze-repo-orchestrator . --auto --timeout 5400

# Focus on a subpackage
/analyze-repo-orchestrator services/api --auto
````

<!-- generated: enaible -->
