/**
 * Root Cause Execution Tracer - High-level execution path and dependency analysis.
 *
 * PURPOSE: Analyzes codebase structure to provide investigation pointers for debugging.
 * Part of the shared/analyzers/root_cause suite using BaseAnalyzer infrastructure.
 *
 * APPROACH:
 * - High-level execution pattern analysis
 * - Dependency structure identification
 * - Investigation pointer generation
 * - Error handling coverage assessment
 * - Complexity hotspot identification
 *
 * EXTENDS: BaseAnalyzer for common analyzer infrastructure
 * - Inherits file scanning, CLI, configuration, and result formatting
 * - Implements execution-specific analysis logic in analyzeTarget()
 * - Uses shared timing, logging, and error handling patterns
 */

import * as fs from 'fs';
import { BaseAnalyzer, RawFinding, AnalyzerMetadata, createDefaultConfig, AnalyzerConfig } from '../../core/base/index.js';
import { registerAnalyzer } from '../../core/base/analyzer-registry.js';

interface FileInfo {
  totalLines: number;
  codeLines: number;
  blankLines: number;
  commentLines: number;
  mainFunctions: number;
  classes: number;
  functions: number;
  imports: number;
  tryBlocks: number;
  forLoops: number;
  apiRoutes: number;
  [key: string]: number; // Index signature for dynamic assignment
}

interface ErrorContext {
  errorType: string;
  message: string;
  file: string | null;
  line: number | null;
}

interface InvestigationPointer {
  type: string;
  severity: string;
  description: string;
  investigationFocus: string;
  lineNumber?: number;
  evidence?: Record<string, unknown>;
}

@registerAnalyzer('root_cause:trace_execution')
export class ExecutionTraceAnalyzer extends BaseAnalyzer {
  public errorInfo: string = '';
  private patterns: Record<string, RegExp[]>;

  constructor(config?: AnalyzerConfig) {
    // Create execution-specific configuration
    const traceConfig = createDefaultConfig({
      codeExtensions: new Set([
        '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cs',
        '.cpp', '.c', '.h', '.hpp', '.go', '.rs', '.php',
        '.rb', '.swift', '.kt', '.scala',
      ]),
      skipPatterns: new Set([
        'node_modules', '.git', '__pycache__', '.pytest_cache',
        'build', 'dist', '.next', '.nuxt', 'coverage', 'venv',
        'env', '.env', 'vendor', 'logs', 'target', '.vscode',
        '.idea',
      ]),
      maxFileSizeMb: 0.1, // 100KB limit
      batchSize: 50,
      ...config,
    });

    super('root_cause', traceConfig);

    // Simple patterns for basic component identification
    this.patterns = {
      mainFunctions: [/def main\(/, /if __name__ == ['"]__main__['"]/],
      classes: [/class \w+/g],
      functions: [/def \w+\(/g, /function \w+\(/g, /const \w+ = (?:async )?\(/g],
      imports: [/import \w+/g, /from \w+ import/g, /require\(['"]/g],
      tryBlocks: [/try\s*[:{]/g],
      forLoops: [/for \w+ in/g, /for\s*\(/g],
      apiRoutes: [/@app\.route/g, /app\.(get|post|put|delete)\(/g, /router\.(get|post|put|delete)\(/g],
    };
  }

  /**
   * Set the error information to investigate.
   * This must be called before analyze() for targeted root cause analysis.
   */
  setErrorInfo(errorInfo: string): void {
    this.errorInfo = errorInfo;
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Execution Trace Analyzer',
      version: '2.0.0',
      description: 'Analyzes execution patterns and provides investigation pointers for debugging',
      category: 'root_cause',
      priority: 'medium',
      capabilities: [
        'High-level execution pattern analysis',
        'Dependency structure identification',
        'Investigation pointer generation',
        'Error handling coverage assessment',
        'Complexity hotspot identification',
        'Multi-language pattern recognition',
      ],
      supportedLanguages: Array.from(this.config.codeExtensions),
    };
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    // REQUIRED: Must have error information to investigate
    if (!this.errorInfo) {
      return [{
        title: 'Error Information Required',
        description: 'Root cause analysis requires an error message or issue to investigate. Please provide: error message, stack trace, or specific issue description.',
        severity: 'critical',
        filePath: targetPath,
        lineNumber: 0,
        recommendation: "Run with --error parameter: enaible analyzers run root_cause:trace_execution --error 'your error message here'",
        metadata: {
          errorType: 'missing_error_context',
          confidence: 'high',
        },
      }];
    }

    const allFindings: RawFinding[] = [];

    // Parse the error to understand what we're investigating
    const errorContext = this.parseError(this.errorInfo);

    // Normalize paths for comparison
    const normalizedTarget = targetPath.replace(/\\/g, '/');

    // Skip files not related to the error
    if (errorContext.file) {
      const errorFile = errorContext.file.replace(/\\/g, '/');
      // Allow exact match or if error file is contained in target path
      const isRelated = errorFile.includes(normalizedTarget) ||
        normalizedTarget.includes(errorFile) ||
        errorFile.split('/').some(part => normalizedTarget.includes(part));

      if (!isRelated) {
        return []; // Skip unrelated files
      }
    }

    try {
      const content = fs.readFileSync(targetPath, 'utf-8');

      // Skip very large files (maxFileSizeMb is in MB, content.length is in bytes)
      const maxBytes = (this.config.maxFileSizeMb || 0.1) * 1024 * 1024;
      if (content.length > maxBytes) {
        return allFindings;
      }

      // Analyze file structure with error context
      const fileInfo = this.analyzeFileStructure(content, targetPath);

      // Generate targeted investigation pointers
      const pointers = this.generateTargetedInvestigationPointers(
        fileInfo,
        targetPath,
        errorContext
      );

      // Convert pointers to findings
      for (const pointer of pointers) {
        const severityMap: Record<string, string> = {
          critical: 'critical',
          high: 'high',
          medium: 'medium',
          low: 'low',
          info: 'info',
        };

        const finding: RawFinding = {
          title: pointer.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: pointer.description,
          severity: severityMap[pointer.severity] || 'medium',
          filePath: targetPath,
          lineNumber: pointer.lineNumber || 0,
          recommendation: pointer.investigationFocus,
          metadata: {
            pointerType: pointer.type,
            investigationFocus: pointer.investigationFocus,
            evidence: pointer.evidence || {},
            confidence: 'medium',
          },
        };
        allFindings.push(finding);
      }
    } catch (e) {
      allFindings.push({
        title: 'File Analysis Error',
        description: `Could not analyze file: ${e instanceof Error ? e.message : String(e)}`,
        severity: 'low',
        filePath: targetPath,
        lineNumber: 0,
        recommendation: 'Check file encoding and permissions.',
        metadata: { errorType: 'file_read_error', confidence: 'high' },
      });
    }

    return allFindings;
  }

  private analyzeFileStructure(content: string, _filePath: string): FileInfo {
    const lines = content.split('\n');
    const fileInfo: FileInfo = {
      totalLines: lines.length,
      codeLines: lines.filter(line => line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('//')).length,
      blankLines: lines.filter(line => !line.trim()).length,
      commentLines: lines.filter(line => line.trim().startsWith('#') || line.trim().startsWith('//')).length,
      mainFunctions: 0,
      classes: 0,
      functions: 0,
      imports: 0,
      tryBlocks: 0,
      forLoops: 0,
      apiRoutes: 0,
    };

    // Count patterns in the content
    for (const [patternName, patterns] of Object.entries(this.patterns)) {
      let count = 0;
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        count += matches ? matches.length : 0;
      }
      fileInfo[patternName] = count;
    }

    return fileInfo;
  }

  parseError(errorInfo: string): ErrorContext {
    if (!errorInfo) {
      return { errorType: 'unknown', message: '', file: null, line: null };
    }

    const errorContext: ErrorContext = {
      errorType: 'unknown',
      message: errorInfo,
      file: null,
      line: null,
    };

    // JavaScript/TypeScript error patterns
    const jsErrorPattern = /(\w+Error): (.+?) at (.+?):(\d+)/;
    const jsMatch = errorInfo.match(jsErrorPattern);
    if (jsMatch) {
      errorContext.errorType = jsMatch[1];
      errorContext.message = jsMatch[2];
      errorContext.file = jsMatch[3];
      errorContext.line = parseInt(jsMatch[4], 10);
    }

    // Python error patterns
    const pythonErrorPattern = /File "(.+?)", line (\d+).+\n\s*(.+)/m;
    const pythonMatch = errorInfo.match(pythonErrorPattern);
    if (pythonMatch) {
      errorContext.file = pythonMatch[1];
      errorContext.line = parseInt(pythonMatch[2], 10);
      errorContext.message = pythonMatch[3];
    }

    // General file:line pattern
    const generalPattern = /([a-zA-Z_./\\]+\.\w+):?(\d+)?/;
    const generalMatch = errorInfo.match(generalPattern);
    if (generalMatch && !errorContext.file) {
      errorContext.file = generalMatch[1];
      if (generalMatch[2]) {
        errorContext.line = parseInt(generalMatch[2], 10);
      }
    }

    return errorContext;
  }

  private generateTargetedInvestigationPointers(
    fileInfo: FileInfo,
    _filePath: string,
    errorContext: ErrorContext
  ): InvestigationPointer[] {
    const pointers: InvestigationPointer[] = [];

    // If we have a specific error line, focus analysis around it
    if (errorContext.line) {
      const errorLine = errorContext.line;

      // Check function structure around error line
      if (fileInfo.functions > 0) {
        pointers.push({
          type: 'error_context_analysis',
          severity: 'high',
          description: `Error occurred at line ${errorLine} in file with ${fileInfo.functions} functions`,
          investigationFocus: `Focus investigation on function containing line ${errorLine} and its callers`,
          lineNumber: errorLine,
          evidence: {
            errorLine,
            totalFunctions: fileInfo.functions,
            errorType: errorContext.errorType || 'unknown',
          },
        });
      }
    }

    // Check error handling around the issue
    if (fileInfo.functions > 0 && fileInfo.tryBlocks === 0) {
      pointers.push({
        type: 'missing_error_handling',
        severity: 'high',
        description: `No error handling found in file where ${errorContext.errorType || 'error'} occurred`,
        investigationFocus: 'Add error handling to prevent similar failures',
        evidence: {
          tryBlocks: fileInfo.tryBlocks,
          functions: fileInfo.functions,
          errorType: errorContext.errorType,
        },
      });
    }

    // Check for complexity that might contribute to errors
    if (fileInfo.functions > 10) {
      pointers.push({
        type: 'complex_file_analysis',
        severity: 'medium',
        description: `Error occurred in complex file with ${fileInfo.functions} functions`,
        investigationFocus: 'Review file complexity and consider refactoring to reduce error likelihood',
        evidence: {
          functions: fileInfo.functions,
          classes: fileInfo.classes,
          complexityLevel: fileInfo.functions > 20 ? 'high' : 'medium',
        },
      });
    }

    // Add error context to all pointers
    for (const pointer of pointers) {
      if (!pointer.evidence) {
        pointer.evidence = {};
      }
      pointer.evidence.investigatedError = errorContext;
    }

    return pointers;
  }
}
