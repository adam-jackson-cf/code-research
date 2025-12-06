# Non-interactive mode

**Source:** https://github.com/openai/codex/blob/main/docs/exec.md
**Scraped:** 2025-10-06

Use Codex in non-interactive mode to automate common workflows.

```bash
codex exec "count the total number of lines of code in this project"
```

In non-interactive mode, Codex does not ask for command or edit approvals. By default it runs in `read-only` mode, so it cannot edit files or run commands that require network access.

Use `codex exec --full-auto` to allow file edits. Use `codex exec --sandbox danger-full-access` to allow edits and networked commands.

## Default output mode

By default, Codex streams its activity to stderr and only writes the final message from the agent to stdout. This makes it easier to pipe `codex exec` into another tool without extra filtering.

To write the output of `codex exec` to a file, in addition to using a shell redirect like `>`, there is also a dedicated flag to specify an output file: `-o`/`--output-last-message`.

## JSON output mode

`codex exec` supports a `--json` mode that streams events to stdout as JSON Lines (JSONL) while the agent runs.

Supported event types:

- `thread.started` - when a thread is started or resumed.
- `turn.started` - when a turn starts. A turn encompasses all events between the user message and the assistant response.
- `turn.completed` - when a turn completes; includes token usage.
- `turn.failed` - when a turn fails; includes error details.
- `item.started`/`item.updated`/`item.completed` - when a thread item is added/updated/completed.

Supported item types:

- `assistant_message` - assistant message.
- `reasoning` - a summary of the assistant's thinking.
- `command_execution` - assistant executing a command.
- `file_change` - assistant making file changes.
- `mcp_tool_call` - assistant calling an MCP tool.
- `web_search` - assistant performing a web search.

Typically, an `assistant_message` is added at the end of the turn.

Sample output:

```json
{"type":"thread.started","thread_id":"0199a213-81c0-7800-8aa1-bbab2a035a53"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","item_type":"reasoning","text":"**Searching for README files**"}}
{"type":"item.completed","item":{"id":"item_1","item_type":"file_change","file_path":"README.md"}}
{"type":"turn.completed","usage":{"total_tokens":1250,"prompt_tokens":800,"completion_tokens":450}}
```
