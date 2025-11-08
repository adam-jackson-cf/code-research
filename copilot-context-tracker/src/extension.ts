import * as vscode from 'vscode';
import { ModelDiscoveryService } from './services/ModelDiscoveryService';
import { TokenTrackingService } from './services/TokenTrackingService';
import { LanguageModelService } from './services/LanguageModelService';
import { StatusBarManager } from './ui/StatusBarManager';
import { DetailedViewProvider } from './ui/DetailedViewProvider';
import { logger } from './utils/logger';
import { ErrorHandler } from './utils/errorHandler';

/**
 * Extension state and services.
 */
interface ExtensionContext {
  modelDiscoveryService: ModelDiscoveryService;
  tokenTrackingService: TokenTrackingService;
  languageModelService: LanguageModelService;
  statusBarManager: StatusBarManager;
  detailedViewProvider: DetailedViewProvider;
  autoRefreshInterval?: NodeJS.Timeout;
}

let extensionContext: ExtensionContext | undefined;

/**
 * Activates the extension.
 * This is called when the extension is first activated.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.info('Activating Copilot Context Tracker extension...');

  try {
    // Initialize configuration
    await initializeConfiguration();

    // Initialize services
    const services = initializeServices(context);
    extensionContext = services;

    // Register commands
    registerCommands(context, services);

    // Register event handlers
    registerEventHandlers(context, services);

    // Initial model discovery
    await performInitialDiscovery(services);

    // Set up auto-refresh if configured
    setupAutoRefresh(services);

    logger.info('Copilot Context Tracker extension activated successfully');
    vscode.window.showInformationMessage('Copilot Context Tracker is now active!');
  } catch (error) {
    ErrorHandler.handleAndShow(error);
    logger.error('Failed to activate extension', error);
  }
}

/**
 * Deactivates the extension.
 * This is called when the extension is deactivated.
 */
export function deactivate(): void {
  logger.info('Deactivating Copilot Context Tracker extension...');

  if (extensionContext) {
    // Clean up auto-refresh interval
    if (extensionContext.autoRefreshInterval) {
      clearInterval(extensionContext.autoRefreshInterval);
    }

    // Dispose UI components
    extensionContext.statusBarManager.dispose();
    extensionContext.detailedViewProvider.dispose();
  }

  // Dispose logger
  logger.dispose();

  logger.info('Copilot Context Tracker extension deactivated');
}

/**
 * Initializes configuration from VS Code settings.
 */
async function initializeConfiguration(): Promise<void> {
  const config = vscode.workspace.getConfiguration('copilot-context-tracker');
  const logLevel = config.get<'debug' | 'info' | 'warn' | 'error'>('logLevel', 'info');
  logger.setLogLevel(logLevel);
}

/**
 * Initializes all services.
 */
function initializeServices(context: vscode.ExtensionContext): ExtensionContext {
  logger.info('Initializing services...');

  // Create services
  const modelDiscoveryService = new ModelDiscoveryService();
  const tokenTrackingService = new TokenTrackingService();
  const languageModelService = new LanguageModelService(tokenTrackingService);

  // Create UI components
  const statusBarManager = new StatusBarManager();
  const detailedViewProvider = new DetailedViewProvider(context.extensionUri);

  // Set up token tracking updates
  tokenTrackingService.onUsageUpdate((stats) => {
    detailedViewProvider.updateUsageStats(stats);
  });

  logger.info('Services initialized successfully');

  return {
    modelDiscoveryService,
    tokenTrackingService,
    languageModelService,
    statusBarManager,
    detailedViewProvider,
  };
}

/**
 * Registers all extension commands.
 */
function registerCommands(context: vscode.ExtensionContext, services: ExtensionContext): void {
  logger.info('Registering commands...');

  // Command: Show Detailed View
  const showDetailedViewCommand = vscode.commands.registerCommand(
    'copilot-context-tracker.showDetailedView',
    () => {
      logger.info('Showing detailed view');
      services.detailedViewProvider.show();
    }
  );

  // Command: Refresh Models
  const refreshModelsCommand = vscode.commands.registerCommand(
    'copilot-context-tracker.refreshModels',
    async () => {
      logger.info('Manually refreshing models');
      await refreshModels(services);
      vscode.window.showInformationMessage('Models refreshed successfully!');
    }
  );

  // Command: Clear Usage Statistics
  const clearUsageStatsCommand = vscode.commands.registerCommand(
    'copilot-context-tracker.clearUsageStats',
    async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to clear all usage statistics?',
        'Yes',
        'No'
      );

      if (confirm === 'Yes') {
        services.tokenTrackingService.clearStats();
        logger.info('Usage statistics cleared');
        vscode.window.showInformationMessage('Usage statistics cleared!');
      }
    }
  );

  // Add commands to subscriptions for cleanup
  context.subscriptions.push(showDetailedViewCommand, refreshModelsCommand, clearUsageStatsCommand);

  logger.info('Commands registered successfully');
}

/**
 * Registers event handlers for configuration changes.
 */
function registerEventHandlers(context: vscode.ExtensionContext, services: ExtensionContext): void {
  logger.info('Registering event handlers...');

  // Handle configuration changes
  const configChangeHandler = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('copilot-context-tracker')) {
      logger.info('Configuration changed, updating...');

      // Update log level
      const config = vscode.workspace.getConfiguration('copilot-context-tracker');
      const logLevel = config.get<'debug' | 'info' | 'warn' | 'error'>('logLevel', 'info');
      logger.setLogLevel(logLevel);

      // Update status bar configuration
      services.statusBarManager.updateConfig();

      // Update auto-refresh interval
      if (event.affectsConfiguration('copilot-context-tracker.autoRefreshInterval')) {
        setupAutoRefresh(services);
      }
    }
  });

  context.subscriptions.push(configChangeHandler);

  logger.info('Event handlers registered successfully');
}

/**
 * Performs initial model discovery.
 */
async function performInitialDiscovery(services: ExtensionContext): Promise<void> {
  logger.info('Performing initial model discovery...');

  try {
    const models = await services.modelDiscoveryService.discoverModels();

    if (models.length === 0) {
      logger.warn('No models discovered during initial discovery');
      vscode.window
        .showWarningMessage(
          'No Copilot models detected. Please ensure GitHub Copilot is installed and you are signed in.',
          'Show Details'
        )
        .then((action) => {
          if (action === 'Show Details') {
            services.detailedViewProvider.show();
          }
        });
    } else {
      logger.info(`Initial discovery found ${models.length} model(s)`);

      // Update UI
      services.statusBarManager.updateModels(models);
      services.detailedViewProvider.updateModels(models);

      // Log model summary
      logger.info(services.modelDiscoveryService.getSummary());
    }
  } catch (error) {
    ErrorHandler.handleAndShow(error);
  }
}

/**
 * Refreshes model information.
 */
async function refreshModels(services: ExtensionContext): Promise<void> {
  try {
    const models = await services.modelDiscoveryService.discoverModels();

    // Update UI
    services.statusBarManager.updateModels(models);
    services.detailedViewProvider.updateModels(models);

    logger.info(`Refresh complete: ${models.length} model(s) found`);
  } catch (error) {
    ErrorHandler.handleAndShow(error);
  }
}

/**
 * Sets up auto-refresh interval based on configuration.
 */
function setupAutoRefresh(services: ExtensionContext): void {
  // Clear existing interval
  if (services.autoRefreshInterval) {
    clearInterval(services.autoRefreshInterval);
    services.autoRefreshInterval = undefined;
  }

  // Get interval from configuration
  const config = vscode.workspace.getConfiguration('copilot-context-tracker');
  const interval = config.get<number>('autoRefreshInterval', 60000);

  // Set up new interval if enabled
  if (interval > 0) {
    logger.info(`Setting up auto-refresh with interval: ${interval}ms`);

    services.autoRefreshInterval = setInterval(async () => {
      logger.debug('Auto-refreshing models...');
      await refreshModels(services);
    }, interval);
  } else {
    logger.info('Auto-refresh disabled');
  }
}

/**
 * Gets the extension's services (useful for testing or external access).
 */
export function getExtensionContext(): ExtensionContext | undefined {
  return extensionContext;
}
