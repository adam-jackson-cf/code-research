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

  // Validate provider mode
  if (providerMode !== 'api-key' && providerMode !== 'subscription') {
    throw new Error(
      `Invalid provider mode '${providerMode}'. Valid options are: 'api-key', 'subscription'`
    );
  }

  const anthropicApiKey = options?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

  // Validate API key requirement for api-key mode
  if (providerMode === 'api-key' && !anthropicApiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is required for api-key mode. ' +
      'Either provide it via options.anthropicApiKey or set the ANTHROPIC_API_KEY environment variable. ' +
      'Alternatively, use provider: { mode: "subscription" } with Claude Code CLI authentication.'
    );
  }

  const config = {
    // Only include API key for api-key mode
    anthropicApiKey: providerMode === 'api-key' ? anthropicApiKey : undefined,
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
