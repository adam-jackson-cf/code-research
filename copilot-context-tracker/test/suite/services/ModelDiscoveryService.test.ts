import * as assert from 'assert';
import * as vscode from 'vscode';
import { ModelDiscoveryService } from '../../../src/services/ModelDiscoveryService';

suite('ModelDiscoveryService Test Suite', () => {
  let service: ModelDiscoveryService;

  setup(() => {
    service = new ModelDiscoveryService();
  });

  test('should initialize with empty models', () => {
    assert.strictEqual(service.hasModels(), false);
    assert.strictEqual(service.getAllModels().length, 0);
  });

  test('should return undefined for non-existent model', () => {
    const model = service.getModel('non-existent');
    assert.strictEqual(model, undefined);
  });

  test('should return null for last discovery time initially', () => {
    const lastTime = service.getLastDiscoveryTime();
    assert.strictEqual(lastTime, null);
  });

  test('should return undefined for primary model when no models', () => {
    const primaryModel = service.getPrimaryModel();
    assert.strictEqual(primaryModel, undefined);
  });

  test('should return empty array for vendor filter when no models', () => {
    const models = service.getModelsByVendor('OpenAI');
    assert.strictEqual(models.length, 0);
  });

  test('should return correct summary when no models', () => {
    const summary = service.getSummary();
    assert.strictEqual(summary, 'No models discovered');
  });

  test('should handle discovery in progress correctly', async () => {
    // Mock the VS Code lm API
    const originalLm = vscode.lm;
    try {
      // Create a mock that will delay
      (vscode as any).lm = {
        selectChatModels: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return [];
        },
      };

      // Start discovery (don't await)
      const promise1 = service.discoverModels();

      // Try to start another discovery immediately
      const promise2 = service.discoverModels();

      // Both should complete
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should return the same result
      assert.strictEqual(result1.length, result2.length);
    } finally {
      // Restore original
      (vscode as any).lm = originalLm;
    }
  });

  test('should handle missing Language Model API', async () => {
    // Mock missing API
    const originalLm = vscode.lm;
    try {
      (vscode as any).lm = undefined;

      const models = await service.discoverModels();

      // Should return empty array and not throw
      assert.strictEqual(models.length, 0);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('should create model info from LanguageModelChat', async () => {
    const originalLm = vscode.lm;
    try {
      const mockModel = {
        id: 'gpt-4o',
        family: 'GPT-4o',
        vendor: 'OpenAI',
        maxInputTokens: 128000,
        version: '1.0',
        name: 'GPT-4o',
      };

      (vscode as any).lm = {
        selectChatModels: async () => [mockModel],
      };

      const models = await service.discoverModels();

      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].id, 'gpt-4o');
      assert.strictEqual(models[0].family, 'GPT-4o');
      assert.strictEqual(models[0].vendor, 'OpenAI');
      assert.strictEqual(models[0].maxTokens, 128000);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('should get model by ID after discovery', async () => {
    const originalLm = vscode.lm;
    try {
      const mockModel = {
        id: 'gpt-4o',
        family: 'GPT-4o',
        vendor: 'OpenAI',
        maxInputTokens: 128000,
      };

      (vscode as any).lm = {
        selectChatModels: async () => [mockModel],
      };

      await service.discoverModels();
      const model = service.getModel('gpt-4o');

      assert.ok(model);
      assert.strictEqual(model.id, 'gpt-4o');
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('should get primary model after discovery', async () => {
    const originalLm = vscode.lm;
    try {
      const mockModels = [
        {
          id: 'gpt-4o',
          family: 'GPT-4o',
          vendor: 'OpenAI',
          maxInputTokens: 128000,
        },
        {
          id: 'claude-3.5-sonnet',
          family: 'Claude 3.5 Sonnet',
          vendor: 'Anthropic',
          maxInputTokens: 200000,
        },
      ];

      (vscode as any).lm = {
        selectChatModels: async () => mockModels,
      };

      await service.discoverModels();
      const primaryModel = service.getPrimaryModel();

      assert.ok(primaryModel);
      assert.strictEqual(primaryModel.id, 'gpt-4o');
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('should filter models by vendor', async () => {
    const originalLm = vscode.lm;
    try {
      const mockModels = [
        {
          id: 'gpt-4o',
          family: 'GPT-4o',
          vendor: 'OpenAI',
          maxInputTokens: 128000,
        },
        {
          id: 'claude-3.5-sonnet',
          family: 'Claude 3.5 Sonnet',
          vendor: 'Anthropic',
          maxInputTokens: 200000,
        },
      ];

      (vscode as any).lm = {
        selectChatModels: async () => mockModels,
      };

      await service.discoverModels();
      const openAIModels = service.getModelsByVendor('OpenAI');
      const anthropicModels = service.getModelsByVendor('Anthropic');

      assert.strictEqual(openAIModels.length, 1);
      assert.strictEqual(openAIModels[0].id, 'gpt-4o');
      assert.strictEqual(anthropicModels.length, 1);
      assert.strictEqual(anthropicModels[0].id, 'claude-3.5-sonnet');
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('should update last discovery time', async () => {
    const originalLm = vscode.lm;
    try {
      (vscode as any).lm = {
        selectChatModels: async () => [],
      };

      const beforeTime = new Date();
      await service.discoverModels();
      const afterTime = new Date();
      const lastTime = service.getLastDiscoveryTime();

      assert.ok(lastTime);
      assert.ok(lastTime >= beforeTime);
      assert.ok(lastTime <= afterTime);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('should generate correct summary with models', async () => {
    const originalLm = vscode.lm;
    try {
      const mockModels = [
        {
          id: 'gpt-4o',
          family: 'GPT-4o',
          vendor: 'OpenAI',
          maxInputTokens: 128000,
        },
        {
          id: 'claude-3.5-sonnet',
          family: 'Claude 3.5 Sonnet',
          vendor: 'Anthropic',
          maxInputTokens: 200000,
        },
      ];

      (vscode as any).lm = {
        selectChatModels: async () => mockModels,
      };

      await service.discoverModels();
      const summary = service.getSummary();

      assert.ok(summary.includes('2 model(s)'));
      assert.ok(summary.includes('2 vendor(s)'));
      assert.ok(summary.includes('OpenAI') || summary.includes('Anthropic'));
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('should handle models without maxInputTokens', async () => {
    const originalLm = vscode.lm;
    try {
      const mockModel = {
        id: 'unknown-model',
        family: 'Unknown',
        vendor: 'Unknown',
        // No maxInputTokens
      };

      (vscode as any).lm = {
        selectChatModels: async () => [mockModel],
      };

      const models = await service.discoverModels();

      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].id, 'unknown-model');
      // Should have a default maxTokens value
      assert.strictEqual(typeof models[0].maxTokens, 'number');
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('should clear models on new discovery', async () => {
    const originalLm = vscode.lm;
    try {
      // First discovery with one model
      (vscode as any).lm = {
        selectChatModels: async () => [
          {
            id: 'gpt-4o',
            family: 'GPT-4o',
            vendor: 'OpenAI',
            maxInputTokens: 128000,
          },
        ],
      };

      await service.discoverModels();
      assert.strictEqual(service.getAllModels().length, 1);

      // Second discovery with different models
      (vscode as any).lm = {
        selectChatModels: async () => [
          {
            id: 'claude-3.5-sonnet',
            family: 'Claude 3.5 Sonnet',
            vendor: 'Anthropic',
            maxInputTokens: 200000,
          },
        ],
      };

      await service.discoverModels();
      const models = service.getAllModels();

      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].id, 'claude-3.5-sonnet');
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('should handle vendor filter case insensitively', async () => {
    const originalLm = vscode.lm;
    try {
      const mockModel = {
        id: 'gpt-4o',
        family: 'GPT-4o',
        vendor: 'OpenAI',
        maxInputTokens: 128000,
      };

      (vscode as any).lm = {
        selectChatModels: async () => [mockModel],
      };

      await service.discoverModels();

      const modelsLower = service.getModelsByVendor('openai');
      const modelsUpper = service.getModelsByVendor('OPENAI');
      const modelsMixed = service.getModelsByVendor('OpEnAi');

      assert.strictEqual(modelsLower.length, 1);
      assert.strictEqual(modelsUpper.length, 1);
      assert.strictEqual(modelsMixed.length, 1);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });
});
