---
name: Agent Sandboxes Local
description: Operate local agent sandboxes using OrbStack (Docker) or Tmux backends
keywords: sandbox, docker, tmux, isolated environment, run code, test code, local
---

# Agent Sandboxes Local

This skill provides access to local sandboxed execution environments through a streamlined CLI.

## Prerequisites

Before using this skill, ensure:

1. **CLI is installed**: The `sbx` command is available
2. **Backend is available**:
   - For OrbStack: Docker/OrbStack is running and images are built
   - For Tmux: `tmux` is installed

## Backend Selection

### Available Backends

| Backend | When to Use |
|---------|-------------|
| `orbstack` | Production code, untrusted scripts, full isolation needed |
| `tmux` | Quick tests, debugging, observable execution |

### Selecting Backend

```bash
# Via CLI flag
sbx init --backend orbstack
sbx init --backend tmux

# Via environment variable
export SBX_BACKEND=tmux
```

## When to Use Sandboxes

Use a sandbox when you need to:

- Run untrusted or experimental code safely
- Test packages without affecting the local system
- Execute system commands in isolation
- Work with binary files
- Clone and test repositories
- Run long-running processes (web servers, etc.)

## CLI Command Groups

### 1. Lifecycle Commands (`sbx sandbox`)

```bash
sbx sandbox create [OPTIONS]     # Create new sandbox
sbx sandbox kill <ID>            # Terminate sandbox
sbx sandbox info <ID>            # Get sandbox details
sbx sandbox status <ID>          # Check if running
sbx sandbox list                 # List all sandboxes
sbx sandbox get-host <ID> --port PORT  # Get exposed URL
```

### 2. Execution Commands (`sbx exec`)

```bash
sbx exec <ID> "command"          # Run command
sbx exec <ID> "command" --cwd /path    # With working directory
sbx exec <ID> "command" --background   # Run in background
sbx exec <ID> "command" --timeout 120  # Custom timeout
```

### 3. File Commands (`sbx files`)

```bash
sbx files ls <ID> [--path /dir]        # List files
sbx files read <ID> /path              # Read file
sbx files write <ID> /path --content "data"  # Write file
sbx files exists <ID> /path            # Check existence
sbx files rm <ID> /path                # Remove file
sbx files mkdir <ID> /path             # Create directory
```

### 4. Backend Commands (`sbx backend`)

```bash
sbx backend list                 # List available backends
sbx backend health               # Check backend health
```

## Critical Multi-Agent Considerations

### Sandbox ID Handling

**IMPORTANT**: Always capture and store the sandbox ID in your context.

```bash
# Capture sandbox ID
SANDBOX_ID=$(sbx init --template python --timeout 1800)

# Use in subsequent commands
sbx exec $SANDBOX_ID "echo hello"
```

### Recommended Timeout

Always use at least 30 minutes (1800 seconds) for complex workflows:

```bash
sbx init --timeout 1800
```

### No Shared State

Each agent invocation should manage its own sandbox. Do not rely on:
- Environment variables persisting between calls
- Sandbox state files
- Global configuration

## Standard Workflow

### Step 1: Initialize Sandbox

```bash
# Create sandbox and capture ID
SANDBOX_ID=$(sbx init --template python --timeout 1800)
echo "Sandbox created: $SANDBOX_ID"
```

### Step 2: Perform Operations

```bash
# Write code
sbx files write $SANDBOX_ID /workspace/app.py --content "print('Hello, World!')"

# Execute code
sbx exec $SANDBOX_ID "python /workspace/app.py"
```

### Step 3: Expose Services (if needed)

```bash
# Start server in background
sbx exec $SANDBOX_ID "python -m http.server 8000" --background

# Get public URL
URL=$(sbx sandbox get-host $SANDBOX_ID --port 8000)
echo "Server running at: $URL"
```

### Step 4: Cleanup

```bash
sbx sandbox kill $SANDBOX_ID
```

## Templates

Available templates for OrbStack backend:

| Template | Contents |
|----------|----------|
| `base` | Alpine Linux with bash, curl, git |
| `python` | Python 3.12, uv package manager |
| `node` | Node.js 22, npm |
| `full` | Python + Node + all tools |

## Examples

### Example 1: Run Python Code

```bash
SANDBOX_ID=$(sbx init --template python)

sbx files write $SANDBOX_ID /workspace/hello.py --content "
import sys
print(f'Python {sys.version}')
print('Hello from sandbox!')
"

sbx exec $SANDBOX_ID "python /workspace/hello.py"

sbx sandbox kill $SANDBOX_ID
```

### Example 2: Clone and Test Repository

```bash
SANDBOX_ID=$(sbx init --template full --timeout 3600)

sbx exec $SANDBOX_ID "git clone https://github.com/example/repo.git"
sbx exec $SANDBOX_ID "cd repo && npm install"
sbx exec $SANDBOX_ID "cd repo && npm test"

sbx sandbox kill $SANDBOX_ID
```

### Example 3: Run Web Server

```bash
SANDBOX_ID=$(sbx init --template node)

sbx files write $SANDBOX_ID /workspace/server.js --content "
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World!');
});
server.listen(3000, () => console.log('Server running on port 3000'));
"

sbx exec $SANDBOX_ID "node /workspace/server.js" --background

# Get URL
URL=$(sbx sandbox get-host $SANDBOX_ID --port 3000)
echo "Server at: $URL"

# Test (from outside sandbox)
curl $URL
```

### Example 4: Using Tmux Backend

```bash
# Tmux is lighter and allows session attachment for debugging
SANDBOX_ID=$(sbx init --backend tmux)

sbx exec $SANDBOX_ID "echo 'Using tmux backend'"
sbx exec $SANDBOX_ID "pwd"

# For debugging, you can attach: tmux attach -t $SANDBOX_ID

sbx sandbox kill $SANDBOX_ID
```

## Error Handling

### Common Issues

1. **Docker not running** (OrbStack backend)
   ```
   Error: Cannot connect to Docker/OrbStack
   ```
   Solution: Start Docker Desktop or OrbStack

2. **Image not found** (OrbStack backend)
   ```
   Error: Image not found: agent-sandbox-python
   ```
   Solution: Build images with `cd docker && ./build.sh`

3. **Tmux not installed** (Tmux backend)
   ```
   Error: tmux is not installed
   ```
   Solution: `apt install tmux` or `brew install tmux`

4. **Sandbox not found**
   ```
   Error: Container/Session not found
   ```
   Solution: Create a new sandbox, the previous one may have timed out

## Best Practices

1. **Always capture sandbox ID** in a variable immediately after creation
2. **Use appropriate timeouts** - 30 minutes minimum for complex tasks
3. **Clean up sandboxes** when done to free resources
4. **Use tmux for debugging** - you can attach to see live output
5. **Use orbstack for production** - true isolation for untrusted code
6. **Check backend health** before starting workflows
