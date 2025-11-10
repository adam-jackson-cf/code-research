// @ts-nocheck
/**
 * Unit tests for index.ts (programmatic API)
 */

describe('Programmatic API', () => {
  describe('Module Exports', () => {
    it('should export ResearchOrchestrator', async () => {
      const { ResearchOrchestrator } = await import('../../src/index.js');
      expect(ResearchOrchestrator).toBeDefined();
      expect(typeof ResearchOrchestrator).toBe('function');
    });

    it('should export VoiceInterface', async () => {
      const { VoiceInterface } = await import('../../src/index.js');
      expect(VoiceInterface).toBeDefined();
      expect(typeof VoiceInterface).toBe('function');
    });

    it('should export OutputFormatter', async () => {
      const { OutputFormatter } = await import('../../src/index.js');
      expect(OutputFormatter).toBeDefined();
      expect(typeof OutputFormatter).toBe('function');
    });

    it('should export research function', async () => {
      const { research } = await import('../../src/index.js');
      expect(research).toBeDefined();
      expect(typeof research).toBe('function');
    });
  });

  describe('Type exports', () => {
    it('should be able to import types', async () => {
      const module = await import('../../src/index.js');
      expect(module).toBeDefined();
    });
  });
});
