<!-- template format for codex prompts -->
<!-- Docs: https://github.com/openai/codex/blob/main/docs/prompts.md -->

<!--
Codex specific items
  Rules:
    User level ~/.codex/AGENTS.md
    Project level ./AGENTS.md
  Directories:
    User level ~/.codex
    Project level ./.codex
  Settings:
    User level  ~/.codex/config.toml
    Project level ./.codex/config.toml
  Mcp config:
    User level ~/.codex/config.toml

ARGUMENTS (expansion rules):
  $1..$9: expand to first nine positional args
  $ARGUMENTS: expands to all args joined by a single space
  $$: preserved literally (emit a dollar sign)
  quoted: wrap an argument in double quotes to include spaces
-->

<prompt-body>
