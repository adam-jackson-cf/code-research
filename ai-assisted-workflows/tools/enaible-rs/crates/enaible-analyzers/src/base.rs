use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzerConfig {
    // Core settings
    pub target_path: String,
    pub output_format: String,
    pub min_severity: String,
    pub summary_mode: bool,

    // File filtering
    pub code_extensions: HashSet<String>,
    pub skip_patterns: HashSet<String>,
    pub gitignore_patterns: Vec<String>,
    pub exclude_globs: HashSet<String>,

    // Analysis settings
    pub max_files: Option<usize>,
    pub max_file_size_mb: usize,
    pub batch_size: usize,
    pub timeout_seconds: Option<u64>,

    // Severity thresholds
    pub severity_thresholds: HashMap<String, f64>,
}

impl Default for AnalyzerConfig {
    fn default() -> Self {
        let mut code_extensions = HashSet::new();
        code_extensions.extend(vec![
            ".py", ".js", ".ts", ".java", ".cs", ".php", ".rb", ".go",
            ".sql", ".prisma", ".kt", ".scala", ".cpp", ".c", ".h", ".hpp",
            ".swift", ".rs", ".dart", ".vue", ".jsx", ".tsx", ".xml",
            ".json", ".yml", ".yaml",
        ]
        .into_iter()
        .map(String::from));

        let mut skip_patterns = HashSet::new();
        skip_patterns.extend(vec![
            "node_modules", ".git", "__pycache__", ".pytest_cache", "venv",
            "env", ".venv", "dist", "build", ".next", "coverage",
            ".nyc_output", "target", "vendor", "migrations", ".cache",
            ".tmp", "temp", "logs", "bin", "obj", "Debug", "Release",
        ]
        .into_iter()
        .map(String::from));

        let mut severity_thresholds = HashMap::new();
        severity_thresholds.insert("critical".to_string(), 0.9);
        severity_thresholds.insert("high".to_string(), 0.7);
        severity_thresholds.insert("medium".to_string(), 0.5);
        severity_thresholds.insert("low".to_string(), 0.3);

        Self {
            target_path: ".".to_string(),
            output_format: "json".to_string(),
            min_severity: "high".to_string(),
            summary_mode: false,
            code_extensions,
            skip_patterns,
            gitignore_patterns: Vec::new(),
            exclude_globs: HashSet::new(),
            max_files: None,
            max_file_size_mb: 5,
            batch_size: 200,
            timeout_seconds: None,
            severity_thresholds,
        }
    }
}

impl AnalyzerConfig {
    pub fn validate(&self) -> Result<()> {
        if let Some(max_files) = self.max_files {
            if max_files == 0 {
                anyhow::bail!("max_files must be positive");
            }
        }
        if self.max_file_size_mb == 0 {
            anyhow::bail!("max_file_size_mb must be positive");
        }
        if self.batch_size == 0 {
            anyhow::bail!("batch_size must be positive");
        }
        if let Some(timeout) = self.timeout_seconds {
            if timeout == 0 {
                anyhow::bail!("timeout_seconds must be positive");
            }
        }
        Ok(())
    }

    pub fn should_skip_path(&self, path: &Path) -> bool {
        for component in path.components() {
            if let Some(name) = component.as_os_str().to_str() {
                if self.skip_patterns.contains(name) {
                    return true;
                }
            }
        }

        // Check gitignore patterns
        let path_str = path.to_string_lossy();
        for pattern in &self.gitignore_patterns {
            if glob::Pattern::new(pattern)
                .map(|p| p.matches(&path_str))
                .unwrap_or(false)
            {
                return true;
            }
        }

        // Check exclude globs
        for glob in &self.exclude_globs {
            if glob::Pattern::new(glob)
                .map(|p| p.matches(&path_str))
                .unwrap_or(false)
            {
                return true;
            }
        }

        false
    }

    pub fn is_code_file(&self, path: &Path) -> bool {
        if let Some(ext) = path.extension() {
            let ext_str = format!(".{}", ext.to_string_lossy());
            self.code_extensions.contains(&ext_str)
        } else {
            false
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub path: String,
    pub line: usize,
    pub column: usize,
    pub severity: String,
    pub category: String,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub findings: Vec<Finding>,
    pub summary: HashMap<String, usize>,
    pub metadata: HashMap<String, String>,
}

impl Default for AnalysisResult {
    fn default() -> Self {
        Self {
            findings: Vec::new(),
            summary: HashMap::new(),
            metadata: HashMap::new(),
        }
    }
}

/// Base trait for all analyzers
pub trait Analyzer: Send + Sync {
    /// Analyze the target and return results
    fn analyze(&self, target: &str) -> Result<AnalysisResult>;

    /// Get analyzer name
    fn name(&self) -> &str;

    /// Get analyzer description
    fn description(&self) -> &str;
}

/// Create an analyzer configuration with common defaults
pub fn create_analyzer_config(
    target_path: &str,
    min_severity: &str,
    summary_mode: bool,
    output_format: &str,
) -> AnalyzerConfig {
    let mut config = AnalyzerConfig::default();
    config.target_path = target_path.to_string();
    config.min_severity = min_severity.to_string();
    config.summary_mode = summary_mode;
    config.output_format = output_format.to_string();
    config
}

/// Collect files for analysis
pub fn collect_files(config: &AnalyzerConfig) -> Result<Vec<PathBuf>> {
    let target_path = Path::new(&config.target_path);
    let mut files = Vec::new();

    if target_path.is_file() {
        if config.is_code_file(target_path) && !config.should_skip_path(target_path) {
            files.push(target_path.to_path_buf());
        }
    } else if target_path.is_dir() {
        for entry in WalkDir::new(target_path) {
            let entry = entry?;
            let path = entry.path();

            if path.is_file()
                && config.is_code_file(path)
                && !config.should_skip_path(path)
            {
                files.push(path.to_path_buf());

                if let Some(max) = config.max_files {
                    if files.len() >= max {
                        break;
                    }
                }
            }
        }
    }

    Ok(files)
}