/**
 * Frontend Performance Analyzer - Web Performance and Optimization Analysis.
 *
 * Analyzes frontend code for performance issues, bundle size, and optimization opportunities.
 * Supports React, Vue, Svelte, and vanilla JavaScript/TypeScript.
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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

interface PatternConfig {
  indicators: RegExp[];
  severity: string;
  description: string;
  recommendation: string;
}

interface ESLintMessage {
  ruleId: string;
  severity: number;
  message: string;
  line: number;
  column: number;
  source?: string;
}

interface ESLintResult {
  filePath: string;
  messages: ESLintMessage[];
}

/**
 * Frontend performance analyzer with pattern-based detection.
 */
@registerAnalyzer('performance:frontend')
export class FrontendPerformanceAnalyzer extends BaseAnalyzer {
  private eslintAvailable = false;
  private eslintConfigPath: string | null = null;

  /** Bundle size and import patterns */
  private bundlePatterns: Record<string, PatternConfig> = {
    large_imports: {
      indicators: [
        /import\s+\*\s+from\s+['"][^'"]*['"]/i,
        /import.*from\s+['"]lodash['"]/i,
        /import.*from\s+['"]moment['"]/i,
        /import.*from\s+['"]rxjs['"]/i,
        /import.*from\s+['"]@material-ui\/core['"]/i,
        /import.*from\s+['"]antd['"]/i,
      ],
      severity: 'low',
      description: 'Large library imports affecting bundle size',
      recommendation: 'Use tree-shaking, import specific modules, or consider lighter alternatives.',
    },
    dynamic_imports_missing: {
      indicators: [
        /import.*['"]\S*(Page|Route|Modal|Dialog)\S*['"]/i,
        /import.*['"].*\/(pages?|routes?)\S*['"]/i,
        /import.*['"]\S*(Chart|Dashboard|Editor)\S*['"]/i,
      ],
      severity: 'low',
      description: 'Missing dynamic imports for code splitting',
      recommendation: 'Use dynamic imports for large components and routes to enable code splitting.',
    },
  };

  /** React performance patterns */
  private reactPatterns: Record<string, PatternConfig> = {
    inline_object_creation: {
      indicators: [
        /style=\{\{[^}]*\}\}/,
        /onClick=\{[^}]*=>\s*\{/,
        /onChange=\{[^}]*=>\s*\{/,
        /onSubmit=\{[^}]*=>\s*\{/,
      ],
      severity: 'low',
      description: 'Inline object/function creation causing re-renders',
      recommendation: 'Extract inline objects and functions to avoid unnecessary re-renders.',
    },
    missing_key_prop: {
      indicators: [
        /\.map\([^)]*=>\s*<[^>]*(?!.*key=)[^>]*>/,
      ],
      severity: 'low',
      description: 'Missing key prop in list rendering',
      recommendation: 'Always provide unique key prop when rendering lists.',
    },
    unnecessary_rerenders: {
      indicators: [
        /useState\([^)]*\{\}[^)]*\)/,
        /useState\([^)]*\[\][^)]*\)/,
        /useEffect\([^,]*,[^)]*\[\][^)]*\)/,
      ],
      severity: 'low',
      description: 'Patterns causing unnecessary re-renders',
      recommendation: 'Use useCallback, useMemo, or stable object references.',
    },
  };

  /** CSS performance patterns */
  private cssPatterns: Record<string, PatternConfig> = {
    expensive_selectors: {
      indicators: [
        /\*\s*\{/,
        /\[.*\*=.*\]/,
        /:nth-child\(/,
        /:not\([^)]*:not\(/,
      ],
      severity: 'low',
      description: 'Expensive CSS selectors affecting render performance',
      recommendation: 'Use class selectors instead of complex descendant selectors.',
    },
    inefficient_animations: {
      indicators: [
        /animation.*(?:left|top|right|bottom|width|height)/i,
        /transition.*(?:left|top|right|bottom|width|height)/i,
        /@keyframes.*\{.*(?:left|top|right|bottom|width|height)/i,
      ],
      severity: 'low',
      description: 'Animations causing layout thrashing',
      recommendation: 'Use transform and opacity for animations to avoid layout recalculation.',
    },
  };

  /** JavaScript performance patterns */
  private jsPatterns: Record<string, PatternConfig> = {
    inefficient_dom_queries: {
      indicators: [
        /document\.querySelector.*(?:for|while)\s*\(/i,
        /document\.getElementById.*(?:for|while)\s*\(/i,
        /getElementsBy.*(?:for|while)\s*\(/i,
      ],
      severity: 'low',
      description: 'Inefficient DOM queries in loops',
      recommendation: 'Cache DOM query results outside loops.',
    },
    blocking_operations: {
      indicators: [
        /for\s*\([^)]*\)\s*\{[^}]*(?:fetch|await)/,
        /while\s*\([^)]*\)\s*\{[^}]*(?:fetch|await)/,
        /forEach\([^)]*(?:fetch|await)/,
      ],
      severity: 'high',
      description: 'Blocking operations on main thread',
      recommendation: 'Use Promise.all() for parallel operations or web workers for heavy computation.',
    },
    memory_leaks: {
      indicators: [
        /setInterval\([^)]*\)(?![^;]*clearInterval)/,
        /setTimeout\([^)]*\)(?![^;]*clearTimeout)/,
        /addEventListener\([^)]*\)(?![^;]*removeEventListener)/,
      ],
      severity: 'high',
      description: 'Potential memory leaks from uncleaned resources',
      recommendation: 'Always clean up timers, event listeners, and observers.',
    },
    inefficient_loops: {
      indicators: [
        /for\s*\([^)]*\.length[^)]*\)/,
      ],
      severity: 'low',
      description: 'Inefficient loop patterns',
      recommendation: 'Cache array length and avoid DOM operations in loop conditions.',
    },
  };

  /** Asset optimization patterns */
  private assetPatterns: Record<string, PatternConfig> = {
    unoptimized_images: {
      indicators: [
        /<img[^>]*src=['"][^'"]*\.(?:jpg|jpeg|png|gif)['"]/i,
        /background-image:[^;]*url\([^)]*\.(?:jpg|jpeg|png|gif)/i,
      ],
      severity: 'low',
      description: 'Unoptimized image formats',
      recommendation: 'Use modern formats like WebP or AVIF for better compression.',
    },
    missing_lazy_loading: {
      indicators: [
        /<img[^>]*src=[^>]*(?!.*loading=)/,
        /<iframe[^>]*src=[^>]*(?!.*loading=)/,
      ],
      severity: 'low',
      description: 'Missing lazy loading for media',
      recommendation: "Add loading='lazy' attribute to images and iframes below the fold.",
    },
  };

  constructor(config?: Partial<AnalyzerConfig>) {
    const frontendConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
        '.css', '.scss', '.sass', '.less',
        '.html', '.htm',
      ]),
      skipPatterns: new Set([
        'node_modules', '.git', '__pycache__', '.next',
        'dist', 'build', 'public', '.nuxt', '.output',
        'coverage', '.nyc_output', 'storybook-static',
        '*.min.js', '*.min.css', '*.bundle.js', '*.d.ts',
      ]),
      ...config,
    });

    super('performance', frontendConfig);
    this.checkESLintAvailability();
  }

  /**
   * Check if ESLint is available.
   */
  private checkESLintAvailability(): void {
    try {
      execSync('npx eslint --version', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.eslintAvailable = true;
    } catch {
      console.error('WARNING: ESLint not available. Some frontend analysis will be limited.');
      this.eslintAvailable = false;
    }
  }

  /**
   * Scan file for performance issues using regex patterns.
   */
  private scanFileForIssues(filePath: string, content: string): RawFinding[] {
    const findings: RawFinding[] = [];
    const lines = content.split('\n');
    const ext = path.extname(filePath).toLowerCase();

    // Select pattern groups based on file type
    const patternGroups: [string, Record<string, PatternConfig>][] = [];

    if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
      patternGroups.push(['css', this.cssPatterns]);
      patternGroups.push(['asset', this.assetPatterns]);
    } else if (['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'].includes(ext)) {
      patternGroups.push(['bundle', this.bundlePatterns]);
      patternGroups.push(['react', this.reactPatterns]);
      patternGroups.push(['javascript', this.jsPatterns]);
      patternGroups.push(['asset', this.assetPatterns]);
    } else if (['.html', '.htm'].includes(ext)) {
      patternGroups.push(['asset', this.assetPatterns]);
    }

    for (const [category, patterns] of patternGroups) {
      for (const [perfType, config] of Object.entries(patterns)) {
        for (const pattern of config.indicators) {
          let match;
          const globalPattern = new RegExp(pattern.source, pattern.flags + (pattern.flags.includes('g') ? '' : 'g'));

          while ((match = globalPattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            const lineContent = lines[lineNumber - 1]?.trim() || '';

            // Skip false positives
            if (this.isFalsePositive(lineContent, perfType, category)) {
              continue;
            }

            findings.push(createStandardFinding(
              `${config.description} (${perfType.replace(/_/g, ' ')})`,
              `${config.description} detected in ${path.basename(filePath)} at line ${lineNumber}. ` +
              `Category: ${category}. This could impact frontend performance.`,
              config.severity,
              filePath,
              lineNumber,
              config.recommendation,
              {
                tool: 'frontend-analyzer',
                perfType,
                category,
                lineContent: lineContent.substring(0, 150),
                patternMatched: pattern.source.substring(0, 80),
              }
            ));
          }
        }
      }
    }

    return findings;
  }

  /**
   * Check if detection is likely a false positive.
   */
  private isFalsePositive(lineContent: string, _perfType: string, category: string): boolean {
    const lineLower = lineContent.toLowerCase();
    const lineStripped = lineContent.trim();

    // Skip comments
    const commentIndicators = ['//', '#', '/*', '*', '<!--', "'''", '"""'];
    for (const indicator of commentIndicators) {
      if (lineStripped.startsWith(indicator)) {
        return true;
      }
    }

    // Skip test files
    const testIndicators = ['test', 'spec', 'mock', 'fixture', 'jest', 'vitest'];
    if (testIndicators.some(ind => lineLower.includes(ind))) {
      return true;
    }

    // Skip very short lines
    if (lineStripped.length < 10) {
      return true;
    }

    // Category-specific checks
    if (category === 'react') {
      const reactOptimized = ['memo(', 'usememo(', 'usecallback('];
      if (reactOptimized.some(opt => lineLower.includes(opt))) {
        return true;
      }
    }

    if (category === 'bundle') {
      const bundleOptimized = ['dynamic', 'lazy', 'import(', 'loadable'];
      if (bundleOptimized.some(opt => lineLower.includes(opt))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Run ESLint analysis on JavaScript/TypeScript files.
   */
  private async runESLintAnalysis(filePath: string): Promise<RawFinding[]> {
    if (!this.eslintAvailable) {
      return [];
    }

    const findings: RawFinding[] = [];

    try {
      // Create temporary ESLint config if needed
      if (!this.eslintConfigPath) {
        this.createESLintConfig();
      }

      const cmd = [
        'npx', 'eslint',
        '--format', 'json',
        '--no-ignore',
        filePath,
      ];

      if (this.eslintConfigPath) {
        cmd.splice(2, 0, '--config', this.eslintConfigPath);
      }

      const result = await this.execCommand(cmd, 30000);

      if (result.stdout) {
        const eslintResults: ESLintResult[] = JSON.parse(result.stdout);

        for (const fileResult of eslintResults) {
          for (const message of fileResult.messages) {
            const severity = message.severity === 2 ? 'high' : message.severity === 1 ? 'medium' : 'low';

            findings.push(createStandardFinding(
              `ESLint: ${message.ruleId || 'unknown'}`,
              message.message,
              severity,
              filePath,
              message.line,
              this.getESLintRecommendation(message.ruleId || ''),
              {
                tool: 'eslint',
                ruleId: message.ruleId,
                column: message.column,
              }
            ));
          }
        }
      }
    } catch {
      // ESLint often exits non-zero when it finds issues
    }

    return findings;
  }

  /**
   * Create temporary ESLint configuration.
   */
  private createESLintConfig(): void {
    const config = {
      env: { browser: true, node: true, es2022: true },
      extends: ['eslint:recommended'],
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      rules: {
        'no-unused-vars': 'warn',
      },
    };

    try {
      const configPath = path.join(os.tmpdir(), `eslint-config-${Date.now()}.json`);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      this.eslintConfigPath = configPath;
    } catch (err) {
      this.log('eslint_config_error', { error: String(err) });
    }
  }

  /**
   * Get recommendation for ESLint rule.
   */
  private getESLintRecommendation(ruleId: string): string {
    const recommendations: Record<string, string> = {
      'no-unused-vars': 'Remove unused variables and imports to reduce bundle size.',
      'react/jsx-key': 'Add unique key prop to list items.',
      'react-hooks/exhaustive-deps': 'Fix hook dependencies to prevent stale closures.',
    };

    return recommendations[ruleId] || 'Fix this issue detected by ESLint.';
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

      proc.on('close', () => {
        resolve({ stdout, stderr });
      });

      proc.on('error', reject);
    });
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    try {
      const content = fs.readFileSync(targetPath, 'utf-8');

      // Pattern-based analysis
      findings.push(...this.scanFileForIssues(targetPath, content));

      // ESLint analysis for JS/TS files
      const ext = path.extname(targetPath).toLowerCase();
      if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        const eslintFindings = await this.runESLintAnalysis(targetPath);
        findings.push(...eslintFindings);
      }
    } catch (err) {
      this.log('analysis_error', { file: targetPath, error: String(err) });
    }

    return findings;
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Frontend Performance Analyzer',
      version: '1.0.0',
      description: 'Analyzes frontend performance and optimization opportunities',
      category: 'performance',
      priority: 'high',
      capabilities: [
        'Bundle size analysis',
        'React performance patterns',
        'CSS optimization detection',
        'JavaScript efficiency analysis',
        'Asset optimization checks',
        'Memory leak detection',
        'ESLint integration',
      ],
      supportedLanguages: ['JavaScript', 'TypeScript', 'CSS', 'HTML'],
      tool: 'frontend-analyzer',
    };
  }
}
