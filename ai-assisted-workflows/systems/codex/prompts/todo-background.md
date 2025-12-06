# Purpose

Run a single Codex CLI workflow inside a named tmux session so it can keep working in the background while progress is logged to a timestamped report file.

## Variables

### Required

- @USER_PROMPT = $1 — first CLI argument; background task brief forwarded to Codex.

### Optional (derived from @ARGUMENTS)

- @MODEL_SELECTOR = --model — Codex model identifier (default codex-medium).
- @REPORT_FILE = --report-file — destination report file (default ./.enaible/agents/background/background-report-<TIMESTAMP>.md).

### Derived (internal)

- @SESSION_NAME — unique tmux session name for this background task
- @TIMESTAMP — UTC timestamp for file naming and session identification
- @MODEL_NAME — parsed Codex model name from @MODEL_SELECTOR
- @ENHANCED_PROMPT — user prompt with appended reporting instructions
- @PROCESS_ID — PID of the tmux pane running Codex

## Instructions

- Capture a timestamp before creating directories or files so report names, tmux sessions, and logs stay aligned.
- Create the report directory and header before launching Codex to guarantee every background run has a writable log.
- Pass @USER_PROMPT verbatim to Codex after prepending the reporting instructions (Codex lacks an append-system-prompt flag).
- Always launch Codex inside a dedicated tmux session.
- Record the tmux session name, Codex model, PID, and report path so operators can monitor or terminate the run later.

## Workflow

0. Auth preflight

   - Run `uv run --project tools/enaible enaible auth_check --cli codex --report @REPORT_FILE` using the parsed report path. If it fails, write the message to the report and exit without launching Codex.

1. Prepare reporting directory

   - Execute `mkdir -p ./.enaible/agents/background && test -w ./.enaible/agents/background`. Abort immediately if the directory cannot be created or is not writable.

2. Parse inputs

   - Require @USER_PROMPT; if missing, prompt the operator and stop.
   - Split @MODEL_SELECTOR on `:` to derive @MODEL_NAME. Default to `codex-medium` when the selector is absent.

3. Prepare reporting path

   - Compute @TIMESTAMP and the default @REPORT_FILE if none was provided.
   - Create parent directories and initialize the markdown header:
     ```
     # Background Task Report - <human-readable date>
     ## Task: @USER_PROMPT
     ## Started: <date time>
     ```

4. Launch tmux session

   - Set @SESSION_NAME to `codex-bg-@TIMESTAMP` (or another unique identifier).
   - Build @ENHANCED_PROMPT by appending reporting instructions: `@USER_PROMPT IMPORTANT: Report all progress and results to: @REPORT_FILE. Use the Write tool to append updates.`
   - Launch Codex inside tmux:
     ```bash
     tmux new-session -d -s @SESSION_NAME \
       "cdx-exec --model @MODEL_NAME \\
         \"@ENHANCED_PROMPT\""
     ```
   - Capture @PROCESS_ID via `tmux display-message -p '#{pane_pid}' -t @SESSION_NAME:0` and store it with the session metadata.

5. Configure monitoring

   - Document how to attach to the session (`tmux attach -t @SESSION_NAME`), capture recent output (`tmux capture-pane -p -S -200 -t @SESSION_NAME`), and stop it (`tmux kill-session -t @SESSION_NAME`).
   - Note that progress is continuously appended to @REPORT_FILE for non-interactive monitoring (`tail -f @REPORT_FILE`).

6. Report launch status
   - Summarize Codex model, tmux session, PID, and report path.
   - Provide explicit monitoring and termination guidance so operators can manage the background task without guessing.

## Output

```md
# RESULT

- Summary: Codex background task launched (@MODEL_NAME) inside tmux session @SESSION_NAME.

## PROCESS

- tmux session: @SESSION_NAME
- PID: @PROCESS_ID
- Command: tmux new-session -d -s @SESSION_NAME 'cdx-exec --model @MODEL_NAME "@ENHANCED_PROMPT"'

## REPORT

- File: @REPORT_FILE
- Monitoring:
  - `tmux attach -t @SESSION_NAME`
  - `tail -f @REPORT_FILE`

## NEXT STEPS

1. Review the report for periodic updates.
2. Terminate the tmux session when work completes (`tmux kill-session -t @SESSION_NAME`).
```

## Examples

```bash
# Default Codex background task
/todo-background "Analyze the codebase for performance issues"

# Custom Codex model with explicit report path
/todo-background "Refactor the authentication module" codex:codex-large ./.enaible/agents/background/auth-refactor.md
```
