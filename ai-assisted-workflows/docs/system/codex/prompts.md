# Prompts

**Source:** https://github.com/openai/codex/blob/main/docs/prompts.md
**Scraped:** 2025-10-06

Save frequently used prompts as Markdown files and reuse them quickly from the slash menu.

Location: Put files in `$CODEX_HOME/prompts/` (defaults to `~/.codex/prompts/`).
File type: Only Markdown files with the `.md` extension are recognized.
Name: The filename without the `.md` extension becomes the slash entry.
Content: The file contents are sent as your message when you select the item.

## Arguments

Local prompts support placeholders in their content:

- `$1..$9` expand to the first nine positional arguments.
- `$ARGUMENTS` expands to all arguments joined by a single space.
- `$$` is preserved literally.
- Quoted args: Wrap a single argument in double quotes to include spaces.

## How to use

1. Start a new session (Codex loads custom prompts on session start).
2. In the composer, type `/` to open the slash popup and begin typing your prompt name.
3. Use Up/Down to select it. Press Enter to submit its contents, or Tab to autocomplete the name.

## Notes

- Files with names that collide with built-in commands (e.g. `/init`) are ignored.
- New or changed files are discovered on session start.
