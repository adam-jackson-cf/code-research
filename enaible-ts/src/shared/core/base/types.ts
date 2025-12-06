/**
 * Core types for the analyzer infrastructure.
 */

/**
 * Configuration for analyzers.
 */
export interface AnalyzerConfig {
  /** Target path to analyze */
  targetPath: string;
  /** Output format: json, console, or summary */
  outputFormat: 'json' | 'console' | 'summary';
  /** Minimum severity to report */
  minSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Summary mode - only output summary */
  summaryMode: boolean;
  /** File extensions to analyze */
  codeExtensions: Set<string>;
  /** Patterns to skip (directory names) */
  skipPatterns: Set<string>;
  /** Gitignore patterns */
  gitignorePatterns: string[];
  /** Glob patterns to exclude */
  excludeGlobs: Set<string>;
  /** Maximum number of files to analyze */
  maxFiles: number | null;
  /** Maximum file size in MB */
  maxFileSizeMb: number;
  /** Batch size for processing */
  batchSize: number;
  /** Timeout in seconds */
  timeoutSeconds: number | null;
  /** Severity thresholds */
  severityThresholds: Record<string, number>;
}

/**
 * Standard finding structure.
 */
export interface Finding {
  /** Unique finding ID */
  findingId: string;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Path to the affected file */
  filePath: string;
  /** Line number where issue occurs */
  lineNumber: number;
  /** Recommended action */
  recommendation: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Raw finding data before standardization.
 */
export interface RawFinding {
  title: string;
  description: string;
  severity: string;
  filePath: string;
  lineNumber: number;
  recommendation: string;
  metadata?: Record<string, unknown>;
}

/**
 * Analysis result with findings and metadata.
 */
export interface AnalysisResult {
  /** Analysis name/type */
  name: string;
  /** Whether analysis was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** List of findings */
  findings: Finding[];
  /** Analysis metadata */
  metadata: Record<string, unknown>;
  /** Timing information */
  timing: {
    startTime: number;
    endTime?: number;
    durationMs?: number;
  };
}

/**
 * Analyzer metadata describing capabilities.
 */
export interface AnalyzerMetadata {
  /** Analyzer name */
  name: string;
  /** Version */
  version: string;
  /** Description */
  description: string;
  /** Category (security, quality, performance, architecture, root-cause) */
  category: string;
  /** Priority level */
  priority?: string;
  /** List of capabilities */
  capabilities: string[];
  /** Supported languages */
  supportedLanguages?: string[];
  /** External tool used */
  tool?: string;
  /** Analyzers this replaces */
  replaces?: string[];
}

/**
 * Severity breakdown statistics.
 */
export interface SeverityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

/**
 * Default analyzer configuration.
 */
export function createDefaultConfig(overrides?: Partial<AnalyzerConfig>): AnalyzerConfig {
  return {
    targetPath: '.',
    outputFormat: 'json',
    minSeverity: 'high',
    summaryMode: false,
    codeExtensions: new Set([
      '.py', '.js', '.ts', '.java', '.cs', '.php', '.rb', '.go', '.sql',
      '.prisma', '.kt', '.scala', '.cpp', '.c', '.h', '.hpp', '.swift',
      '.rs', '.dart', '.vue', '.jsx', '.tsx', '.xml', '.json', '.yml', '.yaml',
    ]),
    skipPatterns: new Set([
      'node_modules', '.git', '__pycache__', '.pytest_cache', 'venv', 'env',
      '.venv', 'dist', 'build', '.next', 'coverage', '.nyc_output', 'target',
      'vendor', 'migrations', '.cache', '.tmp', 'temp', 'logs', 'bin', 'obj',
      'Debug', 'Release',
    ]),
    gitignorePatterns: [],
    excludeGlobs: new Set(),
    maxFiles: null,
    maxFileSizeMb: 5,
    batchSize: 200,
    timeoutSeconds: null,
    severityThresholds: {
      critical: 0.9,
      high: 0.7,
      medium: 0.5,
      low: 0.3,
    },
    ...overrides,
  };
}
