# get-feature-primer v0.3

## Purpose

Explore the codebase and produce a feature primer tailored to @USER_PROMPT, covering context, risks, and next actions.

## Variables

### Required

- @USER_PROMPT = $1 — task brief to guide the analysis

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @TARGET_PATH = --target — root to analyze (default .)
- @OUT = --out — write the final Markdown to this path (also print to stdout)
- @DAYS = --days — history window for insights (default 20)
- @EXCLUDE_GLOBS = --exclude [repeatable] — CSV or repeated flags (e.g., node_modules,dist)

## Instructions

- Operate read-only (apart from writing the report). Do not run builds or install tools.
- Use repository commands (`ls`, `rg`, `git`, `sed`, etc.) to gather facts, then summarize findings in clear prose;
- Avoid dumping raw command syntax unless you are showing an illustrative example.
- Format every section for quick scanning: short paragraphs, bullet lists, and tables. Keep guidance concise and documentation-focused.
- When secrets are encountered, note file and nature only—never print the secret.
- Default to the repository root when @TARGET_PATH is not supplied; respect @EXCLUDE_GLOBS for all searches.
- Respect STOP confirmations unless @AUTO is provided; when auto is active, treat checkpoints as approved without altering other behavior.

## Workflow

1. **Scope & Setup**

   - Resolve @TARGET_PATH, record the working directory, and respect @EXCLUDE_GLOBS by deriving EXCLUDE_ARG from `.gitignore` (and `.git/info/exclude` when present).
   - Confirm the command operates read-only except for writing the final report to @OUT.

2. **Deep Analysis (LLM + file-driven)**

   - Dispatch parallel task agents to review how the project supports @USER_PROMPT across:
     - Architecture & Orchestration
     - Backend Patterns & Practices
     - Frontend Patterns & Practices
     - Data & State
     - Performance & Security
     - Observability
     - Quality gates and Testing Practices
     - Entry points, services, CLIs, routing surfaces, configurations, manifests, and framework signals
   - Capture supporting facts with repository commands (`ls`, `rg`, `git`, `sed`, etc.) and convert them into concise documentation-ready notes.

3. **Git History & Pattern Recognition (last @DAYS days)**

   - Run history commands to surface recent themes, key contributors, and churn hotspots:

     ```bash
     git status
     git log --since="${DAYS:-20} days ago"
     git shortlog -sn --since="${DAYS:-20} days ago"
     ```

   - Summarize new features, notable fixes, regressions, and recurring smells that impact the upcoming work.

4. **Synthesis**
   - Populate the provided report template with structured bullets, tables, and short paragraphs tailored to @USER_PROMPT.
   - Keep guidance action-oriented, avoid duplicating file paths, and write the final Markdown to @OUT while echoing the same content to stdout (no prefaces, fences, or tool logs).

## Output

````markdown
# Project: <Name>

---

## Executive Summary

[Concise description of what this project is and does]

- **Current Readiness**: <headline insight>
- **Immediate Gaps**: <headline risk or opportunity>

## Features

- [Key feature 1]
- [Key feature 2]
- [Additional features...]

## Tech Stack

- **Languages**: [e.g., TypeScript, Python, Rust]
- **Frameworks**: [e.g., React, FastAPI, Actix]
- **Build Tools**: [e.g., Webpack, Poetry, Cargo]
- **Package Managers**: [e.g., npm, pip, cargo]
- **Testing**: [e.g., Jest, pytest, cargo test]

## Structure

```markdown
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

[Description of how components interact, main modules, data flow]

### Key Components:

- **[Component]**: [Role and responsibility]
- **[Component]**: [Role and responsibility]

## Backend Patterns and Practices

[Description for how to implement backend, database and service code in keeping with existing project standards]

- <observation1>
- <observation2>
- <...>

## Frontend Patterns and Practices

[Description for how to implement frontend, visual design and user experience approach in keeping with existing project standards]

- <observation1>
- <observation2>
- <...>

## Data & State

[Description for how to implement data persistence]

- <observation1>
- <observation2>
- <...>

## Performance & Security

[Description on performance considerations and security practices adopted]

- <observation1>
- <observation2>
- <...>

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

- Theme or initiative • supporting evidence
- Notable fix/feature • reference

---

## Task Impact Analysis

| File/Area   | Rationale                      |
| ----------- | ------------------------------ |
| `path:line` | <why change impacts this area> |

---

## Risks & Recommendations

| Risk   | Mitigation           |
| ------ | -------------------- |
| <risk> | <recommended action> |

---

## Open Questions

<!-- optional section -->

[Desription of unclear or unfinished implementation]

- <question1>
- <question2>
- <...>

```

```
