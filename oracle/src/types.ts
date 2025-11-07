/**
 * Core types for Oracle Research Assistant
 */

export interface ResearchConfig {
  minSourcesPerTopic: number;
  maxSearchDepth: number;
  enableVoice: boolean;
  outputDir: string;
  outputFormat: 'markdown' | 'json' | 'html';
  anthropicApiKey: string;
  openaiApiKey?: string;
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
