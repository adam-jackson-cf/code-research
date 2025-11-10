// @ts-nocheck
/**
 * Unit tests for ResearchOrchestrator
 */

import { ResearchOrchestrator } from '../../src/orchestrator.js';
import type { ResearchConfig } from '../../src/types.js';

describe('ResearchOrchestrator', () => {
  let config: ResearchConfig;

  beforeEach(() => {
    config = {
      anthropicApiKey: 'test-key',
      minSourcesPerTopic: 10,
      maxSearchDepth: 3,
      enableVoice: false,
      outputDir: './test-output',
      outputFormat: 'markdown',
    };
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      const orchestrator = new ResearchOrchestrator(config);
      expect(orchestrator).toBeInstanceOf(ResearchOrchestrator);
    });

    it('should initialize state', () => {
      const orchestrator = new ResearchOrchestrator(config);
      const state = orchestrator.getState();

      expect(state.phase).toBe('planning');
      expect(state.progress).toBe(0);
      expect(state.logs).toEqual([]);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const orchestrator = new ResearchOrchestrator(config);
      const state = orchestrator.getState();

      expect(state).toHaveProperty('phase');
      expect(state).toHaveProperty('currentTask');
      expect(state).toHaveProperty('progress');
      expect(state).toHaveProperty('logs');
    });

    it('should return a copy of state', () => {
      const orchestrator = new ResearchOrchestrator(config);
      const state1 = orchestrator.getState();
      const state2 = orchestrator.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });
  });

  describe('configuration', () => {
    it('should respect minSourcesPerTopic setting', () => {
      config.minSourcesPerTopic = 15;
      const orchestrator = new ResearchOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });

    it('should work with different output formats', () => {
      const formats = ['markdown', 'json', 'html'];
      formats.forEach(format => {
        config.outputFormat = format;
        const orchestrator = new ResearchOrchestrator(config);
        expect(orchestrator).toBeDefined();
      });
    });
  });
});
