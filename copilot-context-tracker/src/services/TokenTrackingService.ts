import { TokenUsageTracker, TokenUsageEntry, OverallUsageStats } from '../models/TokenUsage';
import { logger } from '../utils/logger';

/**
 * Service responsible for tracking token usage across all Language Model API calls.
 * This service maintains usage statistics and provides reporting capabilities.
 */
export class TokenTrackingService {
  private tracker: TokenUsageTracker;
  private onUsageUpdateCallbacks: Array<(stats: OverallUsageStats) => void> = [];

  constructor() {
    this.tracker = new TokenUsageTracker();
    logger.info('Token tracking service initialized');
  }

  /**
   * Records a new token usage entry.
   */
  recordUsage(
    modelId: string,
    promptTokens: number,
    completionTokens: number,
    context?: string
  ): void {
    this.tracker.addEntry({
      modelId,
      promptTokens,
      completionTokens,
      context,
    });

    logger.debug(
      `Recorded usage: ${modelId} - Prompt: ${promptTokens}, Completion: ${completionTokens}, Total: ${promptTokens + completionTokens}`
    );

    // Notify listeners
    this.notifyUsageUpdate();
  }

  /**
   * Gets all usage entries.
   */
  getEntries(): readonly TokenUsageEntry[] {
    return this.tracker.getEntries();
  }

  /**
   * Gets usage statistics for a specific model.
   */
  getStatsForModel(modelId: string) {
    return this.tracker.getStatsForModel(modelId);
  }

  /**
   * Gets overall usage statistics across all models.
   */
  getOverallStats(): OverallUsageStats {
    return this.tracker.getOverallStats();
  }

  /**
   * Gets recent usage entries.
   */
  getRecentEntries(count: number): TokenUsageEntry[] {
    return this.tracker.getRecentEntries(count);
  }

  /**
   * Gets entries within a date range.
   */
  getEntriesInRange(startDate: Date, endDate: Date): TokenUsageEntry[] {
    return this.tracker.getEntriesInRange(startDate, endDate);
  }

  /**
   * Clears all usage statistics.
   */
  clearStats(): void {
    this.tracker.clear();
    logger.info('Token usage statistics cleared');
    this.notifyUsageUpdate();
  }

  /**
   * Registers a callback to be notified when usage is updated.
   */
  onUsageUpdate(callback: (stats: OverallUsageStats) => void): void {
    this.onUsageUpdateCallbacks.push(callback);
  }

  /**
   * Notifies all registered callbacks of a usage update.
   */
  private notifyUsageUpdate(): void {
    const stats = this.getOverallStats();
    this.onUsageUpdateCallbacks.forEach((callback) => {
      try {
        callback(stats);
      } catch (error) {
        logger.error('Error in usage update callback', error);
      }
    });
  }

  /**
   * Gets a formatted summary of current usage.
   */
  getUsageSummary(): string {
    const stats = this.getOverallStats();

    if (stats.totalCalls === 0) {
      return 'No API usage recorded yet';
    }

    const lines: string[] = [
      `Total API Calls: ${stats.totalCalls}`,
      `Total Tokens Used: ${stats.totalTokens.toLocaleString()}`,
      `Tracking Since: ${stats.trackingStartedAt.toLocaleString()}`,
      '',
      'Usage by Model:',
    ];

    stats.byModel.forEach((modelStats) => {
      lines.push(
        `  ${modelStats.modelId}:`,
        `    Calls: ${modelStats.callCount}`,
        `    Total Tokens: ${modelStats.totalTokens.toLocaleString()}`,
        `    Avg Tokens/Call: ${Math.round(modelStats.averageTokensPerCall)}`
      );
    });

    return lines.join('\n');
  }

  /**
   * Exports usage data as JSON.
   */
  exportUsageData(): string {
    const stats = this.getOverallStats();
    const entries = this.getEntries();

    const data = {
      summary: {
        totalCalls: stats.totalCalls,
        totalTokens: stats.totalTokens,
        trackingStartedAt: stats.trackingStartedAt,
        exportedAt: new Date(),
      },
      byModel: Array.from(stats.byModel.entries()).map(([_modelId, modelStats]) => ({
        ...modelStats,
      })),
      entries: entries.map((entry) => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      })),
    };

    return JSON.stringify(data, null, 2);
  }
}
