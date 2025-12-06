# create-execplan v0.2

**Purpose**

- Produce a complete execution plan for @USER_PROMPT, using supplied artifacts (spec, inspect report) and asking clarifying questions where there is missing information, contradictions or unclear information. You do not carry out additional research—you work with what you are supplied and what you ask the user.

## Variables

### Required

- @USER_PROMPT = $1 — execution brief

### Optional (derived from $ARGUMENTS)

- @ARTIFACT = --artifact [repeatable] — context files or URLs (e.g., spec, inspect report)
- @OUT = --out — write the final ExecPlan to this path (default ./)

## Instructions

- Read artifacts first (spec, then inspect); extract objectives, constraints, stack details, file references.
- Incorporate global rules (coding standards, quality gates, design principles).
- Do not browse the web. If information is missing or unclear, ask the user for clarification and proceed only with user-provided artifacts and answers.
- Form a recommended solution and devise the plan.
- Output only the final ExecPlan—no preamble—using the canonical template. Write to @OUT and echo the same Markdown to stdout.

## Workflow

1. **Collect Inputs**

   - Load every artifact (spec first, then inspect reports) and capture objectives, constraints, target files, development approach and success criteria summaries.

2. **Clarify Problem Space**

   - The feature, fix, or system requirement driving the work.
   - Document known pain points, limitations, and motivating context.

3. **Clarify Technical Constraints**

   - Mandated stacks, platforms, infrastructure, and integration requirements.
   - Note compliance, security, or regulatory obligations.
   - Record relevant team skill sets or technology preferences.

4. **Clarify Development Approach**

   - Global/project coding and behavior rules explicitly referenced in the artifacts.
   - Document tech stack, implementation patterns and solution design

5. **Emit Plan**
   - Render the ExecPlan using the canonical deterministic template (see Output), write it to @OUT, and echo the same Markdown to stdout without preamble.

## Output

```markdown
# ExecPlan: <Short, action-oriented title>

- Status: <Proposed|In Progress|Blocked|Complete>
- Repo/Branch: `<owner>/<repo>` • `<branch>`
- Scope: <feature/bug/ops> • Priority: <P0–P3>
- Start: <YYYY-MM-DD> • Last Updated: <ISO8601 UTC>
- Links: <issue/PR/runbook/design/PRD>

## Purpose / Big Picture

<Explain user-visible outcome and business value.>

## Success Criteria / Acceptance Tests

- [ ] <Deterministic check 1>
- [ ] <Deterministic check 2>
- Non-Goals: <explicit exclusions>

## Tech stack

- **Languages**: [e.g., TypeScript, Python, Rust]
- **Frameworks**: [e.g., React, FastAPI, Actix]
- **Build Tools**: [e.g., Webpack, Poetry, Cargo]
- **Package Managers**: [e.g., npm, pip, cargo]
- **Testing**: [e.g., Jest, pytest, cargo test]

## Constraints

- <contraint1>
- <contraint2>
- <contraint3>
- ...

## Development approach

- <rule1>
- <rule2>
- <rule3>
- ...

## Context & Orientation

- Code: `path/to/file:line`, `path/to/module`
- Data/Contracts: <APIs, schemas, events>
- Constraints/Assumptions: <performance, security, platform>

## High level Phase Plan

- Phase 1: <name> — <objective>
- Phase 2: <name> — <objective>
- Phase 3: <name> — <objective>

## Detailed Phase Task Steps

- Keep progress updated at the start and end of every task entry.
- Build a task table with columns `Status | Phase # | Task # | Task Type | Description` and populate it with project-specific actions.
- Document your Status and Task Type keys adjacent to the table (e.g., `@ = in progress`, `X = complete`, `Code`, `Read`, `Action`, `Test`, `Gate`, `Human`).
- Ensure file references include filenames plus starting line numbers (e.g., `AGENTS.md:103`) and align phase numbering with the High Level Phase Plan.
- Progress tracking policy: the task table is the primary progress tracker; use the "Progress Per Session" section for brief journal entries; do not add other progress sections.

## Progress Per Session (Running Summary Log)

- (YYYY-MM-DDThh:mmZ) <status note>

## Surprises & Discoveries

- Observation: <what> • Evidence: `<path/log>`

## Decision Log

- Decision: <what>
  Rationale: <why>
  Date/Author: <YYYY-MM-DD • name>

## Risks & Mitigations

- Risk: <impact • likelihood> • Mitigation: <plan/owner/trigger>

## Dependencies

- Upstream/Downstream: <services, libraries, teams>
- External Events: <releases, approvals>

## Security / Privacy / Compliance

- Data touched: <PII/none>
- Secrets: <none | how managed>
- Checks: <security linters/tests>

## Observability (Optional)

- Metrics: <names, targets>
- Logs/Traces: <keys, sampling>
- Feature Flags/Experiments: <keys, rollout plan>

## Test Plan

- Unit: <scope>
- Integration/E2E: <scope>
- Performance/Accessibility: <budget>
- How to run: `<commands>`

### Quality Gates

| Gate        | Command | Threshold / Expectation |
| ----------- | ------- | ----------------------- |
| Lint        | `<cmd>` | 0 errors                |
| Type        | `<cmd>` | 0 errors                |
| Tests       | `<cmd>` | 100% passing            |
| Duplication | `<cmd>` | ≤ 3%                    |
| Complexity  | `<cmd>` | Max CC ≤ 10             |

## Idempotence & Recovery

- Describe which steps can be safely re-run and provide rollback/retry instructions for any destructive operations. Note any environment clean-up.

## Artifacts & Notes

- Include concise transcripts, diffs, or logs that prove acceptance. Keep examples minimal and reproducible.

## PR & Review

- PR URL: <to be filled>
- PR Number/Status: <number> • <OPEN/APPROVED/MERGED>
- Required Checks: <list> • Last CI run: <status/link>

## Outcomes & Retrospective (on PR acceptance, add a summary review)

- What went well: <bullets>
- What to change next time: <bullets>
- What behaviours/actions should be codified in AGENTS.md: <bullets>
```

## Examples

- `/create-execplan "Add MFA to admin console" --artifact .enaible/2025-10-13-add-mfa/spec/spec.md --artifact .enaible/2025-10-13-add-mfa/inspect/report.md --out .enaible/2025-10-13-add-mfa/plan/execplan.md`
