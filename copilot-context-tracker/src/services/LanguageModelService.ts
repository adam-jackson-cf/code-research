import * as vscode from 'vscode';
import { TokenTrackingService } from './TokenTrackingService';
import { logger } from '../utils/logger';
import { ErrorHandler, ErrorType, ExtensionError } from '../utils/errorHandler';

/**
 * Service that wraps the VS Code Language Model API and integrates token tracking.
 * This service provides a convenient interface for making Language Model API calls
 * while automatically tracking token usage.
 */
export class LanguageModelService {
  constructor(private tokenTrackingService: TokenTrackingService) {
    logger.info('Language Model Service initialized');
  }

  /**
   * Sends a chat request to a language model and tracks token usage.
   *
   * @param modelId - The model ID to use (or undefined for default)
   * @param messages - Array of chat messages
   * @param options - Optional request options
   * @param context - Optional context description for tracking
   * @returns The response text and token usage information
   */
  async sendRequest(
    modelId: string | undefined,
    messages: vscode.LanguageModelChatMessage[],
    options?: vscode.LanguageModelChatRequestOptions,
    context?: string
  ): Promise<{
    text: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }> {
    try {
      logger.debug(`Sending chat request to model: ${modelId || 'default'}`, {
        messageCount: messages.length,
        context,
      });

      // Select the appropriate model
      const models = await vscode.lm.selectChatModels({
        vendor: undefined,
        family: undefined,
        version: undefined,
        id: modelId,
      });

      if (models.length === 0) {
        throw new ExtensionError(
          `No language model found${modelId ? ` with ID: ${modelId}` : ''}`,
          ErrorType.API_ERROR
        );
      }

      const model = models[0];
      const actualModelId = model.id || model.family || 'unknown';

      // Send the request
      const request = await model.sendRequest(messages, options);

      // Collect the response
      let responseText = '';
      for await (const fragment of request.text) {
        responseText += fragment;
      }

      // Calculate token usage
      // Note: VS Code API doesn't currently provide exact token counts,
      // so we estimate based on the text length.
      // A rough estimate is ~4 characters per token for English text.
      const estimateTokens = (text: string): number => {
        return Math.ceil(text.length / 4);
      };

      const promptText = messages.map((m) => m.content).join('\n');
      const promptTokens = estimateTokens(promptText);
      const completionTokens = estimateTokens(responseText);
      const totalTokens = promptTokens + completionTokens;

      // Record the usage
      this.tokenTrackingService.recordUsage(actualModelId, promptTokens, completionTokens, context);

      logger.info(
        `Chat request completed: ${actualModelId}, Tokens: ${totalTokens} (${promptTokens} + ${completionTokens})`
      );

      return {
        text: responseText,
        promptTokens,
        completionTokens,
        totalTokens,
      };
    } catch (error) {
      ErrorHandler.handle(
        new ExtensionError(
          'Failed to send language model request',
          ErrorType.API_ERROR,
          error as Error
        ),
        true
      );
      throw error;
    }
  }

  /**
   * Sends a simple text prompt to the default model.
   * Convenience method for simple use cases.
   */
  async sendPrompt(prompt: string, modelId?: string, context?: string): Promise<string> {
    const message = vscode.LanguageModelChatMessage.User(prompt);
    const result = await this.sendRequest(modelId, [message], {}, context);
    return result.text;
  }

  /**
   * Counts tokens in a given text (estimation).
   * Note: This is an approximation since exact tokenization depends on the model.
   */
  estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    // This varies by model and language
    return Math.ceil(text.length / 4);
  }

  /**
   * Checks if the Language Model API is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!vscode.lm || !vscode.lm.selectChatModels) {
        return false;
      }

      const models = await vscode.lm.selectChatModels();
      return models.length > 0;
    } catch (error) {
      logger.error('Error checking Language Model API availability', error);
      return false;
    }
  }
}
