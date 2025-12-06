/**
 * JSCPD Duplicate Detection Analyzer - Copy/Paste Detection.
 *
 * Uses jscpd (JavaScript Copy/Paste Detector) to find duplicated code.
 * jscpd is a Node.js tool, well-suited for TypeScript environments.
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

interface JscpdClone {
  format: string;
  foundDate: number;
  duplicationA: {
    sourceId: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
    range: [number, number];
    fragment: string;
  };
  duplicationB: {
    sourceId: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
    range: [number, number];
    fragment: string;
  };
}

interface JscpdOutput {
  duplicates: JscpdClone[];
  statistics: {
    clones: number;
    duplicatedLines: number;
    sources: number;
    percentage: string;
  };
}

/**
 * Duplicate code detection using jscpd.
 */
@registerAnalyzer('quality:jscpd')
export class JscpdAnalyzer extends BaseAnalyzer {
  private toolAvailable = true;

  /** Thresholds for severity based on duplicate size */
  private thresholds = {
    largeClone: 50,    // 50+ lines = high severity
    mediumClone: 20,   // 20+ lines = medium severity
  };

  constructor(config?: Partial<AnalyzerConfig>) {
    const qualityConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h',
        '.go', '.rs', '.swift', '.kt', '.cs', '.rb', '.php', '.vue', '.html',
        '.css', '.scss', '.less', '.sql',
      ]),
      ...config,
    });

    super('duplicates', qualityConfig);
    this.checkToolAvailability();
  }

  /**
   * Check if jscpd is available.
   */
  private checkToolAvailability(): void {
    try {
      execSync('npx jscpd --version', {
        encoding: 'utf-8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.toolAvailable = true;
      console.error('Found jscpd');
    } catch {
      console.error('WARNING: jscpd is required for duplicate detection.');
      console.error('Install with: npm install -g jscpd');
      this.toolAvailable = false;
    }
  }

  /**
   * Run jscpd analysis on a path.
   */
  private async runJscpd(targetPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    try {
      const cmd = [
        'npx', 'jscpd',
        '--reporters', 'json',
        '--output', '/dev/stdout',
        '--min-lines', '5',
        '--min-tokens', '50',
      ];

      // Add ignore patterns
      for (const pattern of this.config.skipPatterns) {
        cmd.push('--ignore', `**/${pattern}/**`);
      }

      cmd.push(targetPath);

      this.log('jscpd_command', { cmd: cmd.join(' ') });

      const result = await this.execCommand(cmd, 300000); // 5 minute timeout

      if (result.stdout) {
        // Find JSON output in stdout (jscpd may output other info too)
        const jsonMatch = result.stdout.match(/\{[\s\S]*"duplicates"[\s\S]*\}/);
        if (jsonMatch) {
          const output: JscpdOutput = JSON.parse(jsonMatch[0]);

          for (const clone of output.duplicates || []) {
            const processed = this.processCloneFinding(clone);
            if (processed) {
              findings.push(processed);
            }
          }

          this.log('jscpd_complete', {
            clones: output.statistics?.clones || 0,
            percentage: output.statistics?.percentage || '0%',
            findings: findings.length,
          });
        }
      }

    } catch (err) {
      this.log('jscpd_error', { error: String(err) });
      // Don't throw - return empty findings for graceful degradation
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
        shell: true,
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
   * Process a clone finding.
   */
  private processCloneFinding(clone: JscpdClone): RawFinding | null {
    try {
      const fileA = clone.duplicationA.sourceId;
      const fileB = clone.duplicationB.sourceId;
      const startA = clone.duplicationA.start.line;
      const endA = clone.duplicationA.end.line;
      const startB = clone.duplicationB.start.line;
      const endB = clone.duplicationB.end.line;
      const lines = endA - startA + 1;

      // Determine severity based on clone size
      let severity: string;
      if (lines >= this.thresholds.largeClone) {
        severity = 'high';
      } else if (lines >= this.thresholds.mediumClone) {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      const fragment = clone.duplicationA.fragment?.slice(0, 200) || '';

      return createStandardFinding(
        `Duplicated code detected (${lines} lines)`,
        `Found duplicated code block of ${lines} lines between:\n` +
        `  - ${fileA}:${startA}-${endA}\n` +
        `  - ${fileB}:${startB}-${endB}\n` +
        `Duplicated code increases maintenance burden and bug risk.`,
        severity,
        fileA,
        startA,
        this.getRecommendation(lines, fileA === fileB),
        {
          tool: 'jscpd',
          format: clone.format,
          linesCount: lines,
          sourceA: { file: fileA, start: startA, end: endA },
          sourceB: { file: fileB, start: startB, end: endB },
          fragmentPreview: fragment,
          sameFile: fileA === fileB,
        }
      );
    } catch (err) {
      this.log('finding_error', { error: String(err) });
      return null;
    }
  }

  /**
   * Get recommendation based on clone characteristics.
   */
  private getRecommendation(lines: number, sameFile: boolean): string {
    if (sameFile) {
      return `Extract the duplicated code (${lines} lines) into a reusable function within this file. ` +
        `Apply the DRY (Don't Repeat Yourself) principle.`;
    }

    if (lines >= this.thresholds.largeClone) {
      return `This is a significant duplication (${lines} lines). Consider creating a shared module or utility ` +
        `that both files can import. This will reduce maintenance burden and ensure consistent behavior.`;
    }

    return `Extract the duplicated code into a shared function or module. ` +
      `Consider if this logic should live in a common utility file.`;
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    if (!this.toolAvailable) {
      this.log('tool_unavailable', { file: targetPath });
      return [];
    }

    return this.runJscpd(targetPath);
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'JSCPD Duplicate Analyzer',
      version: '1.0.0',
      description: 'Copy/paste detection using jscpd',
      category: 'quality',
      priority: 'medium',
      capabilities: [
        'Duplicate code detection',
        'Cross-file clone detection',
        'Same-file clone detection',
        'Multi-language support',
        'Configurable thresholds',
      ],
      supportedLanguages: [
        'JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#',
        'Go', 'Rust', 'Swift', 'Kotlin', 'Ruby', 'PHP', 'Vue', 'HTML', 'CSS',
      ],
      tool: 'jscpd',
    };
  }
}
