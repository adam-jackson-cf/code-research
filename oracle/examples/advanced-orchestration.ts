/**
 * Advanced Orchestration Example
 *
 * Demonstrates advanced features including voice interaction,
 * custom configuration, and detailed progress tracking
 */

import {
  ResearchOrchestrator,
  VoiceInterface,
  OutputFormatter,
  type ResearchConfig
} from '../src/index.js';
import { config as loadEnv } from 'dotenv';

loadEnv();

async function advancedExample() {
  // Configure Oracle
  const config: ResearchConfig = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    openaiApiKey: process.env.OPENAI_API_KEY,
    minSourcesPerTopic: 15, // Request more sources
    maxSearchDepth: 3,
    enableVoice: true,
    outputDir: './research-output',
    outputFormat: 'html'
  };

  // Initialize components
  const orchestrator = new ResearchOrchestrator(config);
  const formatter = new OutputFormatter(config);
  const voice = new VoiceInterface(config);

  formatter.displayBanner();

  try {
    // Option 1: Voice-based planning
    if (voice.isEnabled()) {
      console.log('🎤 Starting voice planning session...\n');

      const voiceInput = await voice.conductVoicePlanning();

      // Conduct research with voice plan
      const report = await orchestrator.conductResearch({
        query: voiceInput.query,
        scope: voiceInput.scope as any,
        depth: voiceInput.depth as any,
        useVoice: true,
        additionalContext: voiceInput.additionalContext
      });

      // Speak the summary
      await voice.speakSummary(report.executiveSummary);
      await voice.saveInteractionLog();

      // Display results
      formatter.displayReportSummary(report);
      formatter.displaySources(report.sources);

    } else {
      // Option 2: Text-based with custom parameters
      console.log('📝 Starting text-based research...\n');

      const report = await orchestrator.conductResearch({
        query: 'The impact of climate change on biodiversity',
        scope: 'broad',
        depth: 'deep',
        additionalContext: 'Focus on marine ecosystems and coral reefs'
      });

      // Display and save
      formatter.displayReportSummary(report);
      formatter.displaySources(report.sources.slice(0, 10));
    }

    // Check orchestrator state
    const state = orchestrator.getState();
    console.log('\nFinal State:', state);

  } catch (error) {
    console.error('Error during research:', error);
    throw error;
  }
}

advancedExample();
