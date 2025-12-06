use regex::Regex;
use once_cell::sync::Lazy;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct VariableSpec {
    pub name: String,
    pub type_text: String,
    pub description: Option<String>,
    pub kind: String,
    pub required: bool,
    pub flag_name: Option<String>,
    pub positional_index: Option<usize>,
    pub repeatable: bool,
}

static VARIABLE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"@([A-Z_]+)(?:\{([^}]*)\})?").unwrap()
});

static POSITIONAL_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\$(\d+)").unwrap()
});

static FLAG_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"--([a-z0-9-]+)").unwrap()
});

/// Extract variables from prompt content and return them along with the stripped content
pub fn extract_variables(content: &str) -> (Vec<VariableSpec>, String) {
    let mut variables = Vec::new();
    let mut seen_names = std::collections::HashSet::new();
    let mut positional_counter = 1;

    // Extract all @VARIABLE{description} patterns
    for cap in VARIABLE_REGEX.captures_iter(content) {
        let name = format!("@{}", cap.get(1).unwrap().as_str());

        if seen_names.insert(name.clone()) {
            let description_text = cap.get(2).map(|m| m.as_str().to_string());
            let description = description_text.clone();

            // Determine kind and other attributes from description
            let desc_lower = description_text.as_ref().map(|s| s.to_lowercase()).unwrap_or_default();

            let (kind, flag_name, positional_index) = if desc_lower.contains("positional") || desc_lower.starts_with("$") {
                let idx = if let Some(cap) = POSITIONAL_REGEX.captures(&desc_lower) {
                    cap.get(1).and_then(|m| m.as_str().parse().ok())
                } else {
                    let idx = positional_counter;
                    positional_counter += 1;
                    Some(idx)
                };
                ("positional".to_string(), None, idx)
            } else if desc_lower.contains("flag") || desc_lower.starts_with("--") {
                let flag = FLAG_REGEX.captures(&desc_lower)
                    .and_then(|c| c.get(1))
                    .map(|m| format!("--{}", m.as_str()));
                ("flag".to_string(), flag, None)
            } else if desc_lower.contains("derived") || desc_lower.contains("internal") {
                ("derived".to_string(), None, None)
            } else {
                ("config".to_string(), None, None)
            };

            let required = !name.contains("OPTIONAL") && !desc_lower.contains("optional");
            let repeatable = desc_lower.contains("repeatable");

            variables.push(VariableSpec {
                name: name.clone(),
                type_text: description.clone().unwrap_or_default(),
                description,
                kind,
                required,
                flag_name,
                positional_index,
                repeatable,
            });
        }
    }

    // Strip the variable declarations from content
    let stripped = VARIABLE_REGEX.replace_all(content, "").to_string();

    (variables, stripped)
}

/// Parse comma-separated list or "all"
pub fn split_csv(value: &str) -> Vec<String> {
    if value.is_empty() || value.to_lowercase() == "all" {
        return vec!["all".to_string()];
    }

    value
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}
