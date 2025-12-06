/**
 * Pattern Evaluation Analyzer - Design Pattern Analysis.
 *
 * Analyzes design patterns and architectural decisions in codebases.
 * Detects design patterns, anti-patterns, and architectural patterns.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
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

interface PatternInfo {
  indicators: RegExp[];
  severity: string;
  description: string;
}

interface LizardFunction {
  name: string;
  ccn: number;
  nloc: number;
}

interface LizardMetrics {
  functions: LizardFunction[];
  avgCcn: number;
  maxCcn: number;
  totalFunctions: number;
}

/**
 * Pattern evaluation analyzer.
 */
@registerAnalyzer('architecture:patterns')
export class PatternEvaluationAnalyzer extends BaseAnalyzer {
  private lizardCache: Map<string, LizardMetrics> = new Map();

  /** Design patterns */
  private designPatterns: Record<string, PatternInfo> = {
    singleton: {
      indicators: [
        /__instance\s*=\s*None/,
        /private\s+static\s+\w+\s+instance/i,
        /getInstance\(\)/,
      ],
      severity: 'medium',
      description: 'Singleton pattern detected',
    },
    factory: {
      indicators: [
        /def\s+create_\w+\(/,
        /class\s+\w*Factory\w*/i,
        /function\s+create\w+\(/,
      ],
      severity: 'low',
      description: 'Factory pattern detected',
    },
    observer: {
      indicators: [
        /def\s+notify\(/,
        /def\s+subscribe\(/,
        /addEventListener\(/,
        /class\s+\w*Observer\w*/i,
      ],
      severity: 'low',
      description: 'Observer pattern detected',
    },
    strategy: {
      indicators: [
        /def\s+execute\(/,
        /class\s+\w*Strategy\w*/i,
        /interface\s+\w*Strategy\w*/i,
      ],
      severity: 'low',
      description: 'Strategy pattern detected',
    },
    decorator: {
      indicators: [
        /@\w+\s*\n\s*(?:def|class)\s+/,
        /class\s+\w*Decorator\w*/i,
      ],
      severity: 'low',
      description: 'Decorator pattern detected',
    },
  };

  /** Anti-patterns */
  private antiPatterns: Record<string, PatternInfo> = {
    god_class: {
      indicators: [
        /class\s+\w+.*:/,
      ],
      severity: 'high',
      description: 'God Class anti-pattern detected - overly large class',
    },
    feature_envy: {
      indicators: [
        /\w+_\w+\.\w+_\w+\.\w+_\w+\.\w+/,
        /other\w*\.\w+\.\w+\.\w+/,
      ],
      severity: 'medium',
      description: 'Feature Envy anti-pattern - excessive coupling to external objects',
    },
    long_parameter_list: {
      indicators: [
        /def\s+\w+\([^)]{80,}\)/,
        /function\s+\w+\([^)]{80,}\)/,
      ],
      severity: 'medium',
      description: 'Long Parameter List anti-pattern detected',
    },
  };

  /** Architectural patterns */
  private architecturalPatterns: Record<string, PatternInfo> = {
    mvc: {
      indicators: [
        /class\s+\w*Controller\w*/i,
        /class\s+\w*Model\w*/i,
        /class\s+\w*View\w*/i,
      ],
      severity: 'low',
      description: 'MVC architectural pattern detected',
    },
    repository: {
      indicators: [
        /class\s+\w*Repository\w*/i,
        /def\s+find_by_\w+\(/,
        /findBy\w+\(/,
      ],
      severity: 'low',
      description: 'Repository pattern detected',
    },
    service: {
      indicators: [
        /class\s+\w*Service\w*/i,
        /@service/i,
      ],
      severity: 'low',
      description: 'Service Layer pattern detected',
    },
    dependency_injection: {
      indicators: [
        /@inject/i,
        /def\s+__init__\(self,.*:\s*\w+\)/,
        /constructor\([^)]*:\s*\w+/,
      ],
      severity: 'low',
      description: 'Dependency Injection pattern detected',
    },
  };

  /** File extension to language mapping */
  private languageMap: Record<string, string> = {
    '.py': 'python',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.java': 'java',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
  };

  /** Config files to skip */
  private configFilePatterns = [
    'tailwind.config', 'next.config', 'webpack.config', 'babel.config',
    'rollup.config', 'vite.config', 'jest.config', 'package.json',
    'tsconfig.json', 'eslint.config', '.eslintrc',
  ];

  constructor(config?: Partial<AnalyzerConfig>) {
    const patternConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cs',
        '.go', '.rs', '.php', '.rb', '.cpp', '.c', '.h',
      ]),
      skipPatterns: new Set([
        'node_modules', '.git', '__pycache__', 'dist', 'build',
        '.next', 'coverage', 'venv', 'env', 'vendor',
        '*.min.js', '*.bundle.js',
      ]),
      ...config,
    });

    super('architecture', patternConfig);
  }

  /**
   * Check if file should be skipped.
   */
  private shouldSkipFile(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    return this.configFilePatterns.some(pattern =>
      fileName.includes(pattern.toLowerCase())
    );
  }

  /**
   * Detect language from file extension.
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return this.languageMap[ext] || 'unknown';
  }

  /**
   * Get Lizard complexity metrics.
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
      const seenFunctions = new Set<string>();

      for (const line of result.split('\n')) {
        if (!line.trim() || line.startsWith('=') || line.startsWith('NLOC')) {
          continue;
        }

        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4 && /^\d+$/.test(parts[0])) {
          const nloc = parseInt(parts[0], 10);
          const ccn = parseInt(parts[1], 10);
          const funcName = parts[3] || 'unknown';

          if (funcName === 'unknown' || nloc <= 1) {
            continue;
          }

          const funcId = `${funcName}:${ccn}:${nloc}`;
          if (seenFunctions.has(funcId)) {
            continue;
          }
          seenFunctions.add(funcId);

          metrics.functions.push({ name: funcName, ccn, nloc });
          metrics.maxCcn = Math.max(metrics.maxCcn, ccn);
          metrics.totalFunctions++;
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
   * Check for patterns in content.
   */
  private checkPatterns(
    content: string,
    lines: string[],
    filePath: string,
    patterns: Record<string, PatternInfo>,
    patternType: string,
    language: string
  ): RawFinding[] {
    const findings: RawFinding[] = [];

    // Skip large files
    if (content.length > 10000) {
      return findings;
    }

    for (const [patternName, patternInfo] of Object.entries(patterns)) {
      for (const indicator of patternInfo.indicators) {
        try {
          const regex = new RegExp(indicator.source, indicator.flags + (indicator.flags.includes('g') ? '' : 'gm'));
          const matches = [...content.matchAll(regex)].slice(0, 5);

          for (const match of matches) {
            const lineNum = content.substring(0, match.index || 0).split('\n').length;
            const contextLine = lines[lineNum - 1]?.trim() || '';

            findings.push(createStandardFinding(
              `${patternType} Pattern: ${patternName.replace(/_/g, ' ')}`,
              patternInfo.description,
              patternInfo.severity,
              filePath,
              lineNum,
              this.getRecommendation(`${patternType}_${patternName}`),
              {
                tool: 'pattern-analyzer',
                patternType,
                patternName,
                language,
                context: contextLine.substring(0, 150),
              }
            ));
          }
        } catch {
          // Skip invalid regex
        }
      }
    }

    return findings;
  }

  /**
   * Check complexity patterns using Lizard metrics.
   */
  private checkComplexityPatterns(
    filePath: string,
    language: string
  ): RawFinding[] {
    const findings: RawFinding[] = [];
    const metrics = this.getLizardMetrics(filePath);

    // God class detection
    if (metrics.totalFunctions > 20 && metrics.avgCcn > 10) {
      findings.push(createStandardFinding(
        'God Class Anti-pattern',
        `Class has ${metrics.totalFunctions} functions with average complexity ${metrics.avgCcn.toFixed(1)}`,
        'high',
        filePath,
        1,
        'Break down into smaller, focused classes with single responsibilities.',
        {
          tool: 'pattern-analyzer',
          complexityType: 'god_class',
          functionCount: metrics.totalFunctions,
          avgCcn: metrics.avgCcn,
          language,
        }
      ));
    }

    // Complex functions
    for (const func of metrics.functions) {
      if (func.ccn > 15) {
        findings.push(createStandardFinding(
          `Complex Function: ${func.name}`,
          `Function '${func.name}' has cyclomatic complexity of ${func.ccn} (recommended: <15)`,
          func.ccn < 25 ? 'medium' : 'high',
          filePath,
          1,
          'Break function into smaller, focused functions with single responsibilities.',
          {
            tool: 'pattern-analyzer',
            complexityType: 'high_ccn',
            functionName: func.name,
            ccn: func.ccn,
            nloc: func.nloc,
            language,
          }
        ));
      }

      if (func.nloc > 50) {
        findings.push(createStandardFinding(
          `Long Function: ${func.name}`,
          `Function '${func.name}' has ${func.nloc} lines (recommended: <50)`,
          'medium',
          filePath,
          1,
          'Break function into smaller, focused functions.',
          {
            tool: 'pattern-analyzer',
            complexityType: 'long_function',
            functionName: func.name,
            nloc: func.nloc,
            language,
          }
        ));
      }
    }

    return findings;
  }

  /**
   * Get recommendation for pattern.
   */
  private getRecommendation(pattern: string): string {
    const recommendations: Record<string, string> = {
      'design_singleton': 'Consider dependency injection instead of singleton pattern for better testability',
      'design_factory': 'Good use of factory pattern for object creation flexibility',
      'design_observer': 'Consider using event-driven architecture for loose coupling',
      'design_strategy': 'Good separation of algorithms - ensure strategies are interchangeable',
      'design_decorator': 'Consider composition over inheritance for better flexibility',
      'anti_god_class': 'Break down into smaller, focused classes with single responsibilities',
      'anti_feature_envy': 'Move functionality closer to the data it uses to improve cohesion',
      'anti_long_parameter_list': 'Use parameter objects, builder pattern, or configuration classes',
      'architectural_mvc': 'Good separation of concerns with MVC pattern',
      'architectural_repository': 'Good data access abstraction - ensure proper encapsulation',
      'architectural_service': 'Consider domain-driven design principles for service boundaries',
      'architectural_dependency_injection': 'Good use of inversion of control principle',
    };

    return recommendations[pattern] || 'Review pattern usage and consider refactoring for better design';
  }

  /**
   * Deduplicate findings.
   */
  private deduplicateFindings(findings: RawFinding[]): RawFinding[] {
    const seen = new Set<string>();
    const unique: RawFinding[] = [];

    for (const finding of findings) {
      const key = `${finding.filePath}:${finding.lineNumber}:${finding.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(finding);
      }
    }

    return unique;
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    try {
      if (this.shouldSkipFile(targetPath)) {
        return findings;
      }

      const content = fs.readFileSync(targetPath, 'utf-8');
      const lines = content.split('\n');

      // Skip very large files
      if (content.length > 50000 || lines.length > 1000) {
        return findings;
      }

      const language = this.detectLanguage(targetPath);

      // Check design patterns
      findings.push(...this.checkPatterns(
        content, lines, targetPath, this.designPatterns, 'Design', language
      ));

      // Check anti-patterns
      findings.push(...this.checkPatterns(
        content, lines, targetPath, this.antiPatterns, 'Anti', language
      ));

      // Check architectural patterns
      findings.push(...this.checkPatterns(
        content, lines, targetPath, this.architecturalPatterns, 'Architectural', language
      ));

      // Check complexity patterns
      findings.push(...this.checkComplexityPatterns(targetPath, language));

    } catch (err) {
      this.log('analysis_error', { file: targetPath, error: String(err) });
    }

    return this.deduplicateFindings(findings);
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Pattern Evaluation Analyzer',
      version: '1.0.0',
      description: 'Analyzes design patterns and architectural decisions',
      category: 'architecture',
      priority: 'high',
      capabilities: [
        'Design pattern detection (Singleton, Factory, Observer)',
        'Anti-pattern identification (God Class, Feature Envy)',
        'Architectural pattern analysis (MVC, Repository, Service)',
        'Code complexity analysis via Lizard',
        'Multi-language pattern recognition',
      ],
      supportedLanguages: Object.values(this.languageMap),
      tool: 'pattern-analyzer',
    };
  }
}
