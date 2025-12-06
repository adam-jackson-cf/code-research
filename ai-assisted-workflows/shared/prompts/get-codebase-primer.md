# get-primer v0.3

## Purpose

Generate a comprehensive project primer covering purpose, architecture, tech stack, commands, and testing practices.

## Variables

### Required

- (none)

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @TARGET_PATH = --target-path — path to analyze; defaults to the project

### Derived (internal)

- (none)

## Instructions

- Read all relevant docs (CLAUDE.md, AGENTS.md, README variants) before synthesizing conclusions.
- Capture findings for purpose, features, tech stack, architecture, commands, and testing.
- Summaries must be concise yet comprehensive, referencing concrete files and directories.
- Include recent git history insights to surface active development themes.
- Respect STOP confirmations unless @AUTO is provided; when auto is active, treat checkpoints as approved without altering other behavior.

## Workflow

1. **Deep Analysis** (LLM + file-driven)

Analyse the following aspects of the target codebase:

- Architecture & Orchestration
- Backend Patterns & Practices
- Frontend Patterns & Practices
- Data & State
- Performance & Security
- Observability
- Quality gates and Testing Practices
- Identify entry points, apps/services, CLIs, servers, and routing surfaces.
- Locate key configurations and framework signals
- Documentation, Global rules files and configs

2. **Git history review**

   - Run `git status`, `git log --since="30 days ago"`, and `git shortlog -sn --since="30 days ago"` (adjust window when @TARGET_PATH differs).
   - Capture recent themes, active contributors, and churn hotspots for inclusion in the primer.

3. **Generate Project Primer**
   - Compile findings into standardized markdown format.
   - Present comprehensive project overview.

## Output

````markdown
# Project: [Name]

[Concise description of what this project is and does]

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

## Backend Patterns and Practices to follow

[Description for how to implement backend, database and service code in keeping with existing project standards]

## Frontend Patterns and Practices to follow

[Description for how to implement frontend, visual design and user experience approach in keeping with existing project standards]

## Build & Quality Gate Commands

- **Build**: `[command]` - [Description if needed]
- **Test**: `[command]` - [Description if needed]
- **Lint**: `[command]` - [Description if needed]
- **Dev/Run**: `[command]` - [Description if needed]
- **[Other]**: `[command]` - [Description if needed]

## Testing

**Framework**: [Testing framework used]

**Running Tests**:

```bash
[command to run tests]
```

**Creating New Tests**:
[Instructions on where tests go and basic test structure example]

```

```
