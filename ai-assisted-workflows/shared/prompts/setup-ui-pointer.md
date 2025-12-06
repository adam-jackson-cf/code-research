# setup-ui-pointer v0.1

## Purpose

Install and configure react-grab to enable ⌘-click element capture for AI-assisted development workflows.

## Variables

### Required

- (none)

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @ENTRY_POINT = --entry-point — specify React app entry file (default: auto-detect)

### Derived (internal)

- @DETECTED_ENTRY = <path> — auto-detected entry point (main.tsx, App.tsx, index.tsx)
- @IMPORT_GUARD = <code> — development-only import guard pattern
- @SYSTEMS = <filename> — system instructions file (CLAUDE.md or AGENTS.md depending on target)

## Instructions

- ALWAYS validate this is a React project before proceeding.
- NEVER install react-grab in non-React projects.
- ALWAYS use development-only import guard to prevent production bundle bloat.
- Prefer Bun package manager; fall back to npm/yarn if Bun unavailable.
- Locate entry point automatically; only prompt if detection fails.
- Respect STOP confirmations unless @AUTO is provided.

## Workflow

1. Validate React project
   - Check for React dependency in package.json: `grep -q '"react"' package.json`
   - If not found, exit immediately with error message.
2. Check existing installation
   - Search package.json for `react-grab` in dependencies or devDependencies
   - If already installed, confirm version and skip to configuration step.
3. Install react-grab
   - **STOP (skip when @AUTO):** "Install react-grab as dev dependency? (y/n)"
   - Install via Bun: `bun add react-grab` (preferred)
   - If Bun unavailable, fall back: `npm install --save-dev react-grab` or `yarn add -D react-grab`
   - Verify installation succeeded by checking package.json.
4. Locate app entry point
   - If @ENTRY_POINT provided, use that path
   - Otherwise, search for common entry files in order:
     - `src/main.tsx`
     - `src/index.tsx`
     - `src/App.tsx`
     - `app/main.tsx`
     - `app/index.tsx`
   - If multiple candidates found, **STOP (skip when @AUTO):** "Multiple entry points found. Select: <list>"
   - If none found, **STOP (skip when @AUTO):** "Could not auto-detect entry point. Provide path:"
5. Add development-only import
   - Read the detected/specified entry file
   - Check if react-grab import already exists; skip if present
   - Add import at top of file after existing imports:
     ```typescript
     // React Grab - AI-assisted element inspection (dev only)
     if (import.meta.env.DEV) {
       import("react-grab")
     }
     ```
   - **STOP (skip when @AUTO):** "Add react-grab import to @DETECTED_ENTRY? (y/n)"
   - Write updated file
6. Validate setup
   - Verify react-grab appears in package.json devDependencies
   - Verify import exists in entry point file
   - Check import guard uses `import.meta.env.DEV` pattern
   - Provide instructions to test: run dev server and ⌘-click any element

## Output

```md
# RESULT

- Summary: React Grab installed and configured for @DETECTED_ENTRY

## DETAILS

- Package: react-grab (installed via <bun|npm|yarn>)
- Entry Point: @DETECTED_ENTRY
- Import Guard: ✓ Development-only (import.meta.env.DEV)
- Documentation: @SYSTEMS.md updated

## VALIDATION

- Installation: ✓ Found in package.json devDependencies
- Configuration: ✓ Import added to @DETECTED_ENTRY
- Import Guard: ✓ Wrapped in DEV check

## NEXT STEPS

1. Start your development server
2. Hold ⌘ (Command) and click any element in your React app
3. Component context will be copied to clipboard
4. Paste into Claude Code for AI-assisted development
```
