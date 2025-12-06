<!-- template format for claude-code custom slash command -->
<!-- Docs: https://docs.claude.com/en/docs/claude-code/slash-commands -->

<!--
Claude specific items
  Rules:
    User level ~/.claude/CLAUDE.md
    Project level ./CLAUDE.md
  Directories:
    User level ~/.claude
    Project level ./.claude
  Settings:
    User level  ~/.claude/settings.json
    Project level ./.claude/settings.local.json
  Mcp config:
    User level ~/.claude.json

FRONTMATTER (define these in real YAML frontmatter when instantiating):
  allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git log:*), Bash(git diff:*); Read(./path|glob); Write(./path|glob); Edit(./path|glob); MultiEdit(./path|glob); NotebookEdit(./path|glob); NotebookRead(./path|glob); Grep; Glob; Task; TodoWrite; WebFetch; WebSearch; Write; MCP tools by exact name: mcp__server, mcp__server__tool (no wildcards)
  argument-hint: [type] [scope] [message]
  description: One-line summary for /help
  model: claude-3-5-haiku-20241022 (inherits if omitted)
  disable-model-invocation: true | false (default false)

ARGUMENTS (expansion rules):
  $1..$9: expand to first nine positional args
  $ARGUMENTS: expands to all args joined by a single space
  $$: preserved literally (emit a dollar sign)
  quoted: wrap an argument in double quotes to include spaces

TOOLS (referenceable in allowed-tools):
  list: Bash | Edit | Glob | Grep | MultiEdit | NotebookEdit | NotebookRead | Read | Task | TodoWrite | WebFetch | WebSearch | Write
  mcp rules: mcp__github | mcp__github__get_issue (no wildcards)

SHELL OUTPUT INJECTION:
  !`<bash>` injects command output into context (requires a matching Bash(...) rule in allowed-tools)

FILE REFERENCES:
  @path includes file or directory contents in context (e.g., @src, @README.md)
-->

---

allowed-tools:
argument-hint: [type] [scope] [message]
description: One-line summary for /help
model: claude-3-5-haiku-20241022 (inherits if omitted)

---

<prompt-body>
