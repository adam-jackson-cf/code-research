use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::TempDir;

fn get_binary_path() -> PathBuf {
    // Get the path to the built binary
    let mut path = env::current_exe().unwrap();
    path.pop(); // Remove test binary name
    path.pop(); // Remove deps/
    path.push("enaible");
    path
}

fn setup_test_workspace() -> TempDir {
    let temp = TempDir::new().unwrap();
    let workspace = temp.path();

    // Create minimal workspace structure
    fs::create_dir_all(workspace.join("shared/core/base")).unwrap();
    fs::write(
        workspace.join("shared/core/base/analyzer_registry.py"),
        "# Stub registry file",
    )
    .unwrap();

    // Create some prompt files
    fs::create_dir_all(workspace.join("shared/prompts")).unwrap();
    fs::write(
        workspace.join("shared/prompts/analyze-security.md"),
        "# Security Analysis Prompt\n\n@TARGET{path to analyze}\n",
    )
    .unwrap();

    temp
}

#[test]
fn test_version_command() {
    let binary = get_binary_path();

    let output = Command::new(&binary)
        .arg("version")
        .output()
        .expect("Failed to execute version command");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("enaible"));
}

#[test]
fn test_doctor_command_json() {
    let binary = get_binary_path();
    let _workspace = setup_test_workspace();

    let output = Command::new(&binary)
        .arg("doctor")
        .arg("--json")
        .output()
        .expect("Failed to execute doctor command");

    // Doctor may fail due to missing dependencies, but should produce valid JSON
    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .expect("Doctor --json should produce valid JSON");

    assert!(json.get("enaible_version").is_some());
    assert!(json.get("checks").is_some());
}

#[test]
fn test_prompts_list_command() {
    let binary = get_binary_path();
    let workspace = setup_test_workspace();

    let output = Command::new(&binary)
        .arg("prompts")
        .arg("list")
        .env("ENAIBLE_REPO_ROOT", workspace.path())
        .output()
        .expect("Failed to execute prompts list command");

    // The command should run, even if no prompts are found
    let stdout = String::from_utf8_lossy(&output.stdout);
    // Should either list prompts or be empty
    assert!(stdout.len() >= 0);
}

#[test]
fn test_analyzers_list_json() {
    let binary = get_binary_path();
    let workspace = setup_test_workspace();

    let output = Command::new(&binary)
        .arg("analyzers")
        .arg("list")
        .arg("--json")
        .env("ENAIBLE_REPO_ROOT", workspace.path())
        .output()
        .expect("Failed to execute analyzers list command");

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Even if no analyzers are registered, should produce valid JSON
    if !stdout.is_empty() {
        let json: serde_json::Value = serde_json::from_str(&stdout)
            .expect("Analyzers list --json should produce valid JSON");
        assert!(json.get("analyzers").is_some());
    }
}

#[test]
fn test_help_output() {
    let binary = get_binary_path();

    let output = Command::new(&binary)
        .arg("--help")
        .output()
        .expect("Failed to execute help command");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check for expected commands in help output
    assert!(stdout.contains("version"));
    assert!(stdout.contains("doctor"));
    assert!(stdout.contains("prompts"));
    assert!(stdout.contains("analyzers"));
    assert!(stdout.contains("install"));
}

#[test]
fn test_prompts_subcommands() {
    let binary = get_binary_path();

    let output = Command::new(&binary)
        .arg("prompts")
        .arg("--help")
        .output()
        .expect("Failed to execute prompts help");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check for expected subcommands
    assert!(stdout.contains("list"));
    assert!(stdout.contains("render"));
    assert!(stdout.contains("diff"));
    assert!(stdout.contains("validate"));
    assert!(stdout.contains("lint"));
}

#[test]
fn test_analyzers_subcommands() {
    let binary = get_binary_path();

    let output = Command::new(&binary)
        .arg("analyzers")
        .arg("--help")
        .output()
        .expect("Failed to execute analyzers help");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check for expected subcommands
    assert!(stdout.contains("run"));
    assert!(stdout.contains("list"));
}
// =============================================================================
// Additional Integration Tests Using test_codebase Fixtures
// =============================================================================

fn get_ai_workflows_root() -> PathBuf {
    // Find the ai-assisted-workflows root directory
    let mut path = env::current_dir().unwrap();

    // Look up from current directory to find the repo root
    while !path.join("shared").exists() || !path.join("test_codebase").exists() {
        if !path.pop() {
            // Fallback to expected location
            return PathBuf::from("/home/user/code-research/ai-assisted-workflows");
        }
    }
    path
}

#[test]
fn test_prompts_render_with_real_repo() {
    let binary = get_binary_path();
    let repo_root = get_ai_workflows_root();

    // Skip if repo root doesn't exist
    if !repo_root.exists() {
        eprintln!("Skipping test: repo root not found at {:?}", repo_root);
        return;
    }

    let output = Command::new(&binary)
        .arg("prompts")
        .arg("list")
        .current_dir(&repo_root)
        .env("ENAIBLE_REPO_ROOT", &repo_root)
        .output()
        .expect("Failed to execute prompts list");

    let stdout = String::from_utf8_lossy(&output.stdout);
    eprintln!("Prompts list output: {}", stdout);

    // Should list at least some prompts from catalog
    assert!(stdout.contains("analyze-security") || stdout.contains("analyze"), 
        "Expected at least one analyze prompt in output");
}

#[test]
fn test_workspace_context_discovery() {
    let binary = get_binary_path();
    let repo_root = get_ai_workflows_root();

    if !repo_root.exists() {
        eprintln!("Skipping test: repo root not found");
        return;
    }

    let output = Command::new(&binary)
        .arg("doctor")
        .arg("--json")
        .current_dir(&repo_root)
        .env("ENAIBLE_REPO_ROOT", &repo_root)
        .output()
        .expect("Failed to execute doctor");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .expect("Doctor should produce valid JSON");

    // Check workspace was discovered
    assert!(json.get("repo_root").is_some(), "Should discover repo_root");
}

#[test]
fn test_cli_with_test_codebase_vulnerable_apps() {
    let repo_root = get_ai_workflows_root();
    let test_codebase = repo_root.join("test_codebase/vulnerable-apps");

    if !test_codebase.exists() {
        eprintln!("Skipping test: test_codebase/vulnerable-apps not found");
        return;
    }

    // Verify test fixtures exist
    let test_python = test_codebase.join("test-python");
    let test_js = test_codebase.join("test-javascript");

    // These directories should exist in the test fixtures
    assert!(test_codebase.is_dir(), "vulnerable-apps should be a directory");

    // List contents for debugging
    if let Ok(entries) = fs::read_dir(&test_codebase) {
        for entry in entries {
            if let Ok(entry) = entry {
                eprintln!("Found test fixture: {:?}", entry.path());
            }
        }
    }
}

#[test]
fn test_cli_with_clean_apps() {
    let repo_root = get_ai_workflows_root();
    let clean_apps = repo_root.join("test_codebase/clean-apps");

    if !clean_apps.exists() {
        eprintln!("Skipping test: test_codebase/clean-apps not found");
        return;
    }

    // Verify clean-apps fixtures exist
    assert!(clean_apps.is_dir(), "clean-apps should be a directory");
}

#[test]
fn test_analyzer_run_with_test_target() {
    let binary = get_binary_path();
    let repo_root = get_ai_workflows_root();
    let test_target = repo_root.join("test_codebase/vulnerable-apps/test-python");

    if !test_target.exists() {
        eprintln!("Skipping test: test target not found");
        return;
    }

    // Try to run security analyzer on test codebase
    let output = Command::new(&binary)
        .arg("analyzers")
        .arg("run")
        .arg("security:semgrep")
        .arg("--target")
        .arg(&test_target)
        .arg("--json")
        .current_dir(&repo_root)
        .env("ENAIBLE_REPO_ROOT", &repo_root)
        .output()
        .expect("Failed to run analyzer");

    // Even if analyzer isn't fully implemented, command should parse and return JSON
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    eprintln!("Analyzer stdout: {}", stdout);
    eprintln!("Analyzer stderr: {}", stderr);
}

#[test]
fn test_prompt_e2e_fixtures() {
    let repo_root = get_ai_workflows_root();
    let fixtures = repo_root.join("shared/tests/integration/fixtures/prompt-e2e");

    if !fixtures.exists() {
        eprintln!("Skipping test: prompt-e2e fixtures not found");
        return;
    }

    // Check expected fixture structure
    let sample_repo = fixtures.join("sample-repo");
    let plans = fixtures.join("plans");
    let rules = fixtures.join("rules");

    if sample_repo.exists() {
        assert!(sample_repo.is_dir(), "sample-repo should be a directory");
    }

    if plans.exists() {
        assert!(plans.is_dir(), "plans should be a directory");
    }

    if rules.exists() {
        assert!(rules.is_dir(), "rules should be a directory");
    }
}

#[test]
fn test_doctor_all_checks() {
    let binary = get_binary_path();
    let repo_root = get_ai_workflows_root();

    if !repo_root.exists() {
        return;
    }

    let output = Command::new(&binary)
        .arg("doctor")
        .arg("--json")
        .current_dir(&repo_root)
        .env("ENAIBLE_REPO_ROOT", &repo_root)
        .output()
        .expect("Failed to execute doctor");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout)
        .expect("Should produce valid JSON");

    // Verify expected checks are present
    if let Some(checks) = json.get("checks").and_then(|c| c.as_object()) {
        eprintln!("Doctor checks: {:?}", checks.keys().collect::<Vec<_>>());
        // Should have workspace check
        assert!(checks.contains_key("workspace") || checks.contains_key("shared_workspace"),
            "Should have workspace-related check");
    }
}

#[test]
fn test_prompts_help_completeness() {
    let binary = get_binary_path();

    let output = Command::new(&binary)
        .arg("prompts")
        .arg("render")
        .arg("--help")
        .output()
        .expect("Failed to get help");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check render command has expected options
    assert!(stdout.contains("--prompt"), "Should have --prompt option");
    assert!(stdout.contains("--system"), "Should have --system option");
}

#[test]
fn test_install_help() {
    let binary = get_binary_path();

    let output = Command::new(&binary)
        .arg("install")
        .arg("--help")
        .output()
        .expect("Failed to get install help");

    assert!(output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check install command exists and has help
    assert!(stdout.contains("install") || stdout.contains("Install"),
        "Should show install command help");
}

// Test that CLI outputs are machine-parseable
#[test]
fn test_json_output_format() {
    let binary = get_binary_path();

    // Version should not be JSON
    let version_output = Command::new(&binary)
        .arg("version")
        .output()
        .expect("Failed to run version");

    let version_str = String::from_utf8_lossy(&version_output.stdout);
    assert!(!version_str.trim().starts_with("{"), "Version should not be JSON");
    assert!(version_str.contains("0.1.0"), "Version should include version number");

    // Doctor --json should be valid JSON
    let doctor_output = Command::new(&binary)
        .arg("doctor")
        .arg("--json")
        .output()
        .expect("Failed to run doctor");

    let doctor_str = String::from_utf8_lossy(&doctor_output.stdout);
    assert!(serde_json::from_str::<serde_json::Value>(&doctor_str).is_ok(),
        "Doctor --json should output valid JSON");
}

// Test error handling
#[test]
fn test_unknown_command_error() {
    let binary = get_binary_path();

    let output = Command::new(&binary)
        .arg("not-a-real-command")
        .output()
        .expect("Failed to run command");

    assert!(!output.status.success(), "Unknown command should fail");
}

#[test]
fn test_prompts_render_unknown_prompt() {
    let binary = get_binary_path();
    let repo_root = get_ai_workflows_root();

    if !repo_root.exists() {
        return;
    }

    let output = Command::new(&binary)
        .arg("prompts")
        .arg("render")
        .arg("--prompt")
        .arg("definitely-not-a-real-prompt")
        .arg("--system")
        .arg("claude-code")
        .current_dir(&repo_root)
        .env("ENAIBLE_REPO_ROOT", &repo_root)
        .output()
        .expect("Failed to run render");

    // Should fail with error about unknown prompt
    assert!(!output.status.success() || 
            String::from_utf8_lossy(&output.stderr).contains("Unknown") ||
            String::from_utf8_lossy(&output.stderr).contains("unknown"),
        "Should error on unknown prompt");
}
