mod commands;

use anyhow::Result;
use clap::{Parser, Subcommand};
use commands::{analyzers, install, prompts, root};

/// Unified CLI for AI-Assisted Workflows
#[derive(Parser)]
#[command(name = "enaible")]
#[command(version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Display CLI version information
    Version,

    /// Run basic environment diagnostics
    Doctor {
        /// Emit diagnostics as JSON instead of human-readable text
        #[arg(long)]
        json: bool,
    },

    /// Render and validate managed prompts
    #[command(subcommand)]
    Prompts(prompts::PromptsCommands),

    /// Run and inspect registered analyzers
    #[command(subcommand)]
    Analyzers(analyzers::AnalyzersCommands),

    /// Install dependencies and setup workspace
    Install(install::InstallArgs),

    /// Capture session context for Claude or Codex
    ContextCapture(root::ContextCaptureArgs),

    /// Scrape documentation and save as markdown
    DocsScrape(root::DocsScrapeArgs),

    /// Verify that the requested CLI has an active authentication session
    AuthCheck(root::AuthCheckArgs),
}

fn main() -> Result<()> {
    env_logger::init();

    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Version) | None => {
            root::version();
            Ok(())
        }
        Some(Commands::Doctor { json }) => root::doctor(json),
        Some(Commands::Prompts(cmd)) => prompts::handle_command(cmd),
        Some(Commands::Analyzers(cmd)) => analyzers::handle_command(cmd),
        Some(Commands::Install(args)) => install::handle_command(args),
        Some(Commands::ContextCapture(args)) => root::context_capture(args),
        Some(Commands::DocsScrape(args)) => root::docs_scrape(args),
        Some(Commands::AuthCheck(args)) => root::auth_check(args),
    }
}