/**
 * Basic Usage Example
 *
 * Simple example showing how to use Oracle for research
 */

import { research } from '../src/index.js';
import { config } from 'dotenv';

config();

async function basicExample() {
  console.log('Starting basic research example...\n');

  try {
    // Simple research query
    const report = await research(
      'What are the latest developments in quantum computing?',
      {
        anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
        scope: 'medium',
        depth: 'deep',
        minSources: 10,
        outputFormat: 'markdown'
      }
    );

    console.log('\n=== Research Complete ===\n');
    console.log('Topic:', report.topic);
    console.log('Total Sources:', report.metadata.totalSources);
    console.log('Confidence:', report.metadata.confidenceLevel);
    console.log('\nExecutive Summary:');
    report.executiveSummary.forEach((point, i) => {
      console.log(`${i + 1}. ${point}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

basicExample();
