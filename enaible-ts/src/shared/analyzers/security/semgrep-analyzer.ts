/**
 * Semgrep Security Analyzer - Semantic Static Analysis Security Scanner.
 *
 * Uses Semgrep's extensive ruleset for OWASP Top 10 vulnerabilities.
 * Semantic analysis instead of brittle regex patterns.
 * Multi-language support with native language parsers.
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

interface SemgrepOutput {
  results: SemgrepFinding[];
  errors?: unknown[];
}

/**
 * Semantic security analysis using Semgrep.
 */
@registerAnalyzer('security:semgrep')
export class SemgrepAnalyzer extends BaseAnalyzer {
  private semgrepAvailable = true;

  /** Severity mapping from Semgrep to our levels */
  private severityMapping: Record<string, string> = {
    'ERROR': 'critical',
    'WARNING': 'high',
    'INFO': 'medium',
  };

  constructor(config?: Partial<AnalyzerConfig>) {
    const securityConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cs', '.php', '.rb',
        '.go', '.rs', '.cpp', '.c', '.h', '.hpp', '.swift', '.kt', '.scala',
        '.dart', '.vue', '.xml', '.html', '.sql', '.sh', '.bash', '.ps1',
        '.bat', '.yaml', '.yml', '.json', '.tf', '.hcl', '.dockerfile',
        '.lock', '.gradle', '.pom',
      ]),
      ...config,
    });

    super('security', securityConfig);
    this.checkSemgrepAvailability();
  }

  /**
   * Check if Semgrep is available.
   */
  private checkSemgrepAvailability(): void {
    try {
      const result = execSync('semgrep --version', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      console.error(`Found Semgrep ${result.trim()}`);
      this.semgrepAvailable = true;
    } catch {
      console.error('WARNING: Semgrep is required for semantic security analysis but not found.');
      console.error('Install with: pip install semgrep');

      if (this.isTestingEnvironment()) {
        console.error('ERROR: In testing environment - all tools must be available');
        process.exit(1);
      } else {
        console.error('Continuing with degraded security analysis capabilities');
        this.semgrepAvailable = false;
      }
    }
  }

  /**
   * Detect if running in testing environment.
   */
  private isTestingEnvironment(): boolean {
    return Boolean(
      process.env.TESTING?.toLowerCase() === 'true' ||
      process.env.NODE_ENV === 'test' ||
      process.argv.some(arg => arg.includes('test') || arg.includes('vitest') || arg.includes('jest'))
    );
  }

  /**
   * Run Semgrep analysis on a directory.
   */
  private async runSemgrepOnDirectory(directoryPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    try {
      const cmd = [
        'semgrep', 'scan', '--json',
        '--timeout', '10',
        '--timeout-threshold', '3',
        '--max-target-bytes', '500000',
        '--jobs', '4',
        '--optimizations', 'all',
      ];

      // Get config from environment or use auto
      const configsStr = process.env.AAW_SEMGREP_CONFIGS?.trim();
      const configs = configsStr
        ? configsStr.split(/[\n,]+/).map(c => c.trim()).filter(Boolean)
        : ['auto'];

      for (const cfg of configs) {
        if (cfg === 'auto') {
          cmd.push('--config=auto');
        } else {
          cmd.push('--config', cfg);
        }
      }

      // OSS-only toggle (defaults true)
      const ossOnly = process.env.AAW_SEMGREP_OSS_ONLY?.toLowerCase() !== 'false';
      if (ossOnly) {
        cmd.push('--oss-only');
      }

      // Add exclusion patterns
      for (const pattern of this.config.skipPatterns) {
        cmd.push('--exclude', pattern);
        cmd.push('--exclude', `**/${pattern}`);
        cmd.push('--exclude', `${pattern}/**`);
      }

      cmd.push(directoryPath);

      this.log('semgrep_command', { cmd: cmd.join(' ') });

      const result = await this.execCommand(cmd, 300000); // 5 minute timeout

      if (result.stdout) {
        const semgrepOutput: SemgrepOutput = JSON.parse(result.stdout);

        for (const finding of semgrepOutput.results) {
          const processed = this.processSemgrepFinding(finding, 'auto');
          if (processed) {
            findings.push(processed);
          }
        }

        this.log('semgrep_complete', { findings: findings.length });
      }

      if (result.stderr) {
        this.log('semgrep_warnings', { stderr: result.stderr.slice(0, 500) });
      }

    } catch (err) {
      this.log('semgrep_error', { error: String(err) });
      throw err;
    }

    return findings;
  }

  /**
   * Execute a command and return output.
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

      proc.on('close', (code) => {
        if (code !== 0 && !stdout) {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Process a Semgrep finding into our standardized format.
   */
  private processSemgrepFinding(finding: SemgrepFinding, ruleset: string): RawFinding | null {
    try {
      const checkId = finding.check_id || 'unknown';
      const message = finding.message || finding.extra?.message || 'Security issue detected';
      const filePath = finding.path || '';
      const startLine = finding.start?.line || 0;
      const severity = finding.extra?.severity || 'WARNING';
      const ourSeverity = this.severityMapping[severity] || 'medium';
      const category = this.getCategoryFromRuleset(ruleset, checkId);
      const lineContent = (finding.extra?.lines || '').slice(0, 150);

      return createStandardFinding(
        `${message} (${checkId})`,
        `Semgrep detected: ${message}. Category: ${category}. This requires security review and remediation.`,
        ourSeverity,
        filePath,
        startLine,
        this.getRecommendation(checkId),
        {
          tool: 'semgrep',
          checkId,
          category,
          lineContent,
          confidence: 'high',
          patternMatched: `Semgrep: ${checkId}`,
        }
      );
    } catch (err) {
      this.log('finding_error', { error: String(err), checkId: finding.check_id });
      return null;
    }
  }

  /**
   * Map Semgrep ruleset/checkId to our category system.
   */
  private getCategoryFromRuleset(ruleset: string, checkId: string): string {
    const combined = `${ruleset} ${checkId}`.toLowerCase();
    if (combined.includes('injection') || combined.includes('sql')) return 'injection';
    if (combined.includes('xss')) return 'xss';
    if (combined.includes('auth')) return 'authentication';
    if (combined.includes('secret')) return 'secrets';
    if (combined.includes('validation') || combined.includes('input')) return 'input_validation';
    if (combined.includes('crypto')) return 'cryptography';
    return 'security';
  }

  /**
   * Get specific recommendations based on check ID.
   */
  private getRecommendation(checkId: string): string {
    const recommendations: Record<string, string> = {
      'python.lang.security.audit.dangerous-subprocess-use':
        'Use subprocess with shell=False and validate all inputs',
      'python.lang.security.audit.sql-injection':
        'Use parameterized queries or ORM methods to prevent SQL injection',
      'javascript.lang.security.audit.xss.direct-write-to-innerhtml':
        'Use textContent instead of innerHTML or sanitize user input',
      'java.lang.security.audit.command-injection':
        'Avoid runtime.exec() with user input. Use ProcessBuilder with validation',
      'generic.secrets.security.detected-private-key':
        'Remove private keys from code. Use environment variables or secure vaults',
    };

    return recommendations[checkId] ||
      'Review this security finding and apply appropriate security controls';
  }

  /**
   * Override analyze to let Semgrep handle file discovery.
   */
  async analyze(targetPath?: string): Promise<import('../../core/base/types.js').AnalysisResult> {
    this.startAnalysis();

    const analyzePath = targetPath ?? this.config.targetPath;

    try {
      if (!this.semgrepAvailable) {
        this.currentResult!.metadata.info = 'Semgrep not available - analysis skipped';
        return this.completeAnalysis();
      }

      // Let Semgrep handle file discovery for better performance
      const rawFindings = await this.runSemgrepOnDirectory(analyzePath);

      // Convert to standardized format
      this.currentResult!.findings = rawFindings.map((f, i) => this.createFinding(f, i + 1));

      // Add metadata
      const uniqueFiles = new Set(rawFindings.map(f => f.filePath));
      this.currentResult!.metadata = {
        analyzerType: this.analyzerType,
        targetPath: analyzePath,
        filesAnalyzed: 'handled_by_semgrep',
        filesProcessed: uniqueFiles.size,
        filesSkipped: 0,
        processingErrors: 0,
        totalFindings: rawFindings.length,
        severityBreakdown: this.getSeverityBreakdown(rawFindings),
        ...this.getAnalyzerMetadata(),
      };

    } catch (err) {
      this.currentResult!.success = false;
      this.currentResult!.error = `Semgrep analysis failed: ${err}`;
      this.log('analysis_failed', { error: String(err) });
    }

    return this.completeAnalysis();
  }

  /**
   * Calculate severity breakdown for results.
   */
  private getSeverityBreakdown(findings: RawFinding[]): Record<string, number> {
    const breakdown: Record<string, number> = {
      critical: 0, high: 0, medium: 0, low: 0, info: 0
    };
    for (const f of findings) {
      const sev = f.severity.toLowerCase();
      if (sev in breakdown) breakdown[sev]++;
    }
    return breakdown;
  }

  /**
   * Analyze a single target (for batch processing fallback).
   */
  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    if (!this.semgrepAvailable) {
      this.log('semgrep_unavailable', { file: targetPath });
      return [];
    }

    // For single file analysis, delegate to directory analysis
    return this.runSemgrepOnDirectory(targetPath);
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Semgrep Security Analyzer',
      version: '2.0.0',
      description: 'Semantic security analysis using Semgrep',
      category: 'security',
      priority: 'critical',
      capabilities: [
        'OWASP Top 10 vulnerability detection',
        'SQL injection analysis',
        'XSS vulnerability detection',
        'Authentication/authorization analysis',
        'Hardcoded secrets detection',
        'Input validation analysis',
        'Cryptographic weakness detection',
        'Multi-language semantic analysis',
        'Real-time security rule updates',
      ],
      supportedLanguages: [
        'Python', 'JavaScript', 'TypeScript', 'Java', 'C#', 'PHP', 'Ruby',
        'Go', 'Rust', 'C/C++', 'Swift', 'Kotlin', 'Scala', 'Dart', 'HTML',
        'SQL', 'Shell', 'YAML', 'Terraform',
      ],
      tool: 'semgrep',
      replaces: ['scan_vulnerabilities.py', 'check_auth.py', 'validate_inputs.py'],
    };
  }
}
