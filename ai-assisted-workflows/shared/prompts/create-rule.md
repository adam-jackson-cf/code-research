# Purpose

Add a single, concise rule to the appropriate global rules file based on a user request and online best practice research.

## Variables

### Required

- @REQUEST = $1 — User's question or topic for the rule (e.g., "how should I handle async errors?")

### Optional (derived from $ARGUMENTS)

- @SCOPE = --scope — `user` or `project` (default: infer from request context)
- @OUT = --out — Custom target file path (overrides system default)
- @AUTO = --auto — Skip STOP confirmations (auto-approve checkpoints)

### Derived (internal)

- @SYSTEM = <detected> — The AI system running this prompt (claude-code, copilot, cursor, codex)
- @TARGET_FILE = <resolved> — Final target file path based on system, scope, and @OUT

## Instructions

- Search online for authoritative best practices before generating the rule.
- Rules must be concise (single line where possible) with clear true/false framing.
- For conceptual rules, include a minimal code example demonstrating the correct pattern.
- Check existing rules in the target file to avoid duplicates and ensure contextual fit.
- Present the rule for user approval before appending—NEVER add without confirmation.
- If the target file doesn't exist, warn the user and suggest creating it (don't auto-create).

## Workflow

1. Analyze request
   - Understand what the user wants to codify as a rule.
   - Identify the technology/framework context if applicable.
2. Search online for best practices
   - Prioritize: official documentation → style guides → authoritative blogs.
   - Note the source for citation.
3. Detect system and determine target
   - Identify which AI system is running this prompt.
   - Determine scope (user vs project) based on request nature:
     - User-level: personal preferences, global patterns
     - Project-level: project-specific conventions, tech stack rules
   - Resolve target file:
     - If @OUT provided, use that path.
     - Otherwise use system default:
       - Claude Code: `~/.claude/CLAUDE.md` (user) or `./CLAUDE.md` (project)
       - Copilot: `.github/copilot-instructions.md` (project only)
       - Cursor: `.cursorrules` (project only)
       - Codex: `./AGENTS.md` (project only)
4. Check target file
   - If file doesn't exist: STOP, warn user, suggest creating it.
   - Read existing rules to understand context and avoid duplicates.
5. Generate rule
   - Format based on rule type:
     - **Syntax/value rules** (true/false framing): Single line with ALWAYS/NEVER
     - **Concept rules**: Single line + minimal code example
   - Use imperative language: "ALWAYS", "NEVER", "MUST", "PREFER"
6. Present for approval
   - Show the generated rule.
   - Show the target file and location within it.
   - Show the source reference.
   - STOP for user confirmation unless @AUTO is provided.
7. Append rule
   - Add to the appropriate section of the target file.
   - Preserve existing formatting and structure.

## Rule Format Examples

**Syntax/value rule (true/false framing):**

```
- **ALWAYS** use `const` for variables that are never reassigned, `let` only when reassignment is required
- **NEVER** use `any` type in TypeScript; prefer `unknown` for truly unknown types
```

**Concept rule (with code example):**

```text
- **ALWAYS** handle async errors with try/catch at the boundary:
  async function fetchData() {
    try { return await api.get(); }
    catch (e) { logger.error(e); throw new AppError('fetch failed', e); }
  }
```

## Output

```md
# RESULT

- Summary: Rule added to <@TARGET_FILE>.
- Rule: <the concise rule text>
- Source: <reference URL or documentation>
- Scope: <user|project>
- System: <@SYSTEM>
```
