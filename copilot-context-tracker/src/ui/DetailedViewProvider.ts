import * as vscode from 'vscode';
import { ModelInfo } from '../models/ModelInfo';
import { OverallUsageStats } from '../models/TokenUsage';
import { logger } from '../utils/logger';

/**
 * Provides a detailed webview panel showing comprehensive information about
 * available models and token usage statistics.
 */
export class DetailedViewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private models: ModelInfo[] = [];
  private usageStats: OverallUsageStats | undefined;

  constructor(private extensionUri: vscode.Uri) {
    logger.debug('Detailed view provider initialized');
  }

  /**
   * Shows or focuses the detailed view panel.
   */
  show(): void {
    if (this.panel) {
      // Panel already exists, just reveal it
      this.panel.reveal();
      this.updateContent();
    } else {
      // Create new panel
      this.createPanel();
    }
  }

  /**
   * Updates the view with current model information.
   */
  updateModels(models: ModelInfo[]): void {
    this.models = models;
    if (this.panel) {
      this.updateContent();
    }
  }

  /**
   * Updates the view with current usage statistics.
   */
  updateUsageStats(stats: OverallUsageStats): void {
    this.usageStats = stats;
    if (this.panel) {
      this.updateContent();
    }
  }

  /**
   * Disposes the panel if it exists.
   */
  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }

  /**
   * Creates the webview panel.
   */
  private createPanel(): void {
    this.panel = vscode.window.createWebviewPanel(
      'copilotContextDetails',
      'Copilot Context Details',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'resources', 'webview')],
      }
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      logger.debug('Detailed view panel disposed');
    });

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(message);
    }, undefined);

    // Set initial content
    this.updateContent();

    logger.debug('Detailed view panel created');
  }

  /**
   * Updates the webview content.
   */
  private updateContent(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.html = this.getHtmlContent();
  }

  /**
   * Generates the HTML content for the webview.
   */
  private getHtmlContent(): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Copilot Context Details</title>
    <style>
        ${this.getStyles()}
    </style>
</head>
<body>
    <div class="container">
        <h1>Copilot Context Tracker</h1>

        ${this.getEducationalSection()}

        ${this.getModelsSection()}

        ${this.getUsageSection()}
    </div>

    <script nonce="${nonce}">
        ${this.getScript()}
    </script>
</body>
</html>`;
  }

  /**
   * Gets the educational information section HTML.
   */
  private getEducationalSection(): string {
    return `
        <section class="educational-section">
            <h2>About This Extension</h2>
            <div class="info-box">
                <h3>What This Extension Does</h3>
                <ul>
                    <li>Displays information about available GitHub Copilot models</li>
                    <li>Shows maximum context window sizes for each model</li>
                    <li>Tracks token usage when this extension uses the Language Model API</li>
                </ul>
            </div>

            <div class="warning-box">
                <h3>Important Limitation</h3>
                <p>
                    <strong>This extension CANNOT track Copilot's inline code completion usage.</strong>
                    GitHub Copilot's inline completions (the suggestions you see while typing code)
                    do not expose token usage information through any public API.
                </p>
                <p>
                    This extension can only track token usage when:
                </p>
                <ul>
                    <li>This extension itself makes calls to the Language Model API</li>
                    <li>You use VS Code's built-in chat features (tracked by VS Code itself)</li>
                </ul>
                <p>
                    The information shown here is primarily educational, helping you understand
                    the capabilities of different Copilot models.
                </p>
            </div>
        </section>
    `;
  }

  /**
   * Gets the models section HTML.
   */
  private getModelsSection(): string {
    if (this.models.length === 0) {
      return `
        <section class="models-section">
            <h2>Available Models</h2>
            <div class="warning-box">
                <p>No Copilot models detected. Please ensure:</p>
                <ul>
                    <li>GitHub Copilot is installed and enabled</li>
                    <li>You are signed in to GitHub</li>
                    <li>You have an active Copilot subscription</li>
                    <li>You are using VS Code 1.90.0 or later</li>
                </ul>
            </div>
        </section>
      `;
    }

    const modelsHtml = this.models
      .map(
        (model) => `
        <div class="model-card">
            <h3>${this.escapeHtml(model.family)}</h3>
            <div class="model-details">
                <div class="detail-row">
                    <span class="label">Model ID:</span>
                    <span class="value"><code>${this.escapeHtml(model.id)}</code></span>
                </div>
                <div class="detail-row">
                    <span class="label">Vendor:</span>
                    <span class="value">${this.escapeHtml(model.vendor)}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Max Context Window:</span>
                    <span class="value"><strong>${model.maxTokens.toLocaleString()} tokens</strong></span>
                </div>
                ${
                  model.version
                    ? `
                <div class="detail-row">
                    <span class="label">Version:</span>
                    <span class="value">${this.escapeHtml(model.version)}</span>
                </div>
                `
                    : ''
                }
                ${
                  model.metadata?.supportsVision
                    ? `
                <div class="detail-row">
                    <span class="label">Vision Support:</span>
                    <span class="value">✓ Yes</span>
                </div>
                `
                    : ''
                }
                ${
                  model.metadata?.supportsFunctionCalling
                    ? `
                <div class="detail-row">
                    <span class="label">Function Calling:</span>
                    <span class="value">✓ Yes</span>
                </div>
                `
                    : ''
                }
            </div>
        </div>
    `
      )
      .join('\n');

    return `
        <section class="models-section">
            <h2>Available Models (${this.models.length})</h2>
            <div class="models-grid">
                ${modelsHtml}
            </div>
        </section>
    `;
  }

  /**
   * Gets the usage statistics section HTML.
   */
  private getUsageSection(): string {
    if (!this.usageStats || this.usageStats.totalCalls === 0) {
      return `
        <section class="usage-section">
            <h2>Token Usage Statistics</h2>
            <p class="no-data">No API usage has been recorded yet by this extension.</p>
        </section>
      `;
    }

    const modelUsageHtml = Array.from(this.usageStats.byModel.values())
      .map(
        (stats) => `
        <tr>
            <td><code>${this.escapeHtml(stats.modelId)}</code></td>
            <td class="number">${stats.callCount}</td>
            <td class="number">${stats.totalTokens.toLocaleString()}</td>
            <td class="number">${Math.round(stats.averageTokensPerCall).toLocaleString()}</td>
            <td class="number">${stats.maxTokensInCall.toLocaleString()}</td>
        </tr>
    `
      )
      .join('\n');

    return `
        <section class="usage-section">
            <h2>Token Usage Statistics</h2>
            <div class="usage-summary">
                <div class="summary-card">
                    <div class="summary-label">Total API Calls</div>
                    <div class="summary-value">${this.usageStats.totalCalls}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Total Tokens Used</div>
                    <div class="summary-value">${this.usageStats.totalTokens.toLocaleString()}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Tracking Since</div>
                    <div class="summary-value">${this.usageStats.trackingStartedAt.toLocaleString()}</div>
                </div>
            </div>

            <h3>Usage by Model</h3>
            <table class="usage-table">
                <thead>
                    <tr>
                        <th>Model</th>
                        <th>Calls</th>
                        <th>Total Tokens</th>
                        <th>Avg Tokens/Call</th>
                        <th>Max Tokens/Call</th>
                    </tr>
                </thead>
                <tbody>
                    ${modelUsageHtml}
                </tbody>
            </table>

            <div class="actions">
                <button onclick="clearStats()" class="button">Clear Statistics</button>
            </div>
        </section>
    `;
  }

  /**
   * Gets CSS styles for the webview.
   */
  private getStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        h1 {
            font-size: 2em;
            margin-bottom: 20px;
            color: var(--vscode-foreground);
        }

        h2 {
            font-size: 1.5em;
            margin: 30px 0 15px 0;
            color: var(--vscode-foreground);
        }

        h3 {
            font-size: 1.2em;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
        }

        section {
            margin-bottom: 40px;
        }

        .info-box, .warning-box {
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }

        .info-box {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
        }

        .warning-box {
            background-color: var(--vscode-inputValidation-warningBackground);
            border-left: 4px solid var(--vscode-inputValidation-warningBorder);
        }

        .warning-box p, .info-box p {
            margin: 10px 0;
        }

        ul {
            margin-left: 20px;
            margin-top: 10px;
        }

        li {
            margin: 5px 0;
        }

        .models-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .model-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 20px;
        }

        .model-details {
            margin-top: 15px;
        }

        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .detail-row:last-child {
            border-bottom: none;
        }

        .label {
            color: var(--vscode-descriptionForeground);
        }

        .value {
            font-weight: 500;
        }

        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }

        .usage-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }

        .summary-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 20px;
            text-align: center;
        }

        .summary-label {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-bottom: 10px;
        }

        .summary-value {
            font-size: 1.8em;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }

        .usage-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }

        .usage-table th,
        .usage-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .usage-table th {
            font-weight: 600;
            background-color: var(--vscode-editor-background);
        }

        .usage-table td.number {
            text-align: right;
        }

        .no-data {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 20px;
            text-align: center;
        }

        .actions {
            margin-top: 20px;
            text-align: center;
        }

        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1em;
        }

        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    `;
  }

  /**
   * Gets JavaScript code for the webview.
   */
  private getScript(): string {
    return `
        const vscode = acquireVsCodeApi();

        function clearStats() {
            if (confirm('Are you sure you want to clear all usage statistics?')) {
                vscode.postMessage({ command: 'clearStats' });
            }
        }
    `;
  }

  /**
   * Handles messages received from the webview.
   */
  private handleWebviewMessage(message: { command: string }): void {
    switch (message.command) {
      case 'clearStats':
        vscode.commands.executeCommand('copilot-context-tracker.clearUsageStats');
        break;
    }
  }

  /**
   * Generates a nonce for CSP.
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Escapes HTML special characters.
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
