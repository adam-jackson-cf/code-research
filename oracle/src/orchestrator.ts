/**
 * Research Orchestrator
 *
 * Main agent that coordinates research activities, delegates to subagents,
 * and manages the overall research workflow.
 */

import { query, createQueryFunction, getProviderDisplayName } from './provider.js';
import type {
  ResearchConfig,
  ResearchRequest,
  ResearchPlan,
  SearchResult,
  AnalysisResult,
  ResearchReport,
  OrchestratorState,
  QueryOptions
} from './types.js';
import { OutputFormatter } from './formatter.js';

export class ResearchOrchestrator {
  private config: ResearchConfig;
  private state: OrchestratorState;
  private formatter: OutputFormatter;

  constructor(config: ResearchConfig) {
    this.config = config;
    this.formatter = new OutputFormatter(config);
    this.state = {
      phase: 'planning',
      currentTask: 'Initializing',
      progress: 0,
      logs: []
    };
  }

  /**
   * Main entry point for conducting research
   */
  async conductResearch(request: ResearchRequest): Promise<ResearchReport> {
    try {
      this.log('🔮 Oracle Research Assistant initiated');
      this.log(`📡 Using provider: ${getProviderDisplayName(this.config.provider.mode)}`);
      this.updateState('planning', 'Creating research plan', 10);

      // Phase 1: Planning
      const plan = await this.createResearchPlan(request);
      this.log(`📋 Research plan created with ${plan.subTopics.length} sub-topics`);
      this.formatter.displayPlan(plan);

      // Phase 2: Multi-source search (parallel execution)
      this.updateState('searching', 'Conducting multi-source search', 30);
      const searchResults = await this.executeSearchPhase(plan);
      this.log(`🔍 Found ${searchResults.reduce((sum, r) => sum + r.totalSources, 0)} total sources`);

      // Phase 3: Deep analysis
      this.updateState('analyzing', 'Analyzing findings', 60);
      const analysisResults = await this.executeAnalysisPhase(searchResults);
      this.log(`🧠 Analysis complete with ${analysisResults.keyFindings.length} key findings`);

      // Phase 4: Synthesis
      this.updateState('synthesizing', 'Synthesizing report', 80);
      const report = await this.executeSynthesisPhase(request.query, searchResults, analysisResults);
      this.log('📊 Research report generated');

      // Phase 5: Output
      this.updateState('completed', 'Finalizing output', 100);
      await this.formatter.saveReport(report, request.query);

      return report;

    } catch (error) {
      this.updateState('error', `Error: ${error}`, 0);
      throw error;
    }
  }

  /**
   * Create a comprehensive research plan using the orchestrator's planning capabilities
   */
  private async createResearchPlan(request: ResearchRequest): Promise<ResearchPlan> {
    const planningPrompt = `
You are a research planning expert. Create a comprehensive research plan for the following query:

Query: "${request.query}"
Scope: ${request.scope || 'medium'}
Depth: ${request.depth || 'deep'}
${request.additionalContext ? `Additional Context: ${request.additionalContext}` : ''}

Create a structured research plan that includes:
1. Main topic breakdown
2. 5-10 specific sub-topics to investigate
3. 10-15 diverse search queries covering different angles
4. Estimated number of sources needed (minimum ${this.config.minSourcesPerTopic} per sub-topic)
5. Research approach and methodology

Respond in JSON format with the following structure:
{
  "mainTopic": "string",
  "subTopics": ["subtopic1", "subtopic2", ...],
  "searchQueries": ["query1", "query2", ...],
  "estimatedSources": number,
  "estimatedDuration": "string",
  "approach": "string describing the research methodology"
}`;

    const result = await query(
      planningPrompt,
      {
        model: 'sonnet',
        allowedTools: []  // Planning doesn't need tools
      },
      this.config.provider
    );

    // Parse the JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse research plan');
    }

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Execute parallel search phase using search-specialist subagent
   */
  private async executeSearchPhase(plan: ResearchPlan): Promise<SearchResult[]> {
    this.formatter.displayProgress('Searching', 'Delegating to search specialists...');

    const searchPrompt = `
Conduct comprehensive multi-source research for the following topics. For EACH topic, you MUST find at least ${this.config.minSourcesPerTopic} high-quality sources.

Main Topic: ${plan.mainTopic}

Sub-topics to research:
${plan.subTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Suggested search queries:
${plan.searchQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

For each sub-topic:
1. Use multiple search queries to maximize source diversity
2. Find at least ${this.config.minSourcesPerTopic} credible sources
3. Extract key information, quotes, and data points
4. Assess source credibility and relevance
5. Identify any gaps in coverage

Use the search-specialist agent to perform thorough research. Return results in structured JSON format for each sub-topic.`;

    const result = await query(
      searchPrompt,
      {
        model: 'sonnet',
        allowedTools: ['WebSearch', 'WebFetch'],
        agents: {
          'search-specialist': {
            description: 'Expert web search agent that performs comprehensive multi-source research',
            prompt: 'You are a search specialist. Find minimum 10 high-quality sources per topic, extract key information, and assess credibility.',
            tools: ['WebSearch', 'WebFetch'],
            model: 'sonnet'
          }
        }
      },
      this.config.provider
    );

    // Parse search results (simplified - in production, would have more robust parsing)
    return this.parseSearchResults(result.text, plan.subTopics);
  }

  /**
   * Execute analysis phase using analysis-expert subagent
   */
  private async executeAnalysisPhase(searchResults: SearchResult[]): Promise<AnalysisResult> {
    this.formatter.displayProgress('Analyzing', 'Delegating to analysis expert...');

    const analysisPrompt = `
Perform deep analysis of the following research findings:

${JSON.stringify(searchResults, null, 2)}

Your analysis should:
1. Critically evaluate source quality and credibility
2. Identify patterns, trends, and relationships
3. Cross-validate claims across sources
4. Detect biases or contradictions
5. Assess confidence levels for key findings
6. Identify gaps needing further research

Use the analysis-expert agent to perform thorough analysis. Return structured JSON with findings, contradictions, patterns, and confidence assessment.`;

    const result = await query(
      analysisPrompt,
      {
        model: 'sonnet',
        allowedTools: [],
        agents: {
          'analysis-expert': {
            description: 'Deep analysis expert that critically evaluates research findings',
            prompt: 'You are an analysis expert. Critically evaluate findings, identify patterns, detect biases, and assess confidence.',
            tools: [],
            model: 'sonnet'
          }
        }
      },
      this.config.provider
    );

    return this.parseAnalysisResults(result.text);
  }

  /**
   * Execute synthesis phase using synthesis-master subagent
   */
  private async executeSynthesisPhase(
    topic: string,
    searchResults: SearchResult[],
    analysisResults: AnalysisResult
  ): Promise<ResearchReport> {
    this.formatter.displayProgress('Synthesizing', 'Delegating to synthesis master...');

    const synthesisPrompt = `
Create a comprehensive research report synthesizing all findings:

Topic: ${topic}

Search Results:
${JSON.stringify(searchResults, null, 2)}

Analysis Results:
${JSON.stringify(analysisResults, null, 2)}

Create a well-structured report with:
1. Executive summary (3-5 key takeaways)
2. Introduction with context
3. Main findings organized by theme
4. Analysis of patterns and implications
5. Conclusions and recommendations
6. Complete source bibliography

Use the synthesis-master agent to create a compelling, coherent report. Return in structured format with clear sections, proper citations, and actionable insights.`;

    const result = await query(
      synthesisPrompt,
      {
        model: 'sonnet',
        allowedTools: [],
        agents: {
          'synthesis-master': {
            description: 'Synthesis expert that combines research into coherent reports',
            prompt: 'You are a synthesis master. Create clear, well-structured reports with compelling narratives and actionable insights.',
            tools: [],
            model: 'sonnet'
          }
        }
      },
      this.config.provider
    );

    return this.parseSynthesisResults(result.text, topic, searchResults);
  }

  /**
   * Parse search results from agent response
   */
  private parseSearchResults(response: string, subTopics: string[]): SearchResult[] {
    // Simplified parsing - in production would be more robust
    const results: SearchResult[] = [];

    for (let i = 0; i < subTopics.length; i++) {
      results.push({
        topic: subTopics[i],
        queriesUsed: [],
        sources: [],
        totalSources: 0,
        searchCoverage: 'partial',
        gapsIdentified: []
      });
    }

    return results;
  }

  /**
   * Parse analysis results from agent response
   */
  private parseAnalysisResults(response: string): AnalysisResult {
    // Simplified - would extract structured data from response
    return {
      topic: '',
      keyFindings: [],
      contradictions: [],
      patterns: [],
      gaps: [],
      biasesDetected: [],
      confidenceAssessment: 'medium'
    };
  }

  /**
   * Parse synthesis results into final report
   */
  private parseSynthesisResults(
    response: string,
    topic: string,
    searchResults: SearchResult[]
  ): ResearchReport {
    const allSources = searchResults.flatMap(r => r.sources);

    return {
      topic,
      executiveSummary: [],
      introduction: response,
      sections: [],
      conclusions: '',
      sources: allSources,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalSources: allSources.length,
        analysisDepth: 'deep',
        confidenceLevel: 'high'
      }
    };
  }

  /**
   * Update orchestrator state
   */
  private updateState(phase: OrchestratorState['phase'], task: string, progress: number) {
    this.state = {
      phase,
      currentTask: task,
      progress,
      logs: this.state.logs
    };
    this.formatter.displayProgress(phase, task, progress);
  }

  /**
   * Log message
   */
  private log(message: string) {
    this.state.logs.push(`[${new Date().toISOString()}] ${message}`);
    this.formatter.log(message);
  }

  /**
   * Get current state
   */
  getState(): OrchestratorState {
    return { ...this.state };
  }
}
