# Quick Start Guide

## For Developers

### 1. Install Dependencies
```bash
cd /home/user/code-research/copilot-context-tracker
npm install
```

### 2. Compile TypeScript
```bash
npm run compile
```

### 3. Run in Development Mode
```bash
# Option 1: Press F5 in VS Code (opens Extension Development Host)

# Option 2: Use watch mode for auto-recompilation
npm run watch
```

### 4. Run Tests
```bash
npm test
```

### 5. Lint and Format
```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## For Users

### Testing the Extension

1. Open VS Code in the project directory
2. Press F5 to launch the Extension Development Host
3. In the new window:
   - Look for the Copilot icon in the status bar
   - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Try these commands:
     - "Copilot Context: Show Detailed View"
     - "Copilot Context: Refresh Models"
     - "Copilot Context: Clear Usage Statistics"

### Requirements

- VS Code 1.90.0 or later
- GitHub Copilot extension installed
- Active Copilot subscription
- Signed in to GitHub

## Project Structure

```
copilot-context-tracker/
├── src/
│   ├── models/              # Data models
│   │   ├── ModelInfo.ts     # Model metadata
│   │   ├── TokenUsage.ts    # Usage tracking
│   │   └── index.ts
│   ├── services/            # Business logic
│   │   ├── ModelDiscoveryService.ts
│   │   ├── TokenTrackingService.ts
│   │   ├── LanguageModelService.ts
│   │   └── index.ts
│   ├── ui/                  # UI components
│   │   ├── StatusBarManager.ts
│   │   ├── DetailedViewProvider.ts
│   │   └── index.ts
│   ├── utils/               # Utilities
│   │   ├── logger.ts
│   │   ├── errorHandler.ts
│   │   └── index.ts
│   └── extension.ts         # Main entry point
├── test/                    # Tests
│   ├── suite/
│   │   ├── models/
│   │   ├── services/
│   │   └── index.ts
│   └── runTest.ts
├── out/                     # Compiled output
├── package.json             # Extension manifest
├── tsconfig.json            # TypeScript config
└── README.md                # Documentation
```

## Key Commands

### VS Code Commands (Command Palette)
- `Copilot Context: Show Detailed View` - Opens detailed panel
- `Copilot Context: Refresh Models` - Refreshes model list
- `Copilot Context: Clear Usage Statistics` - Clears usage data

### NPM Scripts
```bash
npm run compile          # Compile TypeScript
npm run watch            # Watch mode (auto-compile)
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting
npm test                 # Run tests
npm run vscode:prepublish # Prepare for publishing
```

## Configuration

Edit settings in VS Code (Settings → Extensions → Copilot Context Tracker):

```json
{
  "copilot-context-tracker.statusBarFormat": "$(copilot) {modelFamily}: {maxTokens} tokens",
  "copilot-context-tracker.showInStatusBar": true,
  "copilot-context-tracker.autoRefreshInterval": 60000,
  "copilot-context-tracker.logLevel": "info"
}
```

### Format Placeholders
- `{modelId}` - Full model ID
- `{modelFamily}` - Model family name
- `{vendor}` - Model vendor
- `{maxTokens}` - Max context window

## Troubleshooting

### No models detected
- Ensure GitHub Copilot extension is installed
- Verify you're signed in to GitHub
- Check you have an active Copilot subscription
- Ensure VS Code version is 1.90.0+

### Extension not activating
- Check Output panel → "Copilot Context Tracker" for logs
- Set log level to "debug" in settings
- Check for errors in Developer Console (Help → Toggle Developer Tools)

### Compilation errors
```bash
# Clean and rebuild
rm -rf out/ node_modules/
npm install
npm run compile
```

## Debugging

1. Set breakpoints in TypeScript files
2. Press F5 to launch Extension Development Host
3. Debugger will attach automatically
4. Check Debug Console for output

## Viewing Logs

1. View → Output (Ctrl+Shift+U / Cmd+Shift+U)
2. Select "Copilot Context Tracker" from dropdown
3. Or use Command Palette: "Copilot Context: Show Logs"

## Package Extension

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Package extension
vsce package

# Creates: copilot-context-tracker-0.1.0.vsix
```

## Publishing

```bash
# Create publisher account at https://marketplace.visualstudio.com/manage

# Login
vsce login <publisher-name>

# Publish
vsce publish
```

## Useful Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Language Model API Guide](https://code.visualstudio.com/api/extension-guides/language-model)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

## Support

- Check README.md for detailed documentation
- See DEVELOPMENT.md for architecture details
- Review IMPLEMENTATION_SUMMARY.md for complete feature list

## License

MIT License - See LICENSE file for details
