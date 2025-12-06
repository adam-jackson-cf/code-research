/**
 * Scalability Analysis Analyzer - Code Scalability Assessment.
 *
 * Analyzes code for potential scalability bottlenecks and architectural constraints.
 * Detects database patterns, performance issues, concurrency problems, and architecture concerns.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
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

interface PatternSpec {
  indicators: string[];
  severity: string;
  description: string;
}

interface LizardMetrics {
  functions: Array<{ ccn: number; nloc: number }>;
  avgCcn: number;
  maxCcn: number;
  totalFunctions: number;
}

/**
 * Scalability analyzer with pattern-based detection.
 */
@registerAnalyzer('architecture:scalability')
export class ScalabilityAnalyzer extends BaseAnalyzer {
  private lizardCache: Map<string, LizardMetrics> = new Map();

  /** Database scalability patterns */
  private dbPatterns: Record<string, PatternSpec> = {
    n_plus_one: {
      indicators: [
        'for.*query|while.*query|forEach.*query',
        '\\.find\\(.*\\.map\\(',
        'SELECT.*WHERE.*IN.*SELECT',
      ],
      severity: 'high',
      description: 'Potential N+1 query pattern detected',
    },
    missing_indexes: {
      indicators: [
        'WHERE.*=.*(?!.*INDEX)',
        'ORDER\\s+BY.*(?!.*INDEX)',
        'GROUP\\s+BY',
      ],
      severity: 'medium',
      description: 'Query may benefit from additional indexes',
    },
    large_result_sets: {
      indicators: [
        'SELECT\\s+\\*',
        '\\.findAll\\(\\)',
        '\\.find\\(\\{\\}\\)',
      ],
      severity: 'medium',
      description: 'Query may return large unbounded result sets',
    },
    no_pagination: {
      indicators: [
        'findAll(?!.*limit|.*skip|.*offset)',
        'SELECT.*FROM.*(?!.*LIMIT)',
      ],
      severity: 'low',
      description: 'Query lacks pagination (LIMIT/OFFSET)',
    },
  };

  /** Performance patterns */
  private performancePatterns: Record<string, PatternSpec> = {
    synchronous_io: {
      indicators: [
        'readFileSync|writeFileSync',
        'execSync',
        'spawnSync',
      ],
      severity: 'medium',
      description: 'Synchronous I/O operations may block event loop',
    },
    nested_loops: {
      indicators: [
        'for.*for.*for',
        'while.*while',
        '\\.forEach.*\\.forEach',
        '\\.map.*\\.map.*\\.map',
      ],
      severity: 'high',
      description: 'Deeply nested loops - potential O(n²) or worse complexity',
    },
    inefficient_algorithms: {
      indicators: [
        '\\.indexOf.*for|\\.includes.*for',
        '\\.find.*\\.find',
        'sort\\(.*sort\\(',
      ],
      severity: 'medium',
      description: 'Inefficient algorithm pattern detected',
    },
  };

  /** Concurrency patterns */
  private concurrencyPatterns: Record<string, PatternSpec> = {
    memory_leaks: {
      indicators: [
        'setInterval(?!.*clearInterval)',
        'addEventListener(?!.*removeEventListener)',
        'on\\(.*(?!.*off\\()',
      ],
      severity: 'high',
      description: 'Potential memory leak from uncleaned resources',
    },
    thread_safety: {
      indicators: [
        'global\\s+\\w+',
        'shared_state',
        'static\\s+mut',
      ],
      severity: 'medium',
      description: 'Potential thread safety issue with shared state',
    },
    blocking_operations: {
      indicators: [
        'sleep\\(|time\\.sleep\\(',
        'Thread\\.sleep',
        'await.*for\\s*\\(',
      ],
      severity: 'medium',
      description: 'Blocking operation may impact concurrency',
    },
  };

  /** Architecture patterns */
  private architecturePatterns: Record<string, PatternSpec> = {
    tight_coupling: {
      indicators: [
        'new\\s+\\w+\\(.*new\\s+\\w+\\(',
        'import.*import.*import.*import.*import',
        'require.*require.*require.*require',
      ],
      severity: 'medium',
      description: 'Tight coupling between components detected',
    },
    hardcoded_config: {
      indicators: [
        '(?:host|port|password|secret)\\s*[=:]\\s*["\'][^"\']+["\']',
        'localhost:\\d+',
        '127\\.0\\.0\\.1',
      ],
      severity: 'medium',
      description: 'Hardcoded configuration values detected',
    },
    single_responsibility: {
      indicators: [
        'class.*\\{[^}]{5000,}\\}',
        'function.*\\{[^}]{2000,}\\}',
      ],
      severity: 'high',
      description: 'Large code block may violate single responsibility principle',
    },
  };

  constructor(config?: Partial<AnalyzerConfig>) {
    const scalabilityConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cs',
        '.go', '.rs', '.php', '.rb', '.sql',
      ]),
      skipPatterns: new Set([
        'node_modules', '.git', '__pycache__', 'dist', 'build',
        '.next', 'coverage', 'venv', 'env', 'vendor',
        '*.min.js', '*.bundle.js', '*.test.*', '*/tests/*',
      ]),
      ...config,
    });

    super('architecture', scalabilityConfig);
  }

  /**
   * Get Lizard metrics for file.
   */
  private getLizardMetrics(filePath: string): LizardMetrics {
    if (this.lizardCache.has(filePath)) {
      return this.lizardCache.get(filePath)!;
    }

    const defaultMetrics: LizardMetrics = {
      functions: [],
      avgCcn: 0,
      maxCcn: 0,
      totalFunctions: 0,
    };

    try {
      const result = execSync(
        `lizard -C 999 -L 999 -a 999 "${filePath}"`,
        { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const metrics: LizardMetrics = { ...defaultMetrics };

      for (const line of result.split('\n')) {
        if (!line.trim() || line.startsWith('=') || line.startsWith('NLOC')) {
          continue;
        }

        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4 && /^\d+$/.test(parts[0])) {
          const nloc = parseInt(parts[0], 10);
          const ccn = parseInt(parts[1], 10);

          if (nloc > 1) {
            metrics.functions.push({ ccn, nloc });
            metrics.maxCcn = Math.max(metrics.maxCcn, ccn);
            metrics.totalFunctions++;
          }
        }
      }

      if (metrics.totalFunctions > 0) {
        metrics.avgCcn = metrics.functions.reduce((sum, f) => sum + f.ccn, 0) / metrics.totalFunctions;
      }

      this.lizardCache.set(filePath, metrics);
      return metrics;
    } catch {
      this.lizardCache.set(filePath, defaultMetrics);
      return defaultMetrics;
    }
  }

  /**
   * Check if issue should be flagged based on context.
   */
  private shouldFlagIssue(
    patternName: string,
    contextLine: string,
    content: string,
    metrics: LizardMetrics
  ): boolean {
    const contextLower = contextLine.toLowerCase();

    // Skip test/config files
    if (['test', 'spec', 'mock', 'fixture', 'config', 'setup'].some(
      marker => contextLower.includes(marker)
    )) {
      return false;
    }

    // Pattern-specific evaluations
    const dbPatterns = ['n_plus_one', 'missing_indexes', 'large_result_sets', 'no_pagination'];
    if (dbPatterns.includes(patternName)) {
      const hasDbContext = ['select', 'insert', 'update', 'delete', 'query', 'orm', 'model', 'database']
        .some(term => content.toLowerCase().includes(term));
      return metrics.maxCcn > 10 && metrics.totalFunctions > 2 && hasDbContext;
    }

    if (patternName === 'synchronous_io') {
      const hasLoop = ['for ', 'while ', 'foreach'].some(token => contextLower.includes(token));
      return hasLoop && metrics.maxCcn > 12 && !contextLower.includes('await');
    }

    if (patternName === 'memory_leaks') {
      return metrics.totalFunctions > 5 && metrics.maxCcn > 8;
    }

    if (patternName === 'tight_coupling') {
      return metrics.totalFunctions > 4 && metrics.maxCcn > 10;
    }

    // Default: flag based on complexity
    return metrics.totalFunctions > 3 && metrics.maxCcn > 8;
  }

  /**
   * Calculate confidence level.
   */
  private calculateConfidence(metrics: LizardMetrics): string {
    if (metrics.maxCcn > 15) return 'high';
    if (metrics.maxCcn > 8) return 'medium';
    return 'low';
  }

  /**
   * Get recommendation for pattern.
   */
  private getRecommendation(patternName: string): string {
    const recommendations: Record<string, string> = {
      n_plus_one: 'Use eager loading, batch queries, or caching',
      missing_indexes: 'Add database indexes for frequently queried columns',
      large_result_sets: 'Implement pagination or result limiting',
      no_pagination: 'Add LIMIT clauses and pagination support',
      synchronous_io: 'Use async/await or threading for I/O operations',
      nested_loops: 'Optimize algorithm complexity or use caching',
      inefficient_algorithms: 'Review algorithm choice and data structures',
      memory_leaks: 'Implement proper cleanup and bounded collections',
      thread_safety: 'Use thread-safe data structures and proper synchronization',
      blocking_operations: 'Use non-blocking alternatives or background processing',
      tight_coupling: 'Implement dependency injection and interface abstraction',
      hardcoded_config: 'Use environment variables or configuration files',
      single_responsibility: 'Refactor into smaller, focused components',
    };

    return recommendations[patternName] || 'Review and optimize this pattern';
  }

  /**
   * Check patterns in content.
   */
  private checkScalabilityPatterns(
    content: string,
    lines: string[],
    filePath: string,
    category: string,
    patterns: Record<string, PatternSpec>,
    metrics: LizardMetrics
  ): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const [patternName, spec] of Object.entries(patterns)) {
      for (const indicator of spec.indicators) {
        try {
          const regex = new RegExp(indicator, 'gim');
          let match;

          while ((match = regex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            const contextLine = lines[lineNum - 1]?.trim() || '';

            if (this.shouldFlagIssue(patternName, contextLine, content, metrics)) {
              const confidence = this.calculateConfidence(metrics);

              findings.push(createStandardFinding(
                `Scalability Issue: ${patternName.replace(/_/g, ' ')}`,
                `${spec.description} (${patternName})`,
                spec.severity,
                filePath,
                lineNum,
                this.getRecommendation(patternName),
                {
                  tool: 'scalability-analyzer',
                  scalabilityCategory: category,
                  patternName,
                  context: contextLine.substring(0, 150),
                  confidence,
                  lizardCcn: metrics.maxCcn,
                }
              ));
            }
          }
        } catch {
          // Skip invalid regex
        }
      }
    }

    return findings;
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    try {
      const content = fs.readFileSync(targetPath, 'utf-8');
      const lines = content.split('\n');
      const metrics = this.getLizardMetrics(targetPath);

      // Check database patterns
      findings.push(...this.checkScalabilityPatterns(
        content, lines, targetPath, 'database', this.dbPatterns, metrics
      ));

      // Check performance patterns
      findings.push(...this.checkScalabilityPatterns(
        content, lines, targetPath, 'performance', this.performancePatterns, metrics
      ));

      // Check concurrency patterns
      findings.push(...this.checkScalabilityPatterns(
        content, lines, targetPath, 'concurrency', this.concurrencyPatterns, metrics
      ));

      // Check architecture patterns
      findings.push(...this.checkScalabilityPatterns(
        content, lines, targetPath, 'architecture', this.architecturePatterns, metrics
      ));

    } catch (err) {
      this.log('analysis_error', { file: targetPath, error: String(err) });
    }

    return findings;
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Scalability Analysis Analyzer',
      version: '1.0.0',
      description: 'Analyzes code for potential scalability bottlenecks',
      category: 'architecture',
      priority: 'high',
      capabilities: [
        'Database scalability patterns (N+1 queries, missing indexes)',
        'Performance bottleneck detection (synchronous I/O, nested loops)',
        'Concurrency issue identification (thread safety, resource contention)',
        'Architecture scalability analysis (coupling, configuration)',
        'Complexity-aware pattern detection via Lizard',
      ],
      supportedLanguages: ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'SQL'],
      tool: 'scalability-analyzer',
    };
  }
}
