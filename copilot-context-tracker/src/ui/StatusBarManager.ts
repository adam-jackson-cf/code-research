import * as vscode from 'vscode';
import { ModelInfo } from '../models/ModelInfo';
import { logger } from '../utils/logger';

/**
 * Configuration for status bar display format.
 */
interface StatusBarConfig {
  format: string;
  show: boolean;
}

/**
 * Manages the status bar item that displays Copilot context information.
 * The status bar shows the current model and its maximum context window size.
 */
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private config: StatusBarConfig;
  private currentModel: ModelInfo | undefined;

  constructor() {
    // Create status bar item (aligned to the right, priority 100)
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

    // Set up click command
    this.statusBarItem.command = 'copilot-context-tracker.showDetailedView';

    // Load configuration
    this.config = this.loadConfig();

    // Show status bar if enabled
    if (this.config.show) {
      this.statusBarItem.show();
    }

    logger.debug('Status bar manager initialized');
  }

  /**
   * Updates the status bar with information about the current model.
   */
  updateModel(model: ModelInfo | undefined): void {
    this.currentModel = model;
    this.refresh();
  }

  /**
   * Updates the status bar with multiple models (shows primary model).
   */
  updateModels(models: ModelInfo[]): void {
    if (models.length > 0) {
      this.currentModel = models[0];
      this.refresh();
    } else {
      this.clear();
    }
  }

  /**
   * Refreshes the status bar display with current model information.
   */
  refresh(): void {
    if (!this.currentModel) {
      this.statusBarItem.text = '$(copilot) No model available';
      this.statusBarItem.tooltip = 'No Copilot models detected. Click for details.';
      return;
    }

    // Format the status bar text using the configured format
    const text = this.formatStatusText(this.currentModel);
    this.statusBarItem.text = text;

    // Create detailed tooltip
    const tooltip = this.createTooltip(this.currentModel);
    this.statusBarItem.tooltip = tooltip;

    logger.debug(`Status bar updated: ${text}`);
  }

  /**
   * Clears the status bar display.
   */
  clear(): void {
    this.statusBarItem.text = '$(copilot) Copilot Context';
    this.statusBarItem.tooltip = 'No models available. Click for details.';
  }

  /**
   * Shows the status bar item.
   */
  show(): void {
    this.statusBarItem.show();
    this.config.show = true;
  }

  /**
   * Hides the status bar item.
   */
  hide(): void {
    this.statusBarItem.hide();
    this.config.show = false;
  }

  /**
   * Updates configuration from VS Code settings.
   */
  updateConfig(): void {
    const oldConfig = this.config;
    this.config = this.loadConfig();

    // Handle visibility change
    if (this.config.show !== oldConfig.show) {
      if (this.config.show) {
        this.show();
      } else {
        this.hide();
      }
    }

    // Refresh if format changed
    if (this.config.format !== oldConfig.format) {
      this.refresh();
    }

    logger.debug('Status bar configuration updated', this.config);
  }

  /**
   * Disposes the status bar item.
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }

  /**
   * Loads configuration from VS Code settings.
   */
  private loadConfig(): StatusBarConfig {
    const config = vscode.workspace.getConfiguration('copilot-context-tracker');

    return {
      format: config.get<string>('statusBarFormat', '$(copilot) {modelFamily}: {maxTokens} tokens'),
      show: config.get<boolean>('showInStatusBar', true),
    };
  }

  /**
   * Formats the status bar text using the configured format string.
   */
  private formatStatusText(model: ModelInfo): string {
    let text = this.config.format;

    // Replace placeholders
    const replacements: Record<string, string> = {
      '{modelId}': model.id,
      '{modelFamily}': model.family,
      '{vendor}': model.vendor,
      '{maxTokens}': model.maxTokens.toLocaleString(),
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      text = text.replace(new RegExp(placeholder, 'g'), value);
    }

    return text;
  }

  /**
   * Creates a detailed tooltip for the status bar.
   */
  private createTooltip(model: ModelInfo): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;

    tooltip.appendMarkdown(`**Copilot Context Tracker**\n\n`);
    tooltip.appendMarkdown(`**Model:** ${model.family}\n\n`);
    tooltip.appendMarkdown(`**Vendor:** ${model.vendor}\n\n`);
    tooltip.appendMarkdown(
      `**Max Context Window:** ${model.maxTokens.toLocaleString()} tokens\n\n`
    );

    if (model.version) {
      tooltip.appendMarkdown(`**Version:** ${model.version}\n\n`);
    }

    if (model.metadata?.supportsVision) {
      tooltip.appendMarkdown(`**Vision Support:** Yes\n\n`);
    }

    if (model.metadata?.supportsFunctionCalling) {
      tooltip.appendMarkdown(`**Function Calling:** Yes\n\n`);
    }

    tooltip.appendMarkdown(`---\n\n`);
    tooltip.appendMarkdown(`*Click to view detailed information*`);

    return tooltip;
  }
}
