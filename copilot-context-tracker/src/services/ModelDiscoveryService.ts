import * as vscode from 'vscode';
import { ModelInfo, parseModelId } from '../models/ModelInfo';
import { logger } from '../utils/logger';
import { ErrorHandler, ErrorType, ExtensionError } from '../utils/errorHandler';

/**
 * Service responsible for discovering available language models through VS Code's API.
 * This service queries the vscode.lm API to find all available Copilot models.
 */
export class ModelDiscoveryService {
  private models: Map<string, ModelInfo> = new Map();
  private lastDiscoveryTime: Date | null = null;
  private discoveryInProgress = false;

  /**
   * Discovers all available language models using VS Code's Language Model API.
   * Returns the list of discovered models.
   */
  async discoverModels(): Promise<ModelInfo[]> {
    if (this.discoveryInProgress) {
      logger.warn('Model discovery already in progress, skipping...');
      return Array.from(this.models.values());
    }

    this.discoveryInProgress = true;
    logger.info('Starting model discovery...');

    try {
      // Check if Language Model API is available
      if (!vscode.lm || !vscode.lm.selectChatModels) {
        throw new ExtensionError(
          'Language Model API is not available. Please ensure you have GitHub Copilot enabled and are using a compatible VS Code version (1.90.0 or later).',
          ErrorType.API_ERROR
        );
      }

      // Clear existing models
      this.models.clear();

      // Query for all available models
      // The selectChatModels API allows us to discover models
      const availableModels = await vscode.lm.selectChatModels();

      if (availableModels.length === 0) {
        logger.warn('No language models found. Copilot may not be enabled.');
        return [];
      }

      logger.info(`Found ${availableModels.length} available model(s)`);

      // Process each discovered model
      for (const model of availableModels) {
        const modelInfo = this.createModelInfo(model);
        this.models.set(modelInfo.id, modelInfo);
        logger.debug(`Discovered model: ${modelInfo.id}`, modelInfo);
      }

      this.lastDiscoveryTime = new Date();
      logger.info(`Model discovery completed. Discovered ${this.models.size} model(s).`);

      return Array.from(this.models.values());
    } catch (error) {
      ErrorHandler.handle(
        new ExtensionError(
          'Failed to discover language models',
          ErrorType.API_ERROR,
          error as Error
        ),
        true
      );
      return [];
    } finally {
      this.discoveryInProgress = false;
    }
  }

  /**
   * Creates a ModelInfo object from a VS Code LanguageModelChat instance.
   */
  private createModelInfo(model: vscode.LanguageModelChat): ModelInfo {
    const modelId = model.id || model.family || 'unknown';

    // Parse the model ID to get additional information
    const parsedInfo = parseModelId(modelId);

    // Try to get max input tokens from the model
    // The VS Code API provides maxInputTokens property
    const maxTokens = model.maxInputTokens || parsedInfo.maxTokens || 0;

    const modelInfo: ModelInfo = {
      id: modelId,
      family: parsedInfo.family || model.family || modelId,
      vendor: parsedInfo.vendor || model.vendor || 'Unknown',
      maxTokens,
      version: model.version,
      metadata: {
        ...parsedInfo.metadata,
        // Add any other metadata from the model
        name: model.name,
      },
    };

    return modelInfo;
  }

  /**
   * Gets a specific model by ID.
   */
  getModel(modelId: string): ModelInfo | undefined {
    return this.models.get(modelId);
  }

  /**
   * Gets all discovered models.
   */
  getAllModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  /**
   * Gets the primary/default model (usually the first one discovered).
   */
  getPrimaryModel(): ModelInfo | undefined {
    const models = this.getAllModels();
    return models.length > 0 ? models[0] : undefined;
  }

  /**
   * Gets models from a specific vendor.
   */
  getModelsByVendor(vendor: string): ModelInfo[] {
    return Array.from(this.models.values()).filter(
      (m) => m.vendor.toLowerCase() === vendor.toLowerCase()
    );
  }

  /**
   * Returns when models were last discovered.
   */
  getLastDiscoveryTime(): Date | null {
    return this.lastDiscoveryTime;
  }

  /**
   * Checks if models have been discovered.
   */
  hasModels(): boolean {
    return this.models.size > 0;
  }

  /**
   * Gets a summary of discovered models.
   */
  getSummary(): string {
    if (this.models.size === 0) {
      return 'No models discovered';
    }

    const vendors = new Set(Array.from(this.models.values()).map((m) => m.vendor));
    return `${this.models.size} model(s) from ${vendors.size} vendor(s): ${Array.from(vendors).join(', ')}`;
  }
}
