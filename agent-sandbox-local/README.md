# Agent Sandbox Local

A multi-backend sandbox CLI for isolated code execution. Supports both **OrbStack (Docker)** and **Tmux** backends.

## Overview

This project provides a unified interface for creating and managing sandboxed execution environments. Unlike cloud-based solutions, all execution happens locally on your machine.

### Backend Comparison

| Feature | OrbStack (Docker) | Tmux |
|---------|-------------------|------|
| Isolation | Full container isolation | Process-level only |
| Overhead | ~1-2s startup | ~100ms startup |
| File Access | Via volume mounts | Direct filesystem |
| Port Forwarding | Supported | Localhost only |
| Observability | `docker logs` | Attach to session |
| Best For | Production, untrusted code | Development, debugging |

## Installation

```bash
# Clone the repository
cd agent-sandbox-local

# Install dependencies
cd sandbox_cli
pip install -e .

# Or with uv
uv pip install -e .
```

### Building Docker Images (for OrbStack backend)

```bash
cd docker
./build.sh
```

This builds four images:
- `agent-sandbox-base` - Minimal Alpine
- `agent-sandbox-python` - Python 3.12 + uv
- `agent-sandbox-node` - Node.js 22
- `agent-sandbox-full` - Python + Node + tools

## Quick Start

### Create and Use a Sandbox

```bash
# Create a sandbox (default: OrbStack)
SANDBOX_ID=$(sbx init --template python)

# Execute commands
sbx exec $SANDBOX_ID "echo 'hello world'"
sbx exec $SANDBOX_ID "python -c 'print(1+1)'"

# File operations
sbx files write $SANDBOX_ID /workspace/test.py --content "print('Hello!')"
sbx files read $SANDBOX_ID /workspace/test.py
sbx exec $SANDBOX_ID "python /workspace/test.py"

# Cleanup
sbx sandbox kill $SANDBOX_ID
```

### One-liner Execution

```bash
# Run command in temporary sandbox
sbx run "python -c 'print(42)'"
sbx run --template node "node -e 'console.log(42)'"
```

### Using Tmux Backend

```bash
# Explicitly use tmux backend
sbx init --backend tmux

# Or set as default
export SBX_BACKEND=tmux
sbx init
```

## CLI Reference

### Sandbox Lifecycle

```bash
sbx sandbox create [--template NAME] [--timeout SECS] [--backend TYPE]
sbx sandbox list [--limit N]
sbx sandbox info SANDBOX_ID
sbx sandbox status SANDBOX_ID
sbx sandbox kill SANDBOX_ID
sbx sandbox pause SANDBOX_ID    # OrbStack only
sbx sandbox resume SANDBOX_ID   # OrbStack only
sbx sandbox get-host SANDBOX_ID --port PORT
```

### Command Execution

```bash
sbx exec SANDBOX_ID "command"
sbx exec SANDBOX_ID "command" --cwd /path
sbx exec SANDBOX_ID "command" --env KEY=VALUE
sbx exec SANDBOX_ID "command" --timeout 30
sbx exec SANDBOX_ID "command" --background
```

### File Operations

```bash
sbx files ls SANDBOX_ID [--path /dir]
sbx files read SANDBOX_ID /path/to/file
sbx files write SANDBOX_ID /path/to/file --content "data"
sbx files write SANDBOX_ID /path/to/file --stdin < local_file
sbx files exists SANDBOX_ID /path/to/file
sbx files info SANDBOX_ID /path/to/file
sbx files rm SANDBOX_ID /path/to/file
sbx files mkdir SANDBOX_ID /path/to/dir
sbx files mv SANDBOX_ID /old/path /new/path
```

### Backend Management

```bash
sbx backend list              # List available backends
sbx backend health            # Check backend health
sbx backend info orbstack     # Get backend details
```

## Configuration

Configuration is loaded from multiple sources (highest priority first):
1. Environment variables (`SBX_*`)
2. `~/.agent-sandbox/config.yaml`
3. `./config.yaml`
4. Default values

### Example Configuration

```yaml
backend:
  default: orbstack
  fallback: tmux

orbstack:
  image_prefix: agent-sandbox
  workspace_dir: ~/.agent-sandbox/orbstack-workspaces
  resource_limits:
    memory: 512m
    cpu_quota: 50000

tmux:
  workspace_dir: ~/.agent-sandbox/tmux-workspaces
  capture_dir: ~/.agent-sandbox/tmux-captures

logging:
  level: INFO

timeouts:
  default_sandbox: 1800
  default_command: 60
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SBX_BACKEND` | Default backend (`orbstack` or `tmux`) |
| `SBX_WORKSPACE_DIR` | Workspace directory for OrbStack |
| `SBX_TMUX_WORKSPACE_DIR` | Workspace directory for Tmux |
| `SBX_LOG_LEVEL` | Log level (DEBUG, INFO, WARNING, ERROR) |

## Testing

```bash
# Run all tests
cd agent-sandbox-local
pytest tests/ -v

# Run hello world tests specifically
pytest tests/test_hello_world.py -v -s

# Run backend-specific tests
pytest tests/test_orbstack.py -v  # Requires Docker
pytest tests/test_tmux.py -v      # Requires tmux
```

## Project Structure

```
agent-sandbox-local/
├── config/
│   └── config.yaml           # Default configuration
├── docker/
│   ├── Dockerfile.base       # Minimal Alpine image
│   ├── Dockerfile.python     # Python 3.12 image
│   ├── Dockerfile.node       # Node.js 22 image
│   ├── Dockerfile.full       # Full stack image
│   └── build.sh              # Build all images
├── sandbox_cli/
│   ├── pyproject.toml
│   └── src/
│       ├── main.py           # CLI entry point
│       ├── config/           # Configuration management
│       ├── backends/
│       │   ├── base.py       # Abstract backend interface
│       │   ├── factory.py    # Backend factory
│       │   ├── orbstack/     # Docker backend
│       │   └── tmux/         # Tmux backend
│       ├── commands/         # CLI commands
│       ├── modules/          # High-level API
│       └── utils/            # Utilities
├── tests/
│   ├── test_hello_world.py   # Combined hello world tests
│   ├── test_orbstack.py      # OrbStack tests
│   └── test_tmux.py          # Tmux tests
├── SKILL.md                  # Agent skill definition
└── README.md
```

## For AI Agents

See [SKILL.md](SKILL.md) for instructions on how AI agents should use this sandbox system.

## License

MIT License
