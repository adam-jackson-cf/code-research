# Purpose

Evaluate system architecture quality by combining automated structural analyzers with contextual review of layering, coupling, and scalability trade-offs.

## Variables

### Required

- @TARGET_PATH = $1 — path to analyze; defaults to repo root

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @MIN_SEVERITY = --min-severity — defaults to "high"; accepts critical|high|medium|low
- @EXCLUDE = --exclude [repeatable] — additional glob patterns to exclude
- @VERBOSE = --verbose — emit extended analyzer metadata and reasoning notes

### Derived (internal)

- @ARTIFACT_ROOT = <derived> — timestamped artifacts directory for architecture evidence

## Instructions

- ALWAYS run Enaible analyzers; do not call analyzer modules directly.
- Persist every analyzer output plus derived notes under @ARTIFACT_ROOT for auditability.
- Tie structural findings to concrete files, modules, or layers before recommending action.
- Highlight architectural decisions (patterns, contracts, boundaries) and verify they align with documented system intents.
- When @VERBOSE is provided, include extended metadata (dependency lists, hop counts, pattern scores) inside the final report.
- Respect STOP confirmations unless @AUTO is provided; when auto is active, treat checkpoints as approved without altering other behavior.
- Run reconnaissance before analyzers to detect project context and auto-apply smart exclusions.
- After synthesis, explicitly identify gaps in deterministic tool coverage and backfill where possible.

## Workflow

1. **Establish artifacts directory**
   - Set `ARTIFACT_ROOT=".enaible/artifacts/analyze-architecture/$(date -u +%Y%m%dT%H%M%SZ)"` and create it.
2. **Reconnaissance**
   - Glob for project markers: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`
   - Detect layout: monorepo vs single-project, primary language(s), framework conventions
   - Auto-apply exclusions for generated/vendor directories: `dist/`, `build/`, `node_modules/`, `__pycache__/`, `.next/`, `vendor/`
   - Merge with any user-provided @EXCLUDE patterns
   - Note architectural patterns to look for based on detected stack (e.g., Rails conventions, Spring layers, React component hierarchy)
   - Log applied exclusions for final report
3. **Run automated analyzers**

   - Execute each Enaible command, storing JSON output beneath @ARTIFACT_ROOT:

     ```bash
     enaible analyzers run architecture:patterns \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/architecture-patterns.json"

     enaible analyzers run architecture:dependency \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/architecture-dependency.json"

     enaible analyzers run architecture:coupling \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/architecture-coupling.json"

     enaible analyzers run architecture:scalability \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/architecture-scalability.json"
     ```

   - Add `--min-severity "@MIN_SEVERITY"`, `--exclude "<glob>"`, or `--summary` as needed to control output size; rerun without `--summary` before final delivery.
   - Document any exclusions in the final report.

4. **Synthesize architecture baseline**
   - Identify the primary domains, layers, shared libraries, and external interfaces referenced by architecture:patterns.
   - Note whether observed patterns (CQRS, hexagonal, micro-frontends) align with project standards.
5. **Dependency & coupling assessment**
   - Highlight modules with excessive in-degree/out-degree, circular dependencies, or boundary violations surfaced by architecture:dependency and architecture:coupling.
   - Map findings to concrete files/services and describe user-visible risk (regression blast radius, deployment friction, scalability constraints).
6. **Scalability evaluation**
   - Review architecture:scalability signals for bottlenecks (synchronous fan-out, global locks, shared state) and capture recommended guardrails or capacity tests.
7. **Identify coverage gaps**
   - List what the analyzers checked (structural patterns, dependency graphs, coupling metrics, scalability signals) vs. what they cannot check
   - For each gap category:
     - Business domain alignment: inspect naming conventions and module boundaries for semantic fit
     - Team ownership boundaries: check for CODEOWNERS or ownership markers
     - Cross-cutting concerns: review logging, auth, and error-handling patterns for consistency
   - If inspectable via code reading: perform targeted review, cite evidence
   - If requires runtime/external info: flag as "requires manual verification"
   - Assign confidence: High (tool + LLM agreement), Medium (LLM inference only), Low (couldn't verify)
8. **Deliver report**
   - Summarize architecture health, list hotspots, and propose remediation with impact/effort guidance.
   - Reference analyzer artifacts directly so stakeholders can inspect raw findings.

## Output

```md
# RESULT

- Summary: Architecture assessment completed for <@TARGET_PATH>.
- Artifacts: `.enaible/artifacts/analyze-architecture/<timestamp>/`

## RECONNAISSANCE

- Project type: <monorepo|single-project>
- Primary stack: <languages/frameworks detected>
- Auto-excluded: <patterns applied>

## ARCHITECTURE OVERVIEW

- Domain Boundaries: <summary>
- Layering & Contracts: <summary>
- Patterns Observed: <summary>

## DEPENDENCY MATRIX (Top Findings)

| Source Module | Target Module | Notes  | Evidence                |
| ------------- | ------------- | ------ | ----------------------- |
| <module>      | <module>      | <desc> | architecture:dependency |

## COUPLING HOTSPOTS

| Component | Finding | Impact | Analyzer              |
| --------- | ------- | ------ | --------------------- |
| <module>  | <desc>  | <risk> | architecture:coupling |

## RISKS & GAPS

1. <Risk with impact + likelihood>
2. <Risk>

## GAP ANALYSIS

| Gap Category              | Status            | Finding                                     | Confidence      |
| ------------------------- | ----------------- | ------------------------------------------- | --------------- |
| Business domain alignment | Inspected         | <finding>                                   | High/Medium/Low |
| Team ownership boundaries | Inspected/Flagged | <finding or "requires manual verification"> | High/Medium/Low |
| Cross-cutting concerns    | Inspected         | <finding>                                   | High/Medium/Low |

## RECOMMENDATIONS

1. <Highest priority architectural remediation>
2. <Follow-on improvement>

## ATTACHMENTS

- architecture:patterns → `.enaible/artifacts/analyze-architecture/<timestamp>/architecture-patterns.json`
- architecture:dependency → `.enaible/artifacts/analyze-architecture/<timestamp>/architecture-dependency.json`
- architecture:coupling → `.enaible/artifacts/analyze-architecture/<timestamp>/architecture-coupling.json`
- architecture:scalability → `.enaible/artifacts/analyze-architecture/<timestamp>/architecture-scalability.json`
```
