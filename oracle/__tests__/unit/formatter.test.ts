// @ts-nocheck
/**
 * Unit tests for OutputFormatter
 */

import { OutputFormatter } from '../../src/formatter.js';
import type { ResearchConfig } from '../../src/types.js';
import { jest } from '@jest/globals';

describe('OutputFormatter', () => {
  let formatter: OutputFormatter;
  let config: ResearchConfig;
  let consoleLogSpy;

  beforeEach(() => {
    config = {
      anthropicApiKey: 'test-key',
      minSourcesPerTopic: 10,
      maxSearchDepth: 3,
      enableVoice: false,
      outputDir: './test-output',
      outputFormat: 'markdown',
    };

    formatter = new OutputFormatter(config);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('displayBanner', () => {
    it('should display the Oracle banner', () => {
      formatter.displayBanner();
      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map(call => call[0]).join('');
      expect(calls).toContain('ORACLE');
    });
  });

  describe('displayPlan', () => {
    it('should display a research plan', () => {
      const plan = {
        mainTopic: 'Test Topic',
        subTopics: ['Sub 1', 'Sub 2', 'Sub 3'],
        searchQueries: ['query 1', 'query 2', 'query 3'],
        estimatedSources: 30,
        estimatedDuration: '15 minutes',
        approach: 'Comprehensive research',
      };

      formatter.displayPlan(plan);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('displayReportSummary', () => {
    it('should display report summary', () => {
      const report = {
        topic: 'Test Topic',
        executiveSummary: ['Finding 1', 'Finding 2', 'Finding 3'],
        introduction: 'Introduction',
        sections: [],
        conclusions: 'Conclusions',
        sources: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          totalSources: 15,
          analysisDepth: 'deep',
          confidenceLevel: 'high',
        },
      };

      formatter.displayReportSummary(report);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('log', () => {
    it('should log messages', () => {
      formatter.log('Test message');
      expect(consoleLogSpy).toHaveBeenCalledWith('Test message');
    });
  });

  describe('stop', () => {
    it('should stop spinner without error', () => {
      expect(() => formatter.stop()).not.toThrow();
    });
  });
});
