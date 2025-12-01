# Figma MCP Plugin Documentation

## Overview

The Figma MCP (Model Context Protocol) server enables AI coding agents to access Figma design data directly. MCP is an open standard developed by Anthropic for connecting AI systems to software applications - often described as the "USB-C connector" for AI.

## Why Use Figma MCP?

> "When Cursor has access to Figma design data, it's way better at one-shotting designs accurately than alternative approaches like pasting screenshots."

The MCP server translates complex Figma API responses into simplified, AI-friendly context focusing on:
- Layout information
- Styling properties
- Design tokens
- Component structure

## Available MCP Servers

### 1. Figma Official MCP Server

Two deployment options:

| Type | Endpoint | Requirements |
|------|----------|--------------|
| Desktop | `http://127.0.0.1:3845/mcp` | Figma desktop app running |
| Remote | `https://mcp.figma.com/mcp` | Internet access |

### 2. Framelink Figma MCP (Community)

Third-party MCP server with additional features:
- Package: `figma-developer-mcp`
- Repository: [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP)

## Setup

### Figma Desktop MCP Server

1. Open Figma desktop app
2. Enter Dev Mode (`Shift+D`)
3. Enable MCP server in the Inspect panel
4. Server runs at `http://127.0.0.1:3845/mcp`

### Framelink MCP Server

**macOS/Linux Configuration:**

```json
{
  "mcpServers": {
    "Figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=YOUR_API_KEY", "--stdio"]
    }
  }
}
```

**Windows Configuration:**

```json
{
  "mcpServers": {
    "Figma": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "figma-developer-mcp", "--figma-api-key=YOUR_API_KEY", "--stdio"]
    }
  }
}
```

**Environment Variable Alternative:**

Set `FIGMA_API_KEY` environment variable and omit from config:

```json
{
  "mcpServers": {
    "Figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--stdio"],
      "env": {
        "FIGMA_API_KEY": "${FIGMA_API_KEY}"
      }
    }
  }
}
```

### Creating a Figma API Token

1. Log into Figma
2. Go to Account Settings
3. Navigate to Personal Access Tokens
4. Generate new token with appropriate scopes

**Recommended Scopes:**
- `files:read` - Read file contents
- `files:write` - Write to files (optional, for bidirectional workflows)

## Available Tools

### Core Tools

| Tool | Purpose |
|------|---------|
| `get_file` | Retrieve Figma file metadata and structure |
| `get_file_nodes` | Get specific nodes from a file |
| `get_images` | Export images/assets from designs |
| `get_comments` | Retrieve file comments |
| `list_components` | List all components in a file |
| `get_styles` | Get design styles (colors, typography, effects) |
| `read_text_content` | Extract text content from designs |

### Usage Methods

**Method 1: Selection-Based (Desktop Only)**

1. Select a frame or layer in Figma desktop app
2. Prompt your AI client: "Help me implement the current Figma selection"

**Method 2: Link-Based**

1. Copy the link to a frame/layer in Figma
2. Share the URL with your AI client
3. Prompt: "Implement the design at this URL: [figma-link]"

## Best Practices

### 1. Use Semantic Layer Names

```
# Good
- Button/Primary/Default
- Card/Product/Featured
- Header/Navigation/Desktop

# Avoid
- Frame 1
- Rectangle 42
- Group 7
```

### 2. Link to Specific Frames

```
# Good: Specific frame link
https://www.figma.com/file/abc123/Design?node-id=123%3A456

# Avoid: Entire file link (too large)
https://www.figma.com/file/abc123/Design
```

### 3. Use Components and Variables

Organize designs with:
- Reusable components
- Design tokens as variables
- Consistent naming conventions

### 4. Break Down Large Selections

For complex designs:
1. Implement section by section
2. Start with layout structure
3. Add details progressively

### 5. Minimize OAuth Scopes

Request only necessary permissions:
- Use `files:read` for implementation
- Add `files:write` only when needed

## Common Gotchas and Solutions

### 1. Large File Size

**Problem**: Figma files can be huge, overwhelming context windows.

**Solution**:
- Always link to specific frames, not entire files
- Break large designs into smaller chunks
- Use the frame URL with `node-id` parameter

```
# Extract specific frame
https://www.figma.com/file/FILE_ID/NAME?node-id=FRAME_NODE_ID
```

### 2. Interactive Elements Not Communicated

**Problem**: Static designs can't convey interactive behavior (maps, animations, dynamic content).

**Solution**:
- Add annotations in Figma describing interactions
- Include notes in your prompt about expected behavior
- Use Figma's prototyping notes as reference

### 3. Desktop App Must Stay Running

**Problem**: Desktop MCP server requires Figma app to be open.

**Solution**:
- Use the remote MCP server (`https://mcp.figma.com/mcp`) for CI/CD
- Keep Figma minimized during development sessions
- Consider Framelink server for more flexibility

### 4. Rate Limits

**Problem**: Free/Starter plans have limited tool calls.

| Plan | Limit |
|------|-------|
| Starter/View/Collab | 6 tool calls/month |
| Dev/Full seats (paid) | Per-minute rate limits |

**Solution**:
- Batch related queries when possible
- Cache design context locally
- Upgrade plan for heavy usage

### 5. Context Window Efficiency

**Problem**: Design data consumes tokens quickly.

**Solution**:
- The MCP server already simplifies API responses
- Request only needed properties
- Focus on one component at a time

### 6. Write Tools Disabled by Default

**Problem**: Tools that write to Figma are disabled for safety.

**Solution**:
- Manually enable write tools in MCP client settings
- Only enable when bidirectional sync is needed

### 7. Font Availability

**Problem**: Fonts in Figma may not be available in your project.

**Solution**:
- Map Figma fonts to available web fonts
- Use font-family fallback chains
- Document font substitutions

## Workflow Examples

### Basic Component Implementation

```
User: Implement the Button component from this Figma:
      https://figma.com/file/abc/Design?node-id=123:456

AI:   1. Fetches design context via MCP
      2. Extracts: colors, padding, typography, states
      3. Generates component code matching specs
      4. Applies project's design token system
```

### Design System Extraction

```
User: Extract design tokens from the Figma file

AI:   1. Uses list_components to find all variants
      2. Uses get_styles to extract colors, typography
      3. Maps to CSS custom properties or design tokens
      4. Generates token configuration file
```

### Responsive Layout Implementation

```
User: Implement responsive layout for this page design

AI:   1. Analyzes desktop frame constraints
      2. Identifies breakpoint variants if present
      3. Extracts spacing and layout tokens
      4. Generates responsive CSS/component code
```

## Integration with Claude Code

### Configuration

Add to your MCP settings (varies by client):

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

### Using in Prompts

Reference Figma in your prompts:

```
Implement the header component from this Figma design:
https://figma.com/file/xyz/MyDesign?node-id=1:234

Use our existing design tokens from src/styles/tokens.ts
Follow the component patterns in src/components/
```

## Supported Clients

- VS Code (with Copilot or other extensions)
- Cursor
- Windsurf
- Claude Code
- Android Studio
- Amazon Q
- Kiro
- Openhands
- Replit
- Warp

## Resources

- [Official Figma MCP Guide](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)
- [Figma MCP Blog Post](https://www.figma.com/blog/introducing-figma-mcp-server/)
- [Framelink Figma MCP Repository](https://github.com/GLips/Figma-Context-MCP)
- [What is MCP - Figma Resource](https://www.figma.com/resource-library/what-is-mcp/)
