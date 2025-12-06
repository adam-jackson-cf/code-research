# get-recent-context v0.2

## Purpose

Analyze recent Codex activity from session logs and git history to understand current work and provide quick orientation for continuing development.

## Variables

### Optional (derived from $ARGUMENTS)

- @UUID = --uuid — filter analysis to a specific session UUID
- @VERBOSE = --verbose — expand truncated content where available
- @SEARCH_TERM = --search-term — search for sessions containing semantically matching content

## Workflow

1.  **Session Log Analysis**

    - Sync Enaible tooling once per checkout and capture Codex sessions with optional UUID/search-term filters:

      ```bash
      uv sync --project tools/enaible

      uv run --project tools/enaible enaible context_capture \
        --platform codex \
        --days 2 \
        ${UUID:+--uuid "@UUID"} \
        ${SEARCH_TERM:+--search-term "@SEARCH_TERM"} \
        --output-format json
      ```

    - Aggregate cross-repo history when required:

      ```bash
      uv run --project tools/enaible enaible context_capture \
        --platform codex \
        --days 2 \
        --include-all-projects \
        --output-format json
      ```

    - Generate semantic variations when @SEARCH_TERM is supplied:

           ```bash
           if [ -n "@SEARCH_TERM" ]; then
               SEMANTIC_VARIATIONS=$(cat <<EOF

      {
      "$(echo "@SEARCH_TERM" | cut -d' ' -f1)": [
      "$(echo "@SEARCH_TERM" | cut -d' ' -f1)s",
      "$(echo "@SEARCH_TERM" | cut -d' ' -f1)ing",
      "$(echo "@SEARCH_TERM" | cut -d' ' -f1)ed"
      ]
      }
      EOF
      )
      else
      SEMANTIC_VARIATIONS=""
      fi

      ```

      ```

    - Parse returned JSON and local session logs (`~/.codex/sessions/**`, `~/.codex/history.jsonl`) to surface prompts, operations, and tooling usage. In @VERBOSE mode expand truncated content and spotlight high-signal entries.

2.  **Git Status Review**

    - Inspect uncommitted work and categorize modifications before mapping them to session insights:

      ```bash
      git status --short
      ```

    - Highlight files intersecting with recent Codex activity.

3.  **Git History Review**

    - Build a timeline of recent work, trace file evolution, and mine intent keywords:

      ```bash
      git log --stat --date=iso --max-count 8
      git log --follow --oneline -20 -- <file>
      git blame -w -C -C -C -- <file>
      git log --grep "\bfix\b" --since="30 days ago"
      git log -S"<pattern>" --oneline
      ```

    - Record architectural shifts, renames, regressions, and follow-up TODOs captured in the history.

4.  **Contributor & Pattern Mapping**

    - Identify ownership and recurring issues:

      ```bash
      git shortlog -sn --since="90 days ago"
      git log --stat --author="<name>" --since="90 days ago"
      ```

    - Combine contributor focus with captured session objectives to pinpoint collaborators, blockers, and repeat failure modes.

5.  **Generate Consolidated Summary**
    - Merge Codex session data, git status, and history into a cohesive narrative.
    - Extract file access frequencies, semantic matches, tool usage patterns, and outstanding risks to guide next actions.
    - Recommend follow-up checks (tests, stakeholders) and spotlight the most active files for onboarding or hand-offs.
    - When @SEARCH_TERM is provided, expand the analysis with domain-aware variations to broaden recall while maintaining chronological order.

## Output Format

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

## Git History (Last 3 Commits)

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
