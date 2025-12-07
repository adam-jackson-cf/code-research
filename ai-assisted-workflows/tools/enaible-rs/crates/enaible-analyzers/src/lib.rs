pub mod base;
pub mod registry;
pub mod security;
pub mod quality;
pub mod performance;

pub use base::{
    AnalysisResult, Analyzer, AnalyzerConfig, Finding, collect_files, create_analyzer_config,
};
pub use registry::{AnalyzerRegistry, bootstrap_registry};

// Re-export individual analyzers
pub use security::{SemgrepAnalyzer, DetectSecretsAnalyzer};
pub use quality::{LizardAnalyzer, JscpdAnalyzer};
pub use performance::RuffAnalyzer;
