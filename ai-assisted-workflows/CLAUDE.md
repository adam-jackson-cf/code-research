# Project: AI-Assisted Workflows

- Review and follow AGENTS.md

## When planning - use Beads (bd) for task tracking

**When to use Beads:**

- Multi-session work that needs to persist beyond current session
- Tracked deliverables the user wants visibility into
- Tasks with dependencies or blockers
- Work that should be discoverable in future sessions

**When NOT to use Beads (just use TodoWrite):**

- Single-session tasks
- Implementation steps within a larger tracked bd task
- Quick fixes or explorations

**Workflow:**

1. At session start: Check `bd ready` for pending tasks
2. When planning multi-session work: `bd create "Task description"` to get ID
3. In TodoWrite: Use `[bd-xxx] Step description` to link steps to bd task
4. On completion: Completed TodoWrite items with bd IDs auto-close via hook

**Commands:** `bd ready`, `bd show <id>`, `bd create "<title>"`, `bd close <id>`, `bd list --label <name>`

## UBS Quick Reference for AI Agents

**Golden Rule:** `ubs --only=<lang> <changed-files>` before every commit. Exit 0 = safe. Exit >0 = fix & re-run.

**Commands:**

```bash
# PREFERRED: Use --only to target specific language (avoids cross-language scanner bugs)
ubs --only=python file.py               # Python files
ubs --only=js file.ts file.js           # TypeScript/JavaScript files
ubs --only=python,js src/               # Multiple languages

# Other options
ubs $(git diff --name-only --cached)    # Staged files — before commit
ubs --ci --fail-on-warning .            # CI mode — before PR
ubs --help                              # Full command reference
ubs sessions --entries 1                # Tail the latest install session log
ubs .                                   # Whole project (slower, may have false errors from unused language modules)
```

**Output Format:**

```
⚠️  Category (N errors)
    file.ts:42:5 – Issue description
    💡 Suggested fix
Exit code: 1
```

Parse: `file:line:col` → location | 💡 → how to fix | Exit 0/1 → pass/fail

**Fix Workflow:**

1. Read finding → category + fix suggestion
2. Navigate `file:line:col` → view context
3. Verify real issue (not false positive)
4. Fix root cause (not symptom)
5. Re-run `ubs <file>` → exit 0
6. Commit

**Speed Critical:** Always use `--only=<lang>` and scope to changed files. `ubs --only=js src/file.ts` (< 1s) vs `ubs .` (30s+). Never full scan for small edits.

**Bug Severity:**

- **Critical** (always fix): Null safety, XSS/injection, async/await, memory leaks
- **Important** (production): Type narrowing, division-by-zero, resource leaks
- **Contextual** (judgment): TODO/FIXME, console logs

**Anti-Patterns:**

- ❌ Ignore findings → ✅ Investigate each
- ❌ Full scan per edit → ✅ Scope to file
- ❌ Fix symptom (`if (x) { x.y }`) → ✅ Root cause (`x?.y`)
