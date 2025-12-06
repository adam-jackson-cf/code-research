use std::env;
use std::path::{Path, PathBuf};
use thiserror::Error;

/// Workspace paths required by the CLI
#[derive(Debug, Clone)]
pub struct WorkspaceContext {
    pub repo_root: PathBuf,
    pub shared_root: PathBuf,
    pub artifacts_root: PathBuf,
}

#[derive(Error, Debug)]
pub enum WorkspaceError {
    #[error("Unable to locate repository root; set ENAIBLE_REPO_ROOT or run inside a checkout")]
    RepoRootNotFound,

    #[error("Shared analyzers folder missing at {0}; repository may be incomplete")]
    SharedRootMissing(PathBuf),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

const SHARED_SENTINEL: &str = "shared/core/base/analyzer_registry.py";
const SENTINEL_RELATIVE: &str = "core/base/analyzer_registry.py";

/// Get a path from environment variable
fn env_path(keys: &[&str]) -> Option<PathBuf> {
    for key in keys {
        if let Ok(value) = env::var(key) {
            let candidate = PathBuf::from(value)
                .canonicalize()
                .ok()?;
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    None
}

/// Find the shared root directory
pub fn find_shared_root() -> Option<PathBuf> {
    // Explicit env override
    if let Some(env_shared) = env_path(&["ENAIBLE_SHARED_ROOT"]) {
        if env_shared.join(SENTINEL_RELATIVE).exists() {
            return Some(env_shared);
        }
    }

    // Installed workspace copy
    let default_shared_home = home::home_dir()
        .map(|h| h.join(".enaible").join("workspace").join("shared"))
        .unwrap_or_default();

    if default_shared_home.join(SENTINEL_RELATIVE).exists() {
        return Some(default_shared_home);
    }

    // Will fallback to repo-relative detection later
    None
}

/// Find the repository root
fn find_repo_root(start: Option<&Path>, require_shared: bool) -> Result<PathBuf, WorkspaceError> {
    // Check environment variable first
    if let Some(env_repo) = env_path(&["ENAIBLE_REPO_ROOT"]) {
        if !require_shared || env_repo.join(SHARED_SENTINEL).exists() {
            return Ok(env_repo);
        }
    }

    // Start from current directory or provided path
    let search_start = match start {
        Some(p) => p.to_path_buf(),
        None => env::current_dir()?,
    }.canonicalize()?;

    if !require_shared {
        return Ok(search_start);
    }

    // Walk up directory tree looking for sentinel file
    let mut current = search_start.as_path();
    loop {
        if current.join(SHARED_SENTINEL).exists() {
            return Ok(current.to_path_buf());
        }

        match current.parent() {
            Some(parent) => current = parent,
            None => break,
        }
    }

    // Also check from the binary location
    if let Ok(exe_path) = env::current_exe() {
        let mut current = exe_path.as_path();
        loop {
            if current.join(SHARED_SENTINEL).exists() {
                return Ok(current.to_path_buf());
            }

            match current.parent() {
                Some(parent) => current = parent,
                None => break,
            }
        }
    }

    Err(WorkspaceError::RepoRootNotFound)
}

/// Resolve artifacts root directory
fn resolve_artifacts_root(repo_root: &Path) -> PathBuf {
    env_path(&["ENAIBLE_ARTIFACTS_DIR", "ENAIBLE_ARTIFACTS_ROOT"])
        .unwrap_or_else(|| repo_root.join(".enaible"))
}

/// Load workspace context from the current environment
pub fn load_workspace(start: Option<&Path>) -> Result<WorkspaceContext, WorkspaceError> {
    let shared_root = find_shared_root();

    // If we have a packaged/shared copy, we can relax repo discovery
    let repo_root = find_repo_root(start, shared_root.is_none())?;

    let shared_root = match shared_root {
        Some(root) => root,
        None => {
            let root = repo_root.join("shared");
            if !root.exists() {
                return Err(WorkspaceError::SharedRootMissing(root));
            }
            root
        }
    };

    let artifacts_root = resolve_artifacts_root(&repo_root);

    // Create artifacts directory if it doesn't exist
    std::fs::create_dir_all(&artifacts_root).ok();

    Ok(WorkspaceContext {
        repo_root,
        shared_root,
        artifacts_root,
    })
}