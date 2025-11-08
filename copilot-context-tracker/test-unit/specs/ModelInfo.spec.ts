import { ModelInfo, KNOWN_MODELS, parseModelId } from '../../src/models/ModelInfo';

describe('ModelInfo', () => {
  describe('KNOWN_MODELS', () => {
    it('should contain GPT-4o configuration', () => {
      expect(KNOWN_MODELS['gpt-4o']).toBeDefined();
      expect(KNOWN_MODELS['gpt-4o'].family).toBe('GPT-4o');
      expect(KNOWN_MODELS['gpt-4o'].maxTokens).toBe(128000);
    });

    it('should contain Claude models', () => {
      expect(KNOWN_MODELS['claude-3.5-sonnet']).toBeDefined();
      expect(KNOWN_MODELS['claude-3.5-sonnet'].family).toBe('Claude 3.5 Sonnet');
      expect(KNOWN_MODELS['claude-3.5-sonnet'].maxTokens).toBe(200000);
    });

    it('should contain Gemini models', () => {
      expect(KNOWN_MODELS['gemini-1.5-pro']).toBeDefined();
      expect(KNOWN_MODELS['gemini-1.5-pro'].maxTokens).toBeGreaterThan(0);
    });

    it('should have metadata for vision-capable models', () => {
      expect(KNOWN_MODELS['gpt-4o'].metadata?.supportsVision).toBe(true);
    });
  });

  describe('parseModelId', () => {
    it('should parse GPT-4o model ID', () => {
      const result = parseModelId('gpt-4o');

      expect(result.family).toBe('GPT-4o');
      expect(result.vendor).toBe('OpenAI');
      expect(result.maxTokens).toBe(128000);
    });

    it('should parse Claude model ID', () => {
      const result = parseModelId('claude-3.5-sonnet');

      // Should match the known model data
      expect(result.vendor).toBe('Anthropic');
      expect(result.maxTokens).toBe(200000);
      expect(result.family).toBeDefined();
    });

    it('should parse Gemini model ID', () => {
      const result = parseModelId('gemini-1.5-pro');

      expect(result.vendor).toBe('Google');
      expect(result.maxTokens).toBeGreaterThan(0);
    });

    it('should handle unknown model IDs', () => {
      const result = parseModelId('unknown-model-xyz');

      expect(result.vendor).toBeDefined();
      expect(result.family).toBeDefined();
    });

    it('should be case-insensitive', () => {
      const result1 = parseModelId('GPT-4O');
      const result2 = parseModelId('gpt-4o');

      expect(result1.family).toBe(result2.family);
    });
  });

  describe('ModelInfo type', () => {
    it('should allow creating a ModelInfo object', () => {
      const model: ModelInfo = {
        id: 'test-model',
        family: 'Test Family',
        vendor: 'Test Vendor',
        maxTokens: 8000,
        version: '1.0.0',
      };

      expect(model.id).toBe('test-model');
      expect(model.maxTokens).toBe(8000);
    });

    it('should allow optional metadata', () => {
      const model: ModelInfo = {
        id: 'test-model',
        family: 'Test Family',
        vendor: 'Test Vendor',
        maxTokens: 8000,
        metadata: {
          supportsVision: true,
          customField: 'custom value',
        },
      };

      expect(model.metadata?.supportsVision).toBe(true);
      expect(model.metadata?.customField).toBe('custom value');
    });
  });
});
