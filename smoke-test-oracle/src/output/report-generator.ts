/**
 * Test report generation
 */

import fs from 'fs-extra';
import path from 'path';
import {
  TestResult,
  StorageProvider,
  DiffResult,
} from '../core/types.js';
import { TestResultFormatter, OutputFormat, FormatOptions } from './formatter.js';
import { VisualDiffVisualizer } from './visualizer.js';

/**
 * Report configuration
 */
export interface ReportConfig {
  /** Output directory for reports */
  outputDir: string;

  /** Report title */
  title?: string;

  /** Report format */
  format?: OutputFormat;

  /** Formatting options */
  formatOptions?: FormatOptions;

  /** Whether to include visual diffs */
  includeVisualDiffs?: boolean;

  /** Whether to embed images in HTML reports */
  embedImages?: boolean;

  /** Whether to generate summary report */
  generateSummary?: boolean;
}

/**
 * Test summary statistics
 */
export interface TestSummary {
  /** Total number of tests */
  totalTests: number;

  /** Number of passed tests */
  passedTests: number;

  /** Number of failed tests */
  failedTests: number;

  /** Number of skipped tests */
  skippedTests: number;

  /** Number of tests with errors */
  errorTests: number;

  /** Total duration */
  totalDuration: number;

  /** Success rate percentage */
  successRate: number;

  /** Total checkpoints */
  totalCheckpoints: number;

  /** Passed checkpoints */
  passedCheckpoints: number;

  /** Failed checkpoints */
  failedCheckpoints: number;

  /** Total validations */
  totalValidations: number;

  /** Passed validations */
  passedValidations: number;

  /** Failed validations */
  failedValidations: number;
}

/**
 * Report generator for test results
 */
export class ReportGenerator {
  private storage: StorageProvider;
  private visualizer: VisualDiffVisualizer;

  constructor(storage: StorageProvider) {
    this.storage = storage;
    this.visualizer = new VisualDiffVisualizer(storage);
  }

  /**
   * Generate report for a single test result
   */
  async generateTestReport(
    result: TestResult,
    config: ReportConfig
  ): Promise<string> {
    await fs.ensureDir(config.outputDir);

    const format = config.format || 'html';
    const formatOptions = config.formatOptions || { verbose: true };

    // Generate main report
    const reportContent = TestResultFormatter.format(result, format, formatOptions);
    const filename = `test-${result.testId}-${result.runId}.${this.getFileExtension(format)}`;
    const reportPath = path.join(config.outputDir, filename);

    await fs.writeFile(reportPath, reportContent, 'utf-8');

    // Generate visual diff reports if requested
    if (config.includeVisualDiffs && format === 'html') {
      await this.generateVisualDiffReports(result, config);
    }

    return reportPath;
  }

  /**
   * Generate summary report for multiple test results
   */
  async generateSummaryReport(
    results: TestResult[],
    config: ReportConfig
  ): Promise<string> {
    await fs.ensureDir(config.outputDir);

    const summary = this.calculateSummary(results);
    const format = config.format || 'html';

    let content: string;
    switch (format) {
      case 'json':
        content = this.generateJSONSummary(results, summary);
        break;
      case 'html':
        content = this.generateHTMLSummary(results, summary, config);
        break;
      case 'markdown':
        content = this.generateMarkdownSummary(results, summary);
        break;
      case 'text':
        content = this.generateTextSummary(results, summary);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const filename = `summary-${Date.now()}.${this.getFileExtension(format)}`;
    const reportPath = path.join(config.outputDir, filename);

    await fs.writeFile(reportPath, content, 'utf-8');

    return reportPath;
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(results: TestResult[]): TestSummary {
    const summary: TestSummary = {
      totalTests: results.length,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      errorTests: 0,
      totalDuration: 0,
      successRate: 0,
      totalCheckpoints: 0,
      passedCheckpoints: 0,
      failedCheckpoints: 0,
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
    };

    for (const result of results) {
      // Count test statuses
      switch (result.status) {
        case 'passed':
          summary.passedTests++;
          break;
        case 'failed':
          summary.failedTests++;
          break;
        case 'skipped':
          summary.skippedTests++;
          break;
        case 'error':
          summary.errorTests++;
          break;
      }

      summary.totalDuration += result.duration;

      // Count checkpoints
      summary.totalCheckpoints += result.checkpoints.length;
      for (const checkpoint of result.checkpoints) {
        if (checkpoint.status === 'passed') {
          summary.passedCheckpoints++;
        } else if (checkpoint.status === 'failed') {
          summary.failedCheckpoints++;
        }

        // Count validations
        if (checkpoint.validations) {
          summary.totalValidations += checkpoint.validations.length;
          for (const validation of checkpoint.validations) {
            if (validation.passed) {
              summary.passedValidations++;
            } else {
              summary.failedValidations++;
            }
          }
        }
      }
    }

    summary.successRate =
      summary.totalTests > 0
        ? (summary.passedTests / summary.totalTests) * 100
        : 0;

    return summary;
  }

  /**
   * Generate visual diff reports for test result
   */
  private async generateVisualDiffReports(
    result: TestResult,
    config: ReportConfig
  ): Promise<void> {
    for (const checkpoint of result.checkpoints) {
      if (checkpoint.refs.visualDiff) {
        // Generate visual diff HTML report
        const visualDiffData = await this.storage.retrieve(checkpoint.refs.visualDiff);
        const diffResult = JSON.parse(visualDiffData.toString()) as DiffResult;

        const htmlReport = await this.visualizer.generateHTMLReport(
          checkpoint,
          diffResult,
          {
            includeImages: true,
            embedImages: config.embedImages,
          }
        );

        const filename = `visual-diff-${checkpoint.checkpointId}-${result.runId}.html`;
        const reportPath = path.join(config.outputDir, filename);

        await fs.writeFile(reportPath, htmlReport, 'utf-8');
      }
    }
  }

  /**
   * Generate JSON summary
   */
  private generateJSONSummary(
    results: TestResult[],
    summary: TestSummary
  ): string {
    return JSON.stringify(
      {
        summary,
        results,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Generate HTML summary
   */
  private generateHTMLSummary(
    results: TestResult[],
    summary: TestSummary,
    config: ReportConfig
  ): string {
    const title = config.title || 'Test Summary Report';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { margin-top: 0; color: #333; }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 30px 0;
        }
        .summary-card {
            padding: 20px;
            border-radius: 8px;
            color: white;
            text-align: center;
        }
        .summary-card.total { background: #007bff; }
        .summary-card.passed { background: #28a745; }
        .summary-card.failed { background: #dc3545; }
        .summary-card.skipped { background: #6c757d; }
        .summary-card.error { background: #fd7e14; }
        .summary-card h2 {
            margin: 0;
            font-size: 36px;
            font-weight: bold;
        }
        .summary-card p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .progress-bar {
            height: 30px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
            margin: 20px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745, #20c997);
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        th {
            background: #f8f9fa;
            font-weight: bold;
            color: #495057;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .status-badge.passed { background: #d4edda; color: #155724; }
        .status-badge.failed { background: #f8d7da; color: #721c24; }
        .status-badge.skipped { background: #d1ecf1; color: #0c5460; }
        .status-badge.error { background: #fff3cd; color: #856404; }
        .timestamp {
            color: #6c757d;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>

        <div class="summary-grid">
            <div class="summary-card total">
                <h2>${summary.totalTests}</h2>
                <p>Total Tests</p>
            </div>
            <div class="summary-card passed">
                <h2>${summary.passedTests}</h2>
                <p>Passed</p>
            </div>
            <div class="summary-card failed">
                <h2>${summary.failedTests}</h2>
                <p>Failed</p>
            </div>
            <div class="summary-card skipped">
                <h2>${summary.skippedTests}</h2>
                <p>Skipped</p>
            </div>
        </div>

        <div class="progress-bar">
            <div class="progress-fill" style="width: ${summary.successRate}%">
                ${summary.successRate.toFixed(1)}% Success Rate
            </div>
        </div>

        <h2>Test Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Test ID</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Checkpoints</th>
                    <th>Start Time</th>
                </tr>
            </thead>
            <tbody>
${results
  .map(
    (result) => `
                <tr>
                    <td>${result.testId}</td>
                    <td><span class="status-badge ${result.status}">${result.status.toUpperCase()}</span></td>
                    <td>${this.formatDuration(result.duration)}</td>
                    <td>${result.checkpoints.length} (${result.checkpoints.filter((c) => c.status === 'passed').length} passed)</td>
                    <td>${new Date(result.startTime).toLocaleString()}</td>
                </tr>
`
  )
  .join('')}
            </tbody>
        </table>

        <h2>Statistics</h2>
        <table>
            <tbody>
                <tr>
                    <td><strong>Total Duration</strong></td>
                    <td>${this.formatDuration(summary.totalDuration)}</td>
                </tr>
                <tr>
                    <td><strong>Total Checkpoints</strong></td>
                    <td>${summary.totalCheckpoints} (${summary.passedCheckpoints} passed, ${summary.failedCheckpoints} failed)</td>
                </tr>
                <tr>
                    <td><strong>Total Validations</strong></td>
                    <td>${summary.totalValidations} (${summary.passedValidations} passed, ${summary.failedValidations} failed)</td>
                </tr>
            </tbody>
        </table>
    </div>
</body>
</html>
`;
  }

  /**
   * Generate Markdown summary
   */
  private generateMarkdownSummary(
    results: TestResult[],
    summary: TestSummary
  ): string {
    const lines: string[] = [];

    lines.push('# Test Summary Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Tests:** ${summary.totalTests}`);
    lines.push(`- **Passed:** ${summary.passedTests}`);
    lines.push(`- **Failed:** ${summary.failedTests}`);
    lines.push(`- **Skipped:** ${summary.skippedTests}`);
    lines.push(`- **Errors:** ${summary.errorTests}`);
    lines.push(`- **Success Rate:** ${summary.successRate.toFixed(1)}%`);
    lines.push(`- **Total Duration:** ${this.formatDuration(summary.totalDuration)}`);
    lines.push('');
    lines.push('## Test Results');
    lines.push('');
    lines.push('| Test ID | Status | Duration | Checkpoints | Start Time |');
    lines.push('|---------|--------|----------|-------------|------------|');

    for (const result of results) {
      const checkpointInfo = `${result.checkpoints.length} (${result.checkpoints.filter((c) => c.status === 'passed').length} passed)`;
      lines.push(
        `| ${result.testId} | ${result.status} | ${this.formatDuration(result.duration)} | ${checkpointInfo} | ${new Date(result.startTime).toLocaleString()} |`
      );
    }

    lines.push('');
    lines.push('## Statistics');
    lines.push('');
    lines.push(`- **Total Checkpoints:** ${summary.totalCheckpoints}`);
    lines.push(`- **Passed Checkpoints:** ${summary.passedCheckpoints}`);
    lines.push(`- **Failed Checkpoints:** ${summary.failedCheckpoints}`);
    lines.push(`- **Total Validations:** ${summary.totalValidations}`);
    lines.push(`- **Passed Validations:** ${summary.passedValidations}`);
    lines.push(`- **Failed Validations:** ${summary.failedValidations}`);

    return lines.join('\n');
  }

  /**
   * Generate text summary
   */
  private generateTextSummary(
    results: TestResult[],
    summary: TestSummary
  ): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('TEST SUMMARY REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('SUMMARY');
    lines.push('-'.repeat(80));
    lines.push(`Total Tests:    ${summary.totalTests}`);
    lines.push(`Passed:         ${summary.passedTests}`);
    lines.push(`Failed:         ${summary.failedTests}`);
    lines.push(`Skipped:        ${summary.skippedTests}`);
    lines.push(`Errors:         ${summary.errorTests}`);
    lines.push(`Success Rate:   ${summary.successRate.toFixed(1)}%`);
    lines.push(`Total Duration: ${this.formatDuration(summary.totalDuration)}`);
    lines.push('');
    lines.push('TEST RESULTS');
    lines.push('-'.repeat(80));

    for (const result of results) {
      lines.push('');
      lines.push(`Test: ${result.testId}`);
      lines.push(`  Status: ${result.status.toUpperCase()}`);
      lines.push(`  Duration: ${this.formatDuration(result.duration)}`);
      lines.push(`  Checkpoints: ${result.checkpoints.length} (${result.checkpoints.filter((c) => c.status === 'passed').length} passed)`);
      lines.push(`  Started: ${new Date(result.startTime).toLocaleString()}`);
    }

    return lines.join('\n');
  }

  /**
   * Get file extension for format
   */
  private getFileExtension(format: OutputFormat): string {
    switch (format) {
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'markdown':
        return 'md';
      case 'text':
        return 'txt';
      default:
        return 'txt';
    }
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }
}
