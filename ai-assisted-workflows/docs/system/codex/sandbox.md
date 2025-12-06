# Sandbox & approvals

**Source:** https://github.com/openai/codex/blob/main/docs/sandbox.md
**Scraped:** 2025-10-06

## Approval modes

We've chosen a powerful default for how Codex works on your computer: `Auto`. In this approval mode, Codex can read files, make edits, and run commands in the working directory automatically. However, Codex will need your approval to work outside the working directory or access network.

When you just want to chat, or if you want to plan before diving in, you can switch to `Read Only` mode with the `/approvals` command.

If you need Codex to read files, make edits, and run commands with network access, without approval, you can use `Full Access`. Exercise caution before doing so.

### Defaults and recommendations

Codex runs in a sandbox by default with strong guardrails: it prevents editing files outside the workspace and blocks network access unless enabled.

On launch, Codex detects whether the folder is version-controlled and recommends:

- Version-controlled folders: `Auto` (workspace write + on-request approvals)
- Non-version-controlled folders: `Read Only`

The workspace includes the current directory and temporary directories like `/tmp`. Use the `/status` command to see which directories are in the workspace.

You can set these explicitly:

- `codex --sandbox workspace-write --ask-for-approval on-request`
- `codex --sandbox read-only --ask-for-approval on-request`

## Can I run without ANY approvals?

Yes, you can disable all approval prompts with `--ask-for-approval never`. This option works with all `--sandbox` modes, so you still have full control over Codex's level of autonomy. It will make its best attempt with whatever constraints you provide.

## Common sandbox + approvals combinations

| Intent                             | Flags                                                                              | Effect                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safe read-only browsing            | `--sandbox read-only --ask-for-approval on-request`                                | Codex can read files and answer questions. Codex requires approval to make edits, run commands, or access network.                                    |
| Read-only non-interactive (CI)     | `--sandbox read-only --ask-for-approval never`                                     | Reads only; never escalates                                                                                                                           |
| Let it edit the repo, ask if risky | `--sandbox workspace-write --ask-for-approval on-request`                          | Codex can read files, make edits, and run commands in the workspace. Codex requires approval for actions outside the workspace or for network access. |
| Auto (preset)                      | `--full-auto` (equivalent to `--sandbox workspace-write --ask-for-approval never`) | Full workspace access without prompts. Network access still requires approval.                                                                        |
| Danger zone                        | `--sandbox danger-full-access --ask-for-approval never`                            | No restrictions. Codex can edit any file and access the network without approval.                                                                     |
