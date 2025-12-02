# Setup Browser Tools

> Source: [adam-versed/ai-assisted-workflows](https://github.com/adam-versed/ai-assisted-workflows/blob/main/shared/prompts/setup-browser-tools.md)

This prompt installs Chrome DevTools Protocol automation scripts for AI-assisted UI testing and debugging workflows.

## Overview

The browser tools are CLI scripts that connect to Chrome via the DevTools Protocol on port 9222. They enable AI agents to:
- Navigate web pages
- Take screenshots for visual verification
- Execute JavaScript in page context
- Extract page content
- Select DOM elements interactively

## Variables

### Optional Arguments

| Variable | Description | Default |
|----------|-------------|---------|
| `@AUTO` | Skip confirmation prompts | false |
| `@INSTALL_DIR` | Installation directory | `~/.local/bin` |

### Internal Variables

| Variable | Description |
|----------|-------------|
| `@REPO_URL` | https://github.com/badlogic/agent-tools |
| `@SCRIPTS` | List of browser-*.js script names |
| `@SCOPE` | Installation scope (user/project) |
| `@SYSTEMS` | Target systems file (CLAUDE.md or AGENTS.md) |

## Installed Commands

### browser-start.js

Launch Chrome with remote debugging enabled.

```bash
# Fresh profile (isolated session)
browser-start.js

# Preserve user profile (keeps cookies, logins)
browser-start.js --profile
```

### browser-nav.js

Navigate to URLs in the browser.

```bash
# Navigate in current tab
browser-nav.js https://example.com

# Open in new tab
browser-nav.js https://example.com --new
```

### browser-screenshot.js

Capture the current viewport.

```bash
# Returns path to temporary screenshot file
browser-screenshot.js
```

### browser-eval.js

Execute JavaScript in the active tab's async context.

```bash
# Get page title
browser-eval.js 'document.title'

# Count links
browser-eval.js 'document.querySelectorAll("a").length'

# Extract data
browser-eval.js 'Array.from(document.querySelectorAll("h2")).map(h => h.textContent)'
```

### browser-pick.js

Interactive element picker for selecting DOM elements.

```bash
# Launch picker with description
browser-pick.js "Select the login button"

# Returns CSS selectors for selected elements
# Supports multi-select with Cmd/Ctrl+Click
```

### browser-cookies.js

Display cookies for the current tab.

```bash
# Shows domain, path, httpOnly, secure flags
browser-cookies.js
```

### browser-search.js

Perform Google searches.

```bash
# Basic search (5 results)
browser-search.js "climate change effects"

# More results
browser-search.js "climate change effects" -n 10

# With content extraction
browser-search.js "climate change effects" -n 3 --content
```

### browser-content.js

Extract readable content from a URL as markdown.

```bash
# Navigate and extract content
browser-content.js https://example.com/article

# Handles JavaScript-rendered pages
# Uses Mozilla Readability + Turndown
```

## Installation Steps

### 1. Validate Directory

```bash
mkdir -p ~/.local/bin
export PATH="$PATH:$HOME/.local/bin"
```

### 2. Clone Repository

```bash
git clone https://github.com/badlogic/agent-tools.git /tmp/agent-tools
```

### 3. Install Scripts

```bash
cp /tmp/agent-tools/browser-tools/*.js ~/.local/bin/
chmod +x ~/.local/bin/browser-*.js
```

### 4. Verify Installation

```bash
# Check scripts exist
ls ~/.local/bin/browser-*.js

# Test Chrome launch
browser-start.js
```

### 5. Add to PATH (Permanent)

Add to your shell profile (`~/.bashrc`, `~/.zshrc`):

```bash
export PATH="$PATH:$HOME/.local/bin"
```

## Usage with AI Agents

### Critical Note for Agents

> **IMPORTANT**: These are executable scripts in your PATH. Invoke them directly:
> - ✅ `browser-start.js`
> - ✅ `browser-nav.js https://example.com`
> - ❌ `node browser-start.js`
> - ❌ `./browser-start.js`

### Claude Code Integration

Set up an alias for Claude sessions:

```bash
alias cl="PATH=$PATH:$HOME/.local/bin claude --dangerously-skip-permissions"
```

### Example Agent Workflow

```markdown
1. Start browser
   browser-start.js

2. Navigate to application
   browser-nav.js http://localhost:3000

3. Take screenshot for baseline
   browser-screenshot.js

4. Interact with page
   browser-eval.js 'document.querySelector("#login-btn").click()'

5. Wait and screenshot result
   browser-screenshot.js

6. Extract page state
   browser-eval.js 'document.querySelector(".user-name").textContent'
```

## Prerequisites

- Node.js installed
- Chrome/Chromium browser
- Port 9222 available for remote debugging

## Troubleshooting

### Chrome Won't Start

```bash
# Check if port is in use
lsof -i :9222

# Kill existing Chrome debug instance
pkill -f "chrome.*remote-debugging-port"
```

### Scripts Not Found

```bash
# Verify PATH includes install directory
echo $PATH | grep -q "$HOME/.local/bin" && echo "OK" || echo "Add to PATH"

# Check script permissions
ls -la ~/.local/bin/browser-*.js
```

### Connection Refused

```bash
# Ensure Chrome is running with debugging
browser-start.js

# Verify debug port
curl http://localhost:9222/json/version
```

## Security Considerations

- `--profile` flag copies user data; use carefully
- Scripts have full page access when running
- Consider using fresh profiles for testing untrusted sites
- Remote debugging port should not be exposed publicly
