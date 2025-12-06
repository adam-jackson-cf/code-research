/**
 * Detect Secrets Analyzer - Hardcoded Secrets Detection.
 *
 * Uses detect-secrets for entropy-based secrets detection.
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

interface DetectSecretsResult {
  path: string;
  type: string;
  line_number: number;
  hashed_secret?: string;
  is_verified?: boolean;
}

interface DetectSecretsOutput {
  results: Record<string, DetectSecretsResult[]>;
  version?: string;
}

/**
 * Secrets detection using detect-secrets.
 */
@registerAnalyzer('security:detect_secrets')
export class DetectSecretsAnalyzer extends BaseAnalyzer {
  private toolAvailable = true;

  /** Severity mapping based on secret type */
  private severityByType: Record<string, string> = {
    'Private Key': 'critical',
    'AWS Access Key': 'critical',
    'Basic Auth Credentials': 'critical',
    'Secret Keyword': 'high',
    'High Entropy String': 'medium',
    'Base64 High Entropy String': 'medium',
    'Hex High Entropy String': 'medium',
  };

  constructor(config?: Partial<AnalyzerConfig>) {
    const securityConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cs', '.php', '.rb',
        '.go', '.rs', '.env', '.yaml', '.yml', '.json', '.xml', '.properties',
        '.ini', '.cfg', '.conf', '.toml', '.sh', '.bash', '.zsh',
      ]),
      ...config,
    });

    super('secrets', securityConfig);
    this.checkToolAvailability();
  }

  /**
   * Check if detect-secrets is available.
   */
  private checkToolAvailability(): void {
    try {
      execSync('detect-secrets --version', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.toolAvailable = true;
      console.error('Found detect-secrets');
    } catch {
      console.error('WARNING: detect-secrets is required but not found.');
      console.error('Install with: pip install detect-secrets');
      this.toolAvailable = false;
    }
  }

  /**
   * Run detect-secrets scan on directory.
   */
  private async runDetectSecrets(targetPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    try {
      const cmd = [
        'detect-secrets', 'scan',
        '--all-files',
        targetPath,
      ];

      // Add exclusion patterns
      for (const pattern of this.config.skipPatterns) {
        cmd.push('--exclude-files', pattern);
      }

      this.log('detect_secrets_command', { cmd: cmd.join(' ') });

      const result = await this.execCommand(cmd, 120000); // 2 minute timeout

      if (result.stdout) {
        const output: DetectSecretsOutput = JSON.parse(result.stdout);

        for (const [filePath, secrets] of Object.entries(output.results || {})) {
          for (const secret of secrets) {
            const processed = this.processSecretFinding(filePath, secret);
            if (processed) {
              findings.push(processed);
            }
          }
        }

        this.log('detect_secrets_complete', { findings: findings.length });
      }

    } catch (err) {
      this.log('detect_secrets_error', { error: String(err) });
      throw err;
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
   * Process a secret finding.
   */
  private processSecretFinding(filePath: string, secret: DetectSecretsResult): RawFinding | null {
    try {
      const secretType = secret.type || 'Unknown Secret';
      const severity = this.severityByType[secretType] || 'high';
      const lineNumber = secret.line_number || 0;

      return createStandardFinding(
        `Potential ${secretType} detected`,
        `A potential secret of type "${secretType}" was detected in the file. ` +
        `This could be a hardcoded credential, API key, or other sensitive information.`,
        severity,
        filePath,
        lineNumber,
        this.getRecommendation(secretType),
        {
          tool: 'detect-secrets',
          secretType,
          hashedSecret: secret.hashed_secret,
          verified: secret.is_verified,
        }
      );
    } catch (err) {
      this.log('finding_error', { error: String(err), file: filePath });
      return null;
    }
  }

  /**
   * Get recommendation based on secret type.
   */
  private getRecommendation(secretType: string): string {
    const recommendations: Record<string, string> = {
      'Private Key': 'Remove private keys from code. Store them in secure vaults like AWS Secrets Manager, HashiCorp Vault, or environment variables.',
      'AWS Access Key': 'Rotate AWS credentials immediately and use IAM roles or AWS Secrets Manager instead of hardcoding credentials.',
      'Basic Auth Credentials': 'Remove hardcoded credentials. Use environment variables or a secrets management system.',
      'Secret Keyword': 'Review this secret and move it to a secure configuration system. Never commit secrets to version control.',
      'High Entropy String': 'Review this high-entropy string. If it is a secret, move it to environment variables or a secrets manager.',
    };

    return recommendations[secretType] ||
      'Review this finding and remove any hardcoded secrets. Use environment variables or a secrets management solution.';
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    if (!this.toolAvailable) {
      this.log('tool_unavailable', { file: targetPath });
      return [];
    }

    return this.runDetectSecrets(targetPath);
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Detect Secrets Analyzer',
      version: '1.0.0',
      description: 'Hardcoded secrets detection using detect-secrets',
      category: 'security',
      priority: 'critical',
      capabilities: [
        'Private key detection',
        'AWS credential detection',
        'API key detection',
        'Password detection',
        'High entropy string detection',
        'Base64 encoded secrets',
        'Hex encoded secrets',
      ],
      tool: 'detect-secrets',
    };
  }
}
