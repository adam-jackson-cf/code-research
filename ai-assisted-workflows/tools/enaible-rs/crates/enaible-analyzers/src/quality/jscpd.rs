//! JSCPD Duplication Analyzer - Universal Copy/Paste Detection.
//!
//! Uses the actual jscpd tool via subprocess for detecting duplicate code
//! blocks across multiple languages.

use crate::base::{AnalysisResult, Analyzer, AnalyzerConfig, Finding};
use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::process::Command;
use tempfile::TempDir;

/// jscpd JSON report structure
#[derive(Debug, Deserialize)]
struct JscpdReport {
    #[serde(default)]
    duplicates: Vec<JscpdDuplicate>,
    #[serde(default)]
    statistics: JscpdStatistics,
}

#[derive(Debug, Deserialize, Default)]
struct JscpdStatistics {
    #[serde(default)]
    total: JscpdTotalStats,
}

#[derive(Debug, Deserialize, Default)]
struct JscpdTotalStats {
    #[serde(default)]
    percentage: f64,
    #[serde(default)]
    duplicatedLines: usize,
}

#[derive(Debug, Deserialize)]
struct JscpdDuplicate {
    #[serde(rename = "firstFile")]
    first_file: JscpdFile,
    #[serde(rename = "secondFile")]
    second_file: JscpdFile,
    #[serde(default)]
    lines: usize,
    #[serde(default)]
    tokens: usize,
    #[serde(default)]
    format: String,
}

#[derive(Debug, Deserialize)]
struct JscpdFile {
    #[serde(default)]
    name: String,
    #[serde(default)]
    start: usize,
    #[serde(default)]
    end: usize,
}

pub struct JscpdAnalyzer {
    config: AnalyzerConfig,
    min_tokens: usize,
    mode: String,
}

impl JscpdAnalyzer {
    pub fn new(config: &AnalyzerConfig) -> Self {
        Self {
            config: config.clone(),
            min_tokens: 60,
            mode: "mild".to_string(),
        }
    }

    /// Find jscpd binary (npx or direct)
    fn find_jscpd() -> Result<Vec<String>> {
        // Try direct jscpd first
        if Command::new("jscpd").arg("--version").output().is_ok() {
            return Ok(vec!["jscpd".to_string()]);
        }

        // Try npx
        if Command::new("npx")
            .arg("jscpd")
            .arg("--version")
            .output()
            .is_ok()
        {
            return Ok(vec!["npx".to_string(), "jscpd".to_string()]);
        }

        Err(anyhow!(
            "jscpd not found. Install with: npm install -g jscpd"
        ))
    }

    /// Run jscpd on the target
    fn run_jscpd(&self, target: &str) -> Result<JscpdReport> {
        let jscpd_cmd = Self::find_jscpd()?;

        // Create temp directory for output
        let temp_dir = TempDir::new()?;
        let output_dir = temp_dir.path();
        let report_path = output_dir.join("jscpd-report.json");

        let mut cmd = Command::new(&jscpd_cmd[0]);
        for arg in &jscpd_cmd[1..] {
            cmd.arg(arg);
        }

        cmd.arg("--reporters")
            .arg("json")
            .arg("--output")
            .arg(output_dir)
            .arg("--min-tokens")
            .arg(self.min_tokens.to_string())
            .arg("--mode")
            .arg(&self.mode)
            .arg("--gitignore");

        // Add ignore patterns
        for pattern in &self.config.skip_patterns {
            cmd.arg("--ignore").arg(format!("**/{}", pattern));
        }
        for pattern in &self.config.exclude_globs {
            cmd.arg("--ignore").arg(pattern);
        }

        cmd.arg(target);

        let output = cmd.output().map_err(|e| anyhow!("Failed to run jscpd: {}", e))?;

        // jscpd may exit non-zero if duplicates found, but still produces report
        if !report_path.exists() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(anyhow!(
                "jscpd did not produce a report. stdout: {}, stderr: {}",
                &stdout[..stdout.len().min(500)],
                &stderr[..stderr.len().min(500)]
            ));
        }

        let report_content = fs::read_to_string(&report_path)?;
        serde_json::from_str(&report_content)
            .map_err(|e| anyhow!("Failed to parse jscpd report: {}", e))
    }

    /// Check if path should be included
    fn should_include_path(&self, path: &str) -> bool {
        for pattern in &self.config.skip_patterns {
            if path.contains(pattern.as_str()) {
                return false;
            }
        }
        true
    }
}

impl Analyzer for JscpdAnalyzer {
    fn analyze(&self, target: &str) -> Result<AnalysisResult> {
        let report = self.run_jscpd(target)?;

        let mut findings = Vec::new();
        let mut summary: HashMap<String, usize> = HashMap::new();
        let clone_pairs_count = report.duplicates.len();
        let duplication_percentage = report.statistics.total.percentage;

        for dup in report.duplicates {
            let a_path = &dup.first_file.name;
            let b_path = &dup.second_file.name;

            // Filter paths
            if !self.should_include_path(a_path) || !self.should_include_path(b_path) {
                continue;
            }

            let description = format!(
                "Code block duplicated between {}:{} and {}:{} ({} lines, {} tokens)",
                a_path, dup.first_file.start,
                b_path, dup.second_file.start,
                dup.lines, dup.tokens
            );

            // Create findings for both locations
            findings.push(Finding {
                path: a_path.clone(),
                line: dup.first_file.start,
                column: 0,
                severity: "low".to_string(),
                category: "duplication".to_string(),
                message: description.clone(),
                suggestion: Some(
                    "Consider extracting shared logic into a function/module to remove duplication."
                        .to_string(),
                ),
            });

            findings.push(Finding {
                path: b_path.clone(),
                line: dup.second_file.start,
                column: 0,
                severity: "low".to_string(),
                category: "duplication".to_string(),
                message: description,
                suggestion: Some(
                    "Consider extracting shared logic into a function/module to remove duplication."
                        .to_string(),
                ),
            });

            *summary.entry("low".to_string()).or_insert(0) += 2;
        }

        summary.insert("clone_pairs".to_string(), clone_pairs_count);
        summary.insert("total".to_string(), findings.len());

        let mut metadata = HashMap::new();
        metadata.insert("tool".to_string(), "jscpd".to_string());
        metadata.insert("target".to_string(), target.to_string());
        metadata.insert("total_findings".to_string(), findings.len().to_string());
        metadata.insert(
            "duplication_percentage".to_string(),
            format!("{:.2}", duplication_percentage),
        );

        Ok(AnalysisResult {
            findings,
            summary,
            metadata,
        })
    }

    fn name(&self) -> &str {
        "quality:jscpd"
    }

    fn description(&self) -> &str {
        "Copy/paste detection using jscpd for identifying duplicate code blocks"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_filtering() {
        let mut config = AnalyzerConfig::default();
        config.skip_patterns.insert("node_modules".to_string());

        let analyzer = JscpdAnalyzer::new(&config);

        assert!(!analyzer.should_include_path("src/node_modules/test.js"));
        assert!(analyzer.should_include_path("src/components/test.js"));
    }
}
