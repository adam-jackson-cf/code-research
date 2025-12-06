# setup-task-lists v0.3

## Purpose

Install and configure Beads (bd) for git-backed persistent task tracking.

## Variables

### Required

- (none)

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)

### Derived (internal)

- @BD_BINARY_PATH = <path> — resolved bd binary location

## Instructions

- ALWAYS verify this is a git repository before proceeding.
- NEVER skip git integration prompts during `bd init` without user consent.
- ALWAYS add `.beads/` to `.gitignore` to prevent committing task database.
- Respect STOP confirmations unless @AUTO is provided.

## Workflow

1. Validate prerequisites
   - Run `git rev-parse --is-inside-work-tree`; exit immediately if not a git repository.
   - Check if `bd` binary already installed: `command -v bd`
   - If found, capture version and skip installation step.
2. Install bd binary
   - **STOP (skip when @AUTO):** "Install Beads (bd) binary? (y/n)"
   - Attempt Homebrew installation (macOS/Linux): `brew install steveyegge/beads/bd`
   - If Homebrew unavailable or installation fails, provide manual download instructions:
     - Visit https://github.com/steveyegge/beads/releases
     - Download appropriate binary for platform
     - Move to `~/.local/bin` or `/usr/local/bin`
     - Make executable: `chmod +x <path>/bd`
   - Verify installation: `bd --version`
3. Initialize Beads in project
   - **STOP (skip when @AUTO):** "Run 'bd init' to create .beads/ directory? (y/n)"
   - Run `bd init` (will prompt for git hooks and merge drivers)
   - During init, user will be prompted to configure git integration (hooks, merge driver)
   - Capture initialization output for validation
4. Configure .gitignore
   - Check if `.gitignore` exists; create if missing
   - Search for `.beads/` entry: `grep -q '^\\.beads/' .gitignore`
   - If not found, **STOP (skip when @AUTO):** "Add .beads/ to .gitignore? (y/n)"
   - Append `.beads/` to `.gitignore`
5. Update SYSTEMS.md

   - Add or update Beads documentation section:

     ```md
     ### When you need to track tasks across sessions

     If `--tasks` is included in the users request or a request requires persistent task tracking beyond the current session, you **must** use Beads (bd).

     **Single-session tasks:** Use TodoWrite only (no bd needed).

     **Available Commands:**

     - `bd ready` — List active tasks at session start
     - `bd create "<title>"` — Create a new tracked task (returns ID)
     - `bd show <id>` — View task details
     - `bd close <id>` — Mark task complete
     - `bd list --label <name>` — Filter tasks by label
     ```

6. Validate setup
   - Verify bd binary accessible: `bd --version`
   - Check `.beads/` directory exists
   - Verify `.beads/` in `.gitignore`
   - Run `bd list` to confirm database initialized
   - Provide instructions to test: create a task with `bd create "Test task"`, then run `bd ready`

## Output

```md
# RESULT

- Summary: Beads (bd) installed and configured for persistent task tracking

## DETAILS

- Binary: bd @BD_BINARY_PATH (version: <version>)
- Database: .beads/ (added to .gitignore)
- Documentation: SYSTEMS.md updated

## VALIDATION

- bd binary: ✓ Installed and accessible
- .beads/ directory: ✓ Created
- .gitignore: ✓ Contains .beads/

## NEXT STEPS

1. Create a test task: `bd create "Test Beads integration"`
2. View ready tasks: `bd ready`
3. Close the test task: `bd close <id>`
```
