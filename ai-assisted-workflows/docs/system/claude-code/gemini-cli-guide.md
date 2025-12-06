# Gemini CLI Complete Guide

A comprehensive guide to using Google's Gemini CLI, an open-source AI agent that brings the power of Gemini directly into your terminal.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Authentication Options](#authentication-options)
4. [CLI Reference](#cli-reference)
5. [Usage Examples](#usage-examples)
6. [Key Features](#key-features)
7. [Configuration](#configuration)
8. [Advanced Usage](#advanced-usage)
9. [Troubleshooting](#troubleshooting)
10. [Resources](#resources)

## Overview

Gemini CLI provides lightweight access to Google's Gemini models with:

- **Free tier**: 60 requests/min and 1,000 requests/day with personal Google account
- **Powerful Gemini 2.5 Pro**: Access to 1M token context window
- **Built-in tools**: Google Search grounding, file operations, shell commands, web fetching
- **Extensible**: MCP (Model Context Protocol) support for custom integrations
- **Terminal-first**: Designed for developers who live in the command line
- **Open source**: Apache 2.0 licensed

## Installation

### Quick Install Options

#### Run instantly with npx (no installation required)

```bash
npx https://github.com/google-gemini/gemini-cli
```

#### Install globally with npm

```bash
npm install -g @google/gemini-cli
```

#### Install globally with Homebrew (macOS/Linux)

```bash
brew install gemini-cli
```

### System Requirements

- Node.js version 20 or higher
- macOS, Linux, or Windows

## Authentication Options

### Option 1: OAuth login (Recommended for individual developers)

**Best for:** Individual developers and anyone with a Gemini Code Assist License

**Benefits:**

- Free tier: 60 requests/min and 1,000 requests/day
- Gemini 2.5 Pro with 1M token context window
- No API key management
- Automatic updates to latest models

```bash
# Start Gemini CLI and choose OAuth when prompted
gemini

# For paid Code Assist License users, set your Google Cloud Project
export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_NAME"
gemini
```

### Option 2: Gemini API Key

**Best for:** Developers who need specific model control or paid tier access

```bash
# Get your key from https://aistudio.google.com/apikey
export GEMINI_API_KEY="YOUR_API_KEY"
gemini
```

### Option 3: Vertex AI

**Best for:** Enterprise teams and production workloads

```bash
# Get your key from Google Cloud Console
export GOOGLE_API_KEY="YOUR_API_KEY"
export GOOGLE_GENAI_USE_VERTEXAI=true
gemini
```

## CLI Reference

### Main Command Structure

```
gemini [options] [command]
```

### Commands

| Command      | Description                 |
| ------------ | --------------------------- |
| `gemini`     | Launch Gemini CLI (default) |
| `gemini mcp` | Manage MCP servers          |

### Core Options

| Option                     | Type    | Description                                              |
| -------------------------- | ------- | -------------------------------------------------------- |
| `-m, --model`              | string  | Specify model to use                                     |
| `-p, --prompt`             | string  | Prompt for non-interactive mode. Appended to stdin input |
| `-i, --prompt-interactive` | string  | Execute prompt and continue in interactive mode          |
| `-s, --sandbox`            | boolean | Run in sandbox environment                               |
| `--sandbox-image`          | string  | Sandbox image URI                                        |
| `-d, --debug`              | boolean | Run in debug mode (default: false)                       |
| `-a, --all-files`          | boolean | Include ALL files in context (default: false)            |
| `-v, --version`            | boolean | Show version number                                      |
| `-h, --help`               | boolean | Show help                                                |

### Advanced Options

#### Approval Modes

| Option            | Type    | Description                                       |
| ----------------- | ------- | ------------------------------------------------- |
| `-y, --yolo`      | boolean | Auto-accept all actions (default: false)          |
| `--approval-mode` | string  | Set approval mode: `default`, `auto_edit`, `yolo` |

#### Memory and Performance

| Option                | Type    | Description                                         |
| --------------------- | ------- | --------------------------------------------------- |
| `--show-memory-usage` | boolean | Show memory usage in status bar (default: false)    |
| `-c, --checkpointing` | boolean | Enable checkpointing of file edits (default: false) |

#### Extensions and MCP

| Option                       | Type    | Description                                 |
| ---------------------------- | ------- | ------------------------------------------- |
| `-e, --extensions`           | array   | List of extensions to use (defaults to all) |
| `-l, --list-extensions`      | boolean | List all available extensions and exit      |
| `--allowed-mcp-server-names` | array   | Allowed MCP server names                    |
| `--experimental-acp`         | boolean | Start agent in ACP mode                     |

#### Network and Directories

| Option                  | Type   | Description                                                           |
| ----------------------- | ------ | --------------------------------------------------------------------- |
| `--proxy`               | string | Proxy configuration: `schema://user:password@host:port`               |
| `--include-directories` | array  | Additional directories to include (comma-separated or multiple flags) |

#### Telemetry Options

| Option                      | Type    | Description                                  |
| --------------------------- | ------- | -------------------------------------------- |
| `--telemetry`               | boolean | Enable telemetry                             |
| `--telemetry-target`        | string  | Set telemetry target: `local` or `gcp`       |
| `--telemetry-otlp-endpoint` | string  | Set OTLP endpoint for telemetry              |
| `--telemetry-otlp-protocol` | string  | Set OTLP protocol: `grpc` or `http`          |
| `--telemetry-log-prompts`   | boolean | Enable logging of user prompts for telemetry |
| `--telemetry-outfile`       | string  | Redirect telemetry output to specified file  |

### Deprecated Options

| Option                | Status     | Replacement                       |
| --------------------- | ---------- | --------------------------------- |
| `--all_files`         | Deprecated | Use `--all-files` instead         |
| `--show_memory_usage` | Deprecated | Use `--show-memory-usage` instead |

## Usage Examples

### Basic Usage

#### Start in current directory

```bash
gemini
```

#### Include multiple directories

```bash
gemini --include-directories ../lib,../docs
```

#### Use specific model

```bash
gemini -m gemini-2.5-flash
```

#### Non-interactive mode for scripts

```bash
gemini -p "Explain the architecture of this codebase"
```

#### Execute prompt and continue interactively

```bash
gemini -i "Analyze the main.py file and suggest improvements"
```

### Advanced Usage Examples

#### Run with all files in context

```bash
gemini --all-files -p "Find all TODO comments in the codebase"
```

#### Use with sandbox for safe execution

```bash
gemini --sandbox -p "Run the test suite and fix any failing tests"
```

#### Enable checkpointing for complex sessions

```bash
gemini --checkpointing -i "Let's refactor the authentication system"
```

#### Auto-approve file edits only

```bash
gemini --approval-mode auto_edit -p "Fix all linting errors in src/"
```

#### Run in YOLO mode (auto-approve everything)

```bash
gemini --yolo -p "Deploy the application to staging"
```

#### Debug mode with memory usage

```bash
gemini --debug --show-memory-usage
```

#### Use with proxy

```bash
gemini --proxy http://user:pass@proxy.company.com:8080
```

### Project-Specific Examples

#### Start a new project

```bash
cd new-project/
gemini
> Write me a Discord bot that answers questions using a FAQ.md file I will provide
```

#### Analyze existing codebase

```bash
git clone https://github.com/google-gemini/gemini-cli
cd gemini-cli
gemini
> Give me a summary of all of the changes that went in yesterday
```

#### Code review and improvement

```bash
gemini --include-directories src,tests -i "Review the recent commits and suggest improvements"
```

#### Automated debugging

```bash
gemini --sandbox -p "Run the failing test and debug the issue"
```

## Key Features

### Code Understanding & Generation

- Query and edit large codebases
- Generate new apps from PDFs, images, or sketches using multimodal capabilities
- Debug issues and troubleshoot with natural language

### Automation & Integration

- Automate operational tasks like querying pull requests or handling complex rebases
- Use MCP servers to connect new capabilities
- Run non-interactively in scripts for workflow automation

### Advanced Capabilities

- Ground queries with built-in Google Search for real-time information
- Conversation checkpointing to save and resume complex sessions
- Custom context files (GEMINI.md) to tailor behavior for your projects

### GitHub Integration

Integrate with GitHub workflows using the [Gemini CLI GitHub Action](https://github.com/google-github-actions/run-gemini-cli):

- Pull Request Reviews
- Issue Triage
- On-demand Assistance
- Custom Workflows

## Configuration

### MCP Server Integration

Configure MCP servers in `~/.gemini/settings.json` to extend functionality:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_token_here"
      }
    }
  }
}
```

### Context Files (GEMINI.md)

Create a `GEMINI.md` file in your project root to provide context:

```markdown
# Project Context

This is a Node.js application using Express and TypeScript.

## Key Conventions

- Use async/await for promises
- Follow ESLint configuration
- Tests are in **tests** directories

## Important Files

- `src/server.ts` - Main application entry point
- `src/routes/` - API route handlers
- `config/` - Configuration files
```

### Environment Variables

Common environment variables:

```bash
# Authentication
export GEMINI_API_KEY="your_api_key"
export GOOGLE_API_KEY="your_google_api_key"
export GOOGLE_CLOUD_PROJECT="your_project"
export GOOGLE_GENAI_USE_VERTEXAI=true

# Configuration
export GEMINI_MODEL="gemini-2.5-pro"
export GEMINI_DEBUG=true

# Proxy
export HTTPS_PROXY="http://proxy.company.com:8080"
export HTTP_PROXY="http://proxy.company.com:8080"
```

## Advanced Usage

### Using MCP Servers

Once configured, interact with MCP servers using @ mentions:

```text
> @github List my open pull requests
> @slack Send a summary of today's commits to #dev channel
> @database Run a query to find inactive users
```

### Slash Commands

Available slash commands within the CLI:

- `/help` - Show available commands
- `/chat` - Switch to chat mode
- `/mcp` - MCP server management
- `/bug` - Report a bug directly from CLI
- `/clear` - Clear conversation history
- `/exit` - Exit the CLI

### Checkpointing

Save and resume complex sessions:

```bash
# Enable checkpointing
gemini --checkpointing

# Within the session, checkpoints are automatically created
# Resume from a checkpoint when restarting
```

### Sandbox Mode

Run potentially dangerous operations safely:

```bash
# Use default sandbox
gemini --sandbox

# Use custom sandbox image
gemini --sandbox --sandbox-image ubuntu:latest
```

## Troubleshooting

### Common Issues

#### Authentication Problems

```bash
# Clear cached credentials
rm -rf ~/.gemini/auth/

# Re-authenticate
gemini
```

#### Rate Limiting

- Free tier: 60 requests/min, 1,000 requests/day
- Use `--model gemini-2.5-flash` for faster, cheaper requests
- Consider upgrading to paid tier for higher limits

#### Memory Issues

```bash
# Monitor memory usage
gemini --show-memory-usage

# Reduce context with specific directories
gemini --include-directories src/core
```

#### Network Issues

```bash
# Use proxy if behind corporate firewall
gemini --proxy http://proxy.company.com:8080

# Debug network issues
gemini --debug
```

### Debug Mode

Enable detailed logging:

```bash
gemini --debug -p "your prompt here"
```

This provides:

- Detailed request/response logging
- Token usage information
- Performance metrics
- Error stack traces

## Resources

### Official Documentation

- [Quickstart Guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/index.md)
- [Authentication Setup](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/authentication.md)
- [Configuration Guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md)
- [Built-in Tools Overview](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/index.md)

### Community & Support

- [GitHub Repository](https://github.com/google-gemini/gemini-cli)
- [NPM Package](https://www.npmjs.com/package/@google/gemini-cli)
- [GitHub Issues](https://github.com/google-gemini/gemini-cli/issues)
- [Official Roadmap](https://github.com/orgs/google-gemini/projects/11/)

### Legal

- **License**: Apache License 2.0
- **Terms of Service**: [Terms & Privacy](https://github.com/google-gemini/gemini-cli/blob/main/docs/tos-privacy.md)
- **Security**: [Security Policy](https://github.com/google-gemini/gemini-cli/blob/main/SECURITY.md)

---

_Built with ❤️ by Google and the open source community_
