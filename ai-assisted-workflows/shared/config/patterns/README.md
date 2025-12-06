# Pattern Configuration Overview

This directory contains declarative pattern definitions consumed by multiple analyzers:

- `architectural_patterns.json`, `antipatterns.json`, `language_features.json` – drive the architectural pattern detector.
- `error/` – root cause analyzer inputs:
  - `patterns.json` – canonical error categories used across languages.
  - `language_patterns.json` – language/extension specific supplements layered on top of the general set.
  - `error_type_map.json` – maps runtime error labels (e.g., `TypeError`) to the relevant pattern identifiers. Use `"__all__"` to reference every pattern and keep `default_patterns` in sync with the analyzer’s fallback behaviour.
- `scalability/` – database, performance, concurrency, and architecture patterns consumed by the scalability analyzer.

All configs include a `schema_version` field; bump the version when making breaking structural changes and update the corresponding loader validation.
