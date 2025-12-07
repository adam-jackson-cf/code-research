//! Semgrep Security Analyzer - Semantic Static Analysis Security Scanner.
//!
//! Uses the actual Semgrep tool via subprocess for comprehensive security analysis.
//! Supports OWASP Top 10 vulnerabilities, semantic analysis, and multi-language scanning.

use crate::base::{AnalysisResult, Analyzer, AnalyzerConfig, Finding};
use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::process::Command;

/// Semgrep JSON output structure
#[derive(Debug, Deserialize)]
struct SemgrepOutput {
    results: Vec<SemgrepFinding>,
    #[serde(default)]
    errors: Vec<SemgrepError>,
}

#[derive(Debug, Deserialize)]
struct SemgrepFinding {
    check_id: String,
    path: String,
    start: SemgrepLocation,
    #[serde(default)]
    end: Option<SemgrepLocation>,
    extra: SemgrepExtra,
}

#[derive(Debug, Deserialize)]
struct SemgrepLocation {
    line: usize,
    col: usize,
}

#[derive(Debug, Deserialize)]
struct SemgrepExtra {
    message: String,
    #[serde(default)]
    severity: String,
    #[serde(default)]
    lines: String,
    #[serde(default)]
    metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct SemgrepError {
    #[serde(default)]
    message: String,
}

pub struct SemgrepAnalyzer {
    config: AnalyzerConfig,
}

impl SemgrepAnalyzer {
    pub fn new(config: &AnalyzerConfig) -> Self {
        Self {
            config: config.clone(),
        }
    }

    /// Check if semgrep is available
    fn check_availability() -> Result<String> {
        let output = Command::new("semgrep")
            .arg("--version")
            .output()
            .map_err(|e| anyhow!("semgrep not found: {}. Install with: pip install semgrep", e))?;

        if !output.status.success() {
            return Err(anyhow!("semgrep version check failed"));
        }

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    /// Map semgrep severity to our severity levels
    fn map_severity(semgrep_severity: &str) -> String {
        match semgrep_severity.to_uppercase().as_str() {
            "ERROR" => "critical".to_string(),
            "WARNING" => "high".to_string(),
            "INFO" => "medium".to_string(),
            _ => "medium".to_string(),
        }
    }

    /// Get category from check_id
    fn get_category(check_id: &str) -> String {
        if check_id.contains("injection") || check_id.contains("sqli") {
            "injection".to_string()
        } else if check_id.contains("xss") {
            "xss".to_string()
        } else if check_id.contains("auth") {
            "authentication".to_string()
        } else if check_id.contains("secret") || check_id.contains("key") {
            "secrets".to_string()
        } else if check_id.contains("crypto") {
            "cryptography".to_string()
        } else {
            "security".to_string()
        }
    }

    /// Get recommendation based on check_id
    fn get_recommendation(check_id: &str) -> String {
        if check_id.contains("subprocess") || check_id.contains("command") {
            "Use subprocess with shell=False and validate all inputs".to_string()
        } else if check_id.contains("sql") {
            "Use parameterized queries or ORM methods to prevent SQL injection".to_string()
        } else if check_id.contains("xss") || check_id.contains("innerHTML") {
            "Use textContent instead of innerHTML or sanitize user input".to_string()
        } else if check_id.contains("key") || check_id.contains("secret") {
            "Remove secrets from code. Use environment variables or secure vaults".to_string()
        } else {
            "Review this security finding and apply appropriate security controls".to_string()
        }
    }

    /// Run semgrep on the target directory
    fn run_semgrep(&self, target: &str) -> Result<SemgrepOutput> {
        // Check availability first
        Self::check_availability()?;

        let mut cmd = Command::new("semgrep");
        cmd.arg("scan")
            .arg("--json")
            .arg("--timeout")
            .arg("10")
            .arg("--timeout-threshold")
            .arg("3")
            .arg("--max-target-bytes")
            .arg("500000")
            .arg("--jobs")
            .arg("4")
            .arg("--optimizations")
            .arg("all")
            .arg("--config=auto")
            .arg("--oss-only");

        // Add exclude patterns
        for pattern in &self.config.skip_patterns {
            cmd.arg("--exclude").arg(pattern);
        }
        for pattern in &self.config.exclude_globs {
            cmd.arg("--exclude").arg(pattern);
        }

        cmd.arg(target);

        let output = cmd.output().map_err(|e| anyhow!("Failed to run semgrep: {}", e))?;

        // semgrep returns non-zero if findings exist, so we check stdout
        let stdout = String::from_utf8_lossy(&output.stdout);

        if stdout.trim().is_empty() {
            return Ok(SemgrepOutput {
                results: vec![],
                errors: vec![],
            });
        }

        serde_json::from_str(&stdout)
            .map_err(|e| anyhow!("Failed to parse semgrep output: {}", e))
    }
}

impl Analyzer for SemgrepAnalyzer {
    fn analyze(&self, target: &str) -> Result<AnalysisResult> {
        let semgrep_output = self.run_semgrep(target)?;

        let mut findings = Vec::new();
        let mut summary: HashMap<String, usize> = HashMap::new();

        for result in semgrep_output.results {
            let severity = Self::map_severity(&result.extra.severity);
            let category = Self::get_category(&result.check_id);

            // Update summary counts
            *summary.entry(severity.clone()).or_insert(0) += 1;
            *summary.entry(category.clone()).or_insert(0) += 1;

            findings.push(Finding {
                path: result.path,
                line: result.start.line,
                column: result.start.col,
                severity,
                category,
                message: result.extra.message,
                suggestion: Some(Self::get_recommendation(&result.check_id)),
            });
        }

        let mut metadata = HashMap::new();
        metadata.insert("tool".to_string(), "semgrep".to_string());
        metadata.insert("target".to_string(), target.to_string());
        metadata.insert("total_findings".to_string(), findings.len().to_string());

        Ok(AnalysisResult {
            findings,
            summary,
            metadata,
        })
    }

    fn name(&self) -> &str {
        "security:semgrep"
    }

    fn description(&self) -> &str {
        "Semantic security analysis using Semgrep for OWASP Top 10, injection, XSS, and more"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_mapping() {
        assert_eq!(SemgrepAnalyzer::map_severity("ERROR"), "critical");
        assert_eq!(SemgrepAnalyzer::map_severity("WARNING"), "high");
        assert_eq!(SemgrepAnalyzer::map_severity("INFO"), "medium");
    }

    #[test]
    fn test_category_detection() {
        assert_eq!(SemgrepAnalyzer::get_category("sql-injection-test"), "injection");
        assert_eq!(SemgrepAnalyzer::get_category("xss-vulnerability"), "xss");
        assert_eq!(SemgrepAnalyzer::get_category("hardcoded-secret"), "secrets");
    }
}
