/**
 * Voice Interface Demo
 *
 * Demonstrates TTS and STT capabilities
 */

import { VoiceInterface } from '../src/index.js';
import type { ResearchConfig } from '../src/index.js';
import { config as loadEnv } from 'dotenv';

loadEnv();

async function voiceDemo() {
  const config: ResearchConfig = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    openaiApiKey: process.env.OPENAI_API_KEY,
    minSourcesPerTopic: 10,
    maxSearchDepth: 3,
    enableVoice: true,
    outputDir: './output',
    outputFormat: 'markdown'
  };

  const voice = new VoiceInterface(config);

  if (!voice.isEnabled()) {
    console.error('Voice interface requires OPENAI_API_KEY');
    return;
  }

  console.log('🎤 Voice Interface Demo\n');

  // Demo 1: Text to Speech
  console.log('Demo 1: Text-to-Speech');
  const text = 'Hello! I am Oracle, your AI research assistant. I can help you conduct comprehensive research on any topic with multiple sources and deep analysis.';

  await voice.textToSpeech(text, 'welcome.mp3');
  console.log('✓ Welcome message generated\n');

  // Demo 2: Phase announcements
  console.log('Demo 2: Phase Announcements');
  await voice.announcePhase('Planning', 'Creating research plan');
  await voice.announcePhase('Searching', 'Finding sources');
  await voice.announcePhase('Analyzing', 'Evaluating findings');
  await voice.announcePhase('Synthesizing', 'Generating report');
  console.log('✓ Phase announcements generated\n');

  // Demo 3: Research summary
  console.log('Demo 3: Research Summary');
  const summary = [
    'Artificial intelligence is transforming healthcare diagnostics',
    'Machine learning models show 95% accuracy in detecting diseases',
    'Privacy and ethical considerations remain important challenges'
  ];

  await voice.speakSummary(summary);
  console.log('✓ Research summary generated\n');

  // Demo 4: Voice planning (interactive)
  console.log('Demo 4: Interactive Voice Planning');
  const planning = await voice.conductVoicePlanning();
  console.log('✓ Voice planning complete\n');

  // Save interaction log
  await voice.saveInteractionLog();
  console.log('✓ Interaction log saved\n');

  // Display all interactions
  const interactions = voice.getInteractions();
  console.log(`Total interactions: ${interactions.length}`);
  interactions.forEach((interaction, i) => {
    console.log(`${i + 1}. [${interaction.type}] ${interaction.text.substring(0, 50)}...`);
  });
}

voiceDemo().catch(console.error);
