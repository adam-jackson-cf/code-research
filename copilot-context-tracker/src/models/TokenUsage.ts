/**
 * Represents token usage for a single API call or interaction.
 */
export interface TokenUsageEntry {
  /** Timestamp when the usage occurred */
  timestamp: Date;

  /** Model ID used for this interaction */
  modelId: string;

  /** Number of tokens in the prompt/input */
  promptTokens: number;

  /** Number of tokens in the completion/output */
  completionTokens: number;

  /** Total tokens used (prompt + completion) */
  totalTokens: number;

  /** Optional context about the request */
  context?: string;
}

/**
 * Aggregated token usage statistics for a model.
 */
export interface TokenUsageStats {
  /** Model ID these stats are for */
  modelId: string;

  /** Total number of API calls made */
  callCount: number;

  /** Total prompt tokens used across all calls */
  totalPromptTokens: number;

  /** Total completion tokens used across all calls */
  totalCompletionTokens: number;

  /** Total tokens used (prompt + completion) */
  totalTokens: number;

  /** Average tokens per call */
  averageTokensPerCall: number;

  /** Maximum tokens used in a single call */
  maxTokensInCall: number;

  /** When the first call was made */
  firstCallTimestamp?: Date;

  /** When the most recent call was made */
  lastCallTimestamp?: Date;
}

/**
 * Overall usage statistics across all models.
 */
export interface OverallUsageStats {
  /** Statistics per model */
  byModel: Map<string, TokenUsageStats>;

  /** Total calls across all models */
  totalCalls: number;

  /** Total tokens across all models */
  totalTokens: number;

  /** When tracking started */
  trackingStartedAt: Date;
}

/**
 * Helper class to manage and calculate token usage statistics.
 */
export class TokenUsageTracker {
  private entries: TokenUsageEntry[] = [];
  private trackingStartedAt: Date;

  constructor() {
    this.trackingStartedAt = new Date();
  }

  /**
   * Records a new token usage entry.
   */
  addEntry(entry: Omit<TokenUsageEntry, 'timestamp' | 'totalTokens'>): void {
    const fullEntry: TokenUsageEntry = {
      ...entry,
      timestamp: new Date(),
      totalTokens: entry.promptTokens + entry.completionTokens,
    };

    this.entries.push(fullEntry);
  }

  /**
   * Gets all recorded entries.
   */
  getEntries(): readonly TokenUsageEntry[] {
    return [...this.entries];
  }

  /**
   * Calculates statistics for a specific model.
   */
  getStatsForModel(modelId: string): TokenUsageStats | null {
    const modelEntries = this.entries.filter((e) => e.modelId === modelId);

    if (modelEntries.length === 0) {
      return null;
    }

    const totalPromptTokens = modelEntries.reduce((sum, e) => sum + e.promptTokens, 0);
    const totalCompletionTokens = modelEntries.reduce((sum, e) => sum + e.completionTokens, 0);
    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const maxTokensInCall = Math.max(...modelEntries.map((e) => e.totalTokens));

    const timestamps = modelEntries
      .map((e) => e.timestamp)
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      modelId,
      callCount: modelEntries.length,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      averageTokensPerCall: totalTokens / modelEntries.length,
      maxTokensInCall,
      firstCallTimestamp: timestamps[0],
      lastCallTimestamp: timestamps[timestamps.length - 1],
    };
  }

  /**
   * Gets overall statistics across all models.
   */
  getOverallStats(): OverallUsageStats {
    const modelIds = new Set(this.entries.map((e) => e.modelId));
    const byModel = new Map<string, TokenUsageStats>();

    for (const modelId of modelIds) {
      const stats = this.getStatsForModel(modelId);
      if (stats) {
        byModel.set(modelId, stats);
      }
    }

    const totalCalls = this.entries.length;
    const totalTokens = this.entries.reduce((sum, e) => sum + e.totalTokens, 0);

    return {
      byModel,
      totalCalls,
      totalTokens,
      trackingStartedAt: this.trackingStartedAt,
    };
  }

  /**
   * Clears all recorded entries and resets tracking start time.
   */
  clear(): void {
    this.entries = [];
    this.trackingStartedAt = new Date();
  }

  /**
   * Gets entries within a specific time range.
   */
  getEntriesInRange(startDate: Date, endDate: Date): TokenUsageEntry[] {
    return this.entries.filter((e) => e.timestamp >= startDate && e.timestamp <= endDate);
  }

  /**
   * Gets the most recent N entries.
   */
  getRecentEntries(count: number): TokenUsageEntry[] {
    return this.entries.slice(-count);
  }
}
