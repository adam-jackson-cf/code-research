//! Detect-Secrets Analyzer - Hardcoded Secrets Detection.
//!
//! Uses the actual detect-secrets tool via subprocess for entropy-based
//! secret detection across multiple file types.

use crate::base::{AnalysisResult, Analyzer, AnalyzerConfig, Finding};
use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::process::Command;

/// detect-secrets JSON output structure
#[derive(Debug, Deserialize)]
struct DetectSecretsOutput {
    #[serde(default)]
    results: HashMap<String, Vec<SecretFinding>>,
    #[serde(default)]
    version: String,
}

#[derive(Debug, Deserialize)]
struct SecretFinding {
    #[serde(rename = "type")]
    secret_type: String,
    line_number: usize,
    #[serde(default)]
    hashed_secret: String,
    #[serde(default)]
    is_verified: bool,
}

pub struct DetectSecretsAnalyzer {
    config: AnalyzerConfig,
}

impl DetectSecretsAnalyzer {
    pub fn new(config: &AnalyzerConfig) -> Self {
        Self {
            config: config.clone(),
        }
    }

    /// Check if detect-secrets is available
    fn check_availability() -> Result<String> {
        let output = Command::new("detect-secrets")
            .arg("--version")
            .output()
            .map_err(|e| anyhow!("detect-secrets not found: {}. Install with: pip install detect-secrets", e))?;

        if !output.status.success() {
            return Err(anyhow!("detect-secrets version check failed"));
        }

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    /// Map secret type to severity
    fn map_severity(secret_type: &str) -> String {
        match secret_type {
            "Private Key" | "AWS Access Key" | "JWT Token" | "Azure Storage Key" | "GitHub Token" => {
                "critical".to_string()
            }
            "High Entropy String" | "Basic Auth" | "Slack Token" => "high".to_string(),
            _ => "medium".to_string(),
        }
    }

    /// Get recommendation based on secret type
    fn get_recommendation(secret_type: &str) -> String {
        match secret_type {
            "Private Key" => {
                "Remove private keys from code. Use secure key management services and environment variables.".to_string()
            }
            "AWS Access Key" => {
                "Remove AWS credentials from code. Use IAM roles, AWS profiles, or environment variables.".to_string()
            }
            "JWT Token" => {
                "Remove hardcoded JWT tokens. Generate tokens dynamically and store signing keys securely.".to_string()
            }
            "GitHub Token" => {
                "Remove GitHub tokens from code. Use GitHub secrets or environment variables.".to_string()
            }
            "Azure Storage Key" => {
                "Remove Azure keys from code. Use Azure Key Vault or managed identities.".to_string()
            }
            "High Entropy String" => {
                "Review high entropy strings. If secrets, move to environment variables or secure vaults.".to_string()
            }
            "Basic Auth" => {
                "Remove hardcoded authentication. Use secure credential storage and environment variables.".to_string()
            }
            _ => {
                "Remove hardcoded secrets from code. Use environment variables or secure credential management.".to_string()
            }
        }
    }

    /// Run detect-secrets on the target
    fn run_detect_secrets(&self, target: &str) -> Result<DetectSecretsOutput> {
        // Check availability first
        Self::check_availability()?;

        let output = Command::new("detect-secrets")
            .arg("scan")
            .arg("--all-files")
            .arg("--force-use-all-plugins")
            .arg(target)
            .output()
            .map_err(|e| anyhow!("Failed to run detect-secrets: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        if stdout.trim().is_empty() {
            return Ok(DetectSecretsOutput {
                results: HashMap::new(),
                version: String::new(),
            });
        }

        serde_json::from_str(&stdout)
            .map_err(|e| anyhow!("Failed to parse detect-secrets output: {}", e))
    }

    /// Check if path should be included based on filtering rules
    fn should_include_path(&self, path: &str) -> bool {
        // Exclude obvious test files
        let exclude_patterns = ["test_", "mock_", "example_only", "demo_data", "fixture_"];

        for pattern in exclude_patterns {
            if path.to_lowercase().contains(pattern) {
                return false;
            }
        }

        // Check against skip patterns
        for pattern in &self.config.skip_patterns {
            if path.contains(pattern.as_str()) {
                return false;
            }
        }

        true
    }
}

impl Analyzer for DetectSecretsAnalyzer {
    fn analyze(&self, target: &str) -> Result<AnalysisResult> {
        let secrets_output = self.run_detect_secrets(target)?;

        let mut findings = Vec::new();
        let mut summary: HashMap<String, usize> = HashMap::new();

        for (file_path, secrets) in secrets_output.results {
            if !self.should_include_path(&file_path) {
                continue;
            }

            for secret in secrets {
                let severity = Self::map_severity(&secret.secret_type);

                // Update summary counts
                *summary.entry(severity.clone()).or_insert(0) += 1;
                *summary.entry("secrets".to_string()).or_insert(0) += 1;

                findings.push(Finding {
                    path: file_path.clone(),
                    line: secret.line_number,
                    column: 0,
                    severity,
                    category: "secrets".to_string(),
                    message: format!("Hardcoded {} detected", secret.secret_type.to_lowercase()),
                    suggestion: Some(Self::get_recommendation(&secret.secret_type)),
                });
            }
        }

        let mut metadata = HashMap::new();
        metadata.insert("tool".to_string(), "detect-secrets".to_string());
        metadata.insert("target".to_string(), target.to_string());
        metadata.insert("total_findings".to_string(), findings.len().to_string());

        Ok(AnalysisResult {
            findings,
            summary,
            metadata,
        })
    }

    fn name(&self) -> &str {
        "security:detect_secrets"
    }

    fn description(&self) -> &str {
        "Entropy-based secret detection using detect-secrets for API keys, tokens, and credentials"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_mapping() {
        assert_eq!(DetectSecretsAnalyzer::map_severity("Private Key"), "critical");
        assert_eq!(DetectSecretsAnalyzer::map_severity("AWS Access Key"), "critical");
        assert_eq!(DetectSecretsAnalyzer::map_severity("High Entropy String"), "high");
        assert_eq!(DetectSecretsAnalyzer::map_severity("Unknown"), "medium");
    }
}
