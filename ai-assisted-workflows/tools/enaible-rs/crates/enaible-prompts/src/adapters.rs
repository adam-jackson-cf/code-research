use anyhow::{anyhow, Result};
use once_cell::sync::Lazy;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize)]
pub struct SystemRenderContext {
    pub name: String,
    pub display_name: String,
    pub project_scope_dir: String,
    pub user_scope_dir: String,
    pub commands_dir: String,
    pub prompts_dir: String,
    pub templates_dir: String,
}

pub static SYSTEM_CONTEXTS: Lazy<HashMap<String, SystemRenderContext>> = Lazy::new(|| {
    let mut contexts = HashMap::new();

    contexts.insert(
        "claude-code".to_string(),
        SystemRenderContext {
            name: "claude-code".to_string(),
            display_name: "Claude Code".to_string(),
            project_scope_dir: ".claude".to_string(),
            user_scope_dir: "~/.claude".to_string(),
            commands_dir: "systems/claude-code/commands".to_string(),
            prompts_dir: "systems/claude-code/prompts".to_string(),
            templates_dir: "docs/system/claude-code/templates".to_string(),
        },
    );

    contexts.insert(
        "codex".to_string(),
        SystemRenderContext {
            name: "codex".to_string(),
            display_name: "Codex".to_string(),
            project_scope_dir: ".codex".to_string(),
            user_scope_dir: "~/.codex".to_string(),
            commands_dir: "systems/codex/commands".to_string(),
            prompts_dir: "systems/codex/prompts".to_string(),
            templates_dir: "docs/system/codex/templates".to_string(),
        },
    );

    contexts.insert(
        "copilot".to_string(),
        SystemRenderContext {
            name: "copilot".to_string(),
            display_name: "GitHub Copilot".to_string(),
            project_scope_dir: ".github".to_string(),
            user_scope_dir: "~/.copilot".to_string(),
            commands_dir: "systems/copilot/commands".to_string(),
            prompts_dir: "systems/copilot/prompts".to_string(),
            templates_dir: "docs/system/copilot/templates".to_string(),
        },
    );

    contexts.insert(
        "cursor".to_string(),
        SystemRenderContext {
            name: "cursor".to_string(),
            display_name: "Cursor".to_string(),
            project_scope_dir: ".cursor".to_string(),
            user_scope_dir: "~/.cursor".to_string(),
            commands_dir: "systems/cursor/commands".to_string(),
            prompts_dir: "systems/cursor/rules".to_string(),
            templates_dir: "docs/system/cursor/templates".to_string(),
        },
    );

    contexts.insert(
        "gemini".to_string(),
        SystemRenderContext {
            name: "gemini".to_string(),
            display_name: "Gemini".to_string(),
            project_scope_dir: ".gemini".to_string(),
            user_scope_dir: "~/.gemini".to_string(),
            commands_dir: "systems/gemini/commands".to_string(),
            prompts_dir: "systems/gemini/prompts".to_string(),
            templates_dir: "docs/system/gemini/templates".to_string(),
        },
    );

    contexts.insert(
        "antigravity".to_string(),
        SystemRenderContext {
            name: "antigravity".to_string(),
            display_name: "Antigravity".to_string(),
            project_scope_dir: ".agent".to_string(),
            user_scope_dir: "~/.gemini/antigravity".to_string(),
            commands_dir: "systems/antigravity/workflows".to_string(),
            prompts_dir: "systems/antigravity/workflows".to_string(),
            templates_dir: "docs/system/antigravity/templates".to_string(),
        },
    );

    contexts
});

pub fn get_system_context(system: &str) -> Result<SystemRenderContext> {
    SYSTEM_CONTEXTS
        .get(system)
        .cloned()
        .ok_or_else(|| anyhow!("Unknown system: {}", system))
}
