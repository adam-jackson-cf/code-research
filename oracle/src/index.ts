/**
 * Oracle Research Assistant
 *
 * Main entry point for programmatic usage
 */

export { ResearchOrchestrator } from './orchestrator.js';
export { VoiceInterface } from './voice.js';
export { OutputFormatter } from './formatter.js';
export {
  isSubscriptionAvailable,
  checkSubscriptionStatus,
  getProviderDisplayName
} from './provider.js';
export type { SubscriptionCheckResult } from './provider.js';

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
  OrchestratorState,
  ProviderConfig,
  QueryOptions,
  QueryResult
} from './types.js';

/**
 * Quick start function for easy integration
 */
export async function research(query: string, options?: {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  scope?: 'narrow' | 'medium' | 'broad';
  depth?: 'shallow' | 'medium' | 'deep';
  useVoice?: boolean;
  outputDir?: string;
  outputFormat?: 'markdown' | 'json' | 'html';
  minSources?: number;
  /** Provider configuration - defaults to 'api-key' mode */
  provider?: { mode: 'api-key' | 'subscription' };
}) {
  const { ResearchOrchestrator } = await import('./orchestrator.js');

  const providerMode = options?.provider?.mode || 'api-key';

  const config = {
    anthropicApiKey: options?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    openaiApiKey: options?.openaiApiKey || process.env.OPENAI_API_KEY,
    minSourcesPerTopic: options?.minSources || 10,
    maxSearchDepth: 3,
    enableVoice: options?.useVoice || false,
    outputDir: options?.outputDir || './output',
    outputFormat: options?.outputFormat || 'markdown' as const,
    provider: { mode: providerMode }
  };

  const orchestrator = new ResearchOrchestrator(config);

  return await orchestrator.conductResearch({
    query,
    scope: options?.scope || 'medium',
    depth: options?.depth || 'deep',
    useVoice: options?.useVoice || false
  });
}
