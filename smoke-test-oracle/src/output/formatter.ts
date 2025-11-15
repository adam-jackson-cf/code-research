/**
 * Test result formatting utilities
 */

import {
  TestResult,
  CheckpointState,
  ValidationResult,
  AssertionResult,
} from '../core/types.js';

/**
 * Output format types
 */
export type OutputFormat = 'json' | 'text' | 'html' | 'markdown';

/**
 * Formatting options
 */
export interface FormatOptions {
  /** Whether to include verbose details */
  verbose?: boolean;

  /** Whether to use color in text output */
  color?: boolean;

  /** Whether to include timestamps */
  includeTimestamps?: boolean;

  /** Whether to include artifact references */
  includeArtifacts?: boolean;

  /** Indentation for JSON output */
  indent?: number;
}

/**
 * Test result formatter for multiple output formats
 */
export class TestResultFormatter {
  /**
   * Format test result to specified format
   */
  static format(
    result: TestResult,
    format: OutputFormat = 'json',
    options?: FormatOptions
  ): string {
    switch (format) {
      case 'json':
        return this.formatJSON(result, options);
      case 'text':
        return this.formatText(result, options);
      case 'html':
        return this.formatHTML(result, options);
      case 'markdown':
        return this.formatMarkdown(result, options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Format as JSON
   */
  private static formatJSON(result: TestResult, options?: FormatOptions): string {
    const indent = options?.indent ?? 2;
    return JSON.stringify(result, null, indent);
  }

  /**
   * Format as plain text
   */
  private static formatText(result: TestResult, options?: FormatOptions): string {
    const lines: string[] = [];
    const useColor = options?.color ?? false;

    // Header
    lines.push('='.repeat(80));
    lines.push(`Test Result: ${result.testId}`);
    lines.push(`Run ID: ${result.runId}`);
    lines.push(`Status: ${this.colorizeStatus(result.status, useColor)}`);
    lines.push(`Duration: ${this.formatDuration(result.duration)}`);

    if (options?.includeTimestamps) {
      lines.push(`Started: ${new Date(result.startTime).toLocaleString()}`);
      lines.push(`Ended: ${new Date(result.endTime).toLocaleString()}`);
    }

    lines.push('='.repeat(80));

    // Checkpoints
    if (result.checkpoints.length > 0) {
      lines.push('');
      lines.push('Checkpoints:');
      lines.push('-'.repeat(80));

      for (const checkpoint of result.checkpoints) {
        lines.push(this.formatCheckpointText(checkpoint, options));
      }
    }

    // Error
    if (result.error) {
      lines.push('');
      lines.push('Error:');
      lines.push('-'.repeat(80));
      lines.push(`Message: ${result.error.message}`);
      if (result.error.step) {
        lines.push(`Step: ${result.error.step}`);
      }
      if (options?.verbose && result.error.stack) {
        lines.push('');
        lines.push('Stack Trace:');
        lines.push(result.error.stack);
      }
    }

    // Artifacts
    if (options?.includeArtifacts && result.artifacts.length > 0) {
      lines.push('');
      lines.push(`Artifacts (${result.artifacts.length}):`);
      lines.push('-'.repeat(80));
      for (const artifact of result.artifacts) {
        lines.push(`  - ${artifact.category}: ${artifact.path} (${this.formatBytes(artifact.size)})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format checkpoint as text
   */
  private static formatCheckpointText(
    checkpoint: CheckpointState,
    options?: FormatOptions
  ): string {
    const lines: string[] = [];
    const useColor = options?.color ?? false;

    lines.push('');
    lines.push(`Checkpoint: ${checkpoint.checkpointId}`);
    lines.push(`  Status: ${this.colorizeStatus(checkpoint.status, useColor)}`);
    lines.push(`  Duration: ${this.formatDuration(checkpoint.duration)}`);

    if (options?.includeTimestamps) {
      lines.push(`  Time: ${new Date(checkpoint.timestamp).toLocaleString()}`);
    }

    // Validations
    if (checkpoint.validations && checkpoint.validations.length > 0) {
      lines.push('  Validations:');
      for (const validation of checkpoint.validations) {
        lines.push(this.formatValidationText(validation, options, 4));
      }
    }

    // Captured artifacts
    const capturedTypes = Object.keys(checkpoint.refs).filter(
      (key) => checkpoint.refs[key as keyof typeof checkpoint.refs]
    );
    if (capturedTypes.length > 0) {
      lines.push(`  Captured: ${capturedTypes.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Format validation as text
   */
  private static formatValidationText(
    validation: ValidationResult,
    options?: FormatOptions,
    indent: number = 0
  ): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);
    const useColor = options?.color ?? false;
    const status = validation.passed
      ? this.colorize('✓', 'green', useColor)
      : this.colorize('✗', 'red', useColor);

    lines.push(`${prefix}${status} ${validation.type}: ${validation.name}`);
    lines.push(`${prefix}  ${validation.message}`);

    if (options?.verbose && validation.assertions) {
      for (const assertion of validation.assertions) {
        lines.push(this.formatAssertionText(assertion, indent + 4, useColor));
      }
    }

    return lines.join('\n');
  }

  /**
   * Format assertion as text
   */
  private static formatAssertionText(
    assertion: AssertionResult,
    indent: number,
    useColor: boolean
  ): string {
    const prefix = ' '.repeat(indent);
    const status = assertion.passed
      ? this.colorize('✓', 'green', useColor)
      : this.colorize('✗', 'red', useColor);

    let line = `${prefix}${status} ${assertion.description}`;

    if (!assertion.passed) {
      if (assertion.expected !== undefined) {
        line += `\n${prefix}  Expected: ${JSON.stringify(assertion.expected)}`;
      }
      if (assertion.actual !== undefined) {
        line += `\n${prefix}  Actual: ${JSON.stringify(assertion.actual)}`;
      }
      if (assertion.error) {
        line += `\n${prefix}  Error: ${assertion.error}`;
      }
    }

    return line;
  }

  /**
   * Format as HTML
   */
  private static formatHTML(result: TestResult, options?: FormatOptions): string {
    const statusClass = result.status === 'passed' ? 'success' : 'failure';

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Result: ${result.testId}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1, h2, h3 { margin-top: 0; color: #333; }
        .status {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 4px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .status.success { background: #d4edda; color: #155724; }
        .status.failure { background: #f8d7da; color: #721c24; }
        .status.error { background: #fff3cd; color: #856404; }
        .status.skipped { background: #d1ecf1; color: #0c5460; }
        .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .meta-item { padding: 15px; background: #f8f9fa; border-radius: 4px; border-left: 4px solid #007bff; }
        .meta-label { font-size: 12px; color: #6c757d; text-transform: uppercase; margin-bottom: 5px; }
        .meta-value { font-size: 18px; font-weight: bold; color: #333; }
        .checkpoint { margin: 20px 0; padding: 20px; border: 1px solid #dee2e6; border-radius: 4px; }
        .checkpoint.passed { border-left: 4px solid #28a745; }
        .checkpoint.failed { border-left: 4px solid #dc3545; }
        .validation { margin: 10px 0 10px 20px; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .validation.passed::before { content: '✓'; color: #28a745; margin-right: 8px; }
        .validation.failed::before { content: '✗'; color: #dc3545; margin-right: 8px; }
        .error-box { margin: 20px 0; padding: 20px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; }
        .timestamp { color: #6c757d; font-size: 14px; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Result</h1>
        <div class="status ${statusClass}">${result.status.toUpperCase()}</div>

        <div class="meta">
            <div class="meta-item">
                <div class="meta-label">Test ID</div>
                <div class="meta-value">${result.testId}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Run ID</div>
                <div class="meta-value">${result.runId}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Duration</div>
                <div class="meta-value">${this.formatDuration(result.duration)}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Checkpoints</div>
                <div class="meta-value">${result.checkpoints.length}</div>
            </div>
        </div>
`;

    if (options?.includeTimestamps) {
      html += `
        <div class="timestamp">
            Started: ${new Date(result.startTime).toLocaleString()}<br>
            Ended: ${new Date(result.endTime).toLocaleString()}
        </div>
`;
    }

    // Checkpoints
    if (result.checkpoints.length > 0) {
      html += '<h2>Checkpoints</h2>';
      for (const checkpoint of result.checkpoints) {
        html += this.formatCheckpointHTML(checkpoint, options);
      }
    }

    // Error
    if (result.error) {
      html += `
        <div class="error-box">
            <h2>Error</h2>
            <p><strong>Message:</strong> ${this.escapeHTML(result.error.message)}</p>
            ${result.error.step ? `<p><strong>Step:</strong> ${this.escapeHTML(result.error.step)}</p>` : ''}
            ${options?.verbose && result.error.stack ? `<pre>${this.escapeHTML(result.error.stack)}</pre>` : ''}
        </div>
`;
    }

    html += `
    </div>
</body>
</html>
`;

    return html;
  }

  /**
   * Format checkpoint as HTML
   */
  private static formatCheckpointHTML(
    checkpoint: CheckpointState,
    options?: FormatOptions
  ): string {
    let html = `
        <div class="checkpoint ${checkpoint.status}">
            <h3>${checkpoint.checkpointId}</h3>
            <div class="status ${checkpoint.status === 'passed' ? 'success' : 'failure'}">
                ${checkpoint.status.toUpperCase()}
            </div>
            <p><strong>Duration:</strong> ${this.formatDuration(checkpoint.duration)}</p>
`;

    if (options?.includeTimestamps) {
      html += `<p class="timestamp">${new Date(checkpoint.timestamp).toLocaleString()}</p>`;
    }

    if (checkpoint.validations && checkpoint.validations.length > 0) {
      html += '<h4>Validations</h4>';
      for (const validation of checkpoint.validations) {
        html += `
            <div class="validation ${validation.passed ? 'passed' : 'failed'}">
                <strong>${validation.type}: ${validation.name}</strong><br>
                ${this.escapeHTML(validation.message)}
            </div>
`;
      }
    }

    html += '</div>';
    return html;
  }

  /**
   * Format as Markdown
   */
  private static formatMarkdown(result: TestResult, options?: FormatOptions): string {
    const lines: string[] = [];

    lines.push(`# Test Result: ${result.testId}`);
    lines.push('');
    lines.push(`**Status:** ${result.status.toUpperCase()}`);
    lines.push(`**Run ID:** ${result.runId}`);
    lines.push(`**Duration:** ${this.formatDuration(result.duration)}`);

    if (options?.includeTimestamps) {
      lines.push(`**Started:** ${new Date(result.startTime).toLocaleString()}`);
      lines.push(`**Ended:** ${new Date(result.endTime).toLocaleString()}`);
    }

    lines.push('');
    lines.push('---');

    // Checkpoints
    if (result.checkpoints.length > 0) {
      lines.push('');
      lines.push('## Checkpoints');
      lines.push('');

      for (const checkpoint of result.checkpoints) {
        lines.push(`### ${checkpoint.checkpointId}`);
        lines.push('');
        lines.push(`- **Status:** ${checkpoint.status}`);
        lines.push(`- **Duration:** ${this.formatDuration(checkpoint.duration)}`);

        if (checkpoint.validations && checkpoint.validations.length > 0) {
          lines.push('');
          lines.push('**Validations:**');
          lines.push('');
          for (const validation of checkpoint.validations) {
            const icon = validation.passed ? '✓' : '✗';
            lines.push(`- ${icon} **${validation.type}:** ${validation.name}`);
            lines.push(`  - ${validation.message}`);
          }
        }

        lines.push('');
      }
    }

    // Error
    if (result.error) {
      lines.push('## Error');
      lines.push('');
      lines.push(`**Message:** ${result.error.message}`);
      if (result.error.step) {
        lines.push(`**Step:** ${result.error.step}`);
      }
      if (options?.verbose && result.error.stack) {
        lines.push('');
        lines.push('```');
        lines.push(result.error.stack);
        lines.push('```');
      }
    }

    return lines.join('\n');
  }

  /**
   * Colorize text for terminal output
   */
  private static colorize(text: string, color: string, enabled: boolean): string {
    if (!enabled) return text;

    const colors: Record<string, string> = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      reset: '\x1b[0m',
    };

    return `${colors[color] || ''}${text}${colors.reset}`;
  }

  /**
   * Colorize status based on value
   */
  private static colorizeStatus(status: string, enabled: boolean): string {
    const colorMap: Record<string, string> = {
      passed: 'green',
      failed: 'red',
      skipped: 'yellow',
      error: 'red',
    };

    return this.colorize(status.toUpperCase(), colorMap[status] || 'reset', enabled);
  }

  /**
   * Format duration in human-readable format
   */
  private static formatDuration(ms: number): string {
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

  /**
   * Format bytes in human-readable format
   */
  private static formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes}B`;
    } else if (bytes < 1048576) {
      return `${(bytes / 1024).toFixed(2)}KB`;
    } else {
      return `${(bytes / 1048576).toFixed(2)}MB`;
    }
  }

  /**
   * Escape HTML special characters
   */
  private static escapeHTML(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
