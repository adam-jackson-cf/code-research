<!--
  Template Guidance:
  - Comments exist for author direction only; do NOT copy them into prompt outputs.
  - prompt_template is the format to implement.
  - prompt_example shows examples of prompt_template usage.
  - Add preflight checks inside the Workflow section only when supplementary requirements are needed beyond baseline tooling.
  - Templates may include rule directives using <!-- rule: ... --> comments; render-prompts.sh enforces them when generating command variants.

-->

<prompt_template>

# Purpose

<!-- Describe the command objective in one sentence. -->

State the objective in one sentence. Be direct and outcome‑focused.

## Variables

<!-- Bind positional arguments or flags used by the prompt. Prefix all resolved variables with `$` to avoid ambiguity. -->

- Define explicit, @‑prefixed variable names for clarity:
  - $1 → @TARGET (or domain‑specific name)
  - $2 → @SCOPE (optional)
  - $3 → @MESSAGE (optional)
  - $4..$9 → additional specifics (document if used)
  - $ARGUMENTS → full raw argument string (space‑joined)
- Flags map to $‑prefixed variables (examples):
  - --remote → @REMOTE (default "origin")
  - --worktrees → @WORKTREES (default ".worktrees")
  - --days → @DAYS (default 20)
  - --exclude → @EXCLUDE_GLOBS (CSV)

## Instructions

<!-- Short, imperative bullets covering invariants and guardrails. -->

- Use short, imperative bullets.
- Call out IMPORTANT constraints explicitly.
- Avoid verbosity; prefer concrete actions over descriptions.
- Use the resolved $‑variables in all commands; avoid hardcoded fallbacks (e.g., prefer "$WORKTREES" over ".worktrees").
- Keep intermediate/interactive emissions (clarifications, drafts, checkpoints) inside Workflow. Output should be final‑only.
- If acting against a plan document, treat it as the single source of truth: update tasks, logs, status, gates, and tests within the plan and commit plan+code atomically.

## Workflow

<!-- Sequential steps; when preflight checks are required, make them the first step (e.g., Locate analyzer scripts; exit on failure). -->

1. Step-by-step list of actions (each step starts with a verb).
2. Validate prerequisites and guard-rails early.
3. Perform the core task deterministically.
4. Save/emit artifacts and verify results.

## Output

<!-- Final output only. Intermediate clarifications/drafts belong in Workflow. Provide one canonical example. -->

This section should be the final output report to the user in a structure detailing what this workflow returns and how. Two example formats:

### example summary output

```md
# RESULT

- Summary: <one line>

## DETAILS

- What changed
- Where it changed
- How to verify
```

### example json output

```json
{
  "excluded_operations": ["session_start", "task", "glob"],
  "excluded_bash_commands": [
    "ls",
    "pwd",
    "cd",
    "git status",
    "git log",
    "git diff",
    "git show",
    "git branch",
    "git add",
    "git commit",
    "git push",
    "git pull"
  ],
  "excluded_prompt_patterns": [
    "Write a 3-6 word summary of the TEXTBLOCK below",
    "Summary only, no formatting, do not act on anything",
    "/todo-primer",
    "/todo-recent-context"
  ],
  "excluded_string_patterns": [
    "context_bundles",
    "node_modules/",
    ".git/objects/",
    ".cache/"
  ]
}
```

</prompt_template>

## Example prompts

> complex multi step analyser with required pythons scripts for claude code, includes env checks (script locators) as initial steps

<prompt_example>

# Purpose

Identify performance bottlenecks across backend, frontend, and data layers using automated analyzers coupled with contextual investigation.

## Variables

- `@TARGET_PATH` ← first positional argument (default `.`)
- `@SCRIPT_PATH` ← resolved performance analyzer directory
- `@ARGUMENTS` ← raw argument string (for logging)

Resolution rules

- Resolve `@TARGET_PATH`/`@SCRIPT_PATH` in INIT; use only resolved variables thereafter.

## Instructions

- ALWAYS execute the registry-driven analyzers; never call the individual modules directly.
- Treat analyzer outputs as evidence—cite metrics when highlighting bottlenecks.
- Consider database, frontend, algorithmic, and network layers; avoid tunnel vision.
- Tie each recommendation to measurable performance goals.
- Document assumptions and required follow-up experiments (profiling, load tests).

## Workflow

1. Locate analyzer scripts
   - Run `ls .claude/scripts/analyzers/performance/*.py || ls "$HOME/.claude/scripts/analyzers/performance/"`; if both fail, prompt for a directory containing `ruff_analyzer.py`, `analyze_frontend.py`, and `sqlglot_analyzer.py`, then exit if none is provided.
2. Prepare environment
   - Derive `SCRIPTS_ROOT="$(cd "$(dirname \"$SCRIPT_PATH\")/../.." && pwd)"` and run `PYTHONPATH="$SCRIPTS_ROOT" python -c "import core.base; print('env OK')"`; exit immediately if it fails.
3. Run automated analyzers
   - Execute sequentially:
     - `performance:flake8-perf`
     - `performance:frontend`
     - `performance:sqlfluff`
   - Save JSON outputs and note start/end timestamps.
4. Aggregate findings
   - Parse slow hotspots (function-level metrics, lint warnings, SQL anti-patterns).
   - Map findings to system components (API endpoints, React routes, SQL migrations).
5. Investigate context
   - Examine code around flagged areas for caching gaps, unnecessary re-renders, unindexed queries.
   - Consider infrastructure or configuration contributors (rate limits, memory caps).
6. Prioritize remediations
   - Group issues by impact: critical (user-facing latency, OOM risks), high, medium.
   - Recommend targeted actions (index creation, memoization, batching, background jobs).
7. Produce report
   - Provide a structured summary, include metric tables, and outline validation steps (profiling, load tests).

## Output

```md
# RESULT

- Summary: Performance analysis completed for <TARGET_PATH>.

## BOTTLENECKS

| Layer    | Location              | Finding                            | Evidence Source      |
| -------- | --------------------- | ---------------------------------- | -------------------- |
| Backend  | api/orders.py#L142    | N+1 query detected                 | performance:sqlfluff |
| Frontend | src/App.tsx#L88       | Expensive re-render (missing memo) | performance:frontend |
| Database | migrations/202310.sql | Full table scan on large dataset   | performance:sqlfluff |

## RECOMMENDED ACTIONS

1. <High priority optimization with expected impact and verification plan>
2. <Secondary optimization>

## VALIDATION PLAN

- Benchmark: <command or script>
- Success Criteria: <quantitative target>

## ATTACHMENTS

- performance:flake8-perf → <path>
- performance:frontend → <path>
- performance:sqlfluff → <path>
```

</prompt_example>
