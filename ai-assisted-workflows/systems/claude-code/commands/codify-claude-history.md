---
description: "Codify lessons from recent Claude sessions (user/assistant prompts) into personal workflow guidance"
argument-hint: [--uuid] [--search-term] [--days]
allowed-tools: ["Task", "Read", "Write", "Bash", "Grep", "Glob", "LS"]
---

# codify-claude-history v0.1

## Purpose

Derive standards, preferences, ways of working, and approaches from recent Claude session prompts, then propose user-level updates to CLAUDE.md.

## Variables

### Optional (derived from $ARGUMENTS)

- @DAYS = --days — lookback window (default 7)
- @UUID = --uuid — filter to a specific session
- @SEARCH_TERM = --search-term — keyword/phrase filter

## Instructions

- Use the Enaible `context_capture` command (Claude platform) to gather raw history.
- Prefer `sessions[].user_messages` (and `assistant_messages` when present) as the primary signal; treat `operations` as secondary context.
- Focus on standards, preferences, ways_of_working, approaches; ignore tool errors unless they imply a rule.
- Propose user-level changes only; do not edit project files here.

## Workflow

1. **Capture (7-day default)**

   - Collect Claude session history with Enaible and honor optional UUID or search filters:

     ```bash
     uv run --project tools/enaible enaible context_capture \
       --platform claude \
       --days ${DAYS:-7} \
       ${UUID:+--uuid "@UUID"} \
       ${SEARCH_TERM:+--search-term "@SEARCH_TERM"} \
       --output-format json
     ```

   - Focus on `sessions[].user_messages[]`, `sessions[].assistant_messages[]`, and `operations[]` for downstream analysis.

2. **Build Corpus**

   - For each session, order `user_messages` chronologically, append up to two trimmed `assistant_messages`, and record high-signal file paths from `operations`.
   - Chunk content to ~12k tokens per segment while keeping the total corpus ≤ ~200k tokens.

3. **Summarize (Subagent)**

   - Use the Task tool to summarize each chunk into YAML containing `standards`, `preferences`, `ways_of_working`, `approaches`, and `notes` (lists only, no prose or code blocks).

4. **Consolidate & Propose**

   - Merge YAML outputs, rank items by frequency and clarity, and craft a merge-ready proposal for `~/.claude/CLAUDE.md` under “Personal Workflow Habits”.
   - STOP → "Apply to ~/.claude/CLAUDE.md? (y/n)"

5. **Cleanup**

   - Remove temporary artifacts:

     ```bash
     rm -rf .enaible/codify-history || true
     ```

## Output

```md
# RESULT

- Summary: Proposed personal workflow updates derived from Claude history (last ${DAYS:-7} days).

## DETAILS

- What changed: Consolidated lessons (standards, preferences, ways_of_working, approaches)
- Where it changed: proposal to append in `~/.claude/CLAUDE.md`
- How to verify: Review session evidence by session id + timestamps; re-run with different `--days`/`--uuid` if needed
```

## Examples

```bash
/codify-claude-history --days 7
/codify-claude-history --uuid 4c0b21b6-b728-46b8-a0d6-b954dd7485ad
/codify-claude-history --search-term "electron traffic lights"
```
