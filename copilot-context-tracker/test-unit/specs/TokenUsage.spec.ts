import { TokenUsageTracker } from '../../src/models/TokenUsage';

describe('TokenUsageTracker', () => {
  let tracker: TokenUsageTracker;

  beforeEach(() => {
    tracker = new TokenUsageTracker();
  });

  describe('addEntry', () => {
    it('should add a new usage entry', () => {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });

      const stats = tracker.getStatsForModel('gpt-4o');
      expect(stats).toBeDefined();
      expect(stats!.totalTokens).toBe(150);
      expect(stats!.totalPromptTokens).toBe(100);
      expect(stats!.totalCompletionTokens).toBe(50);
    });

    it('should aggregate multiple entries for same model', () => {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });

      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 200,
        completionTokens: 100,
      });

      const stats = tracker.getStatsForModel('gpt-4o');
      expect(stats!.totalTokens).toBe(450);
      expect(stats!.totalPromptTokens).toBe(300);
      expect(stats!.totalCompletionTokens).toBe(150);
      expect(stats!.callCount).toBe(2);
    });

    it('should track different models separately', () => {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });

      tracker.addEntry({
        modelId: 'claude-sonnet',
        promptTokens: 200,
        completionTokens: 100,
      });

      const gptStats = tracker.getStatsForModel('gpt-4o');
      const claudeStats = tracker.getStatsForModel('claude-sonnet');

      expect(gptStats!.totalTokens).toBe(150);
      expect(claudeStats!.totalTokens).toBe(300);
    });

    it('should automatically set timestamp', () => {
      const beforeTime = new Date();

      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });

      const afterTime = new Date();
      const entries = tracker.getEntries();

      expect(entries.length).toBe(1);
      expect(entries[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(entries[0].timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle zero token usage', () => {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 0,
        completionTokens: 0,
      });

      const stats = tracker.getStatsForModel('gpt-4o');
      expect(stats!.totalTokens).toBe(0);
      expect(stats!.callCount).toBe(1);
    });

    it('should handle large token counts', () => {
      tracker.addEntry({
        modelId: 'gemini',
        promptTokens: 500000,
        completionTokens: 500000,
      });

      const stats = tracker.getStatsForModel('gemini');
      expect(stats!.totalTokens).toBe(1000000);
    });
  });

  describe('getStatsForModel', () => {
    it('should return null or undefined for unknown model', () => {
      const stats = tracker.getStatsForModel('unknown-model');
      expect(stats).toBeFalsy(); // Either null or undefined
    });

    it('should calculate average tokens per call', () => {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });

      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 200,
        completionTokens: 100,
      });

      const stats = tracker.getStatsForModel('gpt-4o');
      expect(stats!.averageTokensPerCall).toBe(225); // (150 + 300) / 2
    });

    it('should track max tokens in a single call', () => {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });

      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 200,
        completionTokens: 100,
      });

      const stats = tracker.getStatsForModel('gpt-4o');
      expect(stats!.maxTokensInCall).toBe(300); // Max of 150 and 300
    });
  });

  describe('getOverallStats', () => {
    it('should return zero stats for empty tracker', () => {
      const stats = tracker.getOverallStats();

      expect(stats.totalTokens).toBe(0);
      expect(stats.totalCalls).toBe(0);
      expect(stats.byModel.size).toBe(0);
    });

    it('should aggregate stats across all models', () => {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });

      tracker.addEntry({
        modelId: 'claude',
        promptTokens: 200,
        completionTokens: 100,
      });

      const stats = tracker.getOverallStats();

      expect(stats.totalTokens).toBe(450);
      expect(stats.totalCalls).toBe(2);
      expect(stats.byModel.size).toBe(2);
    });
  });

  describe('getEntries', () => {
    it('should return empty array for new tracker', () => {
      const entries = tracker.getEntries();
      expect(entries).toEqual([]);
    });

    it('should return all entries in order', () => {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });

      tracker.addEntry({
        modelId: 'claude',
        promptTokens: 200,
        completionTokens: 100,
      });

      const entries = tracker.getEntries();
      expect(entries.length).toBe(2);
      expect(entries[0].modelId).toBe('gpt-4o');
      expect(entries[1].modelId).toBe('claude');
    });
  });

  describe('clear', () => {
    it('should remove all entries and stats', () => {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });

      tracker.addEntry({
        modelId: 'claude',
        promptTokens: 200,
        completionTokens: 100,
      });

      tracker.clear();

      expect(tracker.getEntries()).toEqual([]);
      expect(tracker.getStatsForModel('gpt-4o')).toBeFalsy(); // null or undefined
      expect(tracker.getOverallStats().totalTokens).toBe(0);
    });

    it('should allow adding entries after clear', () => {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });

      tracker.clear();

      tracker.addEntry({
        modelId: 'claude',
        promptTokens: 200,
        completionTokens: 100,
      });

      expect(tracker.getEntries().length).toBe(1);
      expect(tracker.getStatsForModel('claude')!.totalTokens).toBe(300);
    });
  });
});
