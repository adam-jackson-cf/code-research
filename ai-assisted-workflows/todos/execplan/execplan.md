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

- Phase 1:
  - [ ] Project foundation - baseline project setup with confirmed configuration to green status
- Phase 2:
  - [ ] Visual UI/UX - baseline visual design system json defined
  - [ ] Global frontend stack aligned with visual design system
        ...

## Detailed Phase Task Steps

<!--
Guidelines:
- a comprehensive list of every single action to be carried out from start to finish
- File actions should include filename and starting line number like AGENTS.md:103

available status:
"@" - in progress
"X" - complete
" " - outstanding

available types:
- Code, code implementation action write/edit
- Read, reviewing a flie
- Action, a none code or read action like mcp call, bash command, or ,
- Test, creating/editing/running any kind of test
- Gate, quality gate actions - create/edit/run
- Human, a manual action that requires human involvement

Phase numebrs should match high level phase plan

 Progress tracking policy:
 - The table below is the single source of truth for progress (primary tracker).
 - Use the "Progress Per Session" section as a concise journal of sessions (secondary tracker).
 - Do not introduce additional progress sections.
-->

| Status | Phase #                                               | Task # | Task Type | Description                                                                                                                                                                                              |
| ------ | ----------------------------------------------------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X      | 1                                                     | 1      | Action    | Initialize repository: run `git init` at repo root and create initial commit.                                                                                                                            |
| X      | 1                                                     | 2      | Code      | Create .gitignore at `.gitignore:1` with node, bun, python, build artifacts rules.                                                                                                                       |
| @      | 1                                                     | 3      | Code      | Create README.md at `README.md:1` with repo purpose and basic setup steps.                                                                                                                               |
|        | 1                                                     | 4      | Code      | Create package.json at `package.json:1` with project name, license, and scripts: `install`, `lint`, `typecheck`, `test`, `ci-quality-gates`. (Populate scripts for bun usage.)                           |
|        | 1                                                     | 5      | Action    | Install bun dependencies: run `bun install` (record resulting bun.lockb).                                                                                                                                |
|        | 1                                                     | 6      | Read      | Review existing shared tooling and deps: `shared/setup/requirements.txt:1`, `requirements-dev.txt:1`.                                                                                                    |
|        | 2                                                     | 7      | Code      | Add better-t-stack configuration at `better-t-stack.yaml:1` (or `better-t-stack.json:1`) containing chosen presets, project type, and enabled quality gates.                                             |
|        | 2                                                     | 8      | Code      | Create TypeScript baseline: `tsconfig.json:1` with strict settings (`noImplicitAny`, `strictNullChecks`, `noEmit` for typecheck).                                                                        |
|        | 2                                                     | 9      | Code      | Add linter/formatter config: create `.biome.json:1` (or `.eslintrc.json:1`) with rules derived from better-t-stack; ensure max complexity and duplication rules noted.                                   |
|        | 2                                                     | 10     | Read      | Inspect better-t-stack docs or template used: `systems/claude-code/templates/better-t-stack.md:1` (or equivalent) to ensure alignment.                                                                   |
|        | 2                                                     | 11     | Action    | Add standard project folders and placeholders: `src/` (create `src/index.ts:1`), `lib/`, `docs/`. Commit these files.                                                                                    |
|        | 3                                                     | 12     | Code      | Create pyproject.toml at `pyproject.toml:1` including `[tool.pytest.ini_options]` or create `pytest.ini:1` with test path config.                                                                        |
|        | 3                                                     | 13     | Code      | Create minimal test file at `shared/tests/unit/test_hello.py:1` with a single pytest test asserting `True` (hello-world test).                                                                           |
|        | 3                                                     | 14     | Action    | Install Python dev deps (venv optional) and run tests: `PYTHONPATH=shared pytest shared/tests/unit -v`. Record result.                                                                                   |
|        | 3                                                     | 15     | Test      | Add CI-local test script in package.json scripts: `"pytest": "PYTHONPATH=shared pytest shared/tests/unit -v"`.                                                                                           |
|        | 4 - Git pre-commit quality gates (TypeScript-focused) | 16     | Code      | Create hooks directory and enable it: add `.githooks/pre-commit:1` (shebang + commands). Script runs in order: `bun run lint`, `bun run typecheck`, `bun run test --silent` (or only quick smoke tests). |
|        |                                                       | 4      | 17        | Action                                                                                                                                                                                                   | Configure repo to use hooks folder: run `git config core.hooksPath .githooks` (document in README).                                                                                         |
|        |                                                       | 4      | 18        | Gate                                                                                                                                                                                                     | Create lint/type/test gate configs: ensure `biome`/`eslint` config (`.biome.json:1`), `tsconfig.json:1` (type rules), and test command (`package.json:1`) exist and are referenced by hook. |
|        |                                                       | 4      | 19        | Test                                                                                                                                                                                                     | Locally validate pre-commit: stage a TypeScript change and run `.githooks/pre-commit` manually; fix failures until it passes.                                                               |
|        |                                                       | 4      | 20        | Human                                                                                                                                                                                                    | Assign owner(s) to maintain pre-commit hooks and quality gate scripts (document in README).                                                                                                 |

## Progress Per Session (Running Summary Log)

- (YYYY-MM-DDThh:mmZ) Plan created; awaiting build.

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

## Idempotence & Recovery

- Describe which steps can be safely re-run without side effects and how to make them idempotent (e.g., guarded migrations, existence checks, reversible scripts).
- Provide explicit rollback or retry guidance for any potentially destructive operation.
- Note any environment clean-up required after completion.

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

## Artifacts & Notes

- Capture short, focused evidence that proves success: key command transcripts, minimal diffs, or logs relevant to acceptance.
- Keep examples concise; prefer links to file paths and exact commands the reader can re-run.

## PR & Review

- PR URL: <to be filled>
- PR Number/Status: <number> • <OPEN/APPROVED/MERGED>
- Required Checks: <list> • Last CI run: <status/link>

## Outcomes & Retrospective (on PR acceptance, add a summary review)

- What went well: <bullets>
- What to change next time: <bullets>
- What behaviours/actions should be codified in AGENTS.md: <bullets>
