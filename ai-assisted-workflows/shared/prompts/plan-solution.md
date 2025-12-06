# Purpose

Develop and compare solution approaches for a @USER_PROMPT using targeted context gathering, research, and structured recommendations.

## Variables

### Required

- @USER_PROMPT = $1 — description of the technical problem to solve

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @TARGET_PATH = --target-path — repository path when targeting an existing codebase (default .)

### Derived (internal)

- @ARTIFACT_ROOT = <derived> — timestamped artifacts directory for plan-solution evidence

## Instructions

- Begin by collecting detailed context based on @USER_PROMPT, environment constraints, and delivery preferences.
- If analyzing an existing codebase, run the architecture analyzers before crafting solutions.
- Produce exactly three solution options (Conservative, Balanced, Innovative) with consistent evaluation criteria.
- Support recommendations with research citations or code insights.
- Wait for approval before appending tasks to `todos.md` unless @AUTO is provided (log follow-up actions instead).
- Respect STOP confirmations unless @AUTO is provided; when auto is active, treat checkpoints as approved without altering other behavior.

## Workflow

1. Intake context
   - Request explicit information when missing from @USER_PROMPT - frame with assumptions:
     1. Defintion of problem to solve or feature to create
     2. Any technical constraints or predetermined tech stack choices
     3. Development approach preferences
   - When the solution targets an existing repository, record the working directory as @TARGET_PATH (default `.`).
   - **STOP (skip when @AUTO):** Wait until the user provides answers or grants permission to proceed with assumptions.
     - When @AUTO is present, continue immediately and record internally that the confirmation was auto-applied.
2. **Conditional** system analysis (only when working against an existing codebase)

   - Set `@ARTIFACT_ROOT=".enaible/artifacts/plan-solution/$(date -u +%Y%m%dT%H%M%SZ)"` and create the directory.
   - Run the architecture analyzers through Enaible for the relevant target (default `.` unless discovery identifies a subpath):

     ```bash
     enaible analyzers run architecture:patterns \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/architecture-patterns.json"

     enaible analyzers run architecture:scalability \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/architecture-scalability.json"

     enaible analyzers run architecture:coupling \
       --target "@TARGET_PATH" \
       --out "@ARTIFACT_ROOT/architecture-coupling.json"
     ```

   ```

   - Record findings: patterns, scalability constraints, integration points, and technical debt hotspots.

   ```

3. Research & option development
   - Perform targeted web/documentation research as needed.
   - Draft three solution options:
     - Solution 1: Conservative / established approach.
     - Solution 2: Balanced trade-off.
     - Solution 3: Innovative / modern approach.
   - Include approach overview, stack, complexity, risk, and suitability.
4. Comparative analysis
   - Build a matrix evaluating Development Complexity, Integration Effort, Technology Risk, and Team Readiness.
5. Recommendation & roadmap
   - Select a recommended solution with justification.
   - Outline phased implementation roadmap and success criteria.
   - Write a summary using below output format with no additional commentary.

## Output

```md
# RESULT

- Summary: Solution plan generated for "<@USER_PROMPT>."

## SOLUTION OPTIONS

### Solution 1 — Conservative

- Approach: <summary>
- Stack: <technologies>
- Complexity: <low/medium/high>
- Risk: <assessment>

### Solution 2 — Balanced

...

### Solution 3 — Innovative

...

## COMPARATIVE ANALYSIS

| Aspect                 | Solution 1 | Solution 2 | Solution 3 |
| ---------------------- | ---------- | ---------- | ---------- |
| Development Complexity | <value>    | <value>    | <value>    |
| Integration Effort     | <value>    | <value>    | <value>    |
| Technology Risk        | <value>    | <value>    | <value>    |
| Team Readiness         | <value>    | <value>    | <value>    |

## RECOMMENDATION

- Preferred Solution: <name>
- Justification: <bullets>

## IMPLEMENTATION ROADMAP

- Phase 1: <milestones, timeline>
- Phase 2: <milestones>
- Phase 3: <milestones>
- Success Criteria: <metrics/tests>
```
