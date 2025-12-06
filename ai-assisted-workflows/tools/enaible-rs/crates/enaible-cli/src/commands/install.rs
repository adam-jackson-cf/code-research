use anyhow::Result;
use clap::Args;
use enaible_core::load_workspace;
use std::path::PathBuf;
use std::process::Command;

#[derive(Args)]
pub struct InstallArgs {
    /// Install Enaible CLI itself
    #[arg(long)]
    cli: bool,

    /// Sync shared workspace
    #[arg(long)]
    sync_shared: bool,

    /// Install Python dependencies
    #[arg(long)]
    python_deps: bool,

    /// Skip dependency installation
    #[arg(long)]
    skip_deps: bool,

    /// Target directory for installation
    #[arg(long)]
    target: Option<PathBuf>,
}

pub fn handle_command(args: InstallArgs) -> Result<()> {
    let workspace = load_workspace(None)?;

    if args.cli {
        println!("Installing Enaible CLI...");
        // In a real implementation, this would copy the binary to a system location
        println!("CLI installation not yet implemented in Rust version");
    }

    if args.sync_shared {
        println!("Syncing shared workspace...");
        let target = args
            .target
            .unwrap_or_else(|| home::home_dir().unwrap().join(".enaible").join("workspace"));

        if !target.exists() {
            std::fs::create_dir_all(&target)?;
        }

        // Copy shared directory
        let source = workspace.shared_root;
        let dest = target.join("shared");

        println!("Copying {} to {}", source.display(), dest.display());

        // In production, use a proper recursive copy
        // For now, we'll use a simple approach
        if dest.exists() {
            std::fs::remove_dir_all(&dest)?;
        }

        copy_dir_all(&source, &dest)?;
        println!("Shared workspace synced successfully");
    }

    if args.python_deps && !args.skip_deps {
        println!("Installing Python dependencies...");
        let setup_script = workspace
            .repo_root
            .join("shared")
            .join("setup")
            .join("install_dependencies.py");

        if setup_script.exists() {
            let status = Command::new("python3")
                .arg(&setup_script)
                .status()?;

            if !status.success() {
                anyhow::bail!("Failed to install Python dependencies");
            }
        } else {
            println!("Setup script not found, skipping Python dependencies");
        }
    }

    println!("Installation complete");
    Ok(())
}

fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> Result<()> {
    std::fs::create_dir_all(dst)?;

    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}