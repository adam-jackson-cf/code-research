# setup-browser-tools v0.1

## Purpose

Install Chrome DevTools Protocol automation scripts for AI-assisted UI testing and debugging workflows.

## Variables

### Required

- (none)

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @INSTALL_DIR = --install-dir — installation directory (default ~/.local/bin)

### Derived (internal)

- @REPO_URL = <url> — browser-tools repository URL (https://github.com/badlogic/agent-tools)
- @TEMP_DIR = <path> — temporary clone directory
- @SCRIPTS = <list> — browser-\*.js script names to install
- @SCOPE = <user|project> — installation scope from user choice
- @SYSTEMS = <filename> — system instructions file (CLAUDE.md or AGENTS.md depending on target)
- @SYSTEMS_PATH = <path> — full path to systems file based on scope

## Instructions

- ALWAYS ensure @INSTALL_DIR is in the user's PATH.
- NEVER modify shell configuration files (.zshrc, .bashrc, etc.).
- Install all browser-\*.js scripts from the agent-tools repository.
- Make all scripts executable after installation.
- Document commands in @SYSTEMS.md for reference (project or user level).
- Validate Chrome can be launched with remote debugging enabled.
- Respect STOP confirmations unless @AUTO is provided.

## Workflow

1. Validate installation directory
   - Ensure @INSTALL_DIR exists: `mkdir -p @INSTALL_DIR`
   - Check if @INSTALL_DIR is in PATH: `echo $PATH | grep -q @INSTALL_DIR`
   - If not in PATH, **STOP (skip when @AUTO):** "Warning: @INSTALL_DIR not in PATH. Continue anyway? (y/n)"
   - If user declines, exit with instructions to add directory to PATH.
2. Check existing installation
   - Search @INSTALL_DIR for browser-\*.js scripts
   - If found, **STOP (skip when @AUTO):** "Browser tools already installed. Reinstall/update? (y/n)"
   - If user declines, skip to documentation step.
3. Download browser-tools scripts
   - Clone repository to temp directory: `git clone --depth 1 @REPO_URL @TEMP_DIR`
   - If git unavailable, provide manual download instructions:
     - Visit https://github.com/badlogic/agent-tools/tree/main/browser-tools
     - Download each browser-\*.js script manually
4. Install scripts
   - **STOP (skip when @AUTO):** "Install browser tools to @INSTALL_DIR? (y/n)"
   - Copy all browser-\*.js files from @TEMP_DIR/browser-tools/ to @INSTALL_DIR:
     - browser-start.js
     - browser-nav.js
     - browser-screenshot.js
     - browser-eval.js
     - browser-pick.js
     - browser-cookies.js
     - browser-search.js
     - browser-content.js
   - Make all scripts executable: `chmod +x @INSTALL_DIR/browser-*.js`
   - Clean up temp directory: `rm -rf @TEMP_DIR`
5. Verify installation
   - Check each script is executable and in @INSTALL_DIR
   - Verify scripts can be found via PATH: `command -v browser-start.js`
   - If not found, remind user to add @INSTALL_DIR to PATH
6. Update @SYSTEMS.MD

   - **STOP (skip when @AUTO):** "Document browser tools at project level (./@SYSTEMS.md) or user level ({{ system.user_scope_dir }}/@SYSTEMS.md)?"
   - Based on user choice, set @SYSTEMS_PATH:
     - Project: `./@SYSTEMS.md` (repo root)
     - User: `{{ system.user_scope_dir }}/@SYSTEMS.md`
   - Add or update Browser Tools documentation section at @SYSTEMS_PATH:

   ```md
   ### When you need to perform visual web UI tests

   If `--browser` is included in a users request or a request requires visual testing of a web ui, you **must** use the below browser tool.

   These tools connect to a Chrome instance running with remote debugging enabled on port `:9222`.

   **Available Commands:**

   - @INSTALL_DIR + `/browser-start.js` — Launch Chrome with remote debugging on `:9222`
   - @INSTALL_DIR + `/browser-nav.js <url>` — Navigate to URLs (use `--new` flag for new tab)
   - @INSTALL_DIR + `/browser-screenshot.js` — Capture current viewport, returns temp file path
   - @INSTALL_DIR + `/browser-eval.js <code>` — Execute JavaScript in active tab for data extraction/inspection
   - @INSTALL_DIR + `/browser-pick.js` — Interactive element selector (returns CSS selectors)
   - @INSTALL_DIR + `/browser-cookies.js` — Display all cookies for debugging auth/sessions
   - @INSTALL_DIR + `/browser-search.js <query>` — Search Google and return results
   - @INSTALL_DIR + `/browser-content.js` — Extract page content as markdown
   ```

   ```

   ```

7. Test installation
   - **STOP (skip when @AUTO):** "Test browser-start.js to verify Chrome launches? (y/n)"
   - If approved, run `browser-start.js` and check for Chrome window with debugging enabled
   - Verify Chrome DevTools Protocol connection on port 9222
   - Provide instructions to stop Chrome if needed
8. Validate setup
   - Confirm all 8 browser-\*.js scripts exist in @INSTALL_DIR
   - Verify all scripts are executable
   - Check PATH accessibility
   - Provide usage examples and next steps

## Output

```md
# RESULT

- Summary: Browser tools installed to @INSTALL_DIR

## DETAILS

- Installation Directory: @INSTALL_DIR
- Scripts Installed: 8 browser-\*.js tools
- PATH Status: <accessible|not in PATH - manual configuration required>
- Documentation: @SYSTEMS_PATH updated

## INSTALLED COMMANDS

- browser-start.js — Launch Chrome with remote debugging
- browser-nav.js — Navigate to URLs
- browser-screenshot.js — Capture screenshots
- browser-eval.js — Execute JavaScript
- browser-pick.js — Select elements
- browser-cookies.js — View cookies
- browser-search.js — Search Google
- browser-content.js — Extract page content

## VALIDATION

- Scripts installed: ✓ All 8 files in @INSTALL_DIR
- Executable permissions: ✓ chmod +x applied
- PATH accessibility: <✓ accessible | ⚠ Add @INSTALL_DIR to PATH>

## NEXT STEPS

1. Start Chrome with debugging: `browser-start.js`
2. Navigate to your app: `browser-nav.js http://localhost:3000`
3. Take a screenshot: `browser-screenshot.js`
4. (Optional) Add shell aliases from @SYSTEMS_PATH for shorter commands
```
