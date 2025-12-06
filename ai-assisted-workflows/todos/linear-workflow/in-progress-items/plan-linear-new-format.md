# plan-linear v0.1

## Purpose

Transform a raw planning artifact into a Linear-ready cycle plan using gated clarification, deterministic workspace artifacts, and optional mutation.

## Variables

- `TASK_INPUT` ← first positional argument or piped stdin.
- `PROJECT_ID` ← `--linear-project-id` (optional).
- `ESTIMATE_STYLE` ← `--estimate-style` (default `tshirt`).
- `MAX_SIZE` ← `--max-size` (default from config).
- `DRY_RUN` ← `--dry-run` flag.
- `AUTO_MODE` ← `--auto` flag.
- `DIFF_BASE` ← `--diff` value when provided.
- `CONFIG_PATH` ← explicit `--config` override.
- `SCRIPT_ARGS` ← full raw argument string for traceability.

## Instructions

- NEVER continue without a valid artifact; emit `EMPTY_ARTIFACT` envelope on failure.
- Maintain deterministic ordering for config fingerprint, requirements, and issue IDs.
- ALWAYS store subagent artifacts inside `.workspace/<cycle_slug>` with full agent names.
- Surface open questions and pause for confirmation unless `AUTO_MODE` is enabled.
- Trust hash outputs from `@agent-linear-hashing`; do not recalculate locally.
- Do not mutate Linear unless readiness is confirmed, user approves, and `DRY_RUN` is false.

## Workflow

1. Prepare workspace
   - Run `mkdir -p .workspace && test -w .workspace`; exit immediately if the cycle workspace cannot be created or written.
2. Parse arguments and validate flag set; compute `config_fingerprint` using resolved config (explicit path → project → user).
3. Acquire artifact from positional argument, stdin, or file. On empty artifact, emit `EMPTY_ARTIFACT` error and stop.
4. Initialize workspace
   - Ensure `.workspace` exists.
   - Resolve configuration by checking explicit `--config`, then `.claude/linear-plan.config.json`, then `$HOME/.claude/linear-plan.config.json`; exit with `CONFIG_NOT_FOUND` if none are available.
   - Derive `cycle_slug = kebab_case(task_objective)` after objective extraction.
   - Create `CYCLE_DIR = .workspace/<cycle_slug>`.
5. Invoke `@agent-linear-objective-definition`
   - Store `linear-objective-definition-output.json` in `CYCLE_DIR`.
   - Seed `cycle_plan_report.json.objective`.
6. Clarification loop
   - Present summary of objective, affected users, requirements, constraints.
   - List `open_questions`; collect answers and append to `objective.clarifications`.
   - **STOP:** “Provide clarifications or type proceed to continue.” Wait unless `AUTO_MODE`.
7. Planning loop (sequential subagents)
   - For each agent, write `<agent>-input.md`, `<agent>-summary.md`, `<agent>-output.json` to `CYCLE_DIR`:
     1. `@agent-linear-issue-decomposer`
     2. If `ESTIMATE_STYLE=tshirt`, `@agent-linear-estimation-engine`
     3. `@agent-linear-acceptance-criteria-writer`
     4. `@agent-linear-hashing`
   - Update `cycle_plan_report.json` after each subagent.
   - Abort with exit code 4 on hashing errors.
8. Readiness gate
   - Run `@agent-linear-readiness`; embed findings, labels, dependency suggestions.
   - Exit with code 2 if `ready=false` and remediation is required.
   - **STOP:** “Plan formed and readiness check successful, proceed with transfer to Linear? (y/n)” Wait unless `AUTO_MODE`.
9. Optional mutation
   - When approved and not `DRY_RUN`:
     - `@agent-linear-issue-search` per issue (duplicate detection).
     - `@agent-linear-issue-writer` to create/update issues.
     - `@agent-linear-dependency-linker` to apply edges.
     - Verify hashes unchanged; append mutation results to report.
10. Emit final artifacts

- Persist `cycle_plan_report.json`, diff info (when `DIFF_BASE` provided), and mutation results.
- Summarize readiness, totals, complexity, hashes, and mutation status.

## Output

### Cycle Plan Report (Canonical Schema)

```json
{
  "CycleName": {
    "version": 3,
    "objective": { ... },
    "issues": { ... },
    "hashes": { ... },
    "readiness": { ... },
    "mutation": { ... },
    "diff": { "added": [], "removed": [], "changed": [] }
  }
}
```

- Markdown variant mirrors JSON structure for readability.
- Exit codes: 0 (success), 1 (validation failure), 2 (readiness failure), 3 (mutation failure), 4 (contract violation).

## Examples

```bash
/plan-linear-v2 "Add MFA to admin console" --linear-project-id SEC-PLATFORM --dry-run
/plan-linear-v2 ./docs/auth-prd.md --estimate-style none
```
