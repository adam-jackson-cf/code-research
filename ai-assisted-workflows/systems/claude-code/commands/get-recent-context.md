---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(ls:*), Read, Glob
argument-hint: [--uuid] [--verbose] [--search-term]
description: Summarize recent context from git history and edited files
---

# get-recent-context v0.1

## Purpose

Analyze recent activity from context bundles and git history to understand current work and provide quick orientation for continuing development.

## Variables

### Optional (derived from $ARGUMENTS)

- @UUID = --uuid — filter analysis to a specific session UUID
- @VERBOSE = --verbose — expand truncated content where available
- @SEARCH_TERM = --search-term — search for semantically matching sessions

## Workflow

1. **Context Bundle Analysis**

   - Sync dependencies once per checkout to keep the Enaible tooling aligned with the repo:

     ```bash
     uv sync --project tools/enaible
     ```

   - Capture Claude activity with the Enaible CLI while honoring optional UUID and search-term filters:

     ```bash
     uv run --project tools/enaible enaible context_capture \
       --platform claude \
       --days 2 \
       ${UUID:+--uuid "&UUID"} \
       ${SEARCH_TERM:+--search-term "@SEARCH_TERM"} \
       --output-format json
     ```

   - Gather cross-repo history when needed:

     ```bash
     uv run --project tools/enaible enaible context_capture \
       --platform claude \
       --days 2 \
       --include-all-projects \
       --output-format json
     ```

   - Expand semantic coverage whenever `@SEARCH_TERM` is present:

     ```bash
     if [ -n "$SEARCH_TERM" ]; then
         SEMANTIC_VARIATIONS=$(cat <<EOF
        {
            "$(echo "$SEARCH_TERM" | cut -d' ' -f1)": [
                "$(echo "$SEARCH_TERM" | cut -d' ' -f1)s",
                "$(echo "$SEARCH_TERM" | cut -d' ' -f1)ing",
                "$(echo "$SEARCH_TERM" | cut -d' ' -f1)ed"
            ]
        }
        EOF
        )
     else
         SEMANTIC_VARIATIONS=""
     fi
     ```

   - Parse returned JSON to filter by UUID, surface semantic matches, and build compact summaries (sessions, prompts, operations). In `@VERBOSE` mode expand truncated content and include high-signal assistant replies.

2. **Git Status Review**

   - Inspect uncommitted work and note change types before correlating with context bundles:

     ```bash
     git status --short
     ```

   - Highlight files aligning with recent sessions and capture emerging hot spots.

3. **Git History Review**

   - Build a timeline of recent work, track file evolution, and mine intent keywords:

     ```bash
     git log --stat --date=iso --max-count 8
     git log --follow --oneline -20 -- <file>
     git blame -w -C -C -C -- <file>
     git log --grep "\bfix\b" --since="30 days ago"
     git log -S"<pattern>" --oneline
     ```

   - Record architectural shifts, renames, regressions, and follow-up TODOs uncovered by these commands.

4. **Contributor & Pattern Mapping**

   - Map ownership and recurring issues:

     ```bash
     git shortlog -sn --since="90 days ago"
     git log --stat --author="<name>" --since="90 days ago"
     ```

   - Connect contributor focus areas with session objectives to identify partners, blockers, and repeated failure modes.

5. **Generate Consolidated Summary**
   - Merge findings from context bundles, git status, and history into a cohesive narrative.
   - Extract file access frequencies, semantic search matches, command usage patterns, and outstanding risks to guide next actions.
   - Recommend follow-up checks (tests, stakeholders) and spotlight the most active files for hand-offs or onboarding.
   - When `@SEARCH_TERM` is provided, expand the analysis with domain-aware variations (synonyms, verb forms, related technologies) to broaden recall while maintaining chronological order.

## Output

```markdown
# Recent Activity Summary

## Context Bundles Analysis

- **Sessions Found**: [count] sessions
- **Date Range**: [earliest timestamp] to [latest timestamp]
- **Filter**: [All recent sessions | UUID: {uuid} | Search: {term}]
- **Mode**: [Concise summaries | Verbose with full content]

### File Operations Summary

- **Most Accessed**:
  - `[file_path]` (read, edit, write operations)
  - `[file_path]` (read operations only)
- **Recent Edits**: [list of files modified via Write/Edit operations]
- **Files Read**: [list of files accessed via Read operations]
- **Search Results**: [sessions matching search criteria]

### Session Patterns

- **Common Workflows**: [identified patterns in operation sequences]
- **User Objectives**: [summary of goals extracted from prompts]

_Timeline of File Evolution_

1. `[date]` — `[hash]` `[commit message]` (Authored by [author])
   - **Scope**: [files / modules]
   - **Intent**: [feature, fix, refactor, etc.]
   - **Notes**: [renames, follow-up TODOs, regressions addressed]

[Repeat for meaningful hops]

_Key Contributors & Domains_

- **[Contributor]**: [primary areas touched, sample commits, expertise inference]
- **[Contributor]**: [primary areas touched, sample commits, expertise inference]

_Historical Issues & Fixes_

- **Pattern**: `[keyword or failure mode]`
  - **Introduced**: `[commit hash/date]`
  - **Fix / Mitigation**: `[commit hash/date]`
  - **Outstanding Risks**: [notes]

_Change Patterns_

- **File / Component**: [summary of change cadence, rewrite moments, churn indicators]
- **Pattern Searches**: [results from `git log --grep` or `-S` calls]

## Git Status (Uncommitted Work)

- **Files Changed**: [count] ([additions/deletions])
- **Hot Spots**: [directories/components with noteworthy deltas]

## Consolidated Analysis

- **Current Development Focus**: [link context bundles ↔ git history ↔ status]
- **Most Active Files**: [list with reasoning]
- **Recommended Next Checks**: [tests, follow-ups, stakeholders]
```

## Usage Examples

```bash
# Get recent activity summary (default: concise summaries for last 2 days)
/todo-recent-context

# Analyze specific session with concise summaries
/todo-recent-context --uuid a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Get detailed analysis with full conversation content
/todo-recent-context --verbose

# Analyze specific session with full detail
/todo-recent-context --uuid a1b2c3d4-e5f6-7890-abcd-ef1234567890 --verbose

# Search for sessions with semantic matching
/todo-recent-context --search-term "authentication bug"

# Search within specific session
/todo-recent-context --uuid a1b2c3d4-e5f6-7890-abcd-ef1234567890 --search-term "refactor"

# Enhanced semantic search with LLM-generated variations
# When searching for "authentication", the LLM might generate:
{
    "authentication": ["auth", "login", "signin", "authorize", "security", "verify", "authenticate"],
    "bug": ["error", "issue", "problem", "fix", "debug", "repair", "resolve"],
    "performance": ["speed", "fast", "slow", "optimize", "efficiency", "latency"]
}
```
