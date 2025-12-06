# Purpose

Scaffold a new project with the Better-T-Stack CLI using either explicit technology selections or analysis of an existing todos file.

## Variables

### Required

- @PROJECT_NAME = $1 — name of the project to scaffold

### Optional (derived from $ARGUMENTS)

- @PLAN_FILE = --from-plan — path to a todos/plan file when using plan mode
- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)

### Derived (internal)

- @TECH_ARGUMENTS = <config> — additional technology selections parsed from remaining input

## Instructions

- ALWAYS confirm the project name and target directory before running the generator.
- NEVER guess technology mappings; derive them from explicit arguments or todos analysis.
- When analyzing todos, document the detection logic and resulting stack choices.
- Present a full configuration summary and obtain user confirmation prior to execution.
- Respect STOP confirmations unless @AUTO is provided; when auto is active, treat checkpoints as approved without altering other behavior.
- After generation, run the project’s health checks and report outcomes.

## Workflow

1. Parse inputs
   - Extract `PROJECT_NAME`.
   - Detect `--from-plan`; set `MODE` and capture `PLAN_FILE`.
   - Collect remaining arguments into `TECH_ARGUMENTS[]`.
2. Gather requirements
   - If `MODE="plan"`:
     - Read `PLAN_FILE`.
     - Identify technology keywords (React Native, Expo, Zustand, OAuth, WebSocket, etc.).
     - Map findings to Better-T-Stack options.
   - Else `MODE="direct"`:
     - Interpret each tech choice from remaining arguments as a technology or flag; validate against supported sets.
3. Validate environment
   - Ensure Node/NPM/Bun availability as required by the selected stack.
   - Confirm target directory (`./<PROJECT_NAME>`) does not already exist.
4. Present proposed configuration
   - Build the command:
     ```
     bun create better-t-stack@latest <PROJECT_NAME> <mapped-flags>
     ```
   - Display a table of components (Frontend, Backend, Runtime, Database, ORM, Auth, Addons) with their mapped values.
   - **STOP (skip when @AUTO):** “Project setup details ready. Proceed with Better-T-Stack initialization? (y/n)”
     - When @AUTO is present, continue immediately and record internally that the confirmation was auto-applied.
5. Execute scaffold
   - Run the composed CLI command.
   - Capture stdout/stderr for reporting.
6. Post-setup actions
   - `cd <PROJECT_NAME>`; install dependencies (`bun install` or tool specified in package.json).
   - Run initial quality gates: `bun run dev` (or equivalent), `bun run check-types`, `bun run build`.
7. Summarize results
   - Provide success/failure status for each command.
   - Record next steps (e.g., configure env vars, initialize git).

## Output

```md
# RESULT

- Summary: Project "<PROJECT_NAME>" scaffolded with Better-T-Stack.

## STACK

| Component | Selection | Source            |
| --------- | --------- | ----------------- |
| Frontend  | <value>   | <direct or todos> |
| Backend   | <value>   | <direct or todos> |
| Runtime   | <value>   | <direct or todos> |
| Database  | <value>   | <direct or todos> |

## COMMANDS RUN

- `bun create better-t-stack@latest ...` → <pass|fail>
- `<install command>` → <pass|fail>
- `<dev command>` → <pass|fail>
- `<type/build checks>` → <pass|fail>

## NEXT STEPS <!-- optional: if no next steps dont output this section to user -->

1. <Action item (e.g., configure environment variables)>
2. <Action item>
```
