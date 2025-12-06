# Cursor Rules Format

Cursor IDE uses `.mdc` files (MDC = Markdown with Context) for storing custom rules and instructions.

## File Structure

Cursor rules are stored in `.cursor/rules/` and use XML-style wrapper tags:

```markdown
<!-- generated: enaible -->

<rule_category>

# Title

Content goes here...
</rule_category>
```

## Rule Categories

Common rule categories include:

- `<coding>` - General coding practices and standards
- `<security>` - Security-focused rules and guidelines
- `<quality>` - Code quality and refactoring guidance
- `<performance>` - Performance optimization rules
- `<debugging>` - Debugging and troubleshooting instructions
- `<planning>` - Planning and design rules
- `<documentation>` - Documentation standards
- `<development>` - Development workflow rules
- `<configuration>` - Configuration management
- `<scaffolding>` - Project scaffolding and setup
- `<analysis>` - Code analysis guidelines

## Variable Handling

Unlike other AI coding systems, Cursor rules are **static instructions** and do not support runtime variables. All `@TOKEN` placeholders from source prompts are removed or replaced with literal values during rendering.

## Managed Files

Files with the `<!-- generated: enaible -->` sentinel are automatically managed by the enaible CLI. Do not edit these files directly - instead, modify the source prompts in `shared/prompts/` and re-render.

## Rendering Cursor Rules

```bash
# Render all prompts for Cursor
uv run enaible prompts render --system cursor

# Render specific prompt
uv run enaible prompts render --prompt analyze-security --system cursor
```
