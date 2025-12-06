/**
 * Semgrep Performance Analyzer - Performance Anti-pattern Detection.
 *
 * Uses Semgrep to detect performance anti-patterns across multiple languages.
 * Leverages Semgrep's semantic analysis for accurate detection.
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

interface SemgrepFinding {
  check_id: string;
  path: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
  extra: {
    severity?: string;
    message?: string;
    lines?: string;
    metadata?: Record<string, unknown>;
  };
  message?: string;
}

/**
 * Performance anti-pattern detection using Semgrep.
 */
@registerAnalyzer('performance:semgrep')
export class SemgrepPerformanceAnalyzer extends BaseAnalyzer {
  private toolAvailable = true;

  /** Performance-focused ruleset configurations */
  private performanceRulesets = [
    'p/python-performance',
    'p/javascript-performance',
  ];

  constructor(config?: Partial<AnalyzerConfig>) {
    const perfConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rb', '.php',
      ]),
      ...config,
    });

    super('performance', perfConfig);
    this.checkToolAvailability();
  }

  /**
   * Check if Semgrep is available.
   */
  private checkToolAvailability(): void {
    try {
      execSync('semgrep --version', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.toolAvailable = true;
    } catch {
      console.error('WARNING: Semgrep is required for performance pattern analysis.');
      this.toolAvailable = false;
    }
  }

  /**
   * Run Semgrep performance analysis.
   */
  private async runSemgrepPerformance(targetPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    try {
      const cmd = [
        'semgrep', 'scan', '--json',
        '--timeout', '10',
        '--timeout-threshold', '3',
        '--max-target-bytes', '500000',
        '--jobs', '4',
      ];

      // Use performance-focused rulesets
      for (const ruleset of this.performanceRulesets) {
        cmd.push('--config', ruleset);
      }

      // Add custom performance rules if available
      const customRules = process.env.AAW_SEMGREP_PERF_RULES;
      if (customRules) {
        cmd.push('--config', customRules);
      }

      // Add OSS-only flag
      if (process.env.AAW_SEMGREP_OSS_ONLY?.toLowerCase() !== 'false') {
        cmd.push('--oss-only');
      }

      // Exclusions
      for (const pattern of this.config.skipPatterns) {
        cmd.push('--exclude', pattern);
      }

      cmd.push(targetPath);

      const result = await this.execCommand(cmd, 300000);

      if (result.stdout) {
        const output = JSON.parse(result.stdout);

        for (const finding of output.results || []) {
          const processed = this.processFinding(finding);
          if (processed) {
            findings.push(processed);
          }
        }
      }

    } catch (err) {
      this.log('semgrep_perf_error', { error: String(err) });
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
   * Process a Semgrep finding.
   */
  private processFinding(finding: SemgrepFinding): RawFinding | null {
    try {
      const checkId = finding.check_id;
      const message = finding.message || finding.extra?.message || 'Performance issue detected';
      const severity = this.getSeverity(checkId, finding.extra?.severity);

      return createStandardFinding(
        `Performance: ${message}`,
        `Semgrep detected a performance anti-pattern: ${message}. ` +
        `Rule: ${checkId}. This may negatively impact application performance.`,
        severity,
        finding.path,
        finding.start.line,
        this.getRecommendation(checkId),
        {
          tool: 'semgrep',
          checkId,
          category: 'performance',
          lineContent: (finding.extra?.lines || '').slice(0, 150),
        }
      );
    } catch {
      return null;
    }
  }

  /**
   * Determine severity from rule.
   */
  private getSeverity(checkId: string, extraSeverity?: string): string {
    // High severity for known critical performance issues
    const highSeverityPatterns = [
      'n-plus-one', 'unbounded-loop', 'memory-leak', 'blocking-io',
      'expensive-operation', 'regex-dos',
    ];

    const checkLower = checkId.toLowerCase();
    for (const pattern of highSeverityPatterns) {
      if (checkLower.includes(pattern)) {
        return 'high';
      }
    }

    if (extraSeverity === 'ERROR') return 'high';
    if (extraSeverity === 'WARNING') return 'medium';
    return 'low';
  }

  /**
   * Get recommendation.
   */
  private getRecommendation(checkId: string): string {
    const checkLower = checkId.toLowerCase();

    if (checkLower.includes('n-plus-one')) {
      return 'Use eager loading or batch queries to avoid N+1 query problems.';
    }
    if (checkLower.includes('regex')) {
      return 'Review regex patterns for catastrophic backtracking. Use atomic groups or possessive quantifiers.';
    }
    if (checkLower.includes('loop')) {
      return 'Consider using more efficient algorithms or data structures. Avoid nested loops when possible.';
    }
    if (checkLower.includes('memory')) {
      return 'Review memory usage patterns. Use generators for large datasets and ensure proper cleanup.';
    }

    return 'Review this performance pattern and consider optimization strategies.';
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    if (!this.toolAvailable) {
      return [];
    }

    return this.runSemgrepPerformance(targetPath);
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Semgrep Performance Analyzer',
      version: '1.0.0',
      description: 'Performance anti-pattern detection using Semgrep',
      category: 'performance',
      priority: 'medium',
      capabilities: [
        'N+1 query detection',
        'Inefficient loop detection',
        'Memory leak patterns',
        'Regex performance issues',
        'Multi-language support',
      ],
      tool: 'semgrep',
    };
  }
}
