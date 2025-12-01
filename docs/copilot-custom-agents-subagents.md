# GitHub Copilot Custom Agents and Subagents

## Overview

GitHub Copilot supports custom agents that allow you to create specialized AI personas for specific workflows. The system supports both standalone agents and a subagent architecture for complex, multi-step tasks.

## Agent Types

### 1. VS Code Custom Agents (`.agent.md`)

Local agents defined in your workspace that run within VS Code's Copilot Chat.

**Location**: `.github/agents/*.agent.md`

### 2. GitHub Copilot Coding Agent (CCA)

An autonomous agent that operates in GitHub's cloud environment, capable of:
- Creating pull requests
- Fixing bugs
- Implementing features
- Running tests and linters
- Addressing technical debt

**Invocation Methods**:
- Assign Copilot to GitHub Issues
- Use `@copilot` mentions in PR comments
- Assign to security alerts
- Use from VS Code with GitHub integration

### 3. Organization Custom Agents

Agents defined at the organization level, shared across repositories.

**Location**: `{org}/.github/agents/` or `{org}/.github-private/agents/`

## Custom Agent Definition for GitHub

### File Structure

```markdown
# .github/agents/frontend-expert.md

---
name: frontend-expert
description: Frontend development specialist with React and TypeScript expertise
tools:
  - codebase
  - editFiles
  - runTests
mcp-servers:
  figma:
    command: npx
    args: ["-y", "figma-developer-mcp", "--figma-api-key=${FIGMA_API_KEY}"]
---

You are a frontend development expert specializing in React and TypeScript.

## Your Expertise:
- React component architecture
- TypeScript best practices
- CSS-in-JS and styling systems
- Performance optimization
- Accessibility standards

## When implementing features:
1. Follow existing patterns in the codebase
2. Ensure type safety
3. Write comprehensive tests
4. Consider accessibility
5. Optimize for performance
```

### YAML Frontmatter Fields

| Field | Description |
|-------|-------------|
| `name` | Unique identifier for the agent |
| `description` | Brief description shown when selecting agent |
| `tools` | Array of tools the agent can use |
| `mcp-servers` | MCP server configurations for external integrations |

## Subagent Architecture

### How Subagents Work

Subagents run independently from the main chat and have their own isolated context. This enables:
- **Context isolation**: Subagent doesn't see main chat context
- **Focused execution**: Subagent only receives the specific task
- **Clean handoffs**: Main agent only receives subagent's result

### Using #runSubagent Tool

In VS Code, you can invoke subagents using the `#runSubagent` tool:

```markdown
# In your agent instructions

When you need to perform a specialized task, use #tool:runSubagent to delegate to a specialized agent.

Example workflow:
1. Analyze the user's request
2. Delegate security review to @security-agent
3. Delegate test writing to @test-agent
4. Synthesize results and present to user
```

### Subagent Invocation in Prompts

```markdown
For complex implementations, break down the work:

1. Use @docs-agent to generate documentation
2. Use @test-agent to create test suites
3. Use @security-agent to review for vulnerabilities

Each agent operates independently and returns structured results.
```

## Creating Specialized Agent Teams

### Example: Full-Stack Development Team

```markdown
# .github/agents/tech-lead.agent.md
---
description: Technical lead coordinating development tasks
tools: ['codebase', 'search', 'usages']
handoffs:
  - label: Frontend Implementation
    agent: frontend-expert
    prompt: Implement the frontend portion of this plan.
  - label: Backend Implementation
    agent: backend-expert
    prompt: Implement the backend portion of this plan.
  - label: Write Tests
    agent: test-writer
    prompt: Write tests for the implementation.
  - label: Security Review
    agent: security-reviewer
    prompt: Review this code for security issues.
---

You are a technical lead responsible for coordinating development tasks.

## Your Role:
1. Break down complex requests into manageable pieces
2. Delegate to specialized agents via handoffs
3. Ensure consistency across implementations
4. Review and integrate results

## Workflow:
1. Analyze the request and create a plan
2. Present handoff options to the user
3. Coordinate results from specialized agents
```

### Frontend Expert Agent

```yaml
# .github/agents/frontend-expert.agent.md
---
description: React/TypeScript frontend specialist
tools: ['codebase', 'editFiles', 'readFiles', 'runTests']
model: claude-sonnet-4
---

You are a frontend expert specializing in React and TypeScript.

## Standards:
- Functional components with hooks
- Proper TypeScript typing (no `any`)
- CSS modules or styled-components
- Comprehensive prop validation
- Accessibility-first approach

## Implementation Pattern:
1. Review existing component patterns
2. Design component API
3. Implement with proper typing
4. Add unit tests
5. Document props and usage
```

### Backend Expert Agent

```yaml
# .github/agents/backend-expert.agent.md
---
description: Node.js/API backend specialist
tools: ['codebase', 'editFiles', 'readFiles', 'runTests', 'runInTerminal']
model: claude-sonnet-4
---

You are a backend expert specializing in Node.js APIs.

## Standards:
- RESTful API design
- Input validation and sanitization
- Proper error handling
- Database query optimization
- Authentication/authorization patterns

## Implementation Pattern:
1. Design API contract
2. Implement endpoint handlers
3. Add validation middleware
4. Write integration tests
5. Document API endpoints
```

## GitHub CLI Agent Integration

Custom agents are available in the GitHub Copilot CLI:

### Configuration Location

- **User-level**: `~/.copilot/agents/`
- **Repository-level**: `.github/agents/`
- **Organization-level**: `{org}/.github/agents/`

### CLI Invocation

```bash
# Invoke an agent explicitly
/agent frontend-expert

# Let Copilot choose the appropriate agent
# (Copilot auto-selects based on task)
```

## Agent-to-Agent Communication

### Using Agents as Tools

Your custom agents are automatically made available as tools to Copilot. The model will start a new agentic loop using a relevant custom agent when necessary.

```yaml
# .github/agents/coordinator.agent.md
---
description: Coordinates complex multi-step tasks
tools:
  - codebase
  - frontend-expert  # Reference other agent as tool
  - backend-expert   # Reference other agent as tool
  - test-writer      # Reference other agent as tool
---

You coordinate complex development tasks by delegating to specialized agents.
```

## Best Practices

### 1. Design Clear Boundaries

Each agent should have a well-defined scope:

```yaml
# Good: Focused responsibility
---
description: TypeScript type definitions and interfaces specialist
tools: ['codebase', 'editFiles', 'readFiles']
---
Focus only on TypeScript types and interfaces.
Do not implement business logic.
Do not write tests.
```

### 2. Use Appropriate Tool Sets

Limit tools to what the agent actually needs:

```yaml
# Security reviewer doesn't need to edit files
---
description: Security code reviewer
tools: ['codebase', 'readFiles', 'search']  # Read-only
---
```

### 3. Document Agent Capabilities

Help users understand when to use each agent:

```yaml
---
description: |
  Use this agent when you need to:
  - Generate API documentation
  - Create README files
  - Write inline code comments
  - Create architecture decision records (ADRs)
---
```

### 4. Chain Agents for Complex Workflows

Use handoffs to create multi-step workflows:

```yaml
handoffs:
  - label: Step 1 - Plan
    agent: planner
    prompt: Create implementation plan
    send: false
  - label: Step 2 - Implement
    agent: implementer
    prompt: Implement the plan
    send: false
  - label: Step 3 - Review
    agent: reviewer
    prompt: Review the implementation
    send: false
```

### 5. Consider Context Limits

Subagents have fresh context, which can be beneficial:
- Reduces token usage in main conversation
- Prevents context pollution between tasks
- Allows specialized models per task

## Example: Design-to-Code Workflow

```yaml
# .github/agents/design-implementer.agent.md
---
description: Implements UI from Figma designs using the Figma MCP
tools:
  - codebase
  - editFiles
  - readFiles
  - figma/*
mcp-servers:
  figma:
    command: npx
    args: ["-y", "figma-developer-mcp", "--figma-api-key=${FIGMA_API_KEY}"]
handoffs:
  - label: Verify Implementation
    agent: design-reviewer
    prompt: Compare the implementation against the Figma design.
    send: false
---

# Design Implementation Agent

You implement UI components from Figma designs.

## Workflow:

1. **Retrieve Design Context**
   - Use Figma MCP to get design specifications
   - Extract colors, typography, spacing, and layout

2. **Analyze Project Patterns**
   - Search codebase for existing component patterns
   - Identify design system tokens in use
   - Match Figma variables to code tokens

3. **Implement Component**
   - Create component following project conventions
   - Use design tokens from the project's system
   - Ensure responsive behavior
   - Add proper TypeScript types

4. **Verify Completeness**
   - Check all design elements are implemented
   - Verify spacing and alignment
   - Confirm color accuracy
   - Test responsive breakpoints

## Output:
- Implemented component code
- Any new design tokens needed
- Notes on design-to-code decisions
```

## Resources

- [GitHub Copilot Coding Agent Documentation](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent)
- [VS Code Custom Agents](https://code.visualstudio.com/docs/copilot/customization/custom-chat-modes)
- [Custom Agents GitHub Changelog](https://github.blog/changelog/2025-10-28-custom-agents-for-github-copilot/)
- [How to Write a Great agents.md](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
