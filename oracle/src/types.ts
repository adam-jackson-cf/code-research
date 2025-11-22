/**
 * Core types for Oracle Research Assistant
 */

/**
 * Provider configuration for LLM access
 */
export interface ProviderConfig {
  /** Authentication mode: 'api-key' uses ANTHROPIC_API_KEY, 'subscription' uses Claude Code CLI auth */
  mode: 'api-key' | 'subscription';
}

/**
 * Options for LLM queries
 */
export interface QueryOptions {
  /** Model to use: sonnet, haiku, or opus */
  model?: 'sonnet' | 'haiku' | 'opus';
  /** Tools the model is allowed to use */
  allowedTools?: string[];
  /** Subagent definitions for complex tasks */
  agents?: Record<string, AgentDefinition>;
}

/**
 * Subagent definition for multi-agent orchestration
 */
export interface AgentDefinition {
  description: string;
  prompt: string;
  tools: string[];
  model: 'sonnet' | 'haiku' | 'opus';
}

/**
 * Result from an LLM query
 */
export interface QueryResult {
  text: string;
  provider: 'api-key' | 'subscription';
}

export interface ResearchConfig {
  minSourcesPerTopic: number;
  maxSearchDepth: number;
  enableVoice: boolean;
  outputDir: string;
  outputFormat: 'markdown' | 'json' | 'html';
  /** Anthropic API key - required for 'api-key' mode, optional for 'subscription' mode */
  anthropicApiKey?: string;
  openaiApiKey?: string;
  /** Provider configuration for LLM access */
  provider: ProviderConfig;
}

export interface ResearchRequest {
  query: string;
  scope?: 'narrow' | 'medium' | 'broad';
  depth?: 'shallow' | 'medium' | 'deep';
  useVoice?: boolean;
  additionalContext?: string;
}

export interface ResearchSource {
  id: number;
  url: string;
  title: string;
  author?: string;
  date?: string;
  credibility: 'high' | 'medium' | 'low';
  keyFindings: string[];
  quotes: string[];
  relevanceScore: number;
}

export interface SearchResult {
  topic: string;
  queriesUsed: string[];
  sources: ResearchSource[];
  totalSources: number;
  searchCoverage: 'comprehensive' | 'partial';
  gapsIdentified: string[];
}

export interface AnalysisResult {
  topic: string;
  keyFindings: Finding[];
  contradictions: Contradiction[];
  patterns: string[];
  gaps: string[];
  biasesDetected: string[];
  confidenceAssessment: string;
}

export interface Finding {
  finding: string;
  confidence: 'high' | 'medium' | 'low';
  supportingSources: number[];
  evidenceQuality: 'strong' | 'moderate' | 'weak';
  consensus: 'unanimous' | 'majority' | 'split' | 'minority';
}

export interface Contradiction {
  claimA: string;
  claimB: string;
  sourcesA: number[];
  sourcesB: number[];
  resolution: string;
}

export interface ResearchReport {
  topic: string;
  executiveSummary: string[];
  introduction: string;
  sections: ReportSection[];
  conclusions: string;
  sources: ResearchSource[];
  metadata: {
    generatedAt: string;
    totalSources: number;
    analysisDepth: string;
    confidenceLevel: string;
  };
}

export interface ReportSection {
  title: string;
  content: string;
  findings: string[];
  citations: number[];
}

export interface ResearchPlan {
  mainTopic: string;
  subTopics: string[];
  searchQueries: string[];
  estimatedSources: number;
  estimatedDuration: string;
  approach: string;
}

export interface VoiceInteraction {
  type: 'input' | 'output';
  text: string;
  timestamp: Date;
  audioFile?: string;
}

export interface OrchestratorState {
  phase: 'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'completed' | 'error';
  currentTask: string;
  progress: number;
  logs: string[];
}
