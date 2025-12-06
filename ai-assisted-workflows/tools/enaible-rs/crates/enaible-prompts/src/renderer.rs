use crate::adapters::{get_system_context, SystemRenderContext};
use crate::catalog::{PromptDefinition, SystemPromptConfig, CATALOG};
use crate::utils::{extract_variables, VariableSpec};
use anyhow::{Context, Result};
use enaible_core::{WorkspaceContext, MANAGED_SENTINEL};
use minijinja::{context, Environment, Value};
use serde::Serialize;
use similar::{ChangeTag, TextDiff};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct RenderResult {
    pub prompt_id: String,
    pub system: String,
    pub content: String,
    pub output_path: PathBuf,
}

impl RenderResult {
    pub fn write(&self) -> Result<()> {
        if let Some(parent) = self.output_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&self.output_path, &self.content)?;
        Ok(())
    }

    pub fn diff(&self) -> Result<String> {
        if !self.output_path.exists() {
            return Ok(String::new());
        }

        let current = fs::read_to_string(&self.output_path)?;
        let diff = TextDiff::from_lines(&current, &self.content);

        let mut output = String::new();
        output.push_str(&format!(
            "--- {}\n+++ {} (generated)\n",
            self.output_path.display(),
            self.output_path.display()
        ));

        for change in diff.iter_all_changes() {
            let prefix = match change.tag() {
                ChangeTag::Delete => "-",
                ChangeTag::Insert => "+",
                ChangeTag::Equal => " ",
            };
            output.push_str(&format!("{}{}", prefix, change));
        }

        Ok(output)
    }
}

pub struct PromptRenderer {
    context: WorkspaceContext,
    env: Environment<'static>,
}

impl PromptRenderer {
    pub fn new(context: WorkspaceContext) -> Result<Self> {
        let mut env = Environment::new();

        // Set up template loader from repository root
        let repo_root = context.repo_root.clone();
        env.set_loader(move |name| {
            let path = repo_root.join(name);
            match fs::read_to_string(&path) {
                Ok(content) => Ok(Some(content)),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
                Err(e) => Err(minijinja::Error::new(
                    minijinja::ErrorKind::InvalidOperation,
                    format!("Failed to read template {}: {}", name, e),
                )),
            }
        });

        // Configure environment similar to Jinja2 in Python
        env.set_trim_blocks(true);
        env.set_lstrip_blocks(true);

        Ok(Self { context, env })
    }

    pub fn list_prompts(&self) -> Vec<PromptDefinition> {
        CATALOG.values().cloned().collect()
    }

    pub fn render(
        &self,
        prompt_ids: &[String],
        systems: &[String],
        output_override: Option<HashMap<String, Option<PathBuf>>>,
    ) -> Result<Vec<RenderResult>> {
        let mut results = Vec::new();

        for prompt_id in prompt_ids {
            let definition = CATALOG
                .get(prompt_id)
                .ok_or_else(|| anyhow::anyhow!("Unknown prompt: {}", prompt_id))?;

            for system in systems {
                let Some(config) = definition.systems.get(system) else {
                    continue;
                };

                let system_context = get_system_context(system)?;
                let rendered_body = self.render_body(definition, &system_context, config)?;
                let (variables, stripped_body) = extract_variables(&rendered_body);

                let content = self.render_wrapper(
                    definition,
                    &system_context,
                    config,
                    &stripped_body,
                    &variables,
                )?;

                let output_path = self.resolve_output_path(
                    config,
                    system,
                    output_override.as_ref(),
                );

                results.push(RenderResult {
                    prompt_id: prompt_id.clone(),
                    system: system.clone(),
                    content: ensure_trailing_newline(content),
                    output_path,
                });
            }
        }

        Ok(results)
    }

    fn render_body(
        &self,
        definition: &PromptDefinition,
        system_context: &SystemRenderContext,
        config: &SystemPromptConfig,
    ) -> Result<String> {
        let source_path = self.context.repo_root.join(&definition.source_path);
        let body = fs::read_to_string(&source_path)
            .with_context(|| format!("Failed to read {}", source_path.display()))?;

        // Render the source prompt through Jinja2 template engine
        let template = self.env.template_from_str(&body)
            .with_context(|| format!("Failed to parse template from {}", source_path.display()))?;

        // Create context for body template
        let metadata: HashMap<String, String> = config.metadata.clone();

        let rendered = template.render(context! {
            prompt => PromptValue::from(definition),
            system => system_context,
            metadata => metadata,
        }).with_context(|| format!("Failed to render body template for {}", definition.prompt_id))?;

        // Replace @SYSTEMS.md placeholder with system-specific file
        let systems_file = if system_context.name == "claude-code" {
            "CLAUDE.md"
        } else {
            "AGENTS.md"
        };
        let result = rendered.replace("@SYSTEMS.md", systems_file);

        Ok(result)
    }

    fn render_wrapper(
        &self,
        definition: &PromptDefinition,
        system_context: &SystemRenderContext,
        config: &SystemPromptConfig,
        body: &str,
        variables: &[VariableSpec],
    ) -> Result<String> {
        // Strip legacy title from body
        let body_cleaned = strip_legacy_title(body);

        // Load the wrapper template
        let template = self.env.get_template(&config.template)
            .with_context(|| format!("Failed to load template {}", config.template))?;

        // Build argument hint from variables
        let argument_hint = argument_hint_from_variables(variables);

        // Build frontmatter with argument-hint
        let mut frontmatter: HashMap<String, Value> = config.frontmatter.iter()
            .map(|(k, v)| (k.clone(), Value::from(v.clone())))
            .collect();

        if !argument_hint.is_empty() && !frontmatter.contains_key("argument-hint") {
            frontmatter.insert("argument-hint".to_string(), Value::from(argument_hint));
        }

        // Build context for wrapper template
        let metadata: HashMap<String, String> = config.metadata.clone();

        let rendered = template.render(context! {
            title => definition.title,
            body => body_cleaned.trim().to_string() + "\n",
            prompt => PromptValue::from(definition),
            system => system_context,
            frontmatter => frontmatter,
            metadata => metadata,
            variables => variables,
            managed_sentinel => MANAGED_SENTINEL,
        }).with_context(|| format!("Failed to render wrapper template {}", config.template))?;

        Ok(rendered)
    }

    fn resolve_output_path(
        &self,
        config: &SystemPromptConfig,
        system: &str,
        overrides: Option<&HashMap<String, Option<PathBuf>>>,
    ) -> PathBuf {
        if let Some(overrides) = overrides {
            if let Some(override_path) = overrides.get(system) {
                if let Some(path) = override_path {
                    return path.clone();
                }
            }
        }

        self.context.repo_root.join(&config.output_path)
    }
}

// Helper struct for prompt template values
#[derive(Debug, Clone, Serialize)]
struct PromptValue {
    prompt_id: String,
    title: String,
    source_path: String,
}

impl From<&PromptDefinition> for PromptValue {
    fn from(def: &PromptDefinition) -> Self {
        Self {
            prompt_id: def.prompt_id.clone(),
            title: def.title.clone(),
            source_path: def.source_path.to_string_lossy().to_string(),
        }
    }
}

fn strip_legacy_title(body: &str) -> String {
    let lines: Vec<&str> = body.lines().collect();
    let mut idx = 0;

    // Skip leading empty lines
    while idx < lines.len() && lines[idx].trim().is_empty() {
        idx += 1;
    }

    // Check for legacy title pattern (# Something v1.0)
    if idx < lines.len() {
        let line = lines[idx].trim();
        if line.starts_with('#') && regex::Regex::new(r"v\d+(\.\d+)*\s*$").unwrap().is_match(line) {
            idx += 1;
            // Skip trailing empty lines after title
            while idx < lines.len() && lines[idx].trim().is_empty() {
                idx += 1;
            }
        }
    }

    lines[idx..].join("\n")
}

fn argument_hint_from_variables(variables: &[VariableSpec]) -> String {
    let mut tokens = Vec::new();

    // Positional variables first
    let mut positional: Vec<_> = variables.iter()
        .filter(|v| v.kind == "positional")
        .collect();
    positional.sort_by_key(|v| v.positional_index.unwrap_or(0));

    // Flag variables second
    let mut flags: Vec<_> = variables.iter()
        .filter(|v| v.kind == "flag" || v.kind == "named")
        .collect();
    flags.sort_by_key(|v| {
        v.flag_name.as_ref()
            .unwrap_or(&v.name)
            .to_lowercase()
    });

    for var in positional {
        let label = var.name.trim_start_matches(['$', '@'])
            .to_lowercase()
            .replace('_', "-");
        let formatted = if var.required {
            format!("[{}]", label)
        } else {
            format!("[{}?]", label)
        };
        tokens.push(formatted);
    }

    for var in flags {
        let base = var.flag_name.as_ref()
            .unwrap_or(&var.name)
            .trim_start_matches(['$', '@'])
            .to_lowercase();
        let formatted = if var.required {
            format!("[{}]", base)
        } else {
            format!("[{}?]", base)
        };
        tokens.push(formatted);
    }

    tokens.join(" ")
}

fn ensure_trailing_newline(mut content: String) -> String {
    if !content.ends_with('\n') {
        content.push('\n');
    }
    content
}
