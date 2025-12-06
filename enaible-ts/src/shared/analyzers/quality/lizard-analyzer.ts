/**
 * Lizard Complexity Analyzer - Multi-language Code Complexity Analysis.
 *
 * Uses Lizard for cyclomatic complexity, function length, and parameter count metrics.
 * Supports: C/C++/C#, Java, JavaScript, Python, Ruby, PHP, Swift, Go, Rust, TypeScript, etc.
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

interface LizardFunction {
  name: string;
  long_name: string;
  filename: string;
  nloc: number;
  complexity: number;
  token_count: number;
  parameter_count: number;
  start_line: number;
  end_line: number;
}

/**
 * Code complexity analysis using Lizard.
 */
@registerAnalyzer('quality:lizard')
export class LizardComplexityAnalyzer extends BaseAnalyzer {
  private toolAvailable = true;

  /** Thresholds based on industry standards */
  private thresholds = {
    cyclomaticComplexity: {
      critical: 25,  // Extremely complex
      high: 15,      // Very complex
      medium: 10,    // Complex
    },
    functionLength: {
      critical: 150, // Extremely long
      high: 75,      // Very long
      medium: 40,    // Long
    },
    parameterCount: {
      critical: 10,  // Way too many
      high: 7,       // Too many
      medium: 5,     // Many
    },
  };

  constructor(config?: Partial<AnalyzerConfig>) {
    const qualityConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h',
        '.go', '.rs', '.swift', '.kt', '.cs', '.rb', '.php', '.m', '.mm',
        '.scala', '.dart', '.lua', '.perl', '.r',
      ]),
      batchSize: 100,
      maxFiles: 5000,
      ...config,
    });

    super('complexity', qualityConfig);
    this.checkToolAvailability();
  }

  /**
   * Check if Lizard is available.
   */
  private checkToolAvailability(): void {
    try {
      execSync('lizard --version', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.toolAvailable = true;
      console.error('Found Lizard');
    } catch {
      console.error('WARNING: Lizard is required for complexity analysis but not found.');
      console.error('Install with: pip install lizard');
      this.toolAvailable = false;
    }
  }

  /**
   * Run Lizard analysis on a path.
   */
  private async runLizard(targetPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    try {
      const cmd = [
        'lizard',
        '--xml',  // XML output for structured parsing
        targetPath,
      ];

      // Add exclusion patterns
      for (const pattern of this.config.skipPatterns) {
        cmd.push('-x', `*/${pattern}/*`);
      }

      this.log('lizard_command', { cmd: cmd.join(' ') });

      const result = await this.execCommand(cmd, 300000); // 5 minute timeout

      if (result.stdout) {
        // Parse XML output (simplified - in production use proper XML parser)
        const functions = this.parseLizardXml(result.stdout);

        for (const func of functions) {
          const funcFindings = this.analyzeFunctionMetrics(func);
          findings.push(...funcFindings);
        }

        this.log('lizard_complete', { functions: functions.length, findings: findings.length });
      }

    } catch (err) {
      // Try JSON format as fallback
      try {
        const findings2 = await this.runLizardJson(targetPath);
        return findings2;
      } catch {
        this.log('lizard_error', { error: String(err) });
        throw err;
      }
    }

    return findings;
  }

  /**
   * Run Lizard with JSON output (fallback).
   */
  private async runLizardJson(targetPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    const cmd = ['lizard', '-o', '-', '-f', 'csv', targetPath];

    for (const pattern of this.config.skipPatterns) {
      cmd.push('-x', `*/${pattern}/*`);
    }

    const result = await this.execCommand(cmd, 300000);

    if (result.stdout) {
      const functions = this.parseLizardCsv(result.stdout);
      for (const func of functions) {
        const funcFindings = this.analyzeFunctionMetrics(func);
        findings.push(...funcFindings);
      }
    }

    return findings;
  }

  /**
   * Parse Lizard XML output.
   */
  private parseLizardXml(xml: string): LizardFunction[] {
    const functions: LizardFunction[] = [];

    // Simple regex-based XML parsing (use proper parser in production)
    const funcRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = funcRegex.exec(xml)) !== null) {
      const item = match[1];

      const getValue = (tag: string): string => {
        const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(item);
        return m ? m[1] : '';
      };

      functions.push({
        name: getValue('name'),
        long_name: getValue('long_name') || getValue('name'),
        filename: getValue('filename'),
        nloc: parseInt(getValue('nloc')) || 0,
        complexity: parseInt(getValue('complexity') || getValue('cyclomatic_complexity')) || 0,
        token_count: parseInt(getValue('token_count')) || 0,
        parameter_count: parseInt(getValue('parameter_count')) || 0,
        start_line: parseInt(getValue('start_line')) || 0,
        end_line: parseInt(getValue('end_line')) || 0,
      });
    }

    return functions;
  }

  /**
   * Parse Lizard CSV output.
   */
  private parseLizardCsv(csv: string): LizardFunction[] {
    const functions: LizardFunction[] = [];
    const lines = csv.split('\n').filter(l => l.trim());

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length >= 6) {
        functions.push({
          name: cols[1]?.trim() || '',
          long_name: cols[1]?.trim() || '',
          filename: cols[0]?.trim() || '',
          nloc: parseInt(cols[2]) || 0,
          complexity: parseInt(cols[3]) || 0,
          token_count: parseInt(cols[4]) || 0,
          parameter_count: parseInt(cols[5]) || 0,
          start_line: parseInt(cols[6]) || 0,
          end_line: parseInt(cols[7]) || 0,
        });
      }
    }

    return functions;
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
        // Lizard returns non-zero if thresholds exceeded, but still outputs results
        resolve({ stdout, stderr });
      });

      proc.on('error', reject);
    });
  }

  /**
   * Analyze function metrics and generate findings.
   */
  private analyzeFunctionMetrics(func: LizardFunction): RawFinding[] {
    const findings: RawFinding[] = [];

    // Check cyclomatic complexity
    if (func.complexity >= this.thresholds.cyclomaticComplexity.critical) {
      findings.push(this.createComplexityFinding(func, 'critical', 'cyclomatic'));
    } else if (func.complexity >= this.thresholds.cyclomaticComplexity.high) {
      findings.push(this.createComplexityFinding(func, 'high', 'cyclomatic'));
    } else if (func.complexity >= this.thresholds.cyclomaticComplexity.medium) {
      findings.push(this.createComplexityFinding(func, 'medium', 'cyclomatic'));
    }

    // Check function length
    if (func.nloc >= this.thresholds.functionLength.critical) {
      findings.push(this.createComplexityFinding(func, 'critical', 'length'));
    } else if (func.nloc >= this.thresholds.functionLength.high) {
      findings.push(this.createComplexityFinding(func, 'high', 'length'));
    } else if (func.nloc >= this.thresholds.functionLength.medium) {
      findings.push(this.createComplexityFinding(func, 'medium', 'length'));
    }

    // Check parameter count
    if (func.parameter_count >= this.thresholds.parameterCount.critical) {
      findings.push(this.createComplexityFinding(func, 'critical', 'parameters'));
    } else if (func.parameter_count >= this.thresholds.parameterCount.high) {
      findings.push(this.createComplexityFinding(func, 'high', 'parameters'));
    } else if (func.parameter_count >= this.thresholds.parameterCount.medium) {
      findings.push(this.createComplexityFinding(func, 'medium', 'parameters'));
    }

    return findings;
  }

  /**
   * Create a complexity finding.
   */
  private createComplexityFinding(
    func: LizardFunction,
    severity: string,
    type: 'cyclomatic' | 'length' | 'parameters'
  ): RawFinding {
    const typeDescriptions = {
      cyclomatic: {
        title: `High cyclomatic complexity in ${func.name}`,
        description: `Function "${func.long_name}" has cyclomatic complexity of ${func.complexity}. ` +
          `High complexity makes code harder to understand, test, and maintain.`,
        recommendation: 'Consider breaking this function into smaller, focused functions. ' +
          'Extract complex conditional logic into separate methods.',
      },
      length: {
        title: `Long function: ${func.name}`,
        description: `Function "${func.long_name}" has ${func.nloc} lines of code. ` +
          `Long functions are harder to understand and maintain.`,
        recommendation: 'Refactor this function into smaller, single-purpose functions. ' +
          'Apply the Single Responsibility Principle.',
      },
      parameters: {
        title: `Too many parameters in ${func.name}`,
        description: `Function "${func.long_name}" has ${func.parameter_count} parameters. ` +
          `Functions with many parameters are harder to use and test.`,
        recommendation: 'Consider grouping related parameters into objects or using the Builder pattern. ' +
          'Review if all parameters are necessary.',
      },
    };

    const info = typeDescriptions[type];

    return createStandardFinding(
      info.title,
      info.description,
      severity,
      func.filename,
      func.start_line,
      info.recommendation,
      {
        tool: 'lizard',
        functionName: func.name,
        longName: func.long_name,
        metricType: type,
        complexity: func.complexity,
        nloc: func.nloc,
        parameterCount: func.parameter_count,
        tokenCount: func.token_count,
        startLine: func.start_line,
        endLine: func.end_line,
      }
    );
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    if (!this.toolAvailable) {
      this.log('tool_unavailable', { file: targetPath });
      return [];
    }

    return this.runLizard(targetPath);
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Lizard Complexity Analyzer',
      version: '1.0.0',
      description: 'Multi-language code complexity analysis using Lizard',
      category: 'quality',
      priority: 'high',
      capabilities: [
        'Cyclomatic complexity analysis',
        'Function length metrics',
        'Parameter count analysis',
        'Token count metrics',
        'Multi-language support',
      ],
      supportedLanguages: [
        'Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#',
        'Go', 'Rust', 'Swift', 'Kotlin', 'Ruby', 'PHP', 'Scala', 'Dart',
      ],
      tool: 'lizard',
    };
  }
}
