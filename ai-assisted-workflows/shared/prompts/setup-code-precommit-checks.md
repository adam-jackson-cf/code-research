# Purpose

Establish pre-commit hooks so git rejects commits that violate the project's language and tooling standards.

## Variables

### Required

- (none)

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)

### Derived (internal)

- (none)

## Instructions

- NEVER overwrite an existing `.pre-commit-config.yaml`; exit immediately if one is detected.
- ALWAYS confirm you are inside a git repository before attempting hook setup.
- Detect the active language stack; do NOT assume JavaScript or Python by default.
- Match hook selections to the detected stack; only include tools that exist in the project.
- Record the installation approach used (`pip`, `pipx`, `brew`, etc.) in the final summary.
- Respect STOP confirmations unless @AUTO is provided; when auto is active, treat checkpoints as approved without altering other behavior.

## Workflow

1. Validate prerequisites
   - Run `git rev-parse --is-inside-work-tree`; exit immediately if this is not a git repository.
   - If `.pre-commit-config.yaml` already exists, emit a completion notice and stop.
2. Inspect repository tooling
   - Detect package managers, lock files, and linters to infer the language stack.
   - Choose hook templates: use the TypeScript/JavaScript or Python baseline snippets when they match the detected stack; trim or augment hooks as needed.
3. Ensure `pre-commit` is installed
   - Prefer existing global/local installations (`pre-commit --version`).
   - If missing, install via the first available option: `pipx install pre-commit`, `pip install pre-commit`, or `brew install pre-commit`.
   - Capture the installation method for the final report.
4. Generate `.pre-commit-config.yaml`
   - Populate the file with repositories and hooks tailored to the project (e.g., Prettier + ESLint for TypeScript, Black + Ruff + Mypy for Python).
   - Preserve YAML ordering and include only necessary hooks; no placeholders.
   - ALWAYS include a local `stage-fixes` hook after all formatting hooks (Black, Ruff, Prettier, pyupgrade, etc.) that automatically stages modified files using `git add -u`. This ensures auto-fixes are included in commits and prevents CI failures where CI runs linters without `--fix`. Configure it as: `repo: local`, `id: stage-fixes`, `entry: bash -c 'git add -u'`, `language: system`, `pass_filenames: false`, `always_run: true`, `stages: [pre-commit]`.
5. Register git hooks
   - Run `pre-commit install`.
   - When supported by the project, also enable `pre-commit install --hook-type commit-msg`.
6. Smoke-test the configuration
   - Execute `pre-commit run --all-files`; collect failures and recommend fixes.
7. Produce results
   - Summarize configured repositories, hooks, and the installation method.
   - Provide next steps when any hooks failed during the smoke test.

## Output

```md
# RESULT

- Summary: Pre-commit hook suite installed and validated.

## DETAILS

- Config: .pre-commit-config.yaml (language stack: <detected stack>)
- Hooks Installed: <comma-separated hook ids>
- Installation Method: <pip|pipx|brew|pre-existing>
- Validation: <pass|fail> (attach failing hook names if any)
```
