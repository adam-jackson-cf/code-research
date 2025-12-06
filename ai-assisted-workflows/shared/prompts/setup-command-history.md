# setup-command-history v0.1

## Purpose

Install Atuin shell history replacement with SQLite storage, fuzzy search, and optional end-to-end encrypted cloud sync.

## Variables

### Required

- (none)

### Optional (derived from $ARGUMENTS)

- @AUTO = --auto — skip STOP confirmations (auto-approve checkpoints)
- @REGISTER = --register — enable cloud sync registration prompts
- @USERNAME = --username — username for cloud sync registration
- @EMAIL = --email — email for cloud sync registration

### Derived (internal)

- @INSTALL_SCRIPT_URL = <url> — Atuin installation script URL
- @DETECTED_SHELL = <shell> — detected shell type (bash, zsh, fish)
- @SHELL_CONFIG = <path> — shell configuration file path
- @SYSTEMS = <filename> — system instructions file (CLAUDE.md or AGENTS.md depending on target)

## Instructions

- ALWAYS detect the user's shell before proceeding.
- NEVER force cloud sync registration; make it optional.
- Shell integration is automatically configured by the installer.
- Validate Atuin is working with a test search after installation.
- Respect STOP confirmations unless @AUTO is provided.
- Document usage patterns in @SYSTEMS.md for reference.

## Workflow

1. Check existing installation
   - Run `command -v atuin` to check if already installed
   - If found, capture version: `atuin --version`
   - **STOP (skip when @AUTO):** "Atuin already installed (version <version>). Reinstall/update? (y/n)"
   - If user declines, skip to configuration/documentation steps.
2. Detect shell environment
   - Identify current shell: `echo $SHELL` or `ps -p $$`
   - Detect shell config file based on shell type:
     - bash: ~/.bashrc or ~/.bash_profile
     - zsh: ~/.zshrc
     - fish: ~/.config/fish/config.fish
   - Store as @DETECTED_SHELL and @SHELL_CONFIG for reference
3. Install Atuin
   - **STOP (skip when @AUTO):** "Install Atuin via official installer script? (y/n)"
   - Run installation command:
     ```bash
     curl --proto '=https' --tlsv1.2 -LsSf https://setup.atuin.sh | sh
     ```
   - Installer will automatically:
     - Download and install atuin binary
     - Add shell integration to @SHELL_CONFIG
     - Initialize SQLite database
   - Capture installation output for validation
4. Verify shell integration
   - Check @SHELL_CONFIG for atuin integration lines
   - Typical integration adds: `eval "$(atuin init <shell>)"`
   - If missing, **STOP (skip when @AUTO):** "Shell integration not detected. Add manually? (y/n)"
   - If approved, append appropriate integration for @DETECTED_SHELL
5. Optional cloud sync registration
   - If @REGISTER flag provided or user wants cloud sync:
     - **STOP (skip when @AUTO and @REGISTER not provided):** "Enable cloud sync (end-to-end encrypted)? (y/n)"
     - If approved, prompt for credentials if not provided:
       - **STOP:** "Enter username for Atuin sync:" (if @USERNAME not provided)
       - **STOP:** "Enter email for Atuin sync:" (if @EMAIL not provided)
     - Run registration: `atuin register -u @USERNAME -e @EMAIL`
     - Verify registration succeeded
     - Run initial sync: `atuin sync`
   - If cloud sync declined, note that Atuin works locally without registration
6. Update @SYSTEMS.md

- Add or update Atuin documentation section:

```md
### When you want to search past command execution history

If `--bash-history` is included in the users request or a request requires searching past bash command execution, you **must** Atuin shell History tool.

- **Ctrl+R** for enhanced search UI with fuzzy finding
- All Bash commands auto-captured with directory context
- Search history: `atuin search <term>`
- Sync across machines: `atuin sync` (end-to-end encrypted)
```

7. Test installation
   - Source shell config or instruct user to restart shell:
     - bash: `source ~/.bashrc`
     - zsh: `source ~/.zshrc`
     - fish: `source ~/.config/fish/config.fish`
   - Run a test command to populate history: `echo "Atuin test"`
   - Search for test command: `atuin search "Atuin test"`
   - Verify search returns the test command
   - Test Ctrl+R interactive search (requires user interaction, provide instructions)
8. Validate setup
   - Confirm atuin binary installed: `atuin --version`
   - Verify shell integration in @SHELL_CONFIG
   - Check SQLite database initialized: `atuin stats` (should return statistics)
   - If cloud sync enabled, verify sync status: `atuin sync`
   - Provide usage examples and next steps

## Output

```md
# RESULT

- Summary: Atuin shell history installed and configured for @DETECTED_SHELL

## DETAILS

- Binary: atuin (version: <version>)
- Shell: @DETECTED_SHELL
- Shell Config: @SHELL_CONFIG (integration added)
- Cloud Sync: <enabled|disabled>
  - Username: @USERNAME (if enabled)
  - Sync Status: <synced|not configured>
- Documentation: @SYSTEMS.md updated

## VALIDATION

- Binary installed: ✓ atuin --version
- Shell integration: ✓ Found in @SHELL_CONFIG
- Database initialized: ✓ atuin stats returns data
- Cloud sync: <✓ Registered and synced | ⚠ Local only>

## NEXT STEPS

1. Restart your shell or run: `source @SHELL_CONFIG`
2. Press Ctrl+R to test interactive search
3. Run commands normally - they'll be automatically captured
4. Search history: `atuin search <term>`
5. (If cloud sync enabled) Sync across machines: `atuin sync`
6. View statistics: `atuin stats`
```
