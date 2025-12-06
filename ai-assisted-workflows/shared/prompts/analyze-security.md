# Purpose

Execute a comprehensive security assessment that blends automated OWASP-aligned scanning with contextual gap analysis, risk prioritization, and actionable remediation tasks.

## Variables

### Required

- @TARGET_PATH = $1 — path to analyze; defaults to repo root

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @VERBOSE = --verbose — enable verbose analyzer logging
- @MIN_SEVERITY = --min-severity — defaults to "high"; accepts critical|high|medium|low
- @EXCLUDE = --exclude [repeatable] — additional glob patterns to exclude (e.g., terraform/.generated/\*\*)

### Derived (internal)

- @ARTIFACT_ROOT = <derived> — artifacts directory used in workflow examples

## Instructions

- ALWAYS execute automated analyzers first; abort the workflow if any analyzer returns a non-zero exit code.
- Enforce every STOP confirmation (`Automated`, `Gap Assessment`, `Risk Prioritization`, `Todo Transfer`).
- Respect STOP confirmations unless @AUTO is provided; when auto is active, treat checkpoints as approved without altering other behavior.
- Map findings to OWASP Top 10 categories, business impact, and exploitability.
- Store raw analyzer JSON, command transcripts, and severity scoring inside `.enaible/artifacts/` so evidence is immutable.
- When @VERBOSE is provided, include exhaustive vulnerability details, gap tables, and remediation notes.
- Run reconnaissance before analyzers to detect project context and auto-apply smart exclusions.
- After synthesis, explicitly identify gaps in deterministic tool coverage and backfill where possible.

## Workflow

1. **Establish artifacts directory**
   - Set `@ARTIFACT_ROOT=".enaible/artifacts/analyze-security/$(date -u +%Y%m%dT%H%M%SZ)"` and create it.
2. **Reconnaissance**
   - Glob for project markers: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`
   - Detect layout: monorepo vs single-project, primary language(s), auth framework indicators
   - Auto-apply exclusions for generated/vendor directories: `dist/`, `build/`, `node_modules/`, `__pycache__/`, `.next/`, `vendor/`
   - Merge with any user-provided @EXCLUDE patterns
   - Note security-relevant context: auth libraries, secrets management tools, infrastructure-as-code configs
   - Log applied exclusions for final report
3. **Run automated analyzers**

   - Execute each Enaible command, storing the JSON output:

     ```bash
     enaible analyzers run security:semgrep --target "@TARGET_PATH" --out "@ARTIFACT_ROOT/semgrep.json"
     enaible analyzers run security:detect_secrets --target "@TARGET_PATH" --out "@ARTIFACT_ROOT/detect-secrets.json"
     ```

     - Pass `--summary` to generate quick overviews when triaging large reports.
     - Add `--verbose` when @VERBOSE is provided to capture analyzer-specific debugging output.
     - Add `--exclude "<glob>"` or tune `--min-severity` when focusing on specific systems or risk levels.
     - If an invocation fails, inspect supported options with `enaible analyzers run --help` before retrying.

   - Normalize analyzer metadata into a working table (id, severity, location, source analyzer, notes).
   - **STOP (skip when @AUTO):** “Automated security analysis complete. Proceed with gap assessment? (y/n)”
     - When @AUTO is present, continue immediately and record internally that the confirmation was auto-applied.

4. **Phase 2 — Gap Assessment & Contextual Analysis**
   - List what the analyzers checked (code patterns, hardcoded secrets) vs. what they cannot check
   - Compare analyzer coverage versus OWASP Top 10 and stack-specific concerns.
   - Perform targeted manual review for auth, configuration, secrets management, supply chain, and data flow gaps.
   - For each gap category:
     - Business logic authorization: inspect permission checks and role-based access
     - Implicit trust boundaries: review service-to-service auth and internal API security
     - Data flow assumptions: trace sensitive data through the system
   - If inspectable via code reading: perform targeted review, cite evidence
   - If requires runtime/external info: flag as "requires manual verification"
   - Assign confidence: High (tool + LLM agreement), Medium (LLM inference only), Low (couldn't verify)
   - Document technology-specific validations (e.g., Django CSRF, React XSS mitigations, Express headers, Terraform security controls).
   - Capture contextual notes in `@ARTIFACT_ROOT/gap-analysis.md`.
   - **STOP (skip when @AUTO):** "Gap assessment and contextual analysis complete. Proceed with risk prioritization? (y/n)"
     - When @AUTO is present, continue immediately and record internally that the confirmation was auto-applied.
5. **Phase 3 — Risk Prioritization & Reporting**
   - Merge automated findings with contextual insights.
   - Assign impact \* likelihood scoring to derive Critical/High/Medium/Low grading.
   - Build a remediation roadmap with milestone-based sequencing (Phase 1 critical fixes, Phase 2 high priorities, Phase 3 hardening tasks).
   - Snapshot risk posture in `@ARTIFACT_ROOT/risk-summary.md`.
   - **STOP (skip when @AUTO):** "Security analysis complete and validated. Transfer findings to todos.md? (y/n)"
     - When @AUTO is present, continue immediately and record internally that the confirmation was auto-applied.
6. **Phase 4 — Quality Validation & Task Transfer**
   - Confirm the following before closure:
     - OWASP Top 10 categories reviewed with supporting evidence.
     - Analyzer outputs parsed and cross-referenced.
     - Technology-specific controls inspected.
     - Business logic risks evaluated with decision-makers.
   - When approved (and @AUTO is not set), append actionable remediation tasks to `todos.md` using the roadmap structure. In auto mode, collect tasks in the output summary for manual triage.
   - Note whether the transfer happened or was deferred, including owner acknowledgements and follow-up triggers.

## Output

```md
# RESULT

- Summary: Security analysis completed for <@TARGET_PATH> on <date/time>.
- Artifacts: `.enaible/artifacts/analyze-security/<timestamp>/`

## RECONNAISSANCE

- Project type: <monorepo|single-project>
- Primary stack: <languages/frameworks detected>
- Auto-excluded: <patterns applied>

## FINDINGS

| Severity | OWASP Category           | Location / Asset                | Description                          | Evidence Source         |
| -------- | ------------------------ | ------------------------------- | ------------------------------------ | ----------------------- |
| CRITICAL | A01: Injection           | services/api/user.py#L120       | Unsanitized SQL string concatenation | security:semgrep        |
| HIGH     | A02: Cryptographic Fail. | config/settings.py#L45          | Hardcoded API key                    | security:detect_secrets |
| MEDIUM   | A05: SSRF                | infra/terraform/modules/network | Missing egress restrictions          | Gap assessment          |

## RISK SUMMARY

- Scorecard: <overall risk score or narrative>
- Blocking Issues: <list of critical/high items>
- Recommended Timeline: <immediate / short-term / long-term>

## GAP ANALYSIS

| Gap Category                 | Status            | Finding                                     | Confidence      |
| ---------------------------- | ----------------- | ------------------------------------------- | --------------- |
| Business logic authorization | Inspected         | <finding>                                   | High/Medium/Low |
| Implicit trust boundaries    | Inspected/Flagged | <finding or "requires manual verification"> | High/Medium/Low |
| Data flow assumptions        | Inspected         | <finding>                                   | High/Medium/Low |

## REMEDIATION ROADMAP

### Phase 1: Critical Security Issues

- [ ] <Task with owner and file path>

### Phase 2: High Priority Security Issues

- [ ] <Task>

### Phase 3: Security Hardening

- [ ] <Task>

## ATTACHMENTS

- security:semgrep → `.enaible/artifacts/analyze-security/<timestamp>/semgrep.json`
- security:detect_secrets → `.enaible/artifacts/analyze-security/<timestamp>/detect-secrets.json`
- Gap Analysis Notes → `.enaible/artifacts/analyze-security/<timestamp>/gap-analysis.md`
```
