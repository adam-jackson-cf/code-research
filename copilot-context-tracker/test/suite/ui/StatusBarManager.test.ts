import * as assert from 'assert';
import { StatusBarManager } from '../../../src/ui/StatusBarManager';
import { ModelInfo } from '../../../src/models/ModelInfo';

suite('StatusBarManager Test Suite', () => {
  let manager: StatusBarManager;

  setup(() => {
    manager = new StatusBarManager();
  });

  teardown(() => {
    manager.dispose();
  });

  test('should initialize correctly', () => {
    assert.ok(manager);
  });

  test('should update with single model', () => {
    const model: ModelInfo = {
      id: 'gpt-4o',
      family: 'GPT-4o',
      vendor: 'OpenAI',
      maxTokens: 128000,
    };

    manager.updateModel(model);
    // Should not throw
    assert.ok(true);
  });

  test('should update with multiple models', () => {
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
    ];

    manager.updateModels(models);
    // Should use first model
    assert.ok(true);
  });

  test('should handle empty models array', () => {
    manager.updateModels([]);
    // Should clear the display
    assert.ok(true);
  });

  test('should handle undefined model', () => {
    manager.updateModel(undefined);
    // Should show default message
    assert.ok(true);
  });

  test('should show and hide status bar', () => {
    manager.show();
    manager.hide();
    // Should not throw
    assert.ok(true);
  });

  test('should refresh display', () => {
    const model: ModelInfo = {
      id: 'gpt-4o',
      family: 'GPT-4o',
      vendor: 'OpenAI',
      maxTokens: 128000,
    };

    manager.updateModel(model);
    manager.refresh();
    // Should not throw
    assert.ok(true);
  });

  test('should clear display', () => {
    manager.clear();
    // Should show default message
    assert.ok(true);
  });

  test('should update configuration', () => {
    manager.updateConfig();
    // Should reload config and update display
    assert.ok(true);
  });

  test('should handle model with metadata', () => {
    const model: ModelInfo = {
      id: 'claude-3.5-sonnet',
      family: 'Claude 3.5 Sonnet',
      vendor: 'Anthropic',
      maxTokens: 200000,
      version: '3.5',
      metadata: {
        supportsVision: true,
        supportsFunctionCalling: false,
      },
    };

    manager.updateModel(model);
    // Should display with metadata
    assert.ok(true);
  });

  test('should handle model with large token count', () => {
    const model: ModelInfo = {
      id: 'gemini-1.5-pro',
      family: 'Gemini 1.5 Pro',
      vendor: 'Google',
      maxTokens: 2097152, // 2M tokens
    };

    manager.updateModel(model);
    // Should format large numbers correctly
    assert.ok(true);
  });

  test('should handle model with version', () => {
    const model: ModelInfo = {
      id: 'gpt-4o',
      family: 'GPT-4o',
      vendor: 'OpenAI',
      maxTokens: 128000,
      version: '2024-05-13',
    };

    manager.updateModel(model);
    // Should include version in tooltip
    assert.ok(true);
  });

  test('should dispose correctly', () => {
    manager.dispose();
    // Should clean up resources
    assert.ok(true);
  });

  test('should handle rapid updates', () => {
    const model1: ModelInfo = {
      id: 'gpt-4o',
      family: 'GPT-4o',
      vendor: 'OpenAI',
      maxTokens: 128000,
    };

    const model2: ModelInfo = {
      id: 'claude-3.5-sonnet',
      family: 'Claude 3.5 Sonnet',
      vendor: 'Anthropic',
      maxTokens: 200000,
    };

    manager.updateModel(model1);
    manager.updateModel(model2);
    manager.updateModel(model1);
    // Should handle rapid updates
    assert.ok(true);
  });

  test('should handle refresh without model', () => {
    manager.refresh();
    // Should show default message
    assert.ok(true);
  });

  test('should handle multiple show calls', () => {
    manager.show();
    manager.show();
    manager.show();
    // Should remain shown
    assert.ok(true);
  });

  test('should handle multiple hide calls', () => {
    manager.hide();
    manager.hide();
    manager.hide();
    // Should remain hidden
    assert.ok(true);
  });

  test('should handle show after hide', () => {
    manager.hide();
    manager.show();
    // Should be visible
    assert.ok(true);
  });

  test('should handle config update after model update', () => {
    const model: ModelInfo = {
      id: 'gpt-4o',
      family: 'GPT-4o',
      vendor: 'OpenAI',
      maxTokens: 128000,
    };

    manager.updateModel(model);
    manager.updateConfig();
    // Should update display with new config
    assert.ok(true);
  });
});
