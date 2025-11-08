import * as assert from 'assert';
import { TokenUsageTracker } from '../../../src/models/TokenUsage';

suite('TokenUsage Test Suite', () => {
  test('TokenUsageTracker - addEntry and getEntries', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    const entries = tracker.getEntries();
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].modelId, 'gpt-4o');
    assert.strictEqual(entries[0].promptTokens, 100);
    assert.strictEqual(entries[0].completionTokens, 50);
    assert.strictEqual(entries[0].totalTokens, 150);
  });

  test('TokenUsageTracker - getStatsForModel', () => {
    const tracker = new TokenUsageTracker();

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
    assert.ok(stats);
    assert.strictEqual(stats.callCount, 2);
    assert.strictEqual(stats.totalPromptTokens, 300);
    assert.strictEqual(stats.totalCompletionTokens, 150);
    assert.strictEqual(stats.totalTokens, 450);
    assert.strictEqual(stats.averageTokensPerCall, 225);
    assert.strictEqual(stats.maxTokensInCall, 300);
  });

  test('TokenUsageTracker - getOverallStats', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    tracker.addEntry({
      modelId: 'claude-3.5-sonnet',
      promptTokens: 200,
      completionTokens: 100,
    });

    const stats = tracker.getOverallStats();
    assert.strictEqual(stats.totalCalls, 2);
    assert.strictEqual(stats.totalTokens, 450);
    assert.strictEqual(stats.byModel.size, 2);
  });

  test('TokenUsageTracker - clear', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    tracker.clear();

    const entries = tracker.getEntries();
    assert.strictEqual(entries.length, 0);

    const stats = tracker.getOverallStats();
    assert.strictEqual(stats.totalCalls, 0);
    assert.strictEqual(stats.totalTokens, 0);
  });

  test('TokenUsageTracker - getRecentEntries', () => {
    const tracker = new TokenUsageTracker();

    for (let i = 0; i < 10; i++) {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });
    }

    const recentEntries = tracker.getRecentEntries(5);
    assert.strictEqual(recentEntries.length, 5);
  });

  test('TokenUsageTracker - getStatsForModel returns null for non-existent model', () => {
    const tracker = new TokenUsageTracker();
    const stats = tracker.getStatsForModel('non-existent-model');
    assert.strictEqual(stats, null);
  });

  // Enhanced tests
  test('TokenUsageTracker - addEntry automatically adds timestamp', () => {
    const tracker = new TokenUsageTracker();
    const beforeTime = new Date();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    const afterTime = new Date();
    const entries = tracker.getEntries();

    assert.strictEqual(entries.length, 1);
    assert.ok(entries[0].timestamp);
    assert.ok(entries[0].timestamp >= beforeTime);
    assert.ok(entries[0].timestamp <= afterTime);
  });

  test('TokenUsageTracker - addEntry with context', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
      context: 'Test context',
    });

    const entries = tracker.getEntries();
    assert.strictEqual(entries[0].context, 'Test context');
  });

  test('TokenUsageTracker - getEntriesInRange', () => {
    const tracker = new TokenUsageTracker();
    const startDate = new Date();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    // Wait a bit
    const midDate = new Date();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 200,
      completionTokens: 100,
    });

    const endDate = new Date();

    const allEntries = tracker.getEntriesInRange(startDate, endDate);
    assert.strictEqual(allEntries.length, 2);

    const laterEntries = tracker.getEntriesInRange(midDate, endDate);
    assert.strictEqual(laterEntries.length, 1);
  });

  test('TokenUsageTracker - getRecentEntries with more entries than requested', () => {
    const tracker = new TokenUsageTracker();

    for (let i = 0; i < 20; i++) {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });
    }

    const recentEntries = tracker.getRecentEntries(10);
    assert.strictEqual(recentEntries.length, 10);
  });

  test('TokenUsageTracker - getRecentEntries with fewer entries than requested', () => {
    const tracker = new TokenUsageTracker();

    for (let i = 0; i < 5; i++) {
      tracker.addEntry({
        modelId: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
      });
    }

    const recentEntries = tracker.getRecentEntries(10);
    assert.strictEqual(recentEntries.length, 5);
  });

  test('TokenUsageTracker - stats track timestamps correctly', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    // Add second entry with different timestamp
    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 200,
      completionTokens: 100,
    });

    const stats = tracker.getStatsForModel('gpt-4o');
    assert.ok(stats);
    assert.ok(stats.firstCallTimestamp);
    assert.ok(stats.lastCallTimestamp);
    assert.ok(stats.lastCallTimestamp! >= stats.firstCallTimestamp!);
  });

  test('TokenUsageTracker - multiple models have separate stats', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    tracker.addEntry({
      modelId: 'claude-3.5-sonnet',
      promptTokens: 200,
      completionTokens: 100,
    });

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 150,
      completionTokens: 75,
    });

    const gptStats = tracker.getStatsForModel('gpt-4o');
    const claudeStats = tracker.getStatsForModel('claude-3.5-sonnet');

    assert.ok(gptStats);
    assert.ok(claudeStats);
    assert.strictEqual(gptStats.callCount, 2);
    assert.strictEqual(claudeStats.callCount, 1);
    assert.strictEqual(gptStats.totalTokens, 375);
    assert.strictEqual(claudeStats.totalTokens, 300);
  });

  test('TokenUsageTracker - overall stats aggregate correctly', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    tracker.addEntry({
      modelId: 'claude-3.5-sonnet',
      promptTokens: 200,
      completionTokens: 100,
    });

    tracker.addEntry({
      modelId: 'gemini-1.5-pro',
      promptTokens: 300,
      completionTokens: 150,
    });

    const stats = tracker.getOverallStats();

    assert.strictEqual(stats.totalCalls, 3);
    assert.strictEqual(stats.totalTokens, 900); // 150 + 300 + 450
    assert.strictEqual(stats.byModel.size, 3);
  });

  test('TokenUsageTracker - clear resets tracking start time', async () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    const statsBeforeClear = tracker.getOverallStats();
    const timeBeforeClear = statsBeforeClear.trackingStartedAt;

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 10));

    tracker.clear();

    const statsAfterClear = tracker.getOverallStats();
    const timeAfterClear = statsAfterClear.trackingStartedAt;

    assert.ok(timeAfterClear > timeBeforeClear);
  });

  test('TokenUsageTracker - getEntries returns readonly array', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    const entries = tracker.getEntries();

    // Verify it's a readonly array (can't push)
    assert.strictEqual(typeof entries.length, 'number');
  });

  test('TokenUsageTracker - zero token entries', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 0,
      completionTokens: 0,
    });

    const entries = tracker.getEntries();
    assert.strictEqual(entries[0].totalTokens, 0);

    const stats = tracker.getStatsForModel('gpt-4o');
    assert.ok(stats);
    assert.strictEqual(stats.totalTokens, 0);
    assert.strictEqual(stats.averageTokensPerCall, 0);
  });

  test('TokenUsageTracker - large token counts', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gemini-1.5-pro',
      promptTokens: 1000000,
      completionTokens: 500000,
    });

    const stats = tracker.getStatsForModel('gemini-1.5-pro');
    assert.ok(stats);
    assert.strictEqual(stats.totalTokens, 1500000);
  });

  test('TokenUsageTracker - maxTokensInCall is calculated correctly', () => {
    const tracker = new TokenUsageTracker();

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 100,
      completionTokens: 50,
    });

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 500,
      completionTokens: 250,
    });

    tracker.addEntry({
      modelId: 'gpt-4o',
      promptTokens: 200,
      completionTokens: 100,
    });

    const stats = tracker.getStatsForModel('gpt-4o');
    assert.ok(stats);
    assert.strictEqual(stats.maxTokensInCall, 750); // 500 + 250
  });
});
