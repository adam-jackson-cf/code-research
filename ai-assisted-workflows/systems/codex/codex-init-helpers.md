# Codex helpers

# Codex initialisation helpers

- Use in global terminal settings files to offer shorthand start up of codex for different security policies i.e if using zsh you would put this in .zshrc file.

```bash
# Codex helper
cdx-no-sandbox() {
    codex \
        --model 'gpt-5-codex' \
        --sandbox danger-full-access \
        --ask-for-approval on-failure \
        -c model_reasoning_summary_format=experimental \
        --search \
        "$@"
}

```
