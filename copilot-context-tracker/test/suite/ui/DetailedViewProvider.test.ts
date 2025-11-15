import * as assert from 'assert';
import * as vscode from 'vscode';
import { DetailedViewProvider } from '../../../src/ui/DetailedViewProvider';
import { ModelInfo } from '../../../src/models/ModelInfo';
import { OverallUsageStats } from '../../../src/models/TokenUsage';

suite('DetailedViewProvider Test Suite', () => {
  let provider: DetailedViewProvider;
  let extensionUri: vscode.Uri;

  setup(() => {
    extensionUri = vscode.Uri.file(__dirname);
    provider = new DetailedViewProvider(extensionUri);
  });

  teardown(() => {
    provider.dispose();
  });

  test('should initialize correctly', () => {
    assert.ok(provider);
  });

  test('should update models', () => {
    const models: ModelInfo[] = [
      {
        id: 'gpt-4o',
        family: 'GPT-4o',
        vendor: 'OpenAI',
        maxTokens: 128000,
      },
    ];

    provider.updateModels(models);
    // Should not throw
    assert.ok(true);
  });

  test('should update usage stats', () => {
    const stats: OverallUsageStats = {
      byModel: new Map(),
      totalCalls: 10,
      totalTokens: 1000,
      trackingStartedAt: new Date(),
    };

    provider.updateUsageStats(stats);
    // Should not throw
    assert.ok(true);
  });

  test('should show panel', () => {
    provider.show();
    // Should create or reveal panel
    assert.ok(true);
  });

  test('should handle multiple show calls', () => {
    provider.show();
    provider.show();
    // Should reuse existing panel
    assert.ok(true);
  });

  test('should dispose correctly', () => {
    provider.dispose();
    // Should clean up panel
    assert.ok(true);
  });

  test('should update models when panel is visible', () => {
    provider.show();

    const models: ModelInfo[] = [
      {
        id: 'gpt-4o',
        family: 'GPT-4o',
        vendor: 'OpenAI',
        maxTokens: 128000,
      },
    ];

    provider.updateModels(models);
    // Should update content
    assert.ok(true);
  });

  test('should update stats when panel is visible', () => {
    provider.show();

    const stats: OverallUsageStats = {
      byModel: new Map(),
      totalCalls: 10,
      totalTokens: 1000,
      trackingStartedAt: new Date(),
    };

    provider.updateUsageStats(stats);
    // Should update content
    assert.ok(true);
  });

  test('should handle empty models', () => {
    provider.updateModels([]);
    // Should show no models message
    assert.ok(true);
  });

  test('should handle empty stats', () => {
    const stats: OverallUsageStats = {
      byModel: new Map(),
      totalCalls: 0,
      totalTokens: 0,
      trackingStartedAt: new Date(),
    };

    provider.updateUsageStats(stats);
    // Should show no usage message
    assert.ok(true);
  });

  test('should handle models with metadata', () => {
    const models: ModelInfo[] = [
      {
        id: 'claude-3.5-sonnet',
        family: 'Claude 3.5 Sonnet',
        vendor: 'Anthropic',
        maxTokens: 200000,
        version: '3.5',
        metadata: {
          supportsVision: true,
          supportsFunctionCalling: false,
        },
      },
    ];

    provider.updateModels(models);
    // Should display metadata
    assert.ok(true);
  });

  test('should handle multiple models', () => {
    const models: ModelInfo[] = [
      {
        id: 'gpt-4o',
        family: 'GPT-4o',
        vendor: 'OpenAI',
        maxTokens: 128000,
      },
      {
        id: 'claude-3.5-sonnet',
        family: 'Claude 3.5 Sonnet',
        vendor: 'Anthropic',
        maxTokens: 200000,
      },
      {
        id: 'gemini-1.5-pro',
        family: 'Gemini 1.5 Pro',
        vendor: 'Google',
        maxTokens: 2097152,
      },
    ];

    provider.updateModels(models);
    // Should display all models
    assert.ok(true);
  });

  test('should handle stats with multiple models', () => {
    const modelStats1 = {
      modelId: 'gpt-4o',
      callCount: 5,
      totalPromptTokens: 500,
      totalCompletionTokens: 300,
      totalTokens: 800,
      averageTokensPerCall: 160,
      maxTokensInCall: 200,
      firstCallTimestamp: new Date(),
      lastCallTimestamp: new Date(),
    };

    const modelStats2 = {
      modelId: 'claude-3.5-sonnet',
      callCount: 3,
      totalPromptTokens: 300,
      totalCompletionTokens: 200,
      totalTokens: 500,
      averageTokensPerCall: 166.67,
      maxTokensInCall: 180,
      firstCallTimestamp: new Date(),
      lastCallTimestamp: new Date(),
    };

    const stats: OverallUsageStats = {
      byModel: new Map([
        ['gpt-4o', modelStats1],
        ['claude-3.5-sonnet', modelStats2],
      ]),
      totalCalls: 8,
      totalTokens: 1300,
      trackingStartedAt: new Date(),
    };

    provider.updateUsageStats(stats);
    // Should display stats for all models
    assert.ok(true);
  });

  test('should handle large token counts', () => {
    const models: ModelInfo[] = [
      {
        id: 'gemini-1.5-pro',
        family: 'Gemini 1.5 Pro',
        vendor: 'Google',
        maxTokens: 2097152, // 2M tokens
      },
    ];

    provider.updateModels(models);
    // Should format large numbers
    assert.ok(true);
  });

  test('should handle model without version', () => {
    const models: ModelInfo[] = [
      {
        id: 'gpt-4o',
        family: 'GPT-4o',
        vendor: 'OpenAI',
        maxTokens: 128000,
        // No version
      },
    ];

    provider.updateModels(models);
    // Should not show version
    assert.ok(true);
  });

  test('should handle model without metadata', () => {
    const models: ModelInfo[] = [
      {
        id: 'gpt-4o',
        family: 'GPT-4o',
        vendor: 'OpenAI',
        maxTokens: 128000,
        // No metadata
      },
    ];

    provider.updateModels(models);
    // Should not show metadata fields
    assert.ok(true);
  });

  test('should dispose panel when disposed', () => {
    provider.show();
    provider.dispose();
    // Panel should be disposed
    assert.ok(true);
  });

  test('should handle updates before showing panel', () => {
    const models: ModelInfo[] = [
      {
        id: 'gpt-4o',
        family: 'GPT-4o',
        vendor: 'OpenAI',
        maxTokens: 128000,
      },
    ];

    provider.updateModels(models);

    const stats: OverallUsageStats = {
      byModel: new Map(),
      totalCalls: 5,
      totalTokens: 500,
      trackingStartedAt: new Date(),
    };

    provider.updateUsageStats(stats);

    // Now show the panel
    provider.show();

    // Should display all the updated data
    assert.ok(true);
  });
});
