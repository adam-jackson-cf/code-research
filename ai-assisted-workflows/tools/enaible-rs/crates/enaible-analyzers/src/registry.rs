use crate::base::{Analyzer, AnalyzerConfig};
use anyhow::{anyhow, Result};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

type AnalyzerFactory = Box<dyn Fn(&AnalyzerConfig) -> Box<dyn Analyzer> + Send + Sync>;

pub struct AnalyzerRegistry {
    registry: Arc<Mutex<HashMap<String, AnalyzerFactory>>>,
}

impl AnalyzerRegistry {
    pub fn new() -> Self {
        Self {
            registry: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register an analyzer factory with a given name
    pub fn register<F>(&self, name: &str, factory: F) -> Result<()>
    where
        F: Fn(&AnalyzerConfig) -> Box<dyn Analyzer> + Send + Sync + 'static,
    {
        let mut registry = self.registry.lock().unwrap();
        if registry.contains_key(name) {
            return Err(anyhow!("Analyzer '{}' is already registered", name));
        }
        registry.insert(name.to_string(), Box::new(factory));
        Ok(())
    }

    /// Create an analyzer instance by name
    pub fn create(&self, name: &str, config: &AnalyzerConfig) -> Result<Box<dyn Analyzer>> {
        let registry = self.registry.lock().unwrap();
        let factory = registry
            .get(name)
            .ok_or_else(|| anyhow!("Unknown analyzer: {}", name))?;
        Ok(factory(config))
    }

    /// List all registered analyzer names
    pub fn list(&self) -> Vec<String> {
        let registry = self.registry.lock().unwrap();
        registry.keys().cloned().collect()
    }

    /// Get the global registry instance
    pub fn global() -> &'static Self {
        static INSTANCE: Lazy<AnalyzerRegistry> = Lazy::new(AnalyzerRegistry::new);
        &INSTANCE
    }
}

/// Decorator-style registration macro (similar to Python's @register decorator)
#[macro_export]
macro_rules! register_analyzer {
    ($name:expr, $analyzer_type:ty) => {
        #[ctor::ctor]
        fn register() {
            use $crate::registry::AnalyzerRegistry;

            AnalyzerRegistry::global()
                .register($name, |config| Box::new(<$analyzer_type>::new(config)))
                .expect(&format!("Failed to register analyzer: {}", $name));
        }
    };
}

// Example stub analyzers that would be implemented in separate modules
pub struct SecurityAnalyzer {
    config: AnalyzerConfig,
}

impl SecurityAnalyzer {
    pub fn new(config: &AnalyzerConfig) -> Self {
        Self {
            config: config.clone(),
        }
    }
}

impl Analyzer for SecurityAnalyzer {
    fn analyze(&self, target: &str) -> Result<crate::base::AnalysisResult> {
        // Stub implementation
        Ok(crate::base::AnalysisResult::default())
    }

    fn name(&self) -> &str {
        "security"
    }

    fn description(&self) -> &str {
        "Security vulnerability analyzer"
    }
}

pub struct QualityAnalyzer {
    config: AnalyzerConfig,
}

impl QualityAnalyzer {
    pub fn new(config: &AnalyzerConfig) -> Self {
        Self {
            config: config.clone(),
        }
    }
}

impl Analyzer for QualityAnalyzer {
    fn analyze(&self, target: &str) -> Result<crate::base::AnalysisResult> {
        // Stub implementation
        Ok(crate::base::AnalysisResult::default())
    }

    fn name(&self) -> &str {
        "quality"
    }

    fn description(&self) -> &str {
        "Code quality analyzer"
    }
}

/// Bootstrap the registry with default analyzers
pub fn bootstrap_registry() {
    let registry = AnalyzerRegistry::global();

    // Register stub analyzers
    registry
        .register("security:basic", |config| {
            Box::new(SecurityAnalyzer::new(config))
        })
        .ok();

    registry
        .register("quality:lizard", |config| {
            Box::new(QualityAnalyzer::new(config))
        })
        .ok();
}