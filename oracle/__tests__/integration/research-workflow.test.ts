// @ts-nocheck
/**
 * Integration tests for system components
 */

import { ResearchOrchestrator } from '../../src/orchestrator.js';
import { VoiceInterface } from '../../src/voice.js';
import { OutputFormatter } from '../../src/formatter.js';
import type { ResearchConfig } from '../../src/types.js';

describe('Component Integration', () => {
  let config: ResearchConfig;

  beforeEach(() => {
    config = {
      anthropicApiKey: 'test-key',
      openaiApiKey: 'openai-key',
      minSourcesPerTopic: 10,
      maxSearchDepth: 3,
      enableVoice: false,
      outputDir: './test-output',
      outputFormat: 'markdown',
    };
  });

  describe('Component Initialization', () => {
    it('should create orchestrator', () => {
      const orchestrator = new ResearchOrchestrator(config);
      expect(orchestrator).toBeInstanceOf(ResearchOrchestrator);
    });

    it('should create voice interface', () => {
      const voice = new VoiceInterface(config);
      expect(voice).toBeInstanceOf(VoiceInterface);
    });

    it('should create output formatter', () => {
      const formatter = new OutputFormatter(config);
      expect(formatter).toBeInstanceOf(OutputFormatter);
    });
  });

  describe('Component Interaction', () => {
    it('should integrate orchestrator with formatter', () => {
      const orchestrator = new ResearchOrchestrator(config);
      const formatter = new OutputFormatter(config);

      expect(orchestrator.getState()).toBeDefined();
      expect(() => formatter.displayBanner()).not.toThrow();
    });

    it('should integrate voice interface with config', () => {
      config.enableVoice = true;
      const voice = new VoiceInterface(config);

      expect(voice.isEnabled()).toBe(true);
      expect(voice.getInteractions()).toEqual([]);
    });
  });

  describe('Configuration Handling', () => {
    it('should handle different output formats', () => {
      const formats = ['markdown', 'json', 'html'] as const;

      formats.forEach(format => {
        config.outputFormat = format;
        const orchestrator = new ResearchOrchestrator(config);
        expect(orchestrator).toBeDefined();
      });
    });

    it('should handle voice enabled/disabled', () => {
      config.enableVoice = false;
      const voice1 = new VoiceInterface(config);
      expect(voice1.isEnabled()).toBe(false);

      config.enableVoice = true;
      const voice2 = new VoiceInterface(config);
      expect(voice2.isEnabled()).toBe(true);
    });

    it('should handle custom source requirements', () => {
      config.minSourcesPerTopic = 15;
      const orchestrator = new ResearchOrchestrator(config);
      expect(orchestrator.getState()).toBeDefined();
    });
  });
});
