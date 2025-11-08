# Copilot Context Tracker

A Visual Studio Code extension that helps you understand GitHub Copilot's context capacity and track Language Model API usage.

## Features

- **Display Model Information**: View available GitHub Copilot models and their maximum context window sizes
- **Status Bar Integration**: See current model and context capacity at a glance
- **Token Usage Tracking**: Track token usage when this extension uses the Language Model API
- **Detailed View**: Access comprehensive information through an interactive webview panel
- **Educational**: Learn about different AI models and their capabilities

## Important Limitations

**This extension CANNOT track Copilot's inline code completion usage.** GitHub Copilot's inline completions (the suggestions you see while typing code) do not expose token usage information through any public API.

This extension can only:
- Display information about available Copilot models
- Track token usage when this extension itself uses the Language Model API
- Provide educational information about model capabilities

## Requirements

- Visual Studio Code 1.90.0 or later
- GitHub Copilot extension installed and active
- Active GitHub Copilot subscription
- Signed in to GitHub in VS Code

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Copilot Context Tracker"
4. Click Install

Or install from the VS Code Marketplace: [Link to be added]

## Usage

### Status Bar

Once activated, the extension displays information in the status bar showing:
- The current Copilot model
- Maximum context window size

Click the status bar item to open the detailed view.

### Commands

Access these commands via the Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

- **Copilot Context: Show Detailed View** - Opens a panel with comprehensive information
- **Copilot Context: Refresh Models** - Manually refreshes the list of available models
- **Copilot Context: Clear Usage Statistics** - Clears all recorded usage statistics

### Detailed View

The detailed view provides:
- Educational information about what the extension can and cannot do
- List of all available Copilot models with their specifications
- Token usage statistics (if any API calls have been made)
- Model capabilities (vision support, function calling, etc.)

## Configuration

Configure the extension through VS Code settings:

```json
{
  // Format string for status bar display
  "copilot-context-tracker.statusBarFormat": "$(copilot) {modelFamily}: {maxTokens} tokens",

  // Show/hide status bar item
  "copilot-context-tracker.showInStatusBar": true,

  // Auto-refresh interval in milliseconds (0 to disable)
  "copilot-context-tracker.autoRefreshInterval": 60000,

  // Logging level
  "copilot-context-tracker.logLevel": "info"
}
```

### Status Bar Format Placeholders

- `{modelId}` - Full model ID
- `{modelFamily}` - Model family name
- `{vendor}` - Model vendor (OpenAI, Anthropic, Google)
- `{maxTokens}` - Maximum context window size

## Supported Models

The extension recognizes and provides information for:

- **OpenAI Models**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-4, GPT-3.5 Turbo, o1 Preview, o1 Mini
- **Anthropic Models**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
- **Google Models**: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini Pro

## Privacy & Data

This extension:
- Does NOT send any data outside of VS Code
- Does NOT track your code or coding activity
- Only tracks Language Model API usage when the extension itself makes calls
- Stores all data locally in your VS Code workspace

## Troubleshooting

### No models detected

Ensure that:
1. GitHub Copilot extension is installed and enabled
2. You are signed in to GitHub in VS Code
3. You have an active Copilot subscription
4. You are using VS Code 1.90.0 or later

### Status bar not showing

Check the setting: `copilot-context-tracker.showInStatusBar`

### Need more help?

Use the command "Copilot Context: Show Detailed View" to see educational information and check logs via "Show Logs" button if errors occur.

## Development

### Building from Source

```bash
# Clone the repository
git clone <repository-url>
cd copilot-context-tracker

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Package the extension
vsce package
```

### Project Structure

```
copilot-context-tracker/
├── src/
│   ├── models/          # Data models and structures
│   ├── services/        # Core business logic
│   ├── ui/             # UI components
│   ├── utils/          # Utility functions
│   └── extension.ts    # Main entry point
├── resources/          # Static resources
├── test/              # Test files
└── package.json       # Extension manifest
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Acknowledgments

- Built with the VS Code Language Model API
- Inspired by the need to understand AI model capabilities
- Thanks to the GitHub Copilot team for providing the API

## Related Resources

- [VS Code Language Model API Documentation](https://code.visualstudio.com/api/extension-guides/language-model)
- [GitHub Copilot Documentation](https://docs.github.com/copilot)
- [VS Code Extension API](https://code.visualstudio.com/api)
