#!/usr/bin/env node

/**
 * CLI Interface for Oracle Research Assistant
 */

import { Command } from 'commander';
import { config as loadEnv } from 'dotenv';
import chalk from 'chalk';
import { ResearchOrchestrator } from './orchestrator.js';
import { VoiceInterface } from './voice.js';
import { OutputFormatter } from './formatter.js';
import type { ResearchConfig, ResearchRequest } from './types.js';
import * as readline from 'readline';

// Load environment variables
loadEnv();

const program = new Command();

program
  .name('oracle')
  .description('Oracle Research Assistant - Deep research powered by Claude Agent SDK')
  .version('1.0.0');

program
  .command('research')
  .description('Conduct a research session')
  .argument('[query]', 'Research query (optional if using voice mode)')
  .option('-s, --scope <type>', 'Research scope (narrow|medium|broad)', 'medium')
  .option('-d, --depth <type>', 'Research depth (shallow|medium|deep)', 'deep')
  .option('-v, --voice', 'Use voice interaction for planning', false)
  .option('-f, --format <type>', 'Output format (markdown|json|html)', 'markdown')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('--min-sources <number>', 'Minimum sources per topic', '10')
  .action(async (query, options) => {
    try {
      const config = createConfig(options);
      const formatter = new OutputFormatter(config);

      formatter.displayBanner();

      let request: ResearchRequest;

      // Voice planning mode
      if (options.voice || !query) {
        const voice = new VoiceInterface(config);

        if (!voice.isEnabled()) {
          console.log(chalk.yellow('⚠️  Voice mode requires OPENAI_API_KEY'));
          console.log(chalk.gray('Falling back to text input\n'));
          request = await textInput(options);
        } else {
          const voiceInput = await voice.conductVoicePlanning();
          request = {
            query: voiceInput.query,
            scope: voiceInput.scope as any,
            depth: voiceInput.depth as any,
            useVoice: true,
            additionalContext: voiceInput.additionalContext !== 'skip' ? voiceInput.additionalContext : undefined
          };
        }
      } else {
        // Text mode
        request = {
          query,
          scope: options.scope,
          depth: options.depth,
          useVoice: false
        };
      }

      // Conduct research
      const orchestrator = new ResearchOrchestrator(config);
      const report = await orchestrator.conductResearch(request);

      // Display results
      formatter.displayReportSummary(report);
      formatter.displaySources(report.sources.slice(0, 10));

      // Voice summary
      if (request.useVoice && config.openaiApiKey) {
        const voice = new VoiceInterface(config);
        await voice.speakSummary(report.executiveSummary);
        await voice.saveInteractionLog();
      }

      console.log(chalk.bold.green('\n✨ Research session complete!\n'));

    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error}\n`));
      process.exit(1);
    }
  });

program
  .command('interactive')
  .description('Start an interactive research session')
  .alias('i')
  .option('-v, --voice', 'Enable voice interaction', false)
  .action(async (options) => {
    try {
      const config = createConfig(options);
      const formatter = new OutputFormatter(config);

      formatter.displayBanner();

      console.log(chalk.cyan('🎯 Interactive Research Mode\n'));
      console.log(chalk.gray('Type your research queries, or type "exit" to quit\n'));

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const askQuestion = () => {
        rl.question(chalk.bold.cyan('Research query: '), async (query) => {
          if (query.toLowerCase() === 'exit') {
            console.log(chalk.green('\n👋 Goodbye!\n'));
            rl.close();
            return;
          }

          if (!query.trim()) {
            askQuestion();
            return;
          }

          try {
            const orchestrator = new ResearchOrchestrator(config);
            const report = await orchestrator.conductResearch({
              query,
              scope: 'medium',
              depth: 'deep',
              useVoice: options.voice
            });

            formatter.displayReportSummary(report);
            console.log('');
            askQuestion();

          } catch (error) {
            console.error(chalk.red(`Error: ${error}\n`));
            askQuestion();
          }
        });
      };

      askQuestion();

    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error}\n`));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Display current configuration')
  .action(() => {
    const config = createConfig({});

    console.log(chalk.bold.cyan('\n⚙️  Oracle Configuration\n'));
    console.log(chalk.gray('─'.repeat(50)));

    console.log(chalk.white(`Anthropic API Key: ${config.anthropicApiKey ? chalk.green('✓ Set') : chalk.red('✗ Not set')}`));
    console.log(chalk.white(`OpenAI API Key: ${config.openaiApiKey ? chalk.green('✓ Set') : chalk.yellow('○ Not set (voice disabled)')}`));
    console.log(chalk.white(`Min Sources: ${config.minSourcesPerTopic}`));
    console.log(chalk.white(`Max Search Depth: ${config.maxSearchDepth}`));
    console.log(chalk.white(`Voice Enabled: ${config.enableVoice ? chalk.green('Yes') : chalk.gray('No')}`));
    console.log(chalk.white(`Output Directory: ${config.outputDir}`));
    console.log(chalk.white(`Output Format: ${config.outputFormat}`));

    console.log(chalk.gray('─'.repeat(50)));
    console.log('');
  });

program.parse();

/**
 * Create configuration from options and environment
 */
function createConfig(options: any): ResearchConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    console.error(chalk.red('\n❌ Error: ANTHROPIC_API_KEY not set'));
    console.log(chalk.yellow('Please set your API key in .env file or environment\n'));
    process.exit(1);
  }

  return {
    anthropicApiKey,
    openaiApiKey: process.env.OPENAI_API_KEY,
    minSourcesPerTopic: parseInt(options.minSources || process.env.MIN_SOURCES_PER_TOPIC || '10'),
    maxSearchDepth: parseInt(process.env.MAX_SEARCH_DEPTH || '3'),
    enableVoice: options.voice || process.env.ENABLE_VOICE === 'true',
    outputDir: options.output || process.env.OUTPUT_DIR || './output',
    outputFormat: options.format || process.env.OUTPUT_FORMAT || 'markdown'
  };
}

/**
 * Get text input for research query
 */
async function textInput(options: any): Promise<ResearchRequest> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.cyan('What would you like to research? '), (query) => {
      rl.close();
      resolve({
        query,
        scope: options.scope,
        depth: options.depth,
        useVoice: false
      });
    });
  });
}
