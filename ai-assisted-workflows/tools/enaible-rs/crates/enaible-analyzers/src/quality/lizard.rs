//! Lizard Complexity Analyzer - Multi-language Code Complexity Analysis.
//!
//! Uses the actual Lizard tool via subprocess for cyclomatic complexity,
//! function length, and parameter count analysis.

use crate::base::{AnalysisResult, Analyzer, AnalyzerConfig, Finding};
use anyhow::{anyhow, Result};
use regex::Regex;
use std::collections::HashMap;
use std::process::Command;

/// Complexity thresholds based on industry standards
struct ComplexityThresholds {
    cyclomatic: ThresholdLevels,
    function_length: ThresholdLevels,
    parameter_count: ThresholdLevels,
}

struct ThresholdLevels {
    high: usize,
    medium: usize,
}

impl Default for ComplexityThresholds {
    fn default() -> Self {
        Self {
            cyclomatic: ThresholdLevels { high: 20, medium: 10 },
            function_length: ThresholdLevels { high: 100, medium: 50 },
            parameter_count: ThresholdLevels { high: 7, medium: 5 },
        }
    }
}

pub struct LizardAnalyzer {
    config: AnalyzerConfig,
    thresholds: ComplexityThresholds,
}

impl LizardAnalyzer {
    pub fn new(config: &AnalyzerConfig) -> Self {
        Self {
            config: config.clone(),
            thresholds: ComplexityThresholds::default(),
        }
    }

    /// Check if lizard is available
    fn check_availability() -> Result<()> {
        let output = Command::new("lizard")
            .arg("--version")
            .output()
            .map_err(|e| anyhow!("lizard not found: {}. Install with: pip install lizard", e))?;

        if !output.status.success() {
            return Err(anyhow!("lizard version check failed"));
        }

        Ok(())
    }

    /// Determine severity based on metric type and value
    fn get_severity(&self, metric_type: &str, value: usize) -> Option<String> {
        let (high, medium) = match metric_type {
            "cyclomatic" => (self.thresholds.cyclomatic.high, self.thresholds.cyclomatic.medium),
            "function_length" => (self.thresholds.function_length.high, self.thresholds.function_length.medium),
            "parameter_count" => (self.thresholds.parameter_count.high, self.thresholds.parameter_count.medium),
            _ => return None,
        };

        if value >= high {
            Some("high".to_string())
        } else if value >= medium {
            Some("medium".to_string())
        } else {
            None
        }
    }

    /// Run lizard on the target
    fn run_lizard(&self, target: &str) -> Result<String> {
        Self::check_availability()?;

        let output = Command::new("lizard")
            .arg("-C")
            .arg("999")  // High threshold to get all results
            .arg("-L")
            .arg("999")
            .arg("-a")
            .arg("999")
            .arg(target)
            .output()
            .map_err(|e| anyhow!("Failed to run lizard: {}", e))?;

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    /// Parse lizard output format: NLOC CCN token PARAM length location
    fn parse_output(&self, output: &str) -> Vec<Finding> {
        let mut findings = Vec::new();

        // Regex to parse: function_name@start-end@filepath
        let location_regex = Regex::new(r"(.+)@(\d+)-(\d+)@(.+)").unwrap();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() || !line.contains('@') {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 6 {
                continue;
            }

            // Parse numeric values
            let nloc: usize = match parts[0].parse() {
                Ok(v) => v,
                Err(_) => continue,
            };
            let ccn: usize = match parts[1].parse() {
                Ok(v) => v,
                Err(_) => continue,
            };
            let param_count: usize = match parts[3].parse() {
                Ok(v) => v,
                Err(_) => continue,
            };

            // Parse location
            let location = parts[5..].join(" ");
            let caps = match location_regex.captures(&location) {
                Some(c) => c,
                None => continue,
            };

            let func_name = &caps[1];
            let start_line: usize = caps[2].parse().unwrap_or(0);
            let file_path = &caps[4];

            // Check against skip patterns
            let should_skip = self.config.skip_patterns.iter().any(|p| file_path.contains(p.as_str()));
            if should_skip {
                continue;
            }

            // Check cyclomatic complexity
            if let Some(severity) = self.get_severity("cyclomatic", ccn) {
                findings.push(Finding {
                    path: file_path.to_string(),
                    line: start_line,
                    column: 0,
                    severity: severity.clone(),
                    category: "complexity".to_string(),
                    message: format!(
                        "Function '{}' has cyclomatic complexity of {} (threshold: {})",
                        func_name, ccn,
                        if severity == "high" { self.thresholds.cyclomatic.high } else { self.thresholds.cyclomatic.medium }
                    ),
                    suggestion: Some("Consider breaking down this function. Aim for complexity < 10".to_string()),
                });
            }

            // Check function length
            if let Some(severity) = self.get_severity("function_length", nloc) {
                findings.push(Finding {
                    path: file_path.to_string(),
                    line: start_line,
                    column: 0,
                    severity: severity.clone(),
                    category: "complexity".to_string(),
                    message: format!(
                        "Function '{}' is {} lines long (threshold: {})",
                        func_name, nloc,
                        if severity == "high" { self.thresholds.function_length.high } else { self.thresholds.function_length.medium }
                    ),
                    suggestion: Some("Consider breaking down this function. Aim for < 50 lines".to_string()),
                });
            }

            // Check parameter count
            if let Some(severity) = self.get_severity("parameter_count", param_count) {
                findings.push(Finding {
                    path: file_path.to_string(),
                    line: start_line,
                    column: 0,
                    severity: severity.clone(),
                    category: "complexity".to_string(),
                    message: format!(
                        "Function '{}' has {} parameters (threshold: {})",
                        func_name, param_count,
                        if severity == "high" { self.thresholds.parameter_count.high } else { self.thresholds.parameter_count.medium }
                    ),
                    suggestion: Some("Consider using parameter objects or configuration classes".to_string()),
                });
            }
        }

        findings
    }
}

impl Analyzer for LizardAnalyzer {
    fn analyze(&self, target: &str) -> Result<AnalysisResult> {
        let output = self.run_lizard(target)?;
        let findings = self.parse_output(&output);

        let mut summary: HashMap<String, usize> = HashMap::new();
        for finding in &findings {
            *summary.entry(finding.severity.clone()).or_insert(0) += 1;
        }
        summary.insert("total".to_string(), findings.len());

        let mut metadata = HashMap::new();
        metadata.insert("tool".to_string(), "lizard".to_string());
        metadata.insert("target".to_string(), target.to_string());
        metadata.insert("total_findings".to_string(), findings.len().to_string());

        Ok(AnalysisResult {
            findings,
            summary,
            metadata,
        })
    }

    fn name(&self) -> &str {
        "quality:lizard"
    }

    fn description(&self) -> &str {
        "Code complexity analysis using Lizard for cyclomatic complexity, function length, and parameter count"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_threshold_defaults() {
        let thresholds = ComplexityThresholds::default();
        assert_eq!(thresholds.cyclomatic.high, 20);
        assert_eq!(thresholds.cyclomatic.medium, 10);
    }

    #[test]
    fn test_severity_calculation() {
        let analyzer = LizardAnalyzer::new(&AnalyzerConfig::default());

        assert_eq!(analyzer.get_severity("cyclomatic", 25), Some("high".to_string()));
        assert_eq!(analyzer.get_severity("cyclomatic", 15), Some("medium".to_string()));
        assert_eq!(analyzer.get_severity("cyclomatic", 5), None);
    }
}
