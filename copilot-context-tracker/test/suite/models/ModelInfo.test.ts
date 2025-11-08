import * as assert from 'assert';
import { parseModelId, KNOWN_MODELS } from '../../../src/models/ModelInfo';

suite('ModelInfo Test Suite', () => {
  test('parseModelId - GPT-4o', () => {
    const result = parseModelId('gpt-4o');
    assert.strictEqual(result.vendor, 'OpenAI');
    assert.strictEqual(result.family, 'GPT-4o');
    assert.strictEqual(result.maxTokens, 128000);
  });

  test('parseModelId - Claude 3.5 Sonnet', () => {
    const result = parseModelId('claude-3.5-sonnet');
    assert.strictEqual(result.vendor, 'Anthropic');
    assert.strictEqual(result.family, 'Claude 3.5 Sonnet');
    assert.strictEqual(result.maxTokens, 200000);
  });

  test('parseModelId - Gemini 1.5 Pro', () => {
    const result = parseModelId('gemini-1.5-pro');
    assert.strictEqual(result.vendor, 'Google');
    assert.strictEqual(result.family, 'Gemini 1.5 Pro');
    assert.strictEqual(result.maxTokens, 2097152);
  });

  test('parseModelId - Unknown model', () => {
    const result = parseModelId('unknown-model-xyz');
    assert.strictEqual(result.vendor, 'Unknown');
    assert.strictEqual(result.family, 'unknown-model-xyz');
    assert.strictEqual(result.maxTokens, 0);
  });

  test('KNOWN_MODELS contains expected models', () => {
    assert.ok('gpt-4o' in KNOWN_MODELS);
    assert.ok('claude-3.5-sonnet' in KNOWN_MODELS);
    assert.ok('gemini-1.5-pro' in KNOWN_MODELS);
    assert.ok('o1-preview' in KNOWN_MODELS);
  });

  test('parseModelId handles case insensitivity', () => {
    const result1 = parseModelId('GPT-4O');
    const result2 = parseModelId('gpt-4o');
    assert.strictEqual(result1.vendor, result2.vendor);
    assert.strictEqual(result1.maxTokens, result2.maxTokens);
  });

  // Enhanced tests
  test('parseModelId - GPT-4o Mini', () => {
    const result = parseModelId('gpt-4o-mini');
    assert.strictEqual(result.vendor, 'OpenAI');
    assert.strictEqual(result.family, 'GPT-4o Mini');
    assert.strictEqual(result.maxTokens, 128000);
  });

  test('parseModelId - GPT-4 Turbo', () => {
    const result = parseModelId('gpt-4-turbo');
    assert.strictEqual(result.vendor, 'OpenAI');
    assert.strictEqual(result.family, 'GPT-4 Turbo');
    assert.strictEqual(result.maxTokens, 128000);
  });

  test('parseModelId - Claude 3 Opus', () => {
    const result = parseModelId('claude-3-opus');
    assert.strictEqual(result.vendor, 'Anthropic');
    assert.strictEqual(result.family, 'Claude 3 Opus');
    assert.strictEqual(result.maxTokens, 200000);
  });

  test('parseModelId - Claude 3 Haiku', () => {
    const result = parseModelId('claude-3-haiku');
    assert.strictEqual(result.vendor, 'Anthropic');
    assert.strictEqual(result.family, 'Claude 3 Haiku');
    assert.strictEqual(result.maxTokens, 200000);
  });

  test('parseModelId - o1 Preview', () => {
    const result = parseModelId('o1-preview');
    assert.strictEqual(result.vendor, 'OpenAI');
    assert.strictEqual(result.family, 'o1 Preview');
    assert.strictEqual(result.maxTokens, 128000);
  });

  test('parseModelId - o1 Mini', () => {
    const result = parseModelId('o1-mini');
    assert.strictEqual(result.vendor, 'OpenAI');
    assert.strictEqual(result.family, 'o1 Mini');
    assert.strictEqual(result.maxTokens, 128000);
  });

  test('parseModelId - Gemini 1.5 Flash', () => {
    const result = parseModelId('gemini-1.5-flash');
    assert.strictEqual(result.vendor, 'Google');
    assert.strictEqual(result.family, 'Gemini 1.5 Flash');
    assert.strictEqual(result.maxTokens, 1048576);
  });

  test('parseModelId - infers OpenAI vendor from gpt prefix', () => {
    const result = parseModelId('gpt-future-model');
    assert.strictEqual(result.vendor, 'OpenAI');
    assert.strictEqual(result.family, 'gpt-future-model');
    assert.strictEqual(result.maxTokens, 8192);
  });

  test('parseModelId - infers Anthropic vendor from claude prefix', () => {
    const result = parseModelId('claude-future-model');
    assert.strictEqual(result.vendor, 'Anthropic');
    assert.strictEqual(result.family, 'claude-future-model');
    assert.strictEqual(result.maxTokens, 200000);
  });

  test('parseModelId - infers Google vendor from gemini prefix', () => {
    const result = parseModelId('gemini-future-model');
    assert.strictEqual(result.vendor, 'Google');
    assert.strictEqual(result.family, 'gemini-future-model');
    assert.strictEqual(result.maxTokens, 32768);
  });

  test('parseModelId - infers OpenAI vendor from o1 prefix', () => {
    const result = parseModelId('o1-future-model');
    assert.strictEqual(result.vendor, 'OpenAI');
    assert.strictEqual(result.family, 'o1-future-model');
    assert.strictEqual(result.maxTokens, 128000);
  });

  test('KNOWN_MODELS has vision support metadata', () => {
    assert.strictEqual(KNOWN_MODELS['gpt-4o'].metadata?.supportsVision, true);
    assert.strictEqual(KNOWN_MODELS['claude-3.5-sonnet'].metadata?.supportsVision, true);
    assert.strictEqual(KNOWN_MODELS['gemini-1.5-pro'].metadata?.supportsVision, true);
  });

  test('KNOWN_MODELS has function calling metadata', () => {
    assert.strictEqual(KNOWN_MODELS['gpt-4o'].metadata?.supportsFunctionCalling, true);
    assert.strictEqual(KNOWN_MODELS['gpt-4o-mini'].metadata?.supportsFunctionCalling, true);
  });

  test('parseModelId - handles empty string', () => {
    const result = parseModelId('');
    assert.strictEqual(result.vendor, 'Unknown');
    assert.strictEqual(result.family, '');
    assert.strictEqual(result.maxTokens, 0);
  });

  test('parseModelId - handles model with partial match', () => {
    const result = parseModelId('my-gpt-4o-custom');
    assert.strictEqual(result.vendor, 'OpenAI');
    assert.strictEqual(result.family, 'GPT-4o');
  });

  test('KNOWN_MODELS contains all major models', () => {
    const expectedModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'claude-3.5-sonnet',
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku',
      'o1-preview',
      'o1-mini',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro',
    ];

    expectedModels.forEach((model) => {
      assert.ok(model in KNOWN_MODELS, `${model} should be in KNOWN_MODELS`);
    });
  });

  test('KNOWN_MODELS has correct token limits', () => {
    assert.strictEqual(KNOWN_MODELS['gpt-4o'].maxTokens, 128000);
    assert.strictEqual(KNOWN_MODELS['gpt-4'].maxTokens, 8192);
    assert.strictEqual(KNOWN_MODELS['claude-3.5-sonnet'].maxTokens, 200000);
    assert.strictEqual(KNOWN_MODELS['gemini-1.5-pro'].maxTokens, 2097152);
  });
});
