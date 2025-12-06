# Purpose

Generate a handoff document for the next AI session by analyzing the current session to infer the next goal, extract relevant context, and produce a ready-to-paste starting prompt.

## Variables

### Required

- (none)

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @OUTPUT_FILE = --output — destination file (default ./next-session.md)

### Derived (internal)

- (none)

## Instructions

- Analyze the current session to infer what the next session should accomplish.
- Focus on active plans, incomplete todos, and the logical next step in the work trajectory.
- Generate a starting prompt that can be pasted directly into a new session.
- Write to `next-session.md` (overwrite if exists—this is ephemeral handoff, not a log).
- Present the draft for user review before writing unless @AUTO is provided.

## Workflow

1. Analyze session to infer next goal
   - Check active plan files for incomplete steps.
   - Review todo list for pending/in-progress items.
   - Identify the logical continuation of the work trajectory.
   - Note any blockers or dependencies discovered.
2. Extract relevant context
   - Files touched, created, or referenced this session.
   - Key decisions made and their rationale.
   - Discoveries or findings that impact next steps.
3. Generate handoff content
   - Summarize the inferred goal.
   - Write a starting prompt that includes goal, context, and actionable instructions.
   - List relevant files the next session should examine.
4. Present draft for review
   - Display the generated handoff for user approval.
   - STOP for confirmation unless @AUTO is provided.
5. Write to output file
   - Save to @OUTPUT_FILE (default: `./next-session.md`).
6. Report completion
   - Confirm the handoff was written and summarize the inferred goal.

## Output

```md
# RESULT

- Summary: Handoff generated for next session.
- Goal: <inferred goal summary>
- File: next-session.md
```

## Template

The handoff document should follow this structure:

```md
# Handoff: <Goal Summary>

## Starting Prompt

<Ready-to-paste prompt for the next session. Should include:

- The goal/objective
- Essential context from this session
- Specific instructions or constraints
- What to do first>

## Relevant Files

<List of files the next session should examine, with brief notes on why each matters>

## Key Context

<Decisions made, findings discovered, or state information the next session needs to know>
```
