# Purpose

Codify recurring errors, fixes, and user preferences from recent Codex sessions, then propose AGENTS.md updates for approval.

## Variables

### Optional (derived from $ARGUMENTS)

- @DAYS = --days — lookback window (default 7)
- @UUID = --uuid — filter to a specific session
- @SEARCH_TERM = --search-term — keyword/phrase filter

### Derived (internal)

- @MAX_CHARS = 150000 — total character budget across chunks
- @CHUNK_SIZE = 15000 — per-chunk character budget

## Instructions

- Use the `enaible context_capture --platform codex` command; restrict reads to `~/.codex/sessions/**`.
- Honor redaction; never print secrets.
- Enforce budgets: do not exceed `@MAX_CHARS` total or `@CHUNK_SIZE` per chunk.
- Sample head+tail when truncating; keep chronological order.
- Summarize into: standards, preferences, ways_of_working, approaches, notes.
- Compare against project and user rules; flag duplicates, gaps, contradictions.
- Output a merge‑ready proposal; do not auto‑edit files.

## Workflow

1. **Read Rules**

   - Load both project and user guidance to prevent duplicates:
     - `./AGENTS.md`
     - `~/.codex/AGENTS.md`

2. **Capture Session History**

   - Gather Codex sessions within the lookback window, honoring optional filters:

     ```bash
     uv run --project tools/enaible enaible context_capture \
       --platform codex \
       ${DAYS:+--days "@DAYS"} \
       ${UUID:+--uuid "@UUID"} \
       ${SEARCH_TERM:+--search-term "@SEARCH_TERM"} \
       --output-format json
     ```

   - Treat `sessions[].user_messages[]` as primary signal and retain `operations` (tool_output, bash, file_change, turn.\*) for secondary context.

3. **Build Corpus**

   - For each session, order `user_messages` chronologically, append high-signal entries (assistant messages, operations), and chunk to @CHUNK_SIZE until @MAX_CHARS is reached while preserving chronology.

4. **Summarize (Subagent)**

   - Transform each chunk into YAML capturing `standards`, `preferences`, `ways_of_working`, `approaches`, and `notes`; store intermediates under `.enaible/codify-history/`.

5. **Consolidate Findings**

   - Merge YAML outputs, normalize phrasing, rank items by frequency/clarity, and classify them as Always Reinforce, Prevent, Duplicate, or One-off.

6. **Compare Against Existing Rules**

   - Diff the consolidated list with `./AGENTS.md` and `~/.codex/AGENTS.md` to surface overlaps or contradictions.

7. **Cleanup**

   - Remove working artifacts:

     ```bash
     rm -rf .enaible/codify-history || true
     ```

## Output

```md
# RESULT

- Summary: Proposed codified rules from Codex history (last @DAYS days, default 7), compared to AGENTS.md; ready for review.

## DETAILS

- What changed

  - Consolidated standards, preferences, ways_of_working, and approaches (≤ @MAX_CHARS chars).
  - Compared to: ./AGENTS.md, ~/.codex/AGENTS.md.
  - Prepared merge‑ready rule blocks with rationale and evidence.

- Where it changed

  - Proposal: printed for copy/paste into AGENTS.md

- How to verify
  - Re‑run with different @DAYS/@UUID to spot‑check.
  - Confirm no duplication with existing rules; approve merge targets.
```

## Examples (optional)

```bash
/codify-codex-history
/codify-codex-history --uuid 2025-10-10T21-33-01Z
/codify-codex-history --search-term "drizzle migration" --days 14
```
