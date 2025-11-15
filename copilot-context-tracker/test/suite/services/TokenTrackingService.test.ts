import * as assert from 'assert';
import { TokenTrackingService } from '../../../src/services/TokenTrackingService';

suite('TokenTrackingService Test Suite', () => {
  test('recordUsage and getOverallStats', () => {
    const service = new TokenTrackingService();

    service.recordUsage('gpt-4o', 100, 50, 'Test context');

    const stats = service.getOverallStats();
    assert.strictEqual(stats.totalCalls, 1);
    assert.strictEqual(stats.totalTokens, 150);
  });

  test('getUsageSummary with no data', () => {
    const service = new TokenTrackingService();
    const summary = service.getUsageSummary();
    assert.strictEqual(summary, 'No API usage recorded yet');
  });

  test('getUsageSummary with data', () => {
    const service = new TokenTrackingService();
    service.recordUsage('gpt-4o', 100, 50);

    const summary = service.getUsageSummary();
    assert.ok(summary.includes('Total API Calls: 1'));
    assert.ok(summary.includes('Total Tokens Used: 150'));
  });

  test('clearStats', () => {
    const service = new TokenTrackingService();

    service.recordUsage('gpt-4o', 100, 50);
    service.clearStats();

    const stats = service.getOverallStats();
    assert.strictEqual(stats.totalCalls, 0);
    assert.strictEqual(stats.totalTokens, 0);
  });

  test('onUsageUpdate callback', (done) => {
    const service = new TokenTrackingService();

    service.onUsageUpdate((stats) => {
      assert.strictEqual(stats.totalCalls, 1);
      assert.strictEqual(stats.totalTokens, 150);
      done();
    });

    service.recordUsage('gpt-4o', 100, 50);
  });

  test('exportUsageData', () => {
    const service = new TokenTrackingService();
    service.recordUsage('gpt-4o', 100, 50);

    const exported = service.exportUsageData();
    const data = JSON.parse(exported);

    assert.ok(data.summary);
    assert.strictEqual(data.summary.totalCalls, 1);
    assert.strictEqual(data.summary.totalTokens, 150);
    assert.ok(Array.isArray(data.byModel));
    assert.ok(Array.isArray(data.entries));
  });

  test('getStatsForModel', () => {
    const service = new TokenTrackingService();

    service.recordUsage('gpt-4o', 100, 50);
    service.recordUsage('gpt-4o', 200, 100);

    const stats = service.getStatsForModel('gpt-4o');
    assert.ok(stats);
    assert.strictEqual(stats.callCount, 2);
    assert.strictEqual(stats.totalTokens, 450);
  });

  test('getRecentEntries', () => {
    const service = new TokenTrackingService();

    for (let i = 0; i < 10; i++) {
      service.recordUsage('gpt-4o', 100, 50);
    }

    const recent = service.getRecentEntries(5);
    assert.strictEqual(recent.length, 5);
  });
});
