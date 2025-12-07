//! Ruff Performance Analyzer - Python Performance Anti-patterns.
//!
//! Uses the actual Ruff linter via subprocess for detecting Python
//! performance anti-patterns (PERF, C4, B rules).

use crate::base::{AnalysisResult, Analyzer, AnalyzerConfig, Finding};
use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::process::Command;

/// Ruff JSON output structure
#[derive(Debug, Deserialize)]
struct RuffFinding {
    code: String,
    message: String,
    filename: String,
    location: RuffLocation,
    #[serde(default)]
    fix: Option<RuffFix>,
}

#[derive(Debug, Deserialize)]
struct RuffLocation {
    row: usize,
    column: usize,
}

#[derive(Debug, Deserialize)]
struct RuffFix {
    #[serde(default)]
    message: String,
    #[serde(default)]
    applicability: String,
}

pub struct RuffAnalyzer {
    config: AnalyzerConfig,
}

impl RuffAnalyzer {
    pub fn new(config: &AnalyzerConfig) -> Self {
        Self {
            config: config.clone(),
        }
    }

    /// Check if ruff is available
    fn check_availability() -> Result<()> {
        let output = Command::new("ruff")
            .arg("--version")
            .output()
            .map_err(|e| anyhow!("ruff not found: {}. Install with: pip install ruff", e))?;

        if !output.status.success() {
            return Err(anyhow!("ruff version check failed"));
        }

        Ok(())
    }

    /// Map ruff code prefix to severity
    fn get_severity(code: &str) -> String {
        // Handle special prefixes like C4 (flake8-comprehensions) that include a digit
        if code.starts_with("C4") {
            return "medium".to_string();
        }

        // Extract alphabetic prefix for other rules
        let prefix: String = code.chars().take_while(|c| c.is_alphabetic()).collect();

        match prefix.as_str() {
            "PERF" => "high".to_string(),    // perflint rules
            "B" => "medium".to_string(),      // bugbear
            "E" => "low".to_string(),         // pycodestyle errors
            "W" => "low".to_string(),         // pycodestyle warnings
            "F" => "medium".to_string(),      // pyflakes
            _ => "low".to_string(),
        }
    }

    /// Get recommendation based on code
    fn get_recommendation(code: &str) -> String {
        if code.starts_with("PERF") {
            "Refactor to remove performance anti-pattern (PERF rule).".to_string()
        } else if code.starts_with("C4") {
            "Use comprehensions/literals appropriately to reduce overhead.".to_string()
        } else if code.starts_with("B") {
            "Address bugbear issue; consider performance implications.".to_string()
        } else {
            "Review and optimize the highlighted code path.".to_string()
        }
    }

    /// Run ruff on the target
    fn run_ruff(&self, target: &str) -> Result<Vec<RuffFinding>> {
        Self::check_availability()?;

        let output = Command::new("ruff")
            .arg("check")
            .arg("--output-format")
            .arg("json")
            .arg(target)
            .output()
            .map_err(|e| anyhow!("Failed to run ruff: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        if stdout.trim().is_empty() {
            return Ok(vec![]);
        }

        serde_json::from_str(&stdout).map_err(|e| anyhow!("Failed to parse ruff output: {}", e))
    }
}

impl Analyzer for RuffAnalyzer {
    fn analyze(&self, target: &str) -> Result<AnalysisResult> {
        let ruff_findings = self.run_ruff(target)?;

        let mut findings = Vec::new();
        let mut summary: HashMap<String, usize> = HashMap::new();

        for item in ruff_findings {
            // Skip files in skip patterns
            let should_skip = self.config.skip_patterns.iter().any(|p| item.filename.contains(p.as_str()));
            if should_skip {
                continue;
            }

            let severity = Self::get_severity(&item.code);

            *summary.entry(severity.clone()).or_insert(0) += 1;
            *summary.entry(item.code.clone()).or_insert(0) += 1;

            findings.push(Finding {
                path: item.filename,
                line: item.location.row,
                column: item.location.column,
                severity,
                category: "performance".to_string(),
                message: format!("Ruff {}: {}", item.code, item.message),
                suggestion: Some(Self::get_recommendation(&item.code)),
            });
        }

        summary.insert("total".to_string(), findings.len());

        let mut metadata = HashMap::new();
        metadata.insert("tool".to_string(), "ruff".to_string());
        metadata.insert("target".to_string(), target.to_string());
        metadata.insert("total_findings".to_string(), findings.len().to_string());

        Ok(AnalysisResult {
            findings,
            summary,
            metadata,
        })
    }

    fn name(&self) -> &str {
        "performance:ruff"
    }

    fn description(&self) -> &str {
        "Python performance analysis via Ruff (PERF/C4/B rules)"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_mapping() {
        assert_eq!(RuffAnalyzer::get_severity("PERF101"), "high");
        assert_eq!(RuffAnalyzer::get_severity("C401"), "medium");
        assert_eq!(RuffAnalyzer::get_severity("B006"), "medium");
        assert_eq!(RuffAnalyzer::get_severity("E501"), "low");
    }
}
