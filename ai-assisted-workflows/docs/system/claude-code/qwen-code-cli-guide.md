# Qwen Code CLI Usage Guide

A comprehensive guide to using Qwen Code CLI, an AI-powered command-line workflow tool adapted from Gemini CLI and optimized for Qwen3-Coder models.

## Overview

Qwen Code is a powerful command-line AI workflow tool that enhances your development workflow with advanced code understanding, automated tasks, and intelligent assistance. It supports workflow automation, code understanding & editing, and operates beyond traditional context window limits.

## Installation

### Prerequisites

- Node.js version 20 or higher

### Install from npm (Recommended)

```bash
npm install -g @qwen-code/qwen-code@latest
qwen --version
```

### Install from source

```bash
git clone https://github.com/QwenLM/qwen-code.git
cd qwen-code
npm install
npm install -g .
```

## Quick Start

```bash
# Start Qwen Code
qwen

# Example commands
> Explain this codebase structure
> Help me refactor this function
> Generate unit tests for this module
```

---

## CLI Commands Reference

_Note: If you have a screenshot or image of CLI help output, please provide it so the specific command-line flags and options can be transcribed here._

### Basic Usage

```bash
qwen [options] [command]
```

### Key Command-Line Arguments

- **`--model <model_name>`** (**`-m <model_name>`**): Specifies the Qwen model to use
- **`--prompt <your_prompt>`** (**`-p <your_prompt>`**): Non-interactive mode with direct prompt
- **`--prompt-interactive <your_prompt>`** (**`-i <your_prompt>`**): Interactive session with initial prompt
- **`--sandbox`** (**`-s`**): Enables sandbox mode
- **`--debug`** (**`-d`**): Enables debug mode with verbose output
- **`--all-files`** (**`-a`**): Recursively includes all files as context
- **`--help`** (**`-h`**): Displays help information
- **`--version`**: Shows CLI version
- **`--yolo`**: Auto-approves all tool calls
- **`--include-directories <dir1,dir2,...>`**: Multi-directory support
- **`--checkpointing`**: Enables checkpointing feature
- **`--extensions <extension_name ...>`** (**`-e <extension_name ...>`**): Specifies extensions to use

---

## Session Commands

### Slash Commands (`/`)

**Session Management:**

- **`/clear`**: Clear terminal screen and visible session history (Ctrl+L shortcut)
- **`/compress`**: Replace chat context with summary to save tokens
- **`/stats`**: Display session statistics including token usage
- **`/quit`** or **`/exit`**: Exit Qwen Code

**Chat State Management:**

- **`/chat save <tag>`**: Save current conversation state
- **`/chat resume <tag>`**: Resume from saved conversation
- **`/chat list`**: List available saved conversations
- **`/chat delete <tag>`**: Delete saved conversation

**Memory Management:**

- **`/memory add <text>`**: Add text to AI's instructional context
- **`/memory show`**: Display full concatenated memory content
- **`/memory refresh`**: Reload context files (QWEN.md by default)

**Project Management:**

- **`/directory add <path1>,<path2>`** or **`/dir add`**: Add directories to workspace
- **`/directory show`** or **`/dir show`**: Display workspace directories
- **`/restore [tool_call_id]`**: Restore files to pre-tool execution state

**Interface & Tools:**

- **`/help`** or **`/?`**: Display help information
- **`/tools`**: List available tools
- **`/tools desc`**: Show detailed tool descriptions
- **`/tools nodesc`**: Hide tool descriptions
- **`/theme`**: Change visual theme
- **`/auth`**: Change authentication method
- **`/editor`**: Select preferred editor
- **`/vim`**: Toggle vim mode
- **`/copy`**: Copy last output to clipboard

**Debugging & Information:**

- **`/about`**: Show version information
- **`/extensions`**: List active extensions
- **`/mcp`**: List Model Context Protocol servers and tools
- **`/bug`**: File bug report
- **`/privacy`**: Display privacy notice
- **`/init`**: Create QWEN.md context file for current project

### At Commands (`@`)

Include file or directory content in prompts:

- **`@<path_to_file_or_directory>`**: Inject file/directory content
  - Examples:
    - `@path/to/your/file.txt Explain this text.`
    - `@src/my_project/ Summarize the code in this directory.`
    - `What is this file about? @README.md`
  - Features git-aware filtering (excludes node_modules, .git, etc.)
  - Handles spaces in paths with backslashes: `@My\ Documents/file.txt`

### Shell Commands (`!`)

Execute shell commands directly:

- **`!<shell_command>`**: Execute shell command
  - Examples: `!ls -la`, `!git status`
- **`!`**: Toggle shell mode for continuous shell command execution

---

## Authentication Options

### 1. Qwen OAuth (Recommended - Free)

**Easiest setup with generous free tier:**

```bash
qwen  # Opens browser for automatic authentication
```

**Benefits:**

- 2,000 requests per day (no token counting)
- 60 requests per minute rate limit
- Automatic credential management
- Zero cost for individual users

### 2. OpenAI-Compatible API

**Environment Variables:**

```bash
export OPENAI_API_KEY="your_api_key_here"
export OPENAI_BASE_URL="your_api_endpoint"
export OPENAI_MODEL="your_model_choice"
```

**Project `.env` File:**

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=your_api_endpoint
OPENAI_MODEL=your_model_choice
```

**Provider Options:**

**For Mainland China:**

- **Alibaba Cloud Bailian:** `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **ModelScope (Free):** `https://api-inference.modelscope.cn/v1` (2,000 free calls/day)

**For International Users:**

- **Alibaba Cloud ModelStudio:** `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- **OpenRouter:** `https://openrouter.ai/api/v1` (free tier available)

---

## Configuration

### Settings Files Location

1. **User settings:** `~/.qwen/settings.json`
2. **Project settings:** `.qwen/settings.json`
3. **System settings:** `/etc/gemini-cli/settings.json` (Linux)

### Key Configuration Options

**Session Management:**

```json
{
  "sessionTokenLimit": 32000,
  "maxSessionTurns": 10
}
```

**File Handling:**

```json
{
  "contextFileName": "QWEN.md",
  "fileFiltering": {
    "respectGitIgnore": true,
    "enableRecursiveFileSearch": true
  }
}
```

**Tool Control:**

```json
{
  "coreTools": ["ReadFileTool", "GlobTool", "ShellTool(ls)"],
  "excludeTools": ["run_shell_command"],
  "autoAccept": true
}
```

**Multi-Directory Support:**

```json
{
  "includeDirectories": [
    "/path/to/another/project",
    "../shared-library",
    "~/common-utils"
  ]
}
```

**MCP Servers:**

```json
{
  "mcpServers": {
    "myPythonServer": {
      "command": "python",
      "args": ["mcp_server.py", "--port", "8080"],
      "cwd": "./mcp_tools/python",
      "timeout": 5000,
      "includeTools": ["safe_tool", "file_reader"]
    }
  }
}
```

---

## Practical Usage Examples

### Code Exploration

```bash
cd your-project/
qwen

> Describe the main pieces of this system's architecture
> What are the key dependencies and how do they interact?
> Find all API endpoints and their authentication methods
```

### Development Tasks

```bash
# Refactoring
> Refactor this function to improve readability and performance
> Convert this class to use dependency injection

# Code Generation
> Create a REST API endpoint for user management
> Generate unit tests for the authentication module
> Add error handling to all database operations
```

### Workflow Automation

```bash
# Git operations
> Analyze git commits from the last 7 days, grouped by feature
> Create a changelog from recent commits

# File operations
> Convert all images in this directory to PNG format
> Rename all test files to follow the *.test.ts pattern
```

### Debugging & Analysis

```bash
> Identify performance bottlenecks in this React component
> Check for potential SQL injection vulnerabilities
> Find all hardcoded credentials or API keys
```

---

## Session Management

### Token Management

Configure session limits to optimize costs:

```json
{
  "sessionTokenLimit": 32000
}
```

**Session Commands:**

- `/compress`: Compress history to continue within limits
- `/clear`: Start fresh conversation
- `/stats`: Check current usage

### Context Files (Memory System)

Create `QWEN.md` files for project-specific instructions:

**Example QWEN.md:**

```markdown
# Project: My TypeScript Library

## Coding Style:

- Use 2 spaces for indentation
- Interface names prefixed with `I`
- Always use strict equality (`===`)

## Dependencies:

- Avoid new dependencies unless necessary
- State reason for new dependencies
```

**Hierarchical Loading:**

1. Global: `~/.qwen/QWEN.md`
2. Project root and ancestors
3. Subdirectories (context-specific)

---

## Troubleshooting

### Common Issues

**Authentication Errors:**

- Google Workspace users may need to use project ID or Gemini API key
- Check API key validity and permissions

**Command Not Found:**

- Verify npm global binary directory is in PATH
- Update with: `npm install -g @qwen-code/qwen-code@latest`

**Permission Denied:**

- Check sandbox configuration when sandboxing is enabled
- Verify file/directory permissions

**CI Environment Detection:**

- CLI won't start interactively if `CI_*` environment variables detected
- Use: `env -u CI_TOKEN qwen` to bypass

**DEBUG Mode:**

- Use `.gemini/.env` instead of project `.env` for DEBUG variables
- Variables like `DEBUG` are excluded from project `.env` by default

### Debug Tips

**General Debugging:**

- Use `--debug` flag for verbose output
- Check `~/.qwen/` directory for logs and configuration
- Run `npm run preflight` before committing

**Tool Issues:**

- Test commands directly in shell first
- Verify file paths and permissions
- Isolate with simplest possible command

---

## Advanced Features

### Custom Commands

Create reusable command shortcuts in `.qwen/commands/`:

**Example: `~/.qwen/commands/git/commit.toml`**

````toml
description = "Generate commit message from staged changes"
prompt = """
Generate a Conventional Commit message based on:

```diff
!{git diff --staged}
````

"""

````

Usage: `/git:commit`

### MCP Server Integration

Configure Model Context Protocol servers for custom tools:

```json
{
  "mcpServers": {
    "myServer": {
      "command": "node",
      "args": ["mcp_server.js"],
      "trust": true,
      "includeTools": ["safe_tool"]
    }
  }
}
````

### Sandboxing

Enable sandboxed execution for security:

```bash
qwen --sandbox
```

Or in settings:

```json
{
  "sandbox": "docker"
}
```

---

## Keyboard Shortcuts

- **Ctrl+C**: Cancel current operation
- **Ctrl+D**: Exit (on empty line)
- **Ctrl+L**: Clear screen (same as `/clear`)
- **Ctrl+T**: Toggle MCP tool descriptions
- **Up/Down**: Navigate command history

---

## Resources

- **GitHub Repository**: [QwenLM/qwen-code](https://github.com/QwenLM/qwen-code)
- **Issue Tracker**: [GitHub Issues](https://github.com/QwenLM/qwen-code/issues)
- **Documentation**: [Official Docs](https://github.com/QwenLM/qwen-code/tree/main/docs)

---

## Performance Benchmarks

| Agent     | Model              | Accuracy |
| --------- | ------------------ | -------- |
| Qwen Code | Qwen3-Coder-480A35 | 37.5%    |
| Qwen Code | Qwen3-Coder-30BA3B | 31.3%    |

---

_This guide covers the essential usage patterns and configuration options for Qwen Code CLI. For the most up-to-date information, refer to the official documentation and GitHub repository._
