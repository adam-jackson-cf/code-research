// @ts-nocheck
/**
 * Unit tests for type interfaces
 */

import type {
  ResearchConfig,
  ResearchRequest,
  ResearchSource,
  SearchResult,
  AnalysisResult,
  Finding,
  Contradiction,
  ResearchReport,
  ResearchPlan,
  VoiceInteraction,
  OrchestratorState,
} from '../../src/types.js';

describe('Type Definitions', () => {
  describe('ResearchConfig', () => {
    it('should have all required properties', () => {
      const config: ResearchConfig = {
        anthropicApiKey: 'test-key',
        minSourcesPerTopic: 10,
        maxSearchDepth: 3,
        enableVoice: false,
        outputDir: './output',
        outputFormat: 'markdown',
      };

      expect(config.anthropicApiKey).toBe('test-key');
      expect(config.minSourcesPerTopic).toBe(10);
      expect(config.maxSearchDepth).toBe(3);
      expect(config.enableVoice).toBe(false);
    });

    it('should support optional openaiApiKey', () => {
      const config: ResearchConfig = {
        anthropicApiKey: 'test-key',
        openaiApiKey: 'openai-key',
        minSourcesPerTopic: 10,
        maxSearchDepth: 3,
        enableVoice: true,
        outputDir: './output',
        outputFormat: 'json',
      };

      expect(config.openaiApiKey).toBe('openai-key');
    });

    it('should support all output formats', () => {
      const formats: ResearchConfig['outputFormat'][] = ['markdown', 'json', 'html'];

      formats.forEach(format => {
        const config: ResearchConfig = {
          anthropicApiKey: 'test-key',
          minSourcesPerTopic: 10,
          maxSearchDepth: 3,
          enableVoice: false,
          outputDir: './output',
          outputFormat: format,
        };

        expect(config.outputFormat).toBe(format);
      });
    });
  });

  describe('ResearchRequest', () => {
    it('should have required query property', () => {
      const request: ResearchRequest = {
        query: 'Test query',
      };

      expect(request.query).toBe('Test query');
    });

    it('should support all optional properties', () => {
      const request: ResearchRequest = {
        query: 'Test query',
        scope: 'broad',
        depth: 'deep',
        useVoice: true,
        additionalContext: 'Test context',
      };

      expect(request.scope).toBe('broad');
      expect(request.depth).toBe('deep');
      expect(request.useVoice).toBe(true);
      expect(request.additionalContext).toBe('Test context');
    });
  });

  describe('ResearchSource', () => {
    it('should have all required source properties', () => {
      const source: ResearchSource = {
        id: 1,
        url: 'https://example.com',
        title: 'Test Source',
        credibility: 'high',
        keyFindings: ['Finding 1', 'Finding 2'],
        quotes: ['Quote 1'],
        relevanceScore: 0.95,
      };

      expect(source.id).toBe(1);
      expect(source.credibility).toBe('high');
      expect(source.relevanceScore).toBe(0.95);
      expect(source.keyFindings).toHaveLength(2);
    });

    it('should support optional author and date', () => {
      const source: ResearchSource = {
        id: 1,
        url: 'https://example.com',
        title: 'Test Source',
        author: 'John Doe',
        date: '2025-11-08',
        credibility: 'medium',
        keyFindings: [],
        quotes: [],
        relevanceScore: 0.8,
      };

      expect(source.author).toBe('John Doe');
      expect(source.date).toBe('2025-11-08');
    });
  });

  describe('SearchResult', () => {
    it('should structure search results correctly', () => {
      const result: SearchResult = {
        topic: 'Test Topic',
        queriesUsed: ['query1', 'query2'],
        sources: [],
        totalSources: 0,
        searchCoverage: 'comprehensive',
        gapsIdentified: [],
      };

      expect(result.topic).toBe('Test Topic');
      expect(result.queriesUsed).toHaveLength(2);
      expect(result.searchCoverage).toBe('comprehensive');
    });
  });

  describe('Finding', () => {
    it('should have all finding properties', () => {
      const finding: Finding = {
        finding: 'Key finding',
        confidence: 'high',
        supportingSources: [1, 2, 3],
        evidenceQuality: 'strong',
        consensus: 'majority',
      };

      expect(finding.confidence).toBe('high');
      expect(finding.supportingSources).toHaveLength(3);
      expect(finding.evidenceQuality).toBe('strong');
      expect(finding.consensus).toBe('majority');
    });
  });

  describe('Contradiction', () => {
    it('should structure contradictions correctly', () => {
      const contradiction: Contradiction = {
        claimA: 'Claim A',
        claimB: 'Claim B',
        sourcesA: [1, 2],
        sourcesB: [3, 4],
        resolution: 'Need more research',
      };

      expect(contradiction.claimA).toBe('Claim A');
      expect(contradiction.claimB).toBe('Claim B');
      expect(contradiction.sourcesA).toHaveLength(2);
      expect(contradiction.sourcesB).toHaveLength(2);
    });
  });

  describe('ResearchPlan', () => {
    it('should have all planning properties', () => {
      const plan: ResearchPlan = {
        mainTopic: 'Main Topic',
        subTopics: ['Sub 1', 'Sub 2'],
        searchQueries: ['query1', 'query2', 'query3'],
        estimatedSources: 20,
        estimatedDuration: '10 minutes',
        approach: 'Comprehensive research',
      };

      expect(plan.mainTopic).toBe('Main Topic');
      expect(plan.subTopics).toHaveLength(2);
      expect(plan.searchQueries).toHaveLength(3);
      expect(plan.estimatedSources).toBe(20);
    });
  });

  describe('VoiceInteraction', () => {
    it('should track voice interactions', () => {
      const interaction: VoiceInteraction = {
        type: 'input',
        text: 'User speech',
        timestamp: new Date(),
      };

      expect(interaction.type).toBe('input');
      expect(interaction.text).toBe('User speech');
      expect(interaction.timestamp).toBeInstanceOf(Date);
    });

    it('should support optional audio file', () => {
      const interaction: VoiceInteraction = {
        type: 'output',
        text: 'System speech',
        timestamp: new Date(),
        audioFile: '/path/to/audio.mp3',
      };

      expect(interaction.audioFile).toBe('/path/to/audio.mp3');
    });
  });

  describe('OrchestratorState', () => {
    it('should track orchestrator state', () => {
      const state: OrchestratorState = {
        phase: 'searching',
        currentTask: 'Finding sources',
        progress: 50,
        logs: ['Log 1', 'Log 2'],
      };

      expect(state.phase).toBe('searching');
      expect(state.progress).toBe(50);
      expect(state.logs).toHaveLength(2);
    });

    it('should support all phases', () => {
      const phases: OrchestratorState['phase'][] = [
        'planning',
        'searching',
        'analyzing',
        'synthesizing',
        'completed',
        'error',
      ];

      phases.forEach(phase => {
        const state: OrchestratorState = {
          phase,
          currentTask: 'Task',
          progress: 0,
          logs: [],
        };

        expect(state.phase).toBe(phase);
      });
    });
  });

  describe('ResearchReport', () => {
    it('should have complete report structure', () => {
      const report: ResearchReport = {
        topic: 'Test Topic',
        executiveSummary: ['Point 1', 'Point 2'],
        introduction: 'Introduction text',
        sections: [],
        conclusions: 'Conclusion text',
        sources: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          totalSources: 10,
          analysisDepth: 'deep',
          confidenceLevel: 'high',
        },
      };

      expect(report.topic).toBe('Test Topic');
      expect(report.executiveSummary).toHaveLength(2);
      expect(report.metadata.totalSources).toBe(10);
      expect(report.metadata.analysisDepth).toBe('deep');
    });
  });
});
