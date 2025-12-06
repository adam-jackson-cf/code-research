use anyhow::Result;
use chrono::Utc;
use clap::Subcommand;
use enaible_analyzers::{
    AnalyzerRegistry, AnalysisResult, create_analyzer_config, bootstrap_registry,
};
use enaible_core::load_workspace;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Subcommand)]
pub enum AnalyzersCommands {
    /// Run a registered analyzer and emit normalized results
    Run {
        /// Analyzer registry key (e.g. quality:lizard)
        tool: String,

        /// Path to analyze
        #[arg(short, long, default_value = ".")]
        target: PathBuf,

        /// Emit normalized JSON payload (default)
        #[arg(long, default_value = "true")]
        json: bool,

        /// Optional file to write result JSON to
        #[arg(short, long)]
        out: Option<PathBuf>,

        /// Minimum severity to include in findings
        #[arg(long, default_value = "high")]
        min_severity: String,

        /// Limit the number of files processed
        #[arg(long)]
        max_files: Option<usize>,

        /// Return a severity summary only (omits full findings)
        #[arg(long)]
        summary: bool,

        /// Enable verbose analyzer logs
        #[arg(long)]
        verbose: bool,

        /// Disable analyzer features requiring external dependencies
        #[arg(long)]
        no_external: bool,

        /// Additional glob patterns to exclude (repeatable)
        #[arg(short = 'x', long = "exclude")]
        exclude_glob: Vec<String>,
    },

    /// List all registered analyzers
    List {
        /// Emit JSON output
        #[arg(long, default_value = "true")]
        json: bool,
    },
}

#[derive(Serialize, Deserialize)]
struct AnalyzerRunResponse {
    tool: String,
    findings: Vec<HashMap<String, serde_json::Value>>,
    summary: HashMap<String, usize>,
    metadata: HashMap<String, String>,
    started_at: f64,
    finished_at: f64,
    exit_code: i32,
}

impl AnalyzerRunResponse {
    fn from_analysis_result(
        tool: &str,
        result: AnalysisResult,
        started_at: f64,
        finished_at: f64,
        min_severity: &str,
    ) -> Self {
        let mut findings = Vec::new();

        // Filter findings by severity
        let severity_order = ["critical", "high", "medium", "low"];
        let min_index = severity_order
            .iter()
            .position(|&s| s == min_severity)
            .unwrap_or(1);

        for finding in result.findings {
            let finding_index = severity_order
                .iter()
                .position(|&s| s == finding.severity.as_str())
                .unwrap_or(3);

            if finding_index <= min_index {
                let mut map = HashMap::new();
                map.insert("path".to_string(), serde_json::json!(finding.path));
                map.insert("line".to_string(), serde_json::json!(finding.line));
                map.insert("column".to_string(), serde_json::json!(finding.column));
                map.insert("severity".to_string(), serde_json::json!(finding.severity));
                map.insert("category".to_string(), serde_json::json!(finding.category));
                map.insert("message".to_string(), serde_json::json!(finding.message));
                if let Some(suggestion) = finding.suggestion {
                    map.insert("suggestion".to_string(), serde_json::json!(suggestion));
                }
                findings.push(map);
            }
        }

        let exit_code = if findings.is_empty() { 0 } else { 1 };

        Self {
            tool: tool.to_string(),
            findings,
            summary: result.summary,
            metadata: result.metadata,
            started_at,
            finished_at,
            exit_code,
        }
    }
}

pub fn handle_command(cmd: AnalyzersCommands) -> Result<()> {
    // Bootstrap the registry
    bootstrap_registry();

    match cmd {
        AnalyzersCommands::Run {
            tool,
            target,
            json,
            out,
            min_severity,
            max_files,
            summary,
            verbose,
            no_external,
            exclude_glob,
        } => analyzers_run(
            &tool,
            &target,
            json,
            out,
            &min_severity,
            max_files,
            summary,
            verbose,
            no_external,
            exclude_glob,
        ),
        AnalyzersCommands::List { json } => analyzers_list(json),
    }
}

fn collect_gitignore_patterns(search_root: &Path) -> Vec<String> {
    let mut patterns = Vec::new();
    let mut seen_files = std::collections::HashSet::new();

    let mut current = if search_root.exists() {
        search_root.to_path_buf()
    } else {
        std::env::current_dir().unwrap_or_default()
    };

    if current.is_file() {
        current = current.parent().unwrap_or(&current).to_path_buf();
    }

    loop {
        let candidate = current.join(".gitignore");
        if !seen_files.contains(&candidate) && candidate.is_file() {
            if let Ok(content) = fs::read_to_string(&candidate) {
                for line in content.lines() {
                    let stripped = line.trim();
                    if !stripped.is_empty() && !stripped.starts_with('#') {
                        patterns.push(stripped.to_string());
                    }
                }
                seen_files.insert(candidate);
            }
        }

        match current.parent() {
            Some(parent) => current = parent.to_path_buf(),
            None => break,
        }
    }

    patterns
}

fn analyzers_run(
    tool: &str,
    target: &Path,
    json_output: bool,
    out: Option<PathBuf>,
    min_severity: &str,
    max_files: Option<usize>,
    summary_mode: bool,
    _verbose: bool,
    no_external: bool,
    exclude_glob: Vec<String>,
) -> Result<()> {
    let _context = load_workspace(None)?;

    if no_external {
        std::env::set_var("ENAIBLE_DISABLE_EXTERNAL", "1");
    }

    let gitignore_patterns = collect_gitignore_patterns(target);

    let output_format = if json_output { "json" } else { "console" };
    let mut config = create_analyzer_config(
        &target.to_string_lossy(),
        min_severity,
        summary_mode,
        output_format,
    );

    config.gitignore_patterns = gitignore_patterns;
    config.exclude_globs.extend(exclude_glob);
    if let Some(max) = max_files {
        config.max_files = Some(max);
    }

    let registry = AnalyzerRegistry::global();
    let analyzer = registry.create(tool, &config)?;

    let started = Utc::now().timestamp() as f64;
    let result = analyzer.analyze(&target.to_string_lossy())?;
    let finished = Utc::now().timestamp() as f64;

    let response = AnalyzerRunResponse::from_analysis_result(
        tool,
        result,
        started,
        finished,
        min_severity,
    );

    if json_output {
        let json_str = serde_json::to_string_pretty(&response)?;
        if let Some(out_path) = out {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(out_path, json_str)?;
        } else {
            println!("{}", json_str);
        }
    } else if let Some(out_path) = out {
        let json_str = serde_json::to_string_pretty(&response)?;
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(out_path, json_str)?;
    }

    if response.findings.len() >= 200 {
        eprintln!(
            "Hint: If some findings look third-party or generated, rerun with \
            `--exclude <glob>` to filter those directories."
        );
    }

    std::process::exit(response.exit_code);
}

fn analyzers_list(json_output: bool) -> Result<()> {
    let _context = load_workspace(None)?;

    let registry = AnalyzerRegistry::global();
    let analyzers: Vec<_> = registry.list();

    if json_output {
        let json_data = serde_json::json!({
            "analyzers": analyzers.iter().map(|name| {
                serde_json::json!({
                    "tool": name,
                    "doc": "",  // Would need to get from analyzer
                    "module": format!("analyzers.{}", name),
                })
            }).collect::<Vec<_>>()
        });
        println!("{}", serde_json::to_string_pretty(&json_data)?);
    } else {
        for name in analyzers {
            println!("{}: analyzers.{}", name, name);
        }
    }

    Ok(())
}