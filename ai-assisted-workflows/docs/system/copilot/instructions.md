# Custom Instructions

> Enhance GitHub Copilot with contextual guidance through custom instructions at repository, organization, and personal scopes.

## Overview

Custom instructions allow you to provide GitHub Copilot with contextual information about your preferences, coding standards, frameworks, and project-specific requirements. Instructions are automatically included in Copilot Chat requests without requiring explicit invocation.

GitHub Copilot supports custom instructions at three hierarchical scopes:

| Scope            | Priority | Where Configured        | Availability                                         |
| :--------------- | :------- | :---------------------- | :--------------------------------------------------- |
| **Personal**     | Highest  | GitHub.com settings     | All conversations across GitHub.com                  |
| **Repository**   | Medium   | Repository files        | Repository context (IDE, GitHub.com)                 |
| **Organization** | Lowest   | GitHub.com org settings | Organization context on GitHub.com (Enterprise only) |

All relevant instructions are combined and provided to Copilot, with personal instructions taking precedence when conflicts arise.

## Repository Instructions

Repository instructions are stored as files in your repository and are automatically applied when working within that repository's context.

### Basic Repository Instructions

The simplest way to add repository instructions is with a single file at the repository root.

**Location**: `.github/copilot-instructions.md`

**Format**: Plain Markdown with natural language instructions

**Example**:

```markdown
# Project Instructions

This is a TypeScript project using React and TanStack Router.

## Code Style

- Use functional components with TypeScript interfaces
- Prefer named exports over default exports
- Use Tailwind CSS for styling with shadcn/ui components
- Keep cyclomatic complexity under 10

## Testing

- Write tests using Vitest
- Place test files adjacent to source files with `.test.ts` extension
- Maintain minimum 80% code coverage

## Architecture

- Follow feature-based folder structure in src/features/
- Keep business logic in hooks, not components
- Use Zustand for global state, TanStack Query for server state
```

### Contextual Instructions

For more granular control, create multiple instruction files that apply to specific files or directories using glob patterns.

**Location**: `.github/instructions/*.instructions.md`

**Format**: Markdown with YAML frontmatter

**Frontmatter Properties**:

| Property      | Required | Description                           | Example                         |
| :------------ | :------- | :------------------------------------ | :------------------------------ |
| `applyTo`     | Yes      | Glob pattern(s) for target files      | `"**/*.ts, **/*.tsx"`           |
| `description` | No       | Brief description of the instructions | `"TypeScript coding standards"` |

**Example** - TypeScript-specific instructions:

`.github/instructions/typescript.instructions.md`:

```markdown
---
applyTo: "**/*.ts, **/*.tsx"
description: TypeScript and React standards
---

## TypeScript Guidelines

- Enable strict mode in all files
- Avoid `any` type; use `unknown` for truly unknown types
- Define explicit return types for exported functions
- Use `interface` for object shapes, `type` for unions/intersections

## React Patterns

- Use `FC` type for functional components
- Destructure props in function signature
- Use `useCallback` for event handlers passed to children
- Memoize expensive computations with `useMemo`
```

**Example** - Test-specific instructions:

`.github/instructions/testing.instructions.md`:

```markdown
---
applyTo: "**/*.test.ts, **/*.spec.ts"
description: Testing standards and patterns
---

## Test Structure

- Follow Arrange-Act-Assert pattern
- Use descriptive test names: "should [expected behavior] when [condition]"
- Group related tests with `describe` blocks
- Mock external dependencies

## Coverage Requirements

- Unit tests: test edge cases and error handling
- Integration tests: test component interactions
- Avoid testing implementation details
```

**Example** - Directory-specific instructions:

`.github/instructions/backend.instructions.md`:

```markdown
---
applyTo: "src/server/**"
description: Backend API standards
---

## API Design

- Use RESTful conventions for endpoints
- Return appropriate HTTP status codes
- Include request validation with Zod schemas
- Add JSDoc comments for all public functions

## Error Handling

- Use custom error classes
- Log errors with structured logging
- Never expose internal errors to clients
- Include error tracking IDs in responses
```

### AGENTS.md

A standardized instruction file for coding agents, compatible with multiple AI coding tools.

**Location**: Repository root `AGENTS.md` (or `CLAUDE.md`, `GEMINI.md`)

**Format**: Plain Markdown (optional YAML frontmatter for custom agents)

**Purpose**: Provide detailed context that coding agents need, such as build steps, test commands, and architectural decisions that might clutter a README.

**Example**:

```markdown
# Agent Instructions

## Project Context

This is a monorepo using Bun workspaces with shared packages and a web client.

## Build & Development

**Install dependencies**:
```

bun install

```

**Run development server**:
```

bun run dev

```

**Run tests**:
```

bun run test

```

## Code Conventions

### File Organization
- Shared utilities: `shared/utils/`
- Components: `src/components/`
- Feature modules: `src/features/[feature-name]/`

### Naming Conventions
- Components: PascalCase (e.g., `UserProfile.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `MAX_RETRIES`)

### Import Rules
- Use absolute imports from `@/` alias
- Group imports: external, internal, types
- No circular dependencies

## Testing Strategy

- Unit tests: Vitest with React Testing Library
- E2E tests: Playwright
- Run tests before committing
- Maintain 80%+ coverage

## Deployment

Build command: `bun run build`
Output directory: `dist/`
Environment variables required: See `.env.example`
```

## Personal Instructions

Personal instructions apply to all your conversations with Copilot Chat across GitHub.com.

**Configuration**: GitHub.com → Settings → Copilot → Custom instructions

**Scope**: All Copilot Chat conversations on GitHub.com (not in IDE)

**Use Cases**:

- Preferred programming languages
- Personal coding style preferences
- Accessibility requirements
- Communication preferences (verbosity, emoji usage, etc.)

**Example Personal Instructions**:

```
I prefer TypeScript over JavaScript.
I use Bun instead of npm or yarn.
Keep explanations concise and technical.
Always include error handling in code examples.
Use functional programming patterns when possible.
```

## Organization Instructions

Organization instructions apply to all conversations within an organization's context on GitHub.com.

**Configuration**: GitHub.com → Organization Settings → Copilot → Custom instructions

**Requirements**:

- Organization must have Copilot Enterprise subscription
- Must be configured by organization owner

**Scope**: Organization context on GitHub.com only (not in IDE)

**Use Cases**:

- Organization-wide coding standards
- Compliance and security requirements
- Mandatory frameworks or libraries
- Documentation standards
- Shared architectural patterns

**Example Organization Instructions**:

```markdown
## Security Requirements

- Never commit secrets, API keys, or credentials
- Use environment variables for configuration
- Sanitize all user inputs
- Follow OWASP Top 10 guidelines
- Include security review checklist in PR templates

## Code Standards

- All code must pass ESLint and TypeScript checks
- Maintain 80%+ test coverage
- Document public APIs with JSDoc
- Follow conventional commits specification

## Approved Technologies

- Frontend: React 18, TypeScript, Tailwind CSS
- Backend: Node.js, Fastify, Prisma
- Testing: Vitest, Playwright
- Database: PostgreSQL
```

## Precedence and Combination

When multiple instruction scopes are relevant, GitHub Copilot combines them with the following precedence:

1. **Personal instructions** (highest priority) - Override conflicting guidance
2. **Repository instructions** - Project-specific context
3. **Organization instructions** (lowest priority) - Baseline standards

**Example Scenario**:

- **Organization** says: "Use Jest for testing"
- **Repository** says: "This project uses Vitest"
- **Personal** says: "I prefer minimal test descriptions"

**Result**: Copilot will use Vitest (repository overrides org), with minimal descriptions (personal preference applied).

## Best Practices

### Writing Effective Instructions

**Be Specific and Actionable**:

```markdown
❌ Bad: "Write good code"
✅ Good: "Keep functions under 20 lines, extract complex logic into named utilities"
```

**Provide Context, Not Commands**:

```markdown
❌ Bad: "Always use async/await"
✅ Good: "This project uses async/await for asynchronous operations to maintain consistency"
```

**Focus on Why, Not Just What**:

```markdown
❌ Bad: "Use named exports"
✅ Good: "Use named exports to enable better tree-shaking and IDE auto-imports"
```

**Include Examples**:

````markdown
When creating API endpoints, follow this pattern:

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 })
  }

  // ... implementation
}
```
````

```

### Organization Guidelines

**Keep Instructions Concise**:
- Short, self-contained statements
- Whitespace is ignored
- Focus on high-impact guidance

**Avoid Duplicating Documentation**:
- Reference existing docs instead of repeating them
- Link to style guides, architecture docs, or wikis
- Keep instructions as supplements, not replacements

**Update Regularly**:
- Review instructions when architecture changes
- Remove outdated guidance
- Keep aligned with current standards

**Test Instructions**:
- Ask Copilot to generate code and verify it follows guidelines
- Iterate based on actual usage
- Gather feedback from team members

## File Locations Summary

| Instruction Type | File Location | Scope | Frontmatter |
| :--- | :--- | :--- | :--- |
| Basic repository | `.github/copilot-instructions.md` | Repository | No |
| Contextual | `.github/instructions/*.instructions.md` | Glob pattern | Required |
| Agent instructions | `AGENTS.md` (root) | Repository | Optional |
| Personal | GitHub.com settings | All conversations | N/A |
| Organization | GitHub.com org settings | Organization | N/A |

## Compatibility

| Feature | VS Code | GitHub.com | JetBrains | Visual Studio | Copilot CLI |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `.github/copilot-instructions.md` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `.instructions.md` files | ✅ | ✅ | ✅ | ✅ | ✅ |
| `AGENTS.md` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Personal instructions | ❌ | ✅ | ❌ | ❌ | ❌ |
| Organization instructions | ❌ | ✅ | ❌ | ❌ | ❌ |

## See Also

- [Prompts](./prompts.md) - Reusable prompt templates with arguments
- [Agents](./agents.md) - Custom AI agent personas
- [Chat Reference](./chat-reference.md) - Built-in commands and variables
- [GitHub Docs: Custom Instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions)
```
