# Development Guide

## Project Overview

The Copilot Context Tracker is a VS Code extension that provides visibility into GitHub Copilot's available models and their context capacities. It also tracks token usage when the extension uses the Language Model API.

## Architecture

### Core Components

#### 1. Models (`src/models/`)
Data structures and business entities:

- **ModelInfo.ts**: Defines model information structure, known model configurations, and parsing utilities
- **TokenUsage.ts**: Token usage tracking data structures and statistics calculator
- **index.ts**: Barrel exports for models

#### 2. Services (`src/services/`)
Business logic layer:

- **ModelDiscoveryService.ts**: Discovers available Copilot models via VS Code API
- **TokenTrackingService.ts**: Tracks and aggregates token usage statistics
- **LanguageModelService.ts**: Wrapper for VS Code Language Model API with tracking
- **index.ts**: Barrel exports for services

#### 3. UI Components (`src/ui/`)
User interface layer:

- **StatusBarManager.ts**: Manages status bar item display
- **DetailedViewProvider.ts**: Provides detailed webview panel with comprehensive information
- **index.ts**: Barrel exports for UI components

#### 4. Utilities (`src/utils/`)
Cross-cutting concerns:

- **logger.ts**: Logging utility with multiple log levels
- **errorHandler.ts**: Centralized error handling
- **index.ts**: Barrel exports for utilities

#### 5. Main Entry (`src/extension.ts`)
Extension lifecycle management:
- Activation/deactivation
- Service initialization
- Command registration
- Event handling

## Data Flow

```
User Action → Command → Service → Model → UI Update
                ↓
            Logger/Error Handler
```

1. **Model Discovery Flow**:
   ```
   extension.ts → ModelDiscoveryService → vscode.lm.selectChatModels()
                                       ↓
                          StatusBarManager ← ModelInfo[]
                                       ↓
                          DetailedViewProvider
   ```

2. **Token Tracking Flow**:
   ```
   LanguageModelService → vscode.lm → Response
            ↓
   TokenTrackingService → TokenUsageTracker
            ↓
   DetailedViewProvider (via callback)
   ```

## Key Features

### 1. Model Discovery
- Uses `vscode.lm.selectChatModels()` to discover available models
- Parses model information including vendor, family, and context window size
- Falls back to known model configurations when exact info unavailable

### 2. Status Bar Integration
- Displays current model and max tokens
- Configurable format string with placeholders
- Click to open detailed view
- Can be shown/hidden via configuration

### 3. Detailed View
- Webview panel with comprehensive information
- Educational section explaining limitations
- Model cards with specifications
- Token usage statistics and charts
- Export and clear functionality

### 4. Token Tracking
- Tracks Language Model API usage by the extension
- Estimates token counts (exact counts not available from API)
- Per-model statistics
- Historical data retention

### 5. Configuration
- Status bar format customization
- Auto-refresh interval
- Log level control
- Show/hide status bar

## Configuration Options

```typescript
interface Config {
  statusBarFormat: string;        // Default: "$(copilot) {modelFamily}: {maxTokens} tokens"
  showInStatusBar: boolean;       // Default: true
  autoRefreshInterval: number;    // Default: 60000 (ms)
  logLevel: 'debug' | 'info' | 'warn' | 'error'; // Default: 'info'
}
```

## Commands

1. **copilot-context-tracker.showDetailedView**: Opens detailed webview panel
2. **copilot-context-tracker.refreshModels**: Manually refreshes model list
3. **copilot-context-tracker.clearUsageStats**: Clears usage statistics

## API Usage

### VS Code Language Model API

The extension uses the following VS Code APIs:

```typescript
// Discover models
const models = await vscode.lm.selectChatModels({
  vendor: undefined,
  family: undefined,
  version: undefined,
  id: modelId,
});

// Send request
const response = await model.sendRequest(messages, options);
for await (const fragment of response.text) {
  // Process response
}
```

## Testing

### Test Structure
- Unit tests for models (`test/suite/models/`)
- Unit tests for services (`test/suite/services/`)
- Integration tests planned (`test/suite/integration/`)

### Running Tests
```bash
npm test
```

## Development Workflow

### Setup
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch
```

### Debugging
1. Open VS Code
2. Press F5 or select "Run Extension" from debug panel
3. A new VS Code window will open with the extension loaded

### Code Quality
```bash
# Lint
npm run lint

# Format
npm run format

# Check formatting
npm run format:check
```

## Build and Package

```bash
# Compile for production
npm run vscode:prepublish

# Package extension (requires vsce)
vsce package
```

## Important Limitations

### What This Extension Cannot Do

1. **Track Inline Completions**: GitHub Copilot's inline code completions do not expose token usage through any public API. The extension cannot track these.

2. **Exact Token Counts**: The VS Code Language Model API doesn't provide exact token counts. The extension estimates tokens based on text length (~4 chars/token).

3. **Historical Copilot Usage**: Cannot access historical usage data from Copilot itself, only tracks what the extension uses.

### What This Extension Can Do

1. **Display Model Info**: Shows available models and their capabilities
2. **Track Extension Usage**: Tracks tokens when the extension uses the Language Model API
3. **Educational**: Provides information about model capabilities

## Error Handling

The extension uses a centralized error handling approach:

```typescript
try {
  // Operation
} catch (error) {
  ErrorHandler.handle(error, showToUser);
}
```

Error types:
- API_ERROR
- CONFIGURATION_ERROR
- NETWORK_ERROR
- PERMISSION_ERROR
- UNKNOWN_ERROR

## Logging

Multi-level logging system:
- DEBUG: Detailed diagnostic information
- INFO: General informational messages
- WARN: Warning messages
- ERROR: Error messages

Access logs via:
- Command Palette → "Copilot Context: Show Logs"
- Output panel → "Copilot Context Tracker"

## Performance Considerations

1. **Model Discovery**: Cached after initial discovery, refreshed on demand or via interval
2. **Token Tracking**: Lightweight in-memory storage, no external API calls
3. **UI Updates**: Debounced and event-driven
4. **Auto-refresh**: Configurable interval, can be disabled

## Security

- No data sent outside VS Code
- No external API calls
- All data stored locally
- No code tracking or telemetry

## Future Enhancements

Potential future features:
- Historical usage graphs
- Export to CSV/JSON
- Usage alerts and quotas
- Model comparison features
- Integration with VS Code telemetry (opt-in)
- Custom model configurations

## Contributing

See [README.md](README.md) for contribution guidelines.

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [GitHub Copilot Docs](https://docs.github.com/copilot)
