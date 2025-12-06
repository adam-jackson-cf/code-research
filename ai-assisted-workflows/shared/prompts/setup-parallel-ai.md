# setup-parallel-ai v0.1

## Purpose

Install and configure the Parallel AI CLI tool for web intelligence operations including search, content extraction, research tasks, and entity discovery.

## Variables

### Required

- (none)

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)

### Derived (internal)

- @TOOL_DIR = <path> — tools/parallel directory path
- @SCOPE = <user|project> — installation scope from user choice
- @SYSTEMS = <filename> — system instructions file (CLAUDE.md or AGENTS.md depending on target)
- @SYSTEMS_PATH = <path> — full path to systems file based on scope

## Instructions

- ALWAYS verify Python 3.12+ and uv are available before proceeding.
- NEVER modify shell configuration files (.zshrc, .bashrc, etc.) directly.
- Install the parallel CLI tool using uv sync in the tools/parallel directory.
- Document commands in @SYSTEMS.md for reference (project or user level).
- Validate the CLI can be invoked via uv run.
- Respect STOP confirmations unless @AUTO is provided.

## Workflow

1. Check prerequisites
   - Verify uv is available: `command -v uv`
   - Check Python version: `python3 --version` (must be 3.12+)
   - If prerequisites missing, exit with instructions to install them.
2. Check API key
   - Look for `PARALLEL_API_KEY` in environment: `echo $PARALLEL_API_KEY`
   - If not set, **STOP (skip when @AUTO):** "PARALLEL_API_KEY not set. Get your key from platform.parallel.ai and add to shell config. Continue anyway? (y/n)"
   - If user declines, exit with instructions to add API key.
3. Install package
   - Navigate to tools/parallel: `cd @TOOL_DIR`
   - Run uv sync to install dependencies: `uv sync`
   - If installation fails, provide troubleshooting steps.
4. Verify installation
   - Test CLI works: `uv run --directory @TOOL_DIR parallel --help`
   - Verify all subcommands are available (search, extract, task, findall, status, result)
   - **STOP (skip when @AUTO):** "Parallel AI CLI installed successfully. Continue to documentation? (y/n)"
5. Update @SYSTEMS.md

   - **STOP (skip when @AUTO):** "Document Parallel AI tools at project level (./@SYSTEMS.md) or user level ({{ system.user_scope_dir }}/@SYSTEMS.md)?"
   - Based on user choice, set @SYSTEMS_PATH:
     - Project: `./@SYSTEMS.md` (repo root)
     - User: `{{ system.user_scope_dir }}/@SYSTEMS.md`
   - Add or update Parallel AI documentation section at @SYSTEMS_PATH:

   ````md
   ### When you need web intelligence or research capabilities

   If `--search`, `--extract`, `--task`, or `--findall` is included in a user request, use the Parallel AI tools.

   **Requires:** `PARALLEL_API_KEY` environment variable (get from platform.parallel.ai)

   **Usage:** `uv run --directory tools/parallel parallel <command>`

   **Available Commands:**

   - `parallel search <objective>` — Web search with natural language

     - Options: `--query/-q` (repeatable), `--max-results N`, `--format json|markdown`

   - `parallel extract <url>` — Extract content from URLs to markdown

     - Options: `--objective "focus"`, `--full-content`, `--format json|markdown`

   - `parallel task <input>` — Create enrichment/research task (async)

     - Options: `--schema "output desc"`, `--processor base|core`
     - Returns: run_id (use `parallel result` to get output)

   - `parallel findall <objective>` — Discover entities matching criteria (async)

     - Options: `--entity type`, `--condition` (repeatable), `--limit N`, `--generator base|core|pro`
     - Returns: findall_id (use `parallel status` to track)

   - `parallel status <id>` — Check async operation status
   - `parallel result <id>` — Fetch completed results

   **Example Usage:**

   ```bash
   # Search the web
   uv run --directory tools/parallel parallel search "latest AI research papers on RAG"

   # Extract content from URL
   uv run --directory tools/parallel parallel extract https://example.com --objective "key findings"

   # Generate dataset of entities
   uv run --directory tools/parallel parallel findall "AI startups in San Francisco" --entity company --limit 50
   ```
   ````

   ```

   ```

6. Test connectivity (optional)
   - **STOP (skip when @AUTO):** "Test API connectivity with a simple search? (y/n)"
   - If approved and PARALLEL_API_KEY is set, run a test search:
     `uv run --directory @TOOL_DIR parallel search "test query" --max-results 1`
   - Verify response is received successfully.
7. Validate setup
   - Confirm CLI is accessible via uv run
   - Confirm all 6 commands are available
   - Provide usage examples and next steps

## Output

```md
# RESULT

- Summary: Parallel AI CLI installed and configured

## DETAILS

- Tool Directory: @TOOL_DIR
- Python Version: <version>
- API Key Status: <set|not set - configure PARALLEL_API_KEY>
- Documentation: @SYSTEMS_PATH updated

## INSTALLED COMMANDS

- parallel search — Web search with natural language
- parallel extract — Extract content from URLs
- parallel task — Create enrichment/research tasks
- parallel findall — Discover entities at scale
- parallel status — Check async operation status
- parallel result — Fetch completed results

## VALIDATION

- uv sync: ✓ Dependencies installed
- parallel --help: ✓ CLI accessible
- API connectivity: <✓ verified | ⚠ PARALLEL_API_KEY not set>

## NEXT STEPS

1. Set PARALLEL_API_KEY if not already configured:
   `export PARALLEL_API_KEY="your-key-here"`
2. Test with a search: `uv run --directory tools/parallel parallel search "test query"`
3. Review @SYSTEMS_PATH for command reference
```
