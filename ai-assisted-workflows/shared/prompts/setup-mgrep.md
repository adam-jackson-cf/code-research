# setup-mgrep v0.1

## Purpose

Install and configure mgrep for natural-language semantic search across code, documents, and images.

## Variables

### Required

- (none)

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @API_KEY = --api-key — use API key instead of browser login (for CI/headless)

### Derived (internal)

- @MGREP_BINARY_PATH = <path> — resolved mgrep binary location
- @PACKAGE_MANAGER = <manager> — detected package manager (bun, npm, or pnpm)

## Instructions

- ALWAYS check for existing mgrep installation before proceeding.
- ALWAYS verify authentication before indexing.
- NEVER store API keys in plain text files; use environment variables.
- Respect STOP confirmations unless @AUTO is provided.

## Workflow

1. Check existing installation
   - Run `command -v mgrep` to check if already installed
   - If found, capture version: `mgrep --version`
   - **STOP (skip when @AUTO):** "mgrep already installed (version <version>). Reinstall/update? (y/n)"
   - If user declines, skip to configuration/documentation steps.
2. Detect package manager
   - Check availability in order: bun → npm → pnpm
   - Run `command -v bun`, `command -v npm`, `command -v pnpm`
   - Store first available as @PACKAGE_MANAGER
   - Default to npm if none detected
3. Install mgrep
   - **STOP (skip when @AUTO):** "Install mgrep via @PACKAGE_MANAGER? (y/n)"
   - Run installation command: `@PACKAGE_MANAGER install -g @mixedbread/mgrep`
   - Verify installation: `mgrep --version`
   - Capture binary path as @MGREP_BINARY_PATH
4. Authenticate
   - If @API_KEY provided:
     - Instruct user to set environment variable: `export MXBAI_API_KEY=@API_KEY`
     - Add to shell config (~/.zshrc, ~/.bashrc) for persistence
   - Else:
     - **STOP (skip when @AUTO):** "Authenticate via browser login? (y/n)"
     - Run: `mgrep login`
     - Browser will open for authentication flow
   - Verify authentication succeeded
5. Initialize indexing
   - **STOP (skip when @AUTO):** "Initialize mgrep indexing for this repository? (y/n)"
   - Run: `mgrep watch` (performs initial scan and sets up file watchers)
   - Index respects .gitignore patterns automatically
   - If additional exclusions needed, create `.mgrepignore` file
6. Update SYSTEMS.md

   - Add or update mgrep documentation section:

     ```md
     ### When you need semantic code search

     If `--semantic` is included in the user's request or a request requires finding code by intent rather than exact patterns, you **must** use mgrep.

     **Single-term/pattern search:** Use Grep tool (no mgrep needed).

     **Available Commands:**

     - `mgrep "<query>" [path]` — Natural language search
     - `mgrep -a "<query>"` — Search with AI-generated answer synthesis
     - `mgrep -c "<query>"` — Include file content in results
     - `mgrep -m <count>` — Limit number of results (default: 10)
     - `mgrep watch` — Update index (run after major file changes)
     ```

7. Validate setup
   - Verify binary accessible: `mgrep --version`
   - Test search with sample query: `mgrep "test" .`
   - Confirm results returned successfully
   - Provide usage instructions and next steps

## Output

```md
# RESULT

- Summary: mgrep installed and configured for semantic code search

## DETAILS

- Binary: mgrep @MGREP_BINARY_PATH (version: <version>)
- Package Manager: @PACKAGE_MANAGER
- Authentication: <browser|api-key>
- Documentation: SYSTEMS.md updated

## VALIDATION

- mgrep binary: ✓ Installed and accessible
- Authentication: ✓ Logged in
- Index: ✓ Repository indexed

## NEXT STEPS

1. Test semantic search: `mgrep "find authentication logic" .`
2. Get AI-synthesized answer: `mgrep -a "how does error handling work" .`
3. Update index after changes: `mgrep watch`
```
