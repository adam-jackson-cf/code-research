/**
 * Error Pattern Analyzer - Root Cause Analysis Through Pattern Detection.
 *
 * Analyzes code for known error patterns and failure modes to assist with root cause analysis.
 * Detects memory leaks, null pointers, race conditions, injection vulnerabilities, etc.
 */

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

interface ErrorPattern {
  patterns: string[];
  severity: string;
  category: string;
  description: string;
}

interface ErrorContext {
  errorType: string;
  message: string;
  file: string | null;
  line: number | null;
  stackFiles: string[];
}

/**
 * Error pattern analyzer for root cause analysis.
 */
@registerAnalyzer('root_cause:error_patterns')
export class ErrorPatternAnalyzer extends BaseAnalyzer {
  private errorInfo: string;

  /** Error keywords to search for */
  private errorKeywords = [
    'error', 'exception', 'fail', 'crash', 'bug', 'issue',
    'problem', 'todo', 'fixme', 'hack', 'workaround', 'temporary',
  ];

  /** Error patterns */
  private errorPatterns: Record<string, ErrorPattern> = {
    null_pointer: {
      patterns: [
        'null\\.\\w+',
        'undefined\\.\\w+',
        'TypeError.*null',
        'TypeError.*undefined',
        'NullPointerException',
        '\\.\\?\\.',
      ],
      severity: 'high',
      category: 'null_pointer',
      description: 'Potential null/undefined access pattern',
    },
    memory_leak: {
      patterns: [
        'setInterval.*(?!clearInterval)',
        'addEventListener.*(?!removeEventListener)',
        'new.*(?!delete|free|dispose)',
        'malloc.*(?!free)',
      ],
      severity: 'high',
      category: 'memory_leak',
      description: 'Potential memory leak from uncleaned resources',
    },
    race_condition: {
      patterns: [
        'async.*await.*\\bthis\\.',
        'setTimeout.*this\\.',
        '\\bPromise\\b.*\\bthis\\.',
        'global\\s+\\w+',
        'shared.*state',
      ],
      severity: 'high',
      category: 'race_condition',
      description: 'Potential race condition with shared state',
    },
    injection_vulnerability: {
      patterns: [
        'eval\\(',
        'exec\\(',
        'innerHTML\\s*=',
        'outerHTML\\s*=',
        '\\$\\{.*\\}.*(?:sql|query|cmd)',
        'dangerouslySetInnerHTML',
      ],
      severity: 'critical',
      category: 'injection_vulnerability',
      description: 'Potential injection vulnerability',
    },
    poor_error_handling: {
      patterns: [
        'catch\\s*\\{\\s*\\}',
        'catch.*\\{[^}]{0,10}\\}',
        'except:\\s*pass',
        '\\.catch\\(\\(\\)\\s*=>\\s*\\{\\}\\)',
        'catch.*console\\.log',
      ],
      severity: 'medium',
      category: 'poor_error_handling',
      description: 'Inadequate error handling pattern',
    },
    performance_issue: {
      patterns: [
        'for.*for.*for',
        'while.*while',
        '\\.forEach.*\\.forEach',
        'O\\(n\\^[23]\\)',
        'nested.*loop',
      ],
      severity: 'medium',
      category: 'performance_issue',
      description: 'Potential performance bottleneck',
    },
    state_mutation: {
      patterns: [
        '\\bthis\\.state\\.\\w+\\s*=',
        'Object\\.assign\\(this\\.state',
        '\\.push\\(.*\\)',
        '\\.splice\\(',
        'delete\\s+\\w+\\.',
      ],
      severity: 'medium',
      category: 'state_mutation',
      description: 'Direct state mutation pattern',
    },
    auth_bypass: {
      patterns: [
        'isAdmin\\s*=\\s*true',
        'authenticated\\s*=\\s*true',
        'bypass.*auth',
        'skip.*auth',
        'disable.*auth',
      ],
      severity: 'critical',
      category: 'auth_bypass',
      description: 'Potential authentication bypass',
    },
    data_corruption: {
      patterns: [
        'parseInt\\([^,]+\\)',
        'JSON\\.parse\\([^)]+\\)',
        'parseFloat\\([^,]+\\)',
        'Number\\([^)]+\\)',
      ],
      severity: 'medium',
      category: 'data_corruption',
      description: 'Data parsing without validation',
    },
  };

  /** Error type to pattern mapping */
  private errorTypeMap: Record<string, string[]> = {
    TypeError: ['null_pointer', 'state_mutation'],
    ReferenceError: ['null_pointer'],
    SyntaxError: ['data_corruption'],
    RangeError: ['data_corruption', 'performance_issue'],
    SecurityError: ['auth_bypass', 'injection_vulnerability'],
    unknown: ['null_pointer', 'poor_error_handling', 'state_mutation'],
  };

  constructor(config?: Partial<AnalyzerConfig>, errorInfo = '') {
    const errorConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.go',
        '.rs', '.php', '.rb', '.cpp', '.c', '.cs',
      ]),
      skipPatterns: new Set([
        'node_modules', '.git', '__pycache__', 'dist', 'build',
        '.next', 'coverage', 'venv', 'env', 'vendor',
        '*.min.js', '*.bundle.js', '*.test.*', '*/tests/*',
      ]),
      ...config,
    });

    super('root_cause', errorConfig);
    this.errorInfo = errorInfo;
  }

  /**
   * Set error info for targeted analysis.
   */
  setErrorInfo(errorInfo: string): void {
    this.errorInfo = errorInfo;
  }

  /**
   * Parse error information to extract context.
   */
  private parseError(errorInfo: string): ErrorContext {
    const context: ErrorContext = {
      errorType: 'unknown',
      message: errorInfo,
      file: null,
      line: null,
      stackFiles: [],
    };

    if (!errorInfo) return context;

    // JavaScript/TypeScript error pattern
    const jsMatch = errorInfo.match(/(\w+Error): (.+?) at (.+?):(\d+)/);
    if (jsMatch) {
      context.errorType = jsMatch[1];
      context.message = jsMatch[2];
      context.file = jsMatch[3];
      context.line = parseInt(jsMatch[4], 10);
    }

    // Python error pattern
    const pyMatch = errorInfo.match(/File "(.+?)", line (\d+).+\n\s*(.+)/m);
    if (pyMatch) {
      context.file = pyMatch[1];
      context.line = parseInt(pyMatch[2], 10);
      context.message = pyMatch[3];
    }

    // General file:line pattern
    const generalMatch = errorInfo.match(/([a-zA-Z_./\\]+\.\w+):?(\d+)?/);
    if (generalMatch && !context.file) {
      context.file = generalMatch[1];
      if (generalMatch[2]) {
        context.line = parseInt(generalMatch[2], 10);
      }
    }

    // Extract error type from message
    if (context.errorType === 'unknown') {
      const typePatterns = ['TypeError', 'ReferenceError', 'SyntaxError', 'Error', 'Exception'];
      for (const errorType of typePatterns) {
        if (errorInfo.toLowerCase().includes(errorType.toLowerCase())) {
          context.errorType = errorType;
          break;
        }
      }
    }

    return context;
  }

  /**
   * Get patterns relevant to an error type.
   */
  private getPatternsForErrorType(errorType: string): string[] {
    let patterns = this.errorTypeMap[errorType];
    if (!patterns) {
      patterns = this.errorTypeMap[errorType.toLowerCase()];
    }
    if (!patterns) {
      patterns = this.errorTypeMap.unknown;
    }
    return patterns || Object.keys(this.errorPatterns);
  }

  /**
   * Get recommendation for pattern.
   */
  private getRecommendation(patternName: string, errorContext: ErrorContext): string {
    const recommendations: Record<string, string> = {
      null_pointer: 'Add null/undefined checks before accessing object properties',
      memory_leak: 'Ensure proper cleanup of resources and event listeners',
      race_condition: 'Add proper synchronization or use async/await correctly',
      injection_vulnerability: 'Sanitize and validate all user input',
      poor_error_handling: 'Implement proper error handling and logging',
      performance_issue: 'Optimize algorithms and reduce nested iterations',
      state_mutation: 'Use immutable updates or proper state management patterns',
      auth_bypass: 'Implement proper authentication and authorization checks',
      data_corruption: 'Add input validation and bounds checking for data operations',
    };

    let rec = recommendations[patternName] || 'Review and fix the identified issue';

    if (errorContext.line) {
      rec += `. Focus on line ${errorContext.line} and surrounding code.`;
    } else if (errorContext.file) {
      rec += `. Pay special attention to this file as it's mentioned in the error.`;
    }

    return rec;
  }

  /**
   * Check for targeted error patterns.
   */
  private checkTargetedPatterns(
    content: string,
    lines: string[],
    filePath: string,
    relevantPatterns: string[],
    errorContext: ErrorContext
  ): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const patternName of relevantPatterns) {
      const patternInfo = this.errorPatterns[patternName];
      if (!patternInfo) continue;

      for (const regexPattern of patternInfo.patterns) {
        try {
          const regex = new RegExp(regexPattern, 'gim');
          let match;

          while ((match = regex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            const contextLine = lines[lineNum - 1]?.trim() || '';

            // Calculate proximity weight
            let proximityWeight = 'medium';
            if (errorContext.line) {
              const distance = Math.abs(lineNum - errorContext.line);
              if (distance <= 3) proximityWeight = 'high';
              else if (distance <= 10) proximityWeight = 'medium';
              else proximityWeight = 'low';
            }

            findings.push(createStandardFinding(
              `Error Pattern: ${patternName.replace(/_/g, ' ')}`,
              `${patternInfo.description} - Pattern: ${patternName}`,
              patternInfo.severity,
              filePath,
              lineNum,
              this.getRecommendation(patternName, errorContext),
              {
                tool: 'error-pattern-analyzer',
                errorCategory: patternInfo.category,
                patternName,
                matchedText: match[0].substring(0, 100),
                context: contextLine.substring(0, 150),
                proximityToError: proximityWeight,
                investigatedError: this.errorInfo,
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
   * Check for error keywords around error line.
   */
  private checkErrorKeywordsTargeted(
    lines: string[],
    filePath: string,
    errorLine: number
  ): RawFinding[] {
    const findings: RawFinding[] = [];

    const startLine = Math.max(0, errorLine - 6);
    const endLine = Math.min(lines.length, errorLine + 5);

    for (let i = startLine; i < endLine; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();

      for (const keyword of this.errorKeywords) {
        if (lineLower.includes(keyword)) {
          const wordBoundary = new RegExp(`\\b${keyword}\\b`, 'i');
          if (wordBoundary.test(line)) {
            findings.push(createStandardFinding(
              `Error Keyword Found: ${keyword.toUpperCase()}`,
              `Found error-related keyword '${keyword}' near error location`,
              'medium',
              filePath,
              i + 1,
              `Review context around '${keyword}' for debugging clues`,
              {
                tool: 'error-pattern-analyzer',
                keyword,
                context: line.trim().substring(0, 150),
                distanceFromError: Math.abs(i + 1 - errorLine),
              }
            ));
          }
        }
      }
    }

    return findings;
  }

  /**
   * Check for error keywords in comments.
   */
  private checkErrorKeywords(lines: string[], filePath: string): RawFinding[] {
    const findings: RawFinding[] = [];
    const commentPatterns = [
      /\/\/.*/,
      /#.*/,
      /\/\*.*?\*\//s,
      /<!--.*?-->/s,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();

      const isComment = commentPatterns.some(pattern => pattern.test(line));

      if (isComment) {
        for (const keyword of this.errorKeywords) {
          if (lineLower.includes(keyword)) {
            findings.push(createStandardFinding(
              `Error Keyword Found: ${keyword.toUpperCase()}`,
              `Error-related keyword '${keyword}' found in comment, may indicate debugging context`,
              'low',
              filePath,
              i + 1,
              `Review comment containing '${keyword}' for potential issues or technical debt`,
              {
                tool: 'error-pattern-analyzer',
                errorCategory: 'error_keyword',
                keyword,
                context: line.trim().substring(0, 150),
              }
            ));
          }
        }
      }
    }

    return findings;
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    // Error info is required for targeted analysis
    if (!this.errorInfo) {
      return [createStandardFinding(
        'Error Information Required',
        'Root cause analysis requires an error message or issue to investigate. Please provide: error message, stack trace, or specific issue description.',
        'critical',
        targetPath,
        0,
        'Call setErrorInfo() or pass errorInfo to constructor before analysis.',
        {
          tool: 'error-pattern-analyzer',
          errorType: 'missing_error_context',
        }
      )];
    }

    const findings: RawFinding[] = [];
    const errorContext = this.parseError(this.errorInfo);

    // Check if file is related to error
    const normalizedTarget = targetPath.replace(/\\/g, '/');
    if (errorContext.file) {
      const errorFile = errorContext.file.replace(/\\/g, '/');
      if (!normalizedTarget.includes(errorFile) &&
          !errorFile.split('/').some(part => normalizedTarget.includes(part))) {
        return []; // Skip unrelated files
      }
    }

    try {
      const content = fs.readFileSync(targetPath, 'utf-8');
      const lines = content.split('\n');

      // Get relevant patterns for this error type
      const relevantPatterns = this.getPatternsForErrorType(errorContext.errorType);

      // Check targeted patterns
      findings.push(...this.checkTargetedPatterns(
        content, lines, targetPath, relevantPatterns, errorContext
      ));

      // Check error keywords
      if (errorContext.line) {
        findings.push(...this.checkErrorKeywordsTargeted(
          lines, targetPath, errorContext.line
        ));
      } else {
        findings.push(...this.checkErrorKeywords(lines, targetPath));
      }

      // Add error context to all findings
      for (const finding of findings) {
        finding.metadata = {
          ...finding.metadata,
          investigatedError: this.errorInfo,
          errorContext,
        };
      }

    } catch (err) {
      this.log('analysis_error', { file: targetPath, error: String(err) });
    }

    return findings;
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Error Pattern Analyzer',
      version: '1.0.0',
      description: 'Analyzes code for known error patterns to assist with root cause analysis',
      category: 'root_cause',
      priority: 'high',
      capabilities: [
        'Memory leak pattern detection',
        'Null pointer/undefined access detection',
        'Race condition and concurrency issue detection',
        'Security vulnerability pattern matching',
        'Error handling anti-pattern identification',
        'Performance bottleneck pattern recognition',
        'State management issue detection',
        'Error keyword analysis in comments',
      ],
      supportedLanguages: ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust'],
      tool: 'error-pattern-analyzer',
    };
  }
}
