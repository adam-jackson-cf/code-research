use anyhow::Result;
use clap::{Args, Subcommand};
use enaible_core::load_workspace;
use enaible_prompts::{lint_files, split_csv, PromptRenderer, CATALOG};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Subcommand)]
pub enum PromptsCommands {
    /// List prompts known to the catalog
    List,

    /// Render prompts for the selected systems
    Render {
        /// Comma-separated prompt identifiers or 'all'
        #[arg(long, default_value = "all")]
        prompt: String,

        /// Comma-separated system identifiers or 'all'
        #[arg(long, default_value = "all")]
        system: String,

        /// Optional override directory for rendered output
        #[arg(short, long)]
        out: Option<PathBuf>,
    },

    /// Show diffs between catalog output and current files
    Diff {
        /// Comma-separated prompt identifiers or 'all'
        #[arg(long, default_value = "all")]
        prompt: String,

        /// Comma-separated system identifiers or 'all'
        #[arg(long, default_value = "all")]
        system: String,
    },

    /// Validate that rendered prompts match committed files
    Validate {
        /// Comma-separated prompt identifiers or 'all'
        #[arg(long, default_value = "all")]
        prompt: String,

        /// Comma-separated system identifiers or 'all'
        #[arg(long, default_value = "all")]
        system: String,
    },

    /// Lint prompt sources for @TOKEN usage and variable mapping rules
    Lint {
        /// Comma-separated prompt identifiers or 'all'
        #[arg(long, default_value = "all")]
        prompt: String,
    },
}

pub fn handle_command(cmd: PromptsCommands) -> Result<()> {
    match cmd {
        PromptsCommands::List => prompts_list(),
        PromptsCommands::Render { prompt, system, out } => {
            prompts_render(&prompt, &system, out)
        }
        PromptsCommands::Diff { prompt, system } => prompts_diff(&prompt, &system),
        PromptsCommands::Validate { prompt, system } => prompts_validate(&prompt, &system),
        PromptsCommands::Lint { prompt } => prompts_lint(&prompt),
    }
}

fn prompts_list() -> Result<()> {
    let context = load_workspace(None)?;
    let renderer = PromptRenderer::new(context)?;

    for definition in renderer.list_prompts() {
        let systems: Vec<String> = definition.systems.keys().cloned().collect();
        println!(
            "{}: {} [{}]",
            definition.prompt_id,
            definition.title,
            systems.join(", ")
        );
    }

    Ok(())
}

fn resolve_prompt_ids(prompts: &[String]) -> Result<Vec<String>> {
    if prompts.is_empty() || prompts == ["all"] {
        return Ok(CATALOG.keys().cloned().collect());
    }

    let catalog_ids: HashSet<_> = CATALOG.keys().cloned().collect();
    let unknown: Vec<_> = prompts
        .iter()
        .filter(|p| !catalog_ids.contains(*p))
        .collect();

    if !unknown.is_empty() {
        let available: Vec<_> = catalog_ids.into_iter().collect();
        anyhow::bail!(
            "Unknown prompt(s): {}. Available: {}",
            unknown
                .into_iter()
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join(", "),
            available.join(", ")
        );
    }

    Ok(prompts.to_vec())
}

fn resolve_systems(prompt_ids: &[String], systems: &[String]) -> Vec<String> {
    if systems.is_empty() || systems == ["all"] {
        let mut supported = HashSet::new();
        for prompt_id in prompt_ids {
            if let Some(definition) = CATALOG.get(prompt_id) {
                supported.extend(definition.systems.keys().cloned());
            }
        }
        return supported.into_iter().collect();
    }

    systems.to_vec()
}

fn build_overrides(
    selected_systems: &[String],
    out: Option<PathBuf>,
) -> HashMap<String, Option<PathBuf>> {
    let mut overrides = HashMap::new();

    if let Some(out) = out {
        if selected_systems.len() == 1 {
            overrides.insert(selected_systems[0].clone(), Some(out));
        } else {
            for system in selected_systems {
                overrides.insert(system.clone(), Some(out.join(system)));
            }
        }
    } else {
        for system in selected_systems {
            overrides.insert(system.clone(), None);
        }
    }

    overrides
}

fn prompts_render(prompts: &str, systems: &str, out: Option<PathBuf>) -> Result<()> {
    let context = load_workspace(None)?;
    let renderer = PromptRenderer::new(context)?;

    let prompt_args = split_csv(prompts);
    let system_args = split_csv(systems);

    let selected_prompts = resolve_prompt_ids(&prompt_args)?;
    let selected_systems = resolve_systems(&selected_prompts, &system_args);
    let overrides = build_overrides(&selected_systems, out);

    let results = renderer.render(&selected_prompts, &selected_systems, Some(overrides))?;

    for result in results {
        result.write()?;
        println!(
            "Rendered {} for {} → {}",
            result.prompt_id,
            result.system,
            result.output_path.display()
        );
    }

    Ok(())
}

fn prompts_diff(prompts: &str, systems: &str) -> Result<()> {
    let context = load_workspace(None)?;
    let renderer = PromptRenderer::new(context)?;

    let prompt_args = split_csv(prompts);
    let system_args = split_csv(systems);

    let selected_prompts = resolve_prompt_ids(&prompt_args)?;
    let selected_systems = resolve_systems(&selected_prompts, &system_args);

    let results = renderer.render(&selected_prompts, &selected_systems, None)?;

    let mut has_diff = false;
    for result in results {
        let diff_output = result.diff()?;
        if !diff_output.is_empty() {
            has_diff = true;
            println!("{}", diff_output);
        }
    }

    if has_diff {
        std::process::exit(1);
    }

    Ok(())
}

fn prompts_validate(prompts: &str, systems: &str) -> Result<()> {
    match prompts_diff(prompts, systems) {
        Ok(_) => Ok(()),
        Err(_) => {
            eprintln!("Prompt drift detected. Run `enaible prompts render` to update.");
            std::process::exit(1);
        }
    }
}

fn prompts_lint(prompts: &str) -> Result<()> {
    let context = load_workspace(None)?;

    let prompt_args = split_csv(prompts);
    let selected_prompts = resolve_prompt_ids(&prompt_args)?;

    // Collect unique source files for selected prompts
    let mut files = HashSet::new();
    for prompt_id in &selected_prompts {
        if let Some(definition) = CATALOG.get(prompt_id) {
            let path = context.repo_root.join(&definition.source_path);
            files.insert(path);
        }
    }

    // Also lint unmanaged, hand-authored system prompts
    let generated_sentinel = "<!-- generated: enaible -->";
    let system_dirs = [
        context.repo_root.join("systems/claude-code/commands"),
        context.repo_root.join("systems/codex/prompts"),
        context.repo_root.join("systems/copilot/prompts"),
        context.repo_root.join("systems/cursor/rules"),
    ];

    for dir in &system_dirs {
        if !dir.exists() {
            continue;
        }

        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                if name.to_lowercase() == "agents.md" {
                    continue;
                }

                if let Ok(content) = std::fs::read_to_string(&path) {
                    let head: Vec<_> = content.lines().take(3).collect();
                    if head.iter().any(|line| line.contains(generated_sentinel)) {
                        continue;
                    }
                    files.insert(path);
                }
            }
        }
    }

    let issues = lint_files(&files)?;
    if issues.is_empty() {
        println!("prompts: lint passed");
    } else {
        for issue in &issues {
            println!("{}:{}: {}", issue.path, issue.line, issue.message);
        }
        std::process::exit(1);
    }

    Ok(())
}