# GitHub Copilot Chat Modes and Custom Agents

> **Note**: Chat modes have been renamed to "agents" in VS Code. The file extension changed from `.chatmode.md` to `.agent.md`, and the folder changed from `.github/chatmodes/` to `.github/agents/`. VS Code maintains backward compatibility with the old format.

## Overview

Custom agents in GitHub Copilot allow you to define specialized AI personas tailored to specific roles and tasks. An agent consists of a set of instructions and tools that are applied when you switch to that agent.

## File Structure

- **Location**: `.github/agents/` folder in your workspace
- **Extension**: `.agent.md`
- **Format**: YAML frontmatter + Markdown body

## YAML Frontmatter Syntax

The header section uses YAML frontmatter with these configuration options:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Agent identifier shown in dropdown (defaults to filename) |
| `description` | string | Brief summary shown as placeholder text in chat |
| `argument-hint` | string | Optional guidance text for users |
| `tools` | array | List of available tools for this agent |
| `model` | string | Specifies which AI model to use (e.g., `claude-sonnet-4`, `GPT-4.1`) |
| `target` | string | Environment context: `vscode` or `github-copilot` |
| `handoffs` | array | Workflow transitions to other agents |
| `mcp-servers` | object | MCP server configurations |

## Basic Example

```yaml
---
description: Reviews code for potential security vulnerabilities and suggests fixes
name: Security Reviewer
tools: ['codebase', 'fetch', 'findTestFiles', 'githubRepo']
model: GPT-4.1
---

Act as a senior application security engineer.

When reviewing code, focus on:
- OWASP Top 10 vulnerabilities
- Input validation issues
- Authentication/authorization flaws
- Injection attacks

Suggest code changes with clear explanations for each fix.
```

## Available Built-in Tools

Common tools you can specify in the `tools` array:

| Tool | Purpose |
|------|---------|
| `codebase` | Search and analyze codebase |
| `editFiles` | Make file modifications |
| `readFiles` | Read file contents |
| `createFile` | Create new files |
| `runInTerminal` | Execute terminal commands |
| `runTests` | Run test suites |
| `findTestFiles` | Locate test files |
| `fetch` | Make HTTP requests |
| `search` | Search within files |
| `usages` | Find code usages/references |
| `githubRepo` | Access GitHub repository data |
| `websearch` | Search the web |

## MCP Tools Integration

Reference MCP server tools using the `<server-name>/*` syntax to include all tools from an MCP server:

```yaml
---
description: Design implementation agent with Figma access
tools:
  - codebase
  - editFiles
  - figma/*
mcp-servers:
  figma:
    command: npx
    args: ["-y", "figma-developer-mcp", "--stdio"]
    env:
      FIGMA_API_KEY: "${FIGMA_API_KEY}"
---
```

## Tool Priority

When multiple sources define tools, priority follows this hierarchy:
1. Prompt file tools (highest priority)
2. Custom agent tools
3. Default agent tools (lowest priority)

## Advanced Example with Handoffs

Handoffs create sequential workflows between agents:

```yaml
---
description: Generate an implementation plan for new features or refactoring
name: Planner
tools: ['fetch', 'githubRepo', 'search', 'usages', 'codebase']
model: claude-sonnet-4
handoffs:
  - label: Implement Plan
    agent: agent
    prompt: Implement the plan outlined above.
    send: false
  - label: Write Tests
    agent: test-writer
    prompt: Write tests for the implementation plan above.
    send: false
---

# Planning Instructions

You are in planning mode. Your task is to generate an implementation plan for the user's request.

## Your Approach:

1. **Understand Requirements**: Clarify what the user wants to achieve
2. **Analyze Codebase**: Search for relevant existing code and patterns
3. **Design Solution**: Create a step-by-step implementation plan
4. **Identify Risks**: Note potential challenges or edge cases

## Output Format:

Provide your plan as a structured markdown document with:
- Summary of changes
- Files to modify/create
- Step-by-step implementation guide
- Testing considerations

**Important**: Don't make any code edits, just generate the plan.
```

### Handoff Configuration

Each handoff object supports:

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Button display text |
| `agent` | string | Target agent identifier |
| `prompt` | string | Text to send to the next agent (optional) |
| `send` | boolean | Auto-submit flag (defaults to `false`) |

## Creating Custom Agents

### Via VS Code Command

1. Open Command Palette (`Cmd/Ctrl + Shift + P`)
2. Run "Chat: Configure Custom Agents..."
3. Choose workspace or user profile location
4. Enter filename (without extension)
5. Configure YAML frontmatter and instructions

### Manual Creation

1. Create file: `.github/agents/my-agent.agent.md`
2. Add YAML frontmatter with required fields
3. Add instruction body in Markdown
4. Restart VS Code or reload window

## Best Practices

### 1. Create Focused Agents
Create specialized agents with focused tool sets to prevent unwanted actions:

```yaml
# Good: Focused agent with limited tools
---
description: Documentation writer - creates and updates docs
tools: ['readFiles', 'editFiles', 'search']
---

# Avoid: Overly permissive agent
---
description: Does everything
tools: ['*']
---
```

### 2. Use Handoffs for Multi-Step Workflows
Orchestrate complex workflows requiring user approval between steps:

```yaml
handoffs:
  - label: Review Changes
    agent: code-reviewer
    prompt: Review the changes I just made.
    send: false
```

### 3. Write Clear Instructions
Be specific about the agent's role, constraints, and output format:

```yaml
---
description: TypeScript code reviewer
---

You are a senior TypeScript developer specializing in code review.

## Focus Areas:
- Type safety and proper typing
- Error handling patterns
- Performance considerations
- Code maintainability

## Review Format:
For each issue found, provide:
1. Location (file and line)
2. Severity (critical/major/minor)
3. Description of the issue
4. Suggested fix with code example

## Constraints:
- Only comment on TypeScript-specific issues
- Don't rewrite entire functions
- Suggest, don't demand
```

### 4. Reference Tools Semantically
Use `#tool:<tool-name>` syntax in your instructions for better documentation:

```markdown
Use the #tool:codebase tool to search for relevant patterns before suggesting changes.
```

### 5. Share Workspace Agents
Store workspace agents in `.github/agents` for team sharing via version control.

## Highly Rated Example: Test Generator Agent

```yaml
---
description: |
  Generates comprehensive test suites following project conventions.
  Analyzes existing tests to match style and patterns.
name: Test Generator
tools:
  - codebase
  - readFiles
  - editFiles
  - findTestFiles
  - runTests
model: claude-sonnet-4
handoffs:
  - label: Run Tests
    agent: agent
    prompt: Run the tests I just created and report any failures.
    send: true
---

# Test Generation Instructions

You are an expert test engineer. Your role is to generate comprehensive, maintainable tests.

## Before Writing Tests:

1. **Analyze Existing Tests**: Use #tool:findTestFiles and #tool:readFiles to understand:
   - Test framework in use (Jest, Vitest, pytest, etc.)
   - Naming conventions for test files
   - Test organization patterns (describe blocks, test suites)
   - Common assertion patterns
   - Mock/stub approaches

2. **Understand the Code**: Read the implementation thoroughly to identify:
   - Public API surface to test
   - Edge cases and error conditions
   - Dependencies that need mocking
   - State changes to verify

## Test Writing Principles:

1. **Arrange-Act-Assert**: Structure each test clearly
2. **One assertion per test**: Keep tests focused
3. **Descriptive names**: Test names should explain the scenario
4. **Independent tests**: No test should depend on another
5. **Fast execution**: Mock external dependencies

## Output Format:

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle the happy path correctly', () => {
      // Arrange
      const input = createTestInput();

      // Act
      const result = component.methodName(input);

      // Assert
      expect(result).toEqual(expectedOutput);
    });

    it('should throw error when input is invalid', () => {
      // Arrange
      const invalidInput = null;

      // Act & Assert
      expect(() => component.methodName(invalidInput))
        .toThrow('Input cannot be null');
    });
  });
});
```

## Coverage Targets:

- Happy path scenarios
- Error conditions and edge cases
- Boundary values
- Null/undefined handling
- Async behavior (if applicable)
- Integration points
```

## Migration from Chat Modes

If you have existing `.chatmode.md` files:

1. VS Code automatically recognizes them as agents
2. Use Quick Fix action to rename and move:
   - From: `.github/chatmodes/*.chatmode.md`
   - To: `.github/agents/*.agent.md`

## Resources

- [VS Code Custom Agents Documentation](https://code.visualstudio.com/docs/copilot/customization/custom-chat-modes)
- [GitHub Awesome Copilot Repository](https://github.com/github/awesome-copilot)
- [Awesome Copilot Chat Modes Collection](https://github.com/dfinke/awesome-copilot-chatmodes)
