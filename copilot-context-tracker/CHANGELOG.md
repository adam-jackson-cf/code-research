# Changelog

All notable changes to the "Copilot Context Tracker" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-11-08

### Added
- Initial release of Copilot Context Tracker
- Model discovery using VS Code Language Model API
- Status bar integration showing current model and context capacity
- Detailed webview panel with comprehensive information
- Token usage tracking for Language Model API calls
- Support for multiple AI vendors (OpenAI, Anthropic, Google)
- Configuration options for status bar format and auto-refresh
- Educational information about extension capabilities and limitations
- Commands for refreshing models and clearing statistics
- Comprehensive error handling and logging
- TypeScript implementation with strict mode
- Full test suite

### Features
- Display available GitHub Copilot models
- Show maximum context window sizes for each model
- Track token usage when extension uses Language Model API
- Configurable status bar display
- Auto-refresh capability
- Export usage statistics
- Model metadata (vision support, function calling, etc.)

### Documentation
- Complete README with usage instructions
- API documentation
- Configuration guide
- Troubleshooting section

## [Unreleased]

### Planned
- Historical usage graphs and charts
- Export usage data to CSV/JSON
- Notifications for high token usage
- Integration with VS Code telemetry
- Support for custom model configurations
- Model comparison features
- Usage alerts and quotas
