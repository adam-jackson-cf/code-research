/**
 * Voice Interface
 *
 * Handles Text-to-Speech (TTS) and Speech-to-Text (STT) interactions
 * using OpenAI's Whisper and TTS APIs
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import OpenAI from 'openai';
import type { ResearchConfig, VoiceInteraction } from './types.js';
import chalk from 'chalk';

export class VoiceInterface {
  private config: ResearchConfig;
  private openai?: OpenAI;
  private interactions: VoiceInteraction[] = [];
  private audioDir: string;

  constructor(config: ResearchConfig) {
    this.config = config;
    this.audioDir = join(config.outputDir, 'audio');

    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey
      });
    }
  }

  /**
   * Check if voice is enabled and available
   */
  isEnabled(): boolean {
    return this.config.enableVoice && this.openai !== undefined;
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(text: string, outputName?: string): Promise<string | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      await mkdir(this.audioDir, { recursive: true });

      const filename = outputName || `output_${Date.now()}.mp3`;
      const filepath = join(this.audioDir, filename);

      console.log(chalk.cyan('🔊 Generating speech...'));

      const mp3 = await this.openai!.audio.speech.create({
        model: 'tts-1',
        voice: 'nova', // Options: alloy, echo, fable, onyx, nova, shimmer
        input: text,
        speed: 1.0
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      await writeFile(filepath, buffer);

      this.interactions.push({
        type: 'output',
        text,
        timestamp: new Date(),
        audioFile: filepath
      });

      console.log(chalk.green(`✓ Audio saved: ${filepath}`));
      return filepath;

    } catch (error) {
      console.error(chalk.red(`TTS Error: ${error}`));
      return null;
    }
  }

  /**
   * Convert speech to text
   */
  async speechToText(audioPath: string): Promise<string | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      if (!existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      console.log(chalk.cyan('🎤 Transcribing speech...'));

      const audioFile = await readFile(audioPath);
      const blob = new Blob([audioFile]);
      const file = new File([blob], 'audio.mp3', { type: 'audio/mpeg' });

      const transcription = await this.openai!.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en',
        response_format: 'text'
      });

      const text = typeof transcription === 'string' ? transcription : transcription.text;

      this.interactions.push({
        type: 'input',
        text,
        timestamp: new Date(),
        audioFile: audioPath
      });

      console.log(chalk.green(`✓ Transcription: "${text}"`));
      return text;

    } catch (error) {
      console.error(chalk.red(`STT Error: ${error}`));
      return null;
    }
  }

  /**
   * Interactive voice planning session
   * Guides user through research planning with voice interaction
   */
  async conductVoicePlanning(): Promise<{
    query: string;
    scope: string;
    depth: string;
    additionalContext: string;
  }> {
    console.log(chalk.bold.cyan('\n🎤 Voice Planning Mode\n'));

    const prompts = [
      {
        key: 'query',
        question: 'What would you like to research today?',
        followUp: 'I understand you want to research: '
      },
      {
        key: 'scope',
        question: 'What scope would you like? Say narrow, medium, or broad.',
        followUp: 'Setting scope to: '
      },
      {
        key: 'depth',
        question: 'How deep should the research be? Say shallow, medium, or deep.',
        followUp: 'Setting depth to: '
      },
      {
        key: 'additionalContext',
        question: 'Any additional context or specific aspects to focus on? Or say skip.',
        followUp: 'Additional context noted: '
      }
    ];

    const responses: any = {};

    for (const prompt of prompts) {
      // Speak question
      await this.textToSpeech(prompt.question, `prompt_${prompt.key}.mp3`);

      console.log(chalk.yellow(`\n💬 ${prompt.question}`));
      console.log(chalk.gray('Waiting for your audio response...'));
      console.log(chalk.gray('(In production, this would listen for microphone input)\n'));

      // In production, would listen for microphone input
      // For now, we'll simulate with text input
      console.log(chalk.gray('Note: Voice input requires microphone access in production environment'));
      console.log(chalk.gray('This is a demonstration of the voice interface capability\n'));

      // Simulate response (in production, would be actual voice input)
      const simulatedResponses: any = {
        query: 'the impact of artificial intelligence on healthcare',
        scope: 'broad',
        depth: 'deep',
        additionalContext: 'focus on diagnostic imaging and patient outcomes'
      };

      responses[prompt.key] = simulatedResponses[prompt.key];

      // Confirm with voice
      const confirmation = `${prompt.followUp}${responses[prompt.key]}`;
      await this.textToSpeech(confirmation, `confirm_${prompt.key}.mp3`);
      console.log(chalk.green(`✓ ${confirmation}`));
    }

    // Final confirmation
    const summary = `Great! I'll research: ${responses.query}. With ${responses.scope} scope and ${responses.depth} depth. ${responses.additionalContext !== 'skip' ? `Focusing on: ${responses.additionalContext}` : ''}`;
    await this.textToSpeech(summary, 'final_confirmation.mp3');
    console.log(chalk.bold.green(`\n✓ ${summary}\n`));

    return responses;
  }

  /**
   * Announce research phase
   */
  async announcePhase(phase: string, message: string) {
    if (!this.isEnabled()) {
      return;
    }

    const announcement = `${phase}: ${message}`;
    await this.textToSpeech(announcement, `phase_${phase.toLowerCase()}.mp3`);
  }

  /**
   * Speak research summary
   */
  async speakSummary(summary: string[]) {
    if (!this.isEnabled()) {
      return;
    }

    const text = 'Research complete. Here are the key findings: ' + summary.join('. ');
    await this.textToSpeech(text, 'research_summary.mp3');
  }

  /**
   * Get all interactions
   */
  getInteractions(): VoiceInteraction[] {
    return [...this.interactions];
  }

  /**
   * Save interaction log
   */
  async saveInteractionLog() {
    try {
      await mkdir(this.audioDir, { recursive: true });

      const logPath = join(this.audioDir, 'interaction_log.json');
      await writeFile(logPath, JSON.stringify(this.interactions, null, 2), 'utf-8');

      console.log(chalk.gray(`Voice interaction log saved: ${logPath}`));
    } catch (error) {
      console.error(chalk.red(`Error saving interaction log: ${error}`));
    }
  }
}
