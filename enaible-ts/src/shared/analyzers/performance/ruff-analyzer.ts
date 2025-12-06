/**
 * Ruff Performance Analyzer - Python Linting and Performance Rules.
 *
 * Uses Ruff for fast Python linting with focus on performance-related rules.
 * Ruff is an extremely fast Python linter written in Rust.
 */

import { execSync, spawn } from 'child_process';
import {
  BaseAnalyzer,
  createStandardFinding,
} from '../../core/base/analyzer-base.js';
import {
  AnalyzerConfig,
  AnalyzerMetadata,
  RawFinding,
  createDefaultConfig,
} from '../../core/base/types.js';
import { registerAnalyzer } from '../../core/base/analyzer-registry.js';

interface RuffViolation {
  code: string;
  message: string;
  filename: string;
  location: {
    row: number;
    column: number;
  };
  end_location?: {
    row: number;
    column: number;
  };
  fix?: {
    message: string;
    edits: unknown[];
  };
  noqa_row?: number;
}

/**
 * Python performance analysis using Ruff.
 */
@registerAnalyzer('performance:ruff')
export class RuffPerformanceAnalyzer extends BaseAnalyzer {
  private toolAvailable = true;

  /** Performance-related rule codes */
  private performanceRules = [
    'PERF',  // Performance rules
    'C4',    // List/set/dict comprehension optimizations
    'B',     // Bugbear (includes some performance issues)
    'SIM',   // Simplification (can improve performance)
    'UP',    // Upgrade (modern Python is often faster)
  ];

  /** Severity mapping based on rule category */
  private severityByCode: Record<string, string> = {
    'PERF': 'medium',
    'C4': 'low',
    'B': 'medium',
    'SIM': 'low',
    'UP': 'info',
  };

  constructor(config?: Partial<AnalyzerConfig>) {
    const perfConfig = createDefaultConfig({
      codeExtensions: new Set(['.py', '.pyi']),
      ...config,
    });

    super('performance', perfConfig);
    this.checkToolAvailability();
  }

  /**
   * Check if Ruff is available.
   */
  private checkToolAvailability(): void {
    try {
      const result = execSync('ruff --version', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.toolAvailable = true;
      console.error(`Found Ruff ${result.trim()}`);
    } catch {
      console.error('WARNING: Ruff is required for Python performance analysis.');
      console.error('Install with: pip install ruff');
      this.toolAvailable = false;
    }
  }

  /**
   * Run Ruff analysis on a path.
   */
  private async runRuff(targetPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    try {
      const cmd = [
        'ruff', 'check',
        '--output-format', 'json',
        '--select', this.performanceRules.join(','),
      ];

      // Add exclusion patterns
      for (const pattern of this.config.skipPatterns) {
        cmd.push('--exclude', pattern);
      }

      cmd.push(targetPath);

      this.log('ruff_command', { cmd: cmd.join(' ') });

      const result = await this.execCommand(cmd, 120000); // 2 minute timeout

      if (result.stdout) {
        const violations: RuffViolation[] = JSON.parse(result.stdout);

        for (const violation of violations) {
          const processed = this.processViolation(violation);
          if (processed) {
            findings.push(processed);
          }
        }

        this.log('ruff_complete', { violations: violations.length, findings: findings.length });
      }

    } catch (err) {
      this.log('ruff_error', { error: String(err) });
      // Don't throw - Ruff exits non-zero when it finds issues
    }

    return findings;
  }

  /**
   * Execute a command.
   */
  private execCommand(cmd: string[], timeout: number): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd[0], cmd.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', () => {
        resolve({ stdout, stderr });
      });

      proc.on('error', reject);
    });
  }

  /**
   * Process a Ruff violation.
   */
  private processViolation(violation: RuffViolation): RawFinding | null {
    try {
      const code = violation.code;
      const category = this.getCategory(code);
      const severity = this.getSeverity(code);

      return createStandardFinding(
        `${code}: ${violation.message}`,
        `Ruff detected a ${category} issue: ${violation.message}. ` +
        `Rule: ${code}. This may impact code performance or quality.`,
        severity,
        violation.filename,
        violation.location.row,
        this.getRecommendation(code, violation.fix?.message),
        {
          tool: 'ruff',
          code,
          category,
          column: violation.location.column,
          endRow: violation.end_location?.row,
          endColumn: violation.end_location?.column,
          hasFix: Boolean(violation.fix),
          fixMessage: violation.fix?.message,
        }
      );
    } catch (err) {
      this.log('finding_error', { error: String(err), code: violation.code });
      return null;
    }
  }

  /**
   * Get category from rule code.
   */
  private getCategory(code: string): string {
    if (code.startsWith('PERF')) return 'performance';
    if (code.startsWith('C4')) return 'comprehension';
    if (code.startsWith('B')) return 'bugbear';
    if (code.startsWith('SIM')) return 'simplification';
    if (code.startsWith('UP')) return 'upgrade';
    return 'general';
  }

  /**
   * Get severity from rule code.
   */
  private getSeverity(code: string): string {
    for (const [prefix, severity] of Object.entries(this.severityByCode)) {
      if (code.startsWith(prefix)) {
        return severity;
      }
    }
    return 'low';
  }

  /**
   * Get recommendation for a rule.
   */
  private getRecommendation(code: string, fixMessage?: string): string {
    if (fixMessage) {
      return `Suggested fix: ${fixMessage}`;
    }

    const recommendations: Record<string, string> = {
      'PERF': 'Review and apply Python performance best practices. Consider using more efficient data structures or algorithms.',
      'C4': 'Use list/set/dict comprehensions instead of explicit loops for better performance and readability.',
      'B': 'Fix this potential bug or performance issue identified by flake8-bugbear.',
      'SIM': 'Simplify this code for better readability and potentially better performance.',
      'UP': 'Upgrade to modern Python syntax which is often more performant and readable.',
    };

    for (const [prefix, rec] of Object.entries(recommendations)) {
      if (code.startsWith(prefix)) {
        return rec;
      }
    }

    return 'Review this issue and apply the suggested improvements.';
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    if (!this.toolAvailable) {
      this.log('tool_unavailable', { file: targetPath });
      return [];
    }

    // Only analyze Python files
    if (!targetPath.endsWith('.py') && !targetPath.endsWith('.pyi')) {
      return [];
    }

    return this.runRuff(targetPath);
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Ruff Performance Analyzer',
      version: '1.0.0',
      description: 'Python performance analysis using Ruff',
      category: 'performance',
      priority: 'medium',
      capabilities: [
        'Performance rule checking (PERF)',
        'Comprehension optimization (C4)',
        'Bug detection (B/Bugbear)',
        'Code simplification (SIM)',
        'Python upgrade suggestions (UP)',
        'Auto-fix suggestions',
      ],
      supportedLanguages: ['Python'],
      tool: 'ruff',
    };
  }
}
