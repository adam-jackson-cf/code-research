# Figma MCP Workflow System

## Design Decision: Agents vs Chat Modes

### Recommendation: Use Agents with Handoffs

After analyzing the requirements, **agents** (`.agent.md` files) are the best choice for this system:

| Requirement | Chat Modes | Agents | Winner |
|-------------|------------|--------|--------|
| Specialized personas | ✅ | ✅ | Tie |
| Tool restrictions | ✅ | ✅ | Tie |
| MCP server integration | ⚠️ Limited | ✅ Full | Agents |
| Workflow handoffs | ❌ | ✅ | Agents |
| Future compatibility | ⚠️ Deprecated | ✅ Current | Agents |
| Subagent delegation | ❌ | ✅ | Agents |

### Key Reasons

1. **Handoffs**: Design workflows naturally progress from implement → verify → fix. Agents support handoff buttons for this workflow.

2. **MCP Integration**: Agents have first-class MCP server support in their frontmatter, making Figma tool configuration cleaner.

3. **Future-Proof**: Chat modes are renamed to agents; VS Code recommends migrating `.chatmode.md` to `.agent.md`.

4. **Tool Composition**: We need both Figma MCP tools AND browser tools. Agents allow flexible tool configurations.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Figma Design Workflow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  figma-design-   │───▶│  figma-partial-  │                  │
│  │  implementer     │    │  extractor       │                  │
│  └────────┬─────────┘    └──────────────────┘                  │
│           │                                                     │
│           │ handoff                                             │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │  design-         │◀─── Visual Verification                  │
│  │  reviewer        │     (browser-screenshot.js)              │
│  └────────┬─────────┘                                          │
│           │                                                     │
│           │ if issues found                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │  figma-          │                                          │
│  │  consistency-    │                                          │
│  │  checker         │                                          │
│  └──────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Suite Overview

| Agent | Purpose | Use When |
|-------|---------|----------|
| `figma-design-implementer` | Full design → code implementation | Starting a new component/page from Figma |
| `figma-partial-extractor` | Extract specific design elements | Need only colors, tokens, or single component |
| `figma-consistency-checker` | Ensure code follows Figma design | During development to stay aligned |
| `design-reviewer` | Visual comparison and verification | After implementation to verify accuracy |

## Browser Tools Integration

The system uses **badlogic browser tools** via CLI for visual verification instead of Puppeteer:

### Why CLI Browser Tools?

1. **Simpler Integration**: Direct CLI calls from any agent
2. **No Dependencies**: No npm packages to manage in the project
3. **Agent-Friendly**: Scripts designed for AI agent invocation
4. **Interactive Features**: `browser-pick.js` for DOM selection
5. **PATH-Based**: Available system-wide once installed

### Required Browser Tools

| Tool | Usage in Workflow |
|------|-------------------|
| `browser-start.js` | Launch Chrome with debugging |
| `browser-nav.js` | Navigate to local dev server |
| `browser-screenshot.js` | Capture implementation for comparison |
| `browser-eval.js` | Extract computed styles, measure elements |
| `browser-pick.js` | Select specific elements for review |
| `browser-content.js` | Extract page structure |

### Setup Requirement

Browser tools must be installed and in PATH before using the design review workflow. See `setup-browser-tools.md` for installation instructions.

## Workflow Scenarios

### Scenario 1: Full Component Implementation

```
User: Implement the ProductCard from this Figma design
      https://figma.com/file/abc/Design?node-id=123:456

Flow:
1. figma-design-implementer retrieves design via MCP
2. Analyzes existing codebase patterns
3. Implements component with proper tokens
4. Offers handoff to design-reviewer
5. design-reviewer takes screenshots
6. Compares against Figma specs
7. Reports discrepancies
```

### Scenario 2: Extract Design Tokens Only

```
User: Extract the color palette from our Figma design system

Flow:
1. figma-partial-extractor retrieves styles via MCP
2. Maps Figma variables to code format
3. Generates token file (CSS vars, JS object, etc.)
4. No visual review needed
```

### Scenario 3: Verify Existing Implementation

```
User: Check if the Header component matches the Figma design

Flow:
1. design-reviewer starts browser
2. Navigates to component (Storybook or dev server)
3. Takes screenshots at multiple viewports
4. Retrieves Figma design specs via MCP
5. Performs detailed comparison
6. Reports findings with specific fixes
```

### Scenario 4: Ongoing Consistency Check

```
User: Review my changes against the design before committing

Flow:
1. figma-consistency-checker identifies changed components
2. Retrieves corresponding Figma frames
3. Launches browser for visual inspection
4. Checks spacing, colors, typography
5. Reports any drift from design
6. Offers handoff to fix issues
```

## Configuration Requirements

### MCP Server Setup

Add to your IDE's MCP configuration:

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

### Environment Variables

```bash
# Required
export FIGMA_API_KEY="your-figma-api-token"

# Optional: For browser tools
export PATH="$PATH:$HOME/.local/bin"
```

### Project Setup

1. Install browser tools (see `setup-browser-tools.md`)
2. Configure Figma MCP server
3. Copy agents to `.github/agents/` folder
4. Ensure local dev server can run (for visual verification)

## Usage Examples

### Start Implementation Workflow

```
@figma-design-implementer Implement the navigation menu from:
https://figma.com/file/xyz/Design?node-id=nav-menu

Use our existing design tokens from src/styles/tokens.ts
```

### Quick Token Extraction

```
@figma-partial-extractor Extract only the typography styles from:
https://figma.com/file/xyz/Design?node-id=typography

Output as CSS custom properties
```

### Design Review

```
@design-reviewer Compare the implementation at http://localhost:3000/products
against the Figma design: https://figma.com/file/xyz/Design?node-id=product-page

Check mobile (375px), tablet (768px), and desktop (1440px) viewports
```

### Consistency Check

```
@figma-consistency-checker Review my current changes in src/components/
against their Figma designs. Focus on spacing and color accuracy.
```

## Best Practices

### 1. Always Provide Specific Frame Links

```
# Good
https://figma.com/file/abc/Design?node-id=123:456

# Avoid
https://figma.com/file/abc/Design
```

### 2. Specify Viewport Requirements

```
Check at these breakpoints:
- Mobile: 375px
- Tablet: 768px
- Desktop: 1440px
```

### 3. Reference Design Tokens

```
Use tokens from: src/styles/tokens.ts
Component patterns in: src/components/ui/
```

### 4. Include All States

```
Verify these states:
- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Error
```

### 5. Run Dev Server First

Before visual review, ensure:
```bash
# Start your dev server
npm run dev

# Then invoke reviewer
@design-reviewer Check the Button component at http://localhost:3000/storybook
```
