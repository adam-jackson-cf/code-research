# Config

**Source:** https://github.com/openai/codex/blob/main/docs/config.md
**Scraped:** 2025-10-06

Codex supports several mechanisms for setting config values:

- Config-specific command-line flags, such as `--model o3` (highest precedence).
- A generic `-c/--config` flag that takes a `key=value` pair.
- The `$CODEX_HOME/config.toml` configuration file.

## model

The model that Codex should use.

```toml
model = "o3" # overrides the default of "gpt-5-codex"
```

## model_providers

This option lets you override and amend the default set of model providers bundled with Codex. This value is a map where the key is the value to use with `model_provider` to select the corresponding provider.

For example, if you wanted to add a provider that uses the OpenAI 4o model via the chat completions API, then you could add the following configuration:

```toml
# Recall that in TOML, root keys must be listed before tables.
model = "gpt-4o"
model_provider = "openai-chat-completions"

[model_providers.openai-chat-completions]
# Name of the provider that will be displayed in the Codex UI.
name = "OpenAI using Chat Completions"
# The path `/chat/completions` will be amended to this URL to make the POST
# request for the chat completions.
base_url = "https://api.openai.com/v1"
# If `env_key` is set, identifies an environment variable that must be set when
# using Codex with this provider. The value of the environment variable must be
# non-empty and will be used in the `Bearer TOKEN` HTTP header for the POST request.
env_key = "OPENAI_API_KEY"
# Valid values for wire_api are "chat" and "responses". Defaults to "chat" if omitted.
wire_api = "chat"
# If necessary, extra query params that need to be added to the URL.
# See the Azure example below.
query_params = {}
```

Note this makes it possible to use Codex CLI with non-OpenAI models, so long as they use a wire API that is compatible with the OpenAI chat completions API. For example, you could define the following provider to use Codex CLI with Ollama running locally:

```toml
[model_providers.ollama]
name = "Ollama"
base_url = "http://localhost:11434/v1"
wire_api = "chat"
```
