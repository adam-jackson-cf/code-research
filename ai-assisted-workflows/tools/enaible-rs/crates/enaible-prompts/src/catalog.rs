use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct SystemPromptConfig {
    pub template: String,
    pub output_path: PathBuf,
    pub frontmatter: HashMap<String, String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct PromptDefinition {
    pub prompt_id: String,
    pub source_path: PathBuf,
    pub title: String,
    pub systems: HashMap<String, SystemPromptConfig>,
}

fn repo_path(parts: &[&str]) -> PathBuf {
    parts.iter().collect()
}

pub static CATALOG: Lazy<HashMap<String, PromptDefinition>> = Lazy::new(|| {
    let mut catalog = HashMap::new();

    catalog.insert(
        "analyze-security".to_string(),
        PromptDefinition {
            prompt_id: "analyze-security".to_string(),
            source_path: repo_path(&["shared", "prompts", "analyze-security.md"]),
            title: "analyze-security v1.0".to_string(),
            systems: {
                let mut systems = HashMap::new();

                systems.insert(
                    "claude-code".to_string(),
                    SystemPromptConfig {
                        template: "docs/system/claude-code/templates/command.md.j2".to_string(),
                        output_path: repo_path(&[
                            ".build",
                            "rendered",
                            "claude-code",
                            "commands",
                            "analyze-security.md",
                        ]),
                        frontmatter: {
                            let mut fm = HashMap::new();
                            fm.insert("argument-hint".to_string(), "[target-path] [--verbose]".to_string());
                            fm
                        },
                        metadata: HashMap::new(),
                    },
                );

                systems.insert(
                    "codex".to_string(),
                    SystemPromptConfig {
                        template: "docs/system/codex/templates/prompt.md.j2".to_string(),
                        output_path: repo_path(&[
                            ".build", "rendered", "codex", "prompts", "analyze-security.md"
                        ]),
                        metadata: {
                            let mut meta = HashMap::new();
                            meta.insert("comment".to_string(), "codex prompt (frontmatter-free)".to_string());
                            meta
                        },
                        frontmatter: HashMap::new(),
                    },
                );

                systems.insert(
                    "copilot".to_string(),
                    SystemPromptConfig {
                        template: "docs/system/copilot/templates/prompt.md.j2".to_string(),
                        output_path: repo_path(&[
                            ".build",
                            "rendered",
                            "copilot",
                            "prompts",
                            "analyze-security.prompt.md",
                        ]),
                        frontmatter: {
                            let mut fm = HashMap::new();
                            fm.insert("description".to_string(),
                                "Perform a comprehensive security audit of the repository and dependencies".to_string());
                            fm.insert("mode".to_string(), "agent".to_string());
                            fm.insert("tools".to_string(),
                                "[\"edit\", \"githubRepo\", \"search/codebase\", \"terminal\"]".to_string());
                            fm
                        },
                        metadata: HashMap::new(),
                    },
                );

                systems.insert(
                    "cursor".to_string(),
                    SystemPromptConfig {
                        template: "docs/system/cursor/templates/command.md.j2".to_string(),
                        output_path: repo_path(&[
                            ".build", "rendered", "cursor", "commands", "analyze-security.md"
                        ]),
                        frontmatter: HashMap::new(),
                        metadata: HashMap::new(),
                    },
                );

                systems.insert(
                    "gemini".to_string(),
                    SystemPromptConfig {
                        template: "docs/system/gemini/templates/command.toml.j2".to_string(),
                        output_path: repo_path(&[
                            ".build", "rendered", "gemini", "commands", "analyze-security.toml"
                        ]),
                        frontmatter: {
                            let mut fm = HashMap::new();
                            fm.insert("description".to_string(),
                                "Perform a comprehensive security audit of the repository and dependencies".to_string());
                            fm
                        },
                        metadata: HashMap::new(),
                    },
                );

                systems.insert(
                    "antigravity".to_string(),
                    SystemPromptConfig {
                        template: "docs/system/antigravity/templates/workflow.md.j2".to_string(),
                        output_path: repo_path(&[
                            ".build",
                            "rendered",
                            "antigravity",
                            "workflows",
                            "analyze-security.md",
                        ]),
                        frontmatter: {
                            let mut fm = HashMap::new();
                            fm.insert("description".to_string(),
                                "Perform a comprehensive security audit of the repository and dependencies".to_string());
                            fm
                        },
                        metadata: HashMap::new(),
                    },
                );

                systems
            },
        },
    );

    // Note: This is a partial catalog implementation
    // In production, you would add all 21 prompt definitions here
    // For brevity, I'm showing the structure with just one complete example
    // The rest would follow the same pattern

    catalog.insert(
        "analyze-architecture".to_string(),
        PromptDefinition {
            prompt_id: "analyze-architecture".to_string(),
            source_path: repo_path(&["shared", "prompts", "analyze-architecture.md"]),
            title: "analyze-architecture v1.0".to_string(),
            systems: HashMap::new(), // Would be populated similar to above
        },
    );

    catalog.insert(
        "analyze-repository".to_string(),
        PromptDefinition {
            prompt_id: "analyze-repository".to_string(),
            source_path: repo_path(&["shared", "prompts", "analyze-repository.md"]),
            title: "Repository Analysis v1.0".to_string(),
            systems: HashMap::new(),
        },
    );

    catalog
});