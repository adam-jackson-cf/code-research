/**
 * Output Formatter
 *
 * Handles all output formatting with beautiful, custom styling
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import ora, { Ora } from 'ora';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { ResearchConfig, ResearchPlan, ResearchReport, ResearchSource } from './types.js';

// Configure marked for terminal output
marked.use(markedTerminal() as any);

export class OutputFormatter {
  private config: ResearchConfig;
  private spinner?: Ora;

  constructor(config: ResearchConfig) {
    this.config = config;
  }

  /**
   * Display welcome banner
   */
  displayBanner() {
    const banner = chalk.bold.cyan(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🔮  ORACLE RESEARCH ASSISTANT  🔮                  ║
║                                                       ║
║   Deep Research Powered by Claude Agent SDK          ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);

    console.log(banner);
    console.log(chalk.gray('  Multi-source • AI-Powered • Voice-Enabled\n'));
  }

  /**
   * Display research plan
   */
  displayPlan(plan: ResearchPlan) {
    console.log('\n' + chalk.bold.blue('📋 Research Plan'));
    console.log(chalk.gray('─'.repeat(60)));

    console.log(chalk.bold('\n🎯 Main Topic:'));
    console.log(chalk.white(`  ${plan.mainTopic}`));

    console.log(chalk.bold('\n🔍 Sub-Topics:'));
    plan.subTopics.forEach((topic, i) => {
      console.log(chalk.cyan(`  ${i + 1}. ${topic}`));
    });

    console.log(chalk.bold('\n🔎 Search Queries:'));
    plan.searchQueries.slice(0, 5).forEach((query, i) => {
      console.log(chalk.gray(`  ${i + 1}. "${query}"`));
    });
    if (plan.searchQueries.length > 5) {
      console.log(chalk.gray(`  ... and ${plan.searchQueries.length - 5} more`));
    }

    console.log(chalk.bold('\n📊 Estimates:'));
    console.log(chalk.white(`  Sources: ${plan.estimatedSources}`));
    console.log(chalk.white(`  Duration: ${plan.estimatedDuration}`));

    console.log(chalk.bold('\n🎓 Approach:'));
    console.log(chalk.white(`  ${plan.approach}`));

    console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
  }

  /**
   * Display progress indicator
   */
  displayProgress(phase: string, message: string, progress?: number) {
    const phaseEmoji = {
      planning: '📋',
      searching: '🔍',
      analyzing: '🧠',
      synthesizing: '✨',
      completed: '✅',
      error: '❌'
    };

    const emoji = phaseEmoji[phase.toLowerCase() as keyof typeof phaseEmoji] || '⚙️';

    if (this.spinner) {
      this.spinner.stop();
    }

    if (phase === 'completed') {
      console.log(chalk.green(`\n${emoji} ${message}`));
    } else if (phase === 'error') {
      console.log(chalk.red(`\n${emoji} ${message}`));
    } else {
      this.spinner = ora({
        text: chalk.cyan(`${emoji} ${message}${progress ? ` (${progress}%)` : ''}`),
        color: 'cyan'
      }).start();
    }
  }

  /**
   * Display sources table
   */
  displaySources(sources: ResearchSource[]) {
    console.log('\n' + chalk.bold.blue('📚 Sources Found'));
    console.log(chalk.gray('─'.repeat(60)));

    const table = new Table({
      head: [
        chalk.bold('ID'),
        chalk.bold('Title'),
        chalk.bold('Credibility'),
        chalk.bold('Relevance')
      ],
      colWidths: [5, 35, 12, 12],
      style: {
        head: [],
        border: ['gray']
      }
    });

    sources.slice(0, 10).forEach(source => {
      const credibilityColor =
        source.credibility === 'high' ? chalk.green :
        source.credibility === 'medium' ? chalk.yellow :
        chalk.red;

      table.push([
        chalk.cyan(source.id),
        source.title.length > 32 ? source.title.substring(0, 29) + '...' : source.title,
        credibilityColor(source.credibility),
        chalk.white((source.relevanceScore * 100).toFixed(0) + '%')
      ]);
    });

    console.log(table.toString());

    if (sources.length > 10) {
      console.log(chalk.gray(`\n  ... and ${sources.length - 10} more sources\n`));
    }
  }

  /**
   * Display final report summary
   */
  displayReportSummary(report: ResearchReport) {
    console.log('\n' + chalk.bold.green('✨ Research Complete!'));
    console.log(chalk.gray('═'.repeat(60)));

    const box = boxen(
      chalk.bold.white(report.topic) + '\n\n' +
      chalk.cyan('Executive Summary:\n') +
      report.executiveSummary.map(s => `• ${s}`).join('\n') + '\n\n' +
      chalk.gray(`Generated: ${new Date(report.metadata.generatedAt).toLocaleString()}\n`) +
      chalk.gray(`Sources: ${report.metadata.totalSources} | Confidence: ${report.metadata.confidenceLevel}`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green',
        title: '🔮 Oracle Research Report',
        titleAlignment: 'center'
      }
    );

    console.log(box);
  }

  /**
   * Save report to file
   */
  async saveReport(report: ResearchReport, querySlug: string) {
    try {
      await mkdir(this.config.outputDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const slug = querySlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
      const filename = `${timestamp}_${slug}`;

      switch (this.config.outputFormat) {
        case 'markdown':
          await this.saveMarkdown(report, filename);
          break;
        case 'json':
          await this.saveJson(report, filename);
          break;
        case 'html':
          await this.saveHtml(report, filename);
          break;
      }

      const filepath = join(this.config.outputDir, `${filename}.${this.config.outputFormat}`);
      console.log(chalk.green(`\n💾 Report saved: ${filepath}\n`));

    } catch (error) {
      console.error(chalk.red(`Error saving report: ${error}`));
    }
  }

  /**
   * Save report as markdown
   */
  private async saveMarkdown(report: ResearchReport, filename: string) {
    const md = `# ${report.topic}

${new Date(report.metadata.generatedAt).toLocaleString()}
**Sources:** ${report.metadata.totalSources} | **Confidence:** ${report.metadata.confidenceLevel}

---

## 📌 Executive Summary

${report.executiveSummary.map(s => `- ${s}`).join('\n')}

---

## 🔍 Introduction

${report.introduction}

---

## 📊 Findings

${report.sections.map(section => `
### ${section.title}

${section.content}

**Key Points:**
${section.findings.map(f => `- ${f}`).join('\n')}

${section.citations.length > 0 ? `*Sources: [${section.citations.join(', ')}]*` : ''}
`).join('\n---\n')}

---

## 💡 Conclusions

${report.conclusions}

---

## 📚 Sources

${report.sources.map((source, i) => `
${i + 1}. **${source.title}**
   ${source.url}
   ${source.author ? `Author: ${source.author} | ` : ''}${source.date ? `Date: ${source.date} | ` : ''}Credibility: ${source.credibility}
`).join('\n')}

---

*Generated by Oracle Research Assistant powered by Claude Agent SDK*
`;

    await writeFile(join(this.config.outputDir, `${filename}.md`), md, 'utf-8');
  }

  /**
   * Save report as JSON
   */
  private async saveJson(report: ResearchReport, filename: string) {
    await writeFile(
      join(this.config.outputDir, `${filename}.json`),
      JSON.stringify(report, null, 2),
      'utf-8'
    );
  }

  /**
   * Save report as HTML
   */
  private async saveHtml(report: ResearchReport, filename: string) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.topic} - Oracle Research Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h2 {
      color: #34495e;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    h3 {
      color: #7f8c8d;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    .metadata {
      background: #ecf0f1;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
      color: #7f8c8d;
    }
    .executive-summary {
      background: #e8f4f8;
      border-left: 4px solid #3498db;
      padding: 20px;
      margin: 20px 0;
    }
    ul { margin-left: 30px; margin-bottom: 15px; }
    li { margin-bottom: 8px; }
    .source {
      background: #fafafa;
      padding: 10px;
      margin: 10px 0;
      border-left: 3px solid #95a5a6;
    }
    .source-title { font-weight: bold; color: #2c3e50; }
    .source-url { color: #3498db; text-decoration: none; }
    .source-url:hover { text-decoration: underline; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ecf0f1;
      text-align: center;
      color: #95a5a6;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔮 ${report.topic}</h1>

    <div class="metadata">
      <strong>Generated:</strong> ${new Date(report.metadata.generatedAt).toLocaleString()} |
      <strong>Sources:</strong> ${report.metadata.totalSources} |
      <strong>Confidence:</strong> ${report.metadata.confidenceLevel}
    </div>

    <h2>📌 Executive Summary</h2>
    <div class="executive-summary">
      <ul>
        ${report.executiveSummary.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>

    <h2>🔍 Introduction</h2>
    <p>${report.introduction}</p>

    <h2>📊 Findings</h2>
    ${report.sections.map(section => `
      <h3>${section.title}</h3>
      <p>${section.content}</p>
      <ul>
        ${section.findings.map(f => `<li>${f}</li>`).join('')}
      </ul>
    `).join('')}

    <h2>💡 Conclusions</h2>
    <p>${report.conclusions}</p>

    <h2>📚 Sources</h2>
    ${report.sources.map((source, i) => `
      <div class="source">
        <div class="source-title">${i + 1}. ${source.title}</div>
        <a href="${source.url}" class="source-url" target="_blank">${source.url}</a>
        <div style="font-size: 14px; color: #7f8c8d; margin-top: 5px;">
          ${source.author ? `Author: ${source.author} | ` : ''}
          ${source.date ? `Date: ${source.date} | ` : ''}
          Credibility: ${source.credibility}
        </div>
      </div>
    `).join('')}

    <div class="footer">
      Generated by Oracle Research Assistant powered by Claude Agent SDK
    </div>
  </div>
</body>
</html>`;

    await writeFile(join(this.config.outputDir, `${filename}.html`), html, 'utf-8');
  }

  /**
   * Log message
   */
  log(message: string) {
    if (this.spinner) {
      this.spinner.stop();
    }
    console.log(message);
    if (this.spinner) {
      this.spinner.start();
    }
  }

  /**
   * Stop spinner
   */
  stop() {
    if (this.spinner) {
      this.spinner.stop();
    }
  }
}
