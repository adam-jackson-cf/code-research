# Purpose

Identify performance bottlenecks across backend, frontend, and data layers using automated analyzers coupled with contextual investigation.

## Variables

### Required

- @TARGET_PATH = $1 — path to analyze; defaults to repo root

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @MIN_SEVERITY = --min-severity — defaults to "high"; accepts critical|high|medium|low
- @EXCLUDE = --exclude [repeatable] — additional glob patterns to exclude

### Derived (internal)

- @ARTIFACT_ROOT = <derived> — timestamped artifacts directory used for analyzer outputs

## Instructions

- ALWAYS leverage Enaible analyzers; avoid manual script path discovery.
- Persist analyzer results under `.enaible/artifacts/analyze-performance/` and cite them in the final report.
- Investigate bottlenecks holistically (compute, IO, frontend rendering, data access, configuration).
- Tie each recommendation to measurable outcomes and validation steps.
- Respect STOP confirmations unless @AUTO is provided; when auto is active, treat checkpoints as approved without altering other behavior.
- Run reconnaissance before analyzers to detect project context and auto-apply smart exclusions.
- After synthesis, explicitly identify gaps in deterministic tool coverage and backfill where possible.

## Workflow

1. **Establish artifacts directory**
   - Set `@ARTIFACT_ROOT=".enaible/artifacts/analyze-performance/$(date -u +%Y%m%dT%H%M%SZ)"` and create it.
2. **Reconnaissance**
   - Glob for project markers: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`
   - Detect layout: monorepo vs single-project, primary language(s), runtime environment indicators
   - Auto-apply exclusions for generated/vendor directories: `dist/`, `build/`, `node_modules/`, `__pycache__/`, `.next/`, `vendor/`
   - Merge with any user-provided @EXCLUDE patterns
   - Note performance-relevant context: caching infrastructure, async frameworks, database drivers, bundler configs
   - Log applied exclusions for final report
3. **Run automated analyzers**

   - Execute each Enaible command, storing the JSON output:

     ```bash
     enaible analyzers run performance:ruff \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/performance-ruff.json"

     enaible analyzers run performance:frontend \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/performance-frontend.json"

     enaible analyzers run performance:sqlglot \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/performance-sqlglot.json"

     enaible analyzers run performance:semgrep \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/performance-semgrep.json"
     ```

   - Append `--summary` when triaging large repositories; rerun full reports before publishing.
   - Add `--exclude "<glob>"` or refine `--min-severity` to focus on relevant subsystems.
   - If any invocation fails, inspect supported options with `enaible analyzers run --help` before retrying.

4. **Aggregate findings**
   - Parse hotspots across layers: backend N+1 patterns, frontend re-render costs, SQL anti-patterns, lint warnings.
   - Map each issue to system components (API endpoints, React routes, migrations, jobs).
5. **Investigate context**
   - Inspect flagged areas for caching gaps, over-fetching, synchronous IO, or configuration constraints.
   - Consider infrastructure contributors (rate limits, autoscaling thresholds, memory footprints).
6. **Prioritize remediations**
   - Group issues by impact (critical, high, medium) and outline validation experiments (profiling, load tests).
7. **Identify coverage gaps**
   - List what the analyzers checked (static patterns, SQL anti-patterns, frontend re-renders) vs. what they cannot check
   - For each gap category:
     - Algorithmic complexity context: inspect hot paths for O(n²) or worse complexity in context
     - Caching invalidation logic: review cache keys and TTL strategies for correctness
     - Async coordination patterns: check for race conditions, deadlocks, or unnecessary awaits
   - If inspectable via code reading: perform targeted review, cite evidence
   - If requires runtime/external info: flag as "requires manual verification"
   - Assign confidence: High (tool + LLM agreement), Medium (LLM inference only), Low (couldn't verify)
8. **Produce report**
   - Summarize bottlenecks, attach metric tables, and define success metrics for remediation.

## Output

```md
# RESULT

- Summary: Performance analysis completed for <@TARGET_PATH>.
- Artifacts: `.enaible/artifacts/analyze-performance/<timestamp>/`

## RECONNAISSANCE

- Project type: <monorepo|single-project>
- Primary stack: <languages/frameworks detected>
- Auto-excluded: <patterns applied>

## BOTTLENECKS

| Layer    | Location              | Finding                            | Evidence Source      |
| -------- | --------------------- | ---------------------------------- | -------------------- |
| Backend  | api/orders.py#L142    | N+1 query detected                 | performance:sqlglot  |
| Frontend | src/App.tsx#L88       | Expensive re-render (missing memo) | performance:frontend |
| Database | migrations/202310.sql | Full table scan on large dataset   | performance:sqlglot  |

## RECOMMENDED ACTIONS

1. <High priority optimization with expected impact and verification plan>
2. <Secondary optimization>

## VALIDATION PLAN

- Benchmark: <command or script>
- Success Criteria: <quantitative target>

## GAP ANALYSIS

| Gap Category                   | Status            | Finding                                     | Confidence      |
| ------------------------------ | ----------------- | ------------------------------------------- | --------------- |
| Algorithmic complexity context | Inspected         | <finding>                                   | High/Medium/Low |
| Caching invalidation logic     | Inspected/Flagged | <finding or "requires manual verification"> | High/Medium/Low |
| Async coordination patterns    | Inspected         | <finding>                                   | High/Medium/Low |

## ATTACHMENTS

- performance:ruff → `.enaible/artifacts/analyze-performance/<timestamp>/performance-ruff.json`
- performance:frontend → `.enaible/artifacts/analyze-performance/<timestamp>/performance-frontend.json`
- performance:sqlglot → `.enaible/artifacts/analyze-performance/<timestamp>/performance-sqlglot.json`
- performance:semgrep → `.enaible/artifacts/analyze-performance/<timestamp>/performance-semgrep.json`
```
