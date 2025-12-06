use anyhow::Result;
use clap::Args;
use enaible_core::{find_shared_root, load_workspace};
use serde_json::json;
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;
use std::process::Command;

#[derive(Args)]
pub struct ContextCaptureArgs {
    /// Target platform to capture context for
    #[arg(short, long)]
    platform: String,

    /// Number of days to look back
    #[arg(long, default_value = "2")]
    days: u32,

    /// Filter to a specific session UUID
    #[arg(long)]
    uuid: Option<String>,

    /// Search for sessions containing this term
    #[arg(long)]
    search_term: Option<String>,

    /// JSON string describing semantic variations for search_term
    #[arg(long)]
    semantic_variations: Option<String>,

    /// Absolute path to project root for scoping
    #[arg(long)]
    project_root: Option<PathBuf>,

    /// Include sessions across all projects instead of scoping to one
    #[arg(long)]
    include_all_projects: bool,

    /// Output format (json or text)
    #[arg(long, default_value = "json")]
    output_format: String,
}

#[derive(Args)]
pub struct DocsScrapeArgs {
    /// URL to scrape
    url: String,

    /// Destination markdown file
    out: PathBuf,

    /// Override document title
    #[arg(long)]
    title: Option<String>,

    /// Enable verbose logging for the scraper
    #[arg(short, long)]
    verbose: bool,
}

#[derive(Args)]
pub struct AuthCheckArgs {
    /// CLI to verify authentication for
    #[arg(long)]
    cli: String,

    /// Optional path to append auth status output to
    #[arg(long)]
    report: Option<PathBuf>,
}

pub fn version() {
    let version = env!("CARGO_PKG_VERSION");
    println!("enaible {}", version);
}

pub fn doctor(json: bool) -> Result<()> {
    let mut report = HashMap::new();
    let mut checks = HashMap::new();
    let mut errors = Vec::new();
    let mut exit_code = 0;

    // Check Python version
    let python_version = Command::new("python3")
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_else(|| "Unknown".to_string());
    report.insert("python", python_version.trim().to_string());

    // Check for shared workspace
    let shared_root = find_shared_root();
    if let Some(root) = &shared_root {
        checks.insert("shared_workspace", true);
        report.insert("shared_root", root.display().to_string());

        let registry_path = root.join("core").join("base").join("analyzer_registry.py");
        if registry_path.exists() {
            checks.insert("analyzer_registry", true);
        } else {
            checks.insert("analyzer_registry", false);
            errors.push("Analyzer registry module not found under shared/core/base".to_string());
            exit_code = 1;
        }
    } else {
        checks.insert("shared_workspace", false);
        checks.insert("analyzer_registry", false);
        errors.push(
            "Shared workspace not found. Re-run `enaible install ... --sync-shared`".to_string(),
        );
        exit_code = 1;
    }

    // Check workspace
    match load_workspace(None) {
        Ok(context) => {
            checks.insert("workspace", true);
            report.insert("repo_root", context.repo_root.display().to_string());

            let schema_path = context.repo_root.join(".enaible").join("schema.json");
            checks.insert("schema_exists", schema_path.exists());
        }
        Err(e) => {
            checks.insert("workspace", false);
            errors.push(format!("{}", e));
        }
    }

    report.insert("enaible_version", env!("CARGO_PKG_VERSION").to_string());

    if json {
        let json_report = json!({
            "python": report.get("python").unwrap_or(&"Unknown".to_string()),
            "enaible_version": report.get("enaible_version").unwrap(),
            "checks": checks,
            "errors": errors,
            "repo_root": report.get("repo_root"),
            "shared_root": report.get("shared_root"),
        });
        println!("{}", serde_json::to_string_pretty(&json_report)?);
    } else {
        println!("Enaible Diagnostics");
        if let Some(repo) = report.get("repo_root") {
            println!("  Repo root: {}", repo);
        }
        if let Some(python) = report.get("python") {
            println!("  Python: {}", python);
        }
        println!("  Enaible: {}", report.get("enaible_version").unwrap());

        for (name, passed) in &checks {
            let status = if *passed { "OK" } else { "FAIL" };
            println!("  {}: {}", name.replace('_', " "), status);
        }

        if !errors.is_empty() {
            println!("Errors:");
            for err in &errors {
                println!("  - {}", err);
            }
        }
    }

    if exit_code != 0 {
        std::process::exit(exit_code);
    }

    Ok(())
}

pub fn context_capture(args: ContextCaptureArgs) -> Result<()> {
    let workspace = load_workspace(None)?;

    let script_path = match args.platform.as_str() {
        "claude" => workspace
            .repo_root
            .join("shared")
            .join("context")
            .join("context_bundle_capture_claude.py"),
        "codex" => workspace
            .repo_root
            .join("shared")
            .join("context")
            .join("context_bundle_capture_codex.py"),
        _ => anyhow::bail!("Unknown platform: {}", args.platform),
    };

    if !script_path.exists() {
        anyhow::bail!("Context capture script not found at {}", script_path.display());
    }

    let mut cmd = Command::new("python3");
    cmd.arg(&script_path)
        .arg("--days")
        .arg(args.days.to_string())
        .arg("--output-format")
        .arg(&args.output_format);

    if let Some(uuid) = &args.uuid {
        cmd.arg("--uuid").arg(uuid);
    }
    if let Some(term) = &args.search_term {
        cmd.arg("--search-term").arg(term);
    }
    if let Some(variations) = &args.semantic_variations {
        cmd.arg("--semantic-variations").arg(variations);
    }
    if let Some(root) = &args.project_root {
        cmd.arg("--project-root").arg(root);
    }
    if args.include_all_projects {
        cmd.arg("--include-all-projects");
    }

    // Add shared root to PYTHONPATH
    let mut env_vars = env::vars().collect::<HashMap<_, _>>();
    let pythonpath = env_vars
        .get("PYTHONPATH")
        .map(|p| format!("{}:{}", workspace.shared_root.display(), p))
        .unwrap_or_else(|| workspace.shared_root.display().to_string());
    env_vars.insert("PYTHONPATH".to_string(), pythonpath);

    cmd.envs(&env_vars);

    let status = cmd.status()?;
    if !status.success() {
        std::process::exit(status.code().unwrap_or(1));
    }

    Ok(())
}

pub fn docs_scrape(args: DocsScrapeArgs) -> Result<()> {
    let workspace = load_workspace(None)?;

    let mut cmd = Command::new("python3");
    cmd.arg("-m").arg("web_scraper.cli");

    if args.verbose {
        cmd.arg("-v");
    }

    cmd.arg("save-as-markdown")
        .arg(&args.url)
        .arg(&args.out);

    if let Some(title) = &args.title {
        cmd.arg("--title").arg(title);
    }

    // Add shared root to PYTHONPATH
    let mut env_vars = env::vars().collect::<HashMap<_, _>>();
    let pythonpath = env_vars
        .get("PYTHONPATH")
        .map(|p| format!("{}:{}", workspace.shared_root.display(), p))
        .unwrap_or_else(|| workspace.shared_root.display().to_string());
    env_vars.insert("PYTHONPATH".to_string(), pythonpath);

    cmd.envs(&env_vars);

    let status = cmd.status()?;
    if !status.success() {
        std::process::exit(status.code().unwrap_or(1));
    }

    Ok(())
}

pub fn auth_check(args: AuthCheckArgs) -> Result<()> {
    let workspace = load_workspace(None)?;

    let script = workspace
        .repo_root
        .join("shared")
        .join("tests")
        .join("integration")
        .join("fixtures")
        .join("check-ai-cli-auth.sh");

    if !script.exists() {
        anyhow::bail!(
            "Auth check script not found under shared/tests/integration/fixtures"
        );
    }

    let mut cmd = Command::new("bash");
    cmd.arg(&script).arg(&args.cli);

    if let Some(report) = &args.report {
        cmd.arg("--report").arg(report);
    }

    let status = cmd.status()?;
    if !status.success() {
        std::process::exit(status.code().unwrap_or(1));
    }

    Ok(())
}