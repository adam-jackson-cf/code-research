/**
 * Oracle Research Assistant
 *
 * Main entry point for programmatic usage
 */

export { ResearchOrchestrator } from './orchestrator.js';
export { VoiceInterface } from './voice.js';
export { OutputFormatter } from './formatter.js';

export type {
  ResearchConfig,
  ResearchRequest,
  ResearchPlan,
  ResearchReport,
  ResearchSource,
  SearchResult,
  AnalysisResult,
  Finding,
  Contradiction,
  ReportSection,
  VoiceInteraction,
  OrchestratorState
} from './types.js';

/**
 * Quick start function for easy integration
 */
export async function research(query: string, options?: {
  anthropicApiKey: string;
  openaiApiKey?: string;
  scope?: 'narrow' | 'medium' | 'broad';
  depth?: 'shallow' | 'medium' | 'deep';
  useVoice?: boolean;
  outputDir?: string;
  outputFormat?: 'markdown' | 'json' | 'html';
  minSources?: number;
}) {
  const { ResearchOrchestrator } = await import('./orchestrator.js');

  const config = {
    anthropicApiKey: options?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
    openaiApiKey: options?.openaiApiKey || process.env.OPENAI_API_KEY,
    minSourcesPerTopic: options?.minSources || 10,
    maxSearchDepth: 3,
    enableVoice: options?.useVoice || false,
    outputDir: options?.outputDir || './output',
    outputFormat: options?.outputFormat || 'markdown' as const
  };

  const orchestrator = new ResearchOrchestrator(config);

  return await orchestrator.conductResearch({
    query,
    scope: options?.scope || 'medium',
    depth: options?.depth || 'deep',
    useVoice: options?.useVoice || false
  });
}
