use anyhow::Result;
use regex::Regex;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug)]
pub struct LintIssue {
    pub path: String,
    pub line: usize,
    pub message: String,
}

/// Lint prompt files for @TOKEN usage and variable mapping rules
pub fn lint_files(files: &HashSet<PathBuf>) -> Result<Vec<LintIssue>> {
    let mut issues = Vec::new();
    let token_regex = Regex::new(r"@([A-Z_]+)(?:\{[^}]*\})?")?;

    for file_path in files {
        let content = fs::read_to_string(file_path)?;

        for (line_num, line) in content.lines().enumerate() {
            // Check for @TOKENS
            for cap in token_regex.captures_iter(line) {
                let token = cap.get(1).unwrap().as_str();

                // Common validation rules
                if token.contains("__") {
                    issues.push(LintIssue {
                        path: file_path.display().to_string(),
                        line: line_num + 1,
                        message: format!("Token '{}' contains double underscore", token),
                    });
                }

                // Check for common typos
                let common_tokens = ["TARGET", "VERBOSE", "OPTIONAL", "PATH", "FILE"];
                if !common_tokens.iter().any(|t| token.contains(t)) && token.len() < 3 {
                    issues.push(LintIssue {
                        path: file_path.display().to_string(),
                        line: line_num + 1,
                        message: format!("Suspicious token '{}' - possibly too short", token),
                    });
                }
            }

            // Check for unbalanced braces
            let open_count = line.matches('{').count();
            let close_count = line.matches('}').count();
            if open_count != close_count {
                issues.push(LintIssue {
                    path: file_path.display().to_string(),
                    line: line_num + 1,
                    message: "Unbalanced braces detected".to_string(),
                });
            }
        }
    }

    Ok(issues)
}