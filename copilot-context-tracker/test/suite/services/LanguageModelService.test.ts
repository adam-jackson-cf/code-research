import * as assert from 'assert';
import * as vscode from 'vscode';
import { LanguageModelService } from '../../../src/services/LanguageModelService';
import { TokenTrackingService } from '../../../src/services/TokenTrackingService';

suite('LanguageModelService Test Suite', () => {
  let service: LanguageModelService;
  let trackingService: TokenTrackingService;

  setup(() => {
    trackingService = new TokenTrackingService();
    service = new LanguageModelService(trackingService);
  });

  test('should initialize correctly', () => {
    assert.ok(service);
  });

  test('estimateTokenCount should return reasonable estimate', () => {
    const text = 'Hello, world!'; // 13 characters
    const estimate = service.estimateTokenCount(text);

    // ~4 characters per token, so 13/4 = 3.25, ceil = 4
    assert.strictEqual(estimate, 4);
  });

  test('estimateTokenCount should handle empty string', () => {
    const estimate = service.estimateTokenCount('');
    assert.strictEqual(estimate, 0);
  });

  test('estimateTokenCount should handle long text', () => {
    const longText = 'a'.repeat(1000); // 1000 characters
    const estimate = service.estimateTokenCount(longText);

    // 1000/4 = 250
    assert.strictEqual(estimate, 250);
  });

  test('isAvailable should return false when API not available', async () => {
    const originalLm = vscode.lm;
    try {
      (vscode as any).lm = undefined;

      const available = await service.isAvailable();
      assert.strictEqual(available, false);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('isAvailable should return false when selectChatModels not available', async () => {
    const originalLm = vscode.lm;
    try {
      (vscode as any).lm = {};

      const available = await service.isAvailable();
      assert.strictEqual(available, false);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('isAvailable should return false when no models available', async () => {
    const originalLm = vscode.lm;
    try {
      (vscode as any).lm = {
        selectChatModels: async () => [],
      };

      const available = await service.isAvailable();
      assert.strictEqual(available, false);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('isAvailable should return true when models available', async () => {
    const originalLm = vscode.lm;
    try {
      (vscode as any).lm = {
        selectChatModels: async () => [
          {
            id: 'gpt-4o',
            family: 'GPT-4o',
          },
        ],
      };

      const available = await service.isAvailable();
      assert.strictEqual(available, true);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('sendRequest should throw error when no models available', async () => {
    const originalLm = vscode.lm;
    try {
      (vscode as any).lm = {
        selectChatModels: async () => [],
      };

      const message = vscode.LanguageModelChatMessage.User('Hello');

      await assert.rejects(async () => {
        await service.sendRequest(undefined, [message]);
      });
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('sendRequest should send message and track tokens', async () => {
    const originalLm = vscode.lm;
    try {
      const mockResponse = 'This is a test response from the model';

      (vscode as any).lm = {
        selectChatModels: async () => [
          {
            id: 'gpt-4o',
            family: 'GPT-4o',
            sendRequest: async () => ({
              text: (async function* () {
                yield mockResponse;
              })(),
            }),
          },
        ],
      };

      const message = vscode.LanguageModelChatMessage.User('Hello');
      const result = await service.sendRequest(undefined, [message], {}, 'Test context');

      assert.strictEqual(result.text, mockResponse);
      assert.ok(result.promptTokens > 0);
      assert.ok(result.completionTokens > 0);
      assert.strictEqual(result.totalTokens, result.promptTokens + result.completionTokens);

      // Verify tracking
      const stats = trackingService.getOverallStats();
      assert.strictEqual(stats.totalCalls, 1);
      assert.strictEqual(stats.totalTokens, result.totalTokens);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('sendRequest should handle streaming response', async () => {
    const originalLm = vscode.lm;
    try {
      const chunks = ['Hello', ' ', 'World', '!'];

      (vscode as any).lm = {
        selectChatModels: async () => [
          {
            id: 'gpt-4o',
            family: 'GPT-4o',
            sendRequest: async () => ({
              text: (async function* () {
                for (const chunk of chunks) {
                  yield chunk;
                }
              })(),
            }),
          },
        ],
      };

      const message = vscode.LanguageModelChatMessage.User('Hello');
      const result = await service.sendRequest(undefined, [message]);

      assert.strictEqual(result.text, 'Hello World!');
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('sendRequest should use specified model ID', async () => {
    const originalLm = vscode.lm;
    try {
      let requestedModelId: string | undefined;

      (vscode as any).lm = {
        selectChatModels: async (selector: any) => {
          requestedModelId = selector.id;
          return [
            {
              id: 'claude-3.5-sonnet',
              family: 'Claude 3.5 Sonnet',
              sendRequest: async () => ({
                text: (async function* () {
                  yield 'response';
                })(),
              }),
            },
          ];
        },
      };

      const message = vscode.LanguageModelChatMessage.User('Hello');
      await service.sendRequest('claude-3.5-sonnet', [message]);

      assert.strictEqual(requestedModelId, 'claude-3.5-sonnet');
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('sendPrompt should send simple prompt and return text', async () => {
    const originalLm = vscode.lm;
    try {
      const mockResponse = 'Response to prompt';

      (vscode as any).lm = {
        selectChatModels: async () => [
          {
            id: 'gpt-4o',
            family: 'GPT-4o',
            sendRequest: async () => ({
              text: (async function* () {
                yield mockResponse;
              })(),
            }),
          },
        ],
      };

      const result = await service.sendPrompt('Test prompt', undefined, 'Test context');

      assert.strictEqual(result, mockResponse);

      // Verify tracking
      const stats = trackingService.getOverallStats();
      assert.strictEqual(stats.totalCalls, 1);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('sendPrompt should use specified model', async () => {
    const originalLm = vscode.lm;
    try {
      let usedModelId: string | undefined;

      (vscode as any).lm = {
        selectChatModels: async (selector: any) => {
          usedModelId = selector.id;
          return [
            {
              id: 'claude-3.5-sonnet',
              family: 'Claude 3.5 Sonnet',
              sendRequest: async () => ({
                text: (async function* () {
                  yield 'response';
                })(),
              }),
            },
          ];
        },
      };

      await service.sendPrompt('Test', 'claude-3.5-sonnet');

      assert.strictEqual(usedModelId, 'claude-3.5-sonnet');
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('sendRequest should record usage with context', async () => {
    const originalLm = vscode.lm;
    try {
      (vscode as any).lm = {
        selectChatModels: async () => [
          {
            id: 'gpt-4o',
            family: 'GPT-4o',
            sendRequest: async () => ({
              text: (async function* () {
                yield 'response';
              })(),
            }),
          },
        ],
      };

      const message = vscode.LanguageModelChatMessage.User('Hello');
      await service.sendRequest(undefined, [message], {}, 'My custom context');

      const entries = trackingService.getEntries();
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].context, 'My custom context');
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('sendRequest should handle multiple messages', async () => {
    const originalLm = vscode.lm;
    try {
      (vscode as any).lm = {
        selectChatModels: async () => [
          {
            id: 'gpt-4o',
            family: 'GPT-4o',
            sendRequest: async () => ({
              text: (async function* () {
                yield 'response';
              })(),
            }),
          },
        ],
      };

      const messages = [
        vscode.LanguageModelChatMessage.User('First message'),
        vscode.LanguageModelChatMessage.Assistant('First response'),
        vscode.LanguageModelChatMessage.User('Second message'),
      ];

      const result = await service.sendRequest(undefined, messages);

      assert.ok(result.promptTokens > 0);
      assert.strictEqual(result.text, 'response');
    } finally {
      (vscode as any).lm = originalLm;
    }
  });

  test('isAvailable should handle errors gracefully', async () => {
    const originalLm = vscode.lm;
    try {
      (vscode as any).lm = {
        selectChatModels: async () => {
          throw new Error('Test error');
        },
      };

      const available = await service.isAvailable();
      assert.strictEqual(available, false);
    } finally {
      (vscode as any).lm = originalLm;
    }
  });
});
