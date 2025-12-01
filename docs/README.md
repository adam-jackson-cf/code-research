# Copilot and Figma MCP Research Documentation

This folder contains research and documentation on GitHub Copilot customization features and Figma MCP integration for AI-assisted design-to-code workflows.

## Contents

### Research Documentation

| Document | Description |
|----------|-------------|
| [copilot-chat-modes-and-agents.md](./copilot-chat-modes-and-agents.md) | GitHub Copilot custom chat modes/agents syntax, YAML frontmatter, and examples |
| [copilot-custom-agents-subagents.md](./copilot-custom-agents-subagents.md) | Custom agents and subagent architecture for multi-step workflows |
| [figma-mcp-plugin.md](./figma-mcp-plugin.md) | Figma MCP server setup, tools, best practices, and gotchas |

### Reference Prompts

| Document | Source | Description |
|----------|--------|-------------|
| [design-implementation-reviewer.md](./design-implementation-reviewer.md) | [EveryInc/claude_commands](https://github.com/EveryInc/claude_commands) | Agent for verifying UI matches Figma specs |
| [setup-browser-tools.md](./setup-browser-tools.md) | [adam-versed/ai-assisted-workflows](https://github.com/adam-versed/ai-assisted-workflows) | Browser automation tools installation |

### Figma Workflow System

| Document | Description |
|----------|-------------|
| [figma-workflow-system.md](./figma-workflow-system.md) | Complete system design for Figma MCP workflows |
| [agents/](./agents/) | Ready-to-use agent definitions |

## Agent Suite

The `agents/` folder contains specialized agents for Figma-to-code workflows:

| Agent | File | Purpose |
|-------|------|---------|
| Design Implementer | `figma-design-implementer.agent.md` | Full component/page implementation from Figma |
| Partial Extractor | `figma-partial-extractor.agent.md` | Extract specific design tokens or specs |
| Consistency Checker | `figma-consistency-checker.agent.md` | Verify code stays aligned with Figma |
| Design Reviewer | `design-reviewer.agent.md` | Visual comparison using browser automation |

### Using the Agents

1. **Copy to your project:**
   ```bash
   mkdir -p .github/agents
   cp docs/agents/*.agent.md .github/agents/
   ```

2. **Configure Figma MCP:**
   ```json
   {
     "mcpServers": {
       "figma": {
         "command": "npx",
         "args": ["-y", "figma-developer-mcp", "--stdio"],
         "env": {
           "FIGMA_API_KEY": "${FIGMA_API_KEY}"
         }
       }
     }
   }
   ```

3. **Install browser tools (for visual review):**
   See [setup-browser-tools.md](./setup-browser-tools.md)

4. **Invoke agents:**
   ```
   @figma-design-implementer Implement the Button from https://figma.com/file/xyz?node-id=button
   ```

## Architecture

```
User Request
    │
    ▼
┌───────────────────────┐
│ figma-design-         │◄── For new implementations
│ implementer           │
└───────────┬───────────┘
            │ handoff
            ▼
┌───────────────────────┐
│ design-reviewer       │◄── Visual verification
│ (uses browser tools)  │
└───────────┬───────────┘
            │ if issues
            ▼
┌───────────────────────┐
│ figma-consistency-    │◄── Ongoing alignment
│ checker               │
└───────────────────────┘

┌───────────────────────┐
│ figma-partial-        │◄── Extract tokens/specs only
│ extractor             │
└───────────────────────┘
```

## Key Features

- **Agent-based**: Uses `.agent.md` format (current VS Code standard)
- **MCP Integration**: Direct Figma access via Model Context Protocol
- **Browser Automation**: Visual verification via badlogic browser tools (CLI, not Puppeteer)
- **Handoffs**: Multi-step workflows with user approval between steps
- **Token-Aware**: Maps Figma values to project design tokens

## Prerequisites

- VS Code with GitHub Copilot extension (or compatible IDE)
- Node.js (for Figma MCP server)
- Figma API token
- Chrome/Chromium (for browser tools)
- Browser tools installed and in PATH

## Quick Start

1. Get a Figma API token from your Figma account settings
2. Set environment variable: `export FIGMA_API_KEY="your-token"`
3. Copy agents to `.github/agents/`
4. Install browser tools (optional, for visual review)
5. Invoke agents in Copilot Chat

## Resources

- [VS Code Custom Agents Docs](https://code.visualstudio.com/docs/copilot/customization/custom-chat-modes)
- [GitHub Awesome Copilot](https://github.com/github/awesome-copilot)
- [Figma MCP Guide](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)
- [Framelink Figma MCP](https://github.com/GLips/Figma-Context-MCP)
- [badlogic agent-tools](https://github.com/badlogic/agent-tools)
