/**
 * BaseAnalyzer - Shared Infrastructure for Analysis Tools.
 *
 * Abstract base class providing common functionality for all analysis tools.
 * Eliminates duplication across analyzer implementations.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import {
  AnalyzerConfig,
  AnalysisResult,
  Finding,
  RawFinding,
  AnalyzerMetadata,
  SeverityBreakdown,
  createDefaultConfig,
} from './types.js';

/**
 * Abstract base class for all analysis tools.
 */
export abstract class BaseAnalyzer {
  protected analyzerType: string;
  protected config: AnalyzerConfig;
  protected analysisRoot: string;

  // Analysis tracking
  protected filesProcessed = 0;
  protected filesSkipped = 0;
  protected processingErrors = 0;

  // Result tracking
  protected currentResult: AnalysisResult | null = null;

  constructor(analyzerType: string, config?: Partial<AnalyzerConfig>) {
    this.analyzerType = analyzerType;
    this.config = createDefaultConfig(config);
    this.analysisRoot = this.determineAnalysisRoot(this.config.targetPath);

    this.log('analyzer_initialized', {
      type: analyzerType,
      maxFiles: this.config.maxFiles,
      extensions: this.config.codeExtensions.size,
    });
  }

  /**
   * Implement specific analysis logic for the target path.
   * @param targetPath - Path to analyze
   * @returns List of analysis findings
   */
  abstract analyzeTarget(targetPath: string): Promise<RawFinding[]>;

  /**
   * Get analyzer-specific metadata for results.
   */
  abstract getAnalyzerMetadata(): AnalyzerMetadata;

  /**
   * Check if file should be scanned based on configuration.
   */
  shouldScanFile(filePath: string): boolean {
    const parsed = path.parse(filePath);
    const parts = filePath.split(path.sep);

    // Check skip patterns
    for (const skipPattern of this.config.skipPatterns) {
      if (parts.includes(skipPattern)) {
        return false;
      }
    }

    // Check exclude globs
    for (const pattern of this.config.excludeGlobs) {
      if (this.matchGlob(filePath, pattern)) {
        this.log('file_skipped_pattern', { file: filePath, pattern });
        return false;
      }
    }

    // Skip common build/cache directories
    const skipPathPatterns = [
      '.angular', '.next', '.nuxt', '.cache', '.tmp', 'tmp', 'cache',
      'generated', '__generated__', 'auto', 'node_modules/.cache',
    ];

    for (const skipPattern of skipPathPatterns) {
      if (filePath.toLowerCase().includes(skipPattern)) {
        this.log('file_skipped_pattern', { file: filePath, pattern: skipPattern });
        return false;
      }
    }

    // Check file extension
    const ext = parsed.ext.toLowerCase();
    if (!this.config.codeExtensions.has(ext)) {
      return false;
    }

    // Check file size
    try {
      const stats = fs.statSync(filePath);
      const sizeMb = stats.size / (1024 * 1024);
      if (sizeMb > this.config.maxFileSizeMb) {
        this.log('file_skipped_size', { file: filePath, sizeMb: sizeMb.toFixed(2) });
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  /**
   * Simple glob matching.
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexStr = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')
      .replace(/\./g, '\\.');
    return new RegExp(`^${regexStr}$`).test(filePath);
  }

  /**
   * Determine the root directory for analysis.
   */
  private determineAnalysisRoot(targetPath: string): string {
    try {
      const resolved = path.resolve(targetPath);
      const stats = fs.statSync(resolved);
      if (stats.isDirectory()) {
        return resolved;
      }
      if (stats.isFile()) {
        return path.dirname(resolved);
      }
    } catch {
      // Path doesn't exist
    }
    return process.cwd();
  }

  /**
   * Scan directory for files matching analyzer criteria.
   */
  async scanDirectory(targetPath: string): Promise<string[]> {
    const target = path.resolve(targetPath);
    const filesToScan: string[] = [];

    try {
      const stats = fs.statSync(target);

      if (stats.isFile()) {
        if (this.shouldScanFile(target)) {
          filesToScan.push(target);
        }
      } else if (stats.isDirectory()) {
        // Use glob to find all files
        const pattern = path.join(target, '**/*');
        const files = await glob(pattern, {
          nodir: true,
          absolute: true,
          ignore: Array.from(this.config.skipPatterns).map(p => `**/${p}/**`),
        });

        for (const file of files) {
          if (this.config.maxFiles !== null && filesToScan.length >= this.config.maxFiles) {
            this.log('max_files_reached', { limit: this.config.maxFiles });
            break;
          }

          if (this.shouldScanFile(file)) {
            filesToScan.push(file);
          }
        }
      }
    } catch (err) {
      this.log('scan_error', { target: targetPath, error: String(err) });
    }

    this.log('directory_scanned', { target: targetPath, filesFound: filesToScan.length });
    return filesToScan;
  }

  /**
   * Process files in batches for memory efficiency.
   */
  async processFilesBatch(files: string[]): Promise<RawFinding[]> {
    const allFindings: RawFinding[] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchFindings = await this.processBatch(batch);
      allFindings.push(...batchFindings);

      this.log('batch_processed', {
        batchNumber: Math.floor(i / batchSize) + 1,
        filesInBatch: batch.length,
        findings: batchFindings.length,
      });
    }

    return allFindings;
  }

  /**
   * Process a single batch of files.
   */
  protected async processBatch(batch: string[]): Promise<RawFinding[]> {
    const batchFindings: RawFinding[] = [];

    for (const filePath of batch) {
      try {
        const fileFindings = await this.analyzeTarget(filePath);
        batchFindings.push(...fileFindings);
        this.filesProcessed++;
      } catch (err) {
        this.processingErrors++;
        this.log('file_error', { file: filePath, error: String(err) });
      }
    }

    return batchFindings;
  }

  /**
   * Start analysis timing.
   */
  protected startAnalysis(): void {
    this.currentResult = {
      name: this.analyzerType,
      success: true,
      findings: [],
      metadata: {},
      timing: {
        startTime: Date.now(),
      },
    };
  }

  /**
   * Create a standardized finding.
   */
  protected createFinding(raw: RawFinding, index: number): Finding {
    return {
      findingId: `${this.analyzerType.toUpperCase()}${String(index).padStart(3, '0')}`,
      title: raw.title,
      description: raw.description,
      severity: this.normalizeSeverity(raw.severity),
      filePath: raw.filePath,
      lineNumber: raw.lineNumber,
      recommendation: raw.recommendation,
      metadata: raw.metadata ?? {},
    };
  }

  /**
   * Normalize severity string.
   */
  private normalizeSeverity(severity: string): Finding['severity'] {
    const normalized = severity.toLowerCase();
    if (['critical', 'high', 'medium', 'low', 'info'].includes(normalized)) {
      return normalized as Finding['severity'];
    }
    return 'medium';
  }

  /**
   * Complete analysis and return result.
   */
  protected completeAnalysis(): AnalysisResult {
    if (!this.currentResult) {
      throw new Error('Analysis not started');
    }

    this.currentResult.timing.endTime = Date.now();
    this.currentResult.timing.durationMs =
      this.currentResult.timing.endTime - this.currentResult.timing.startTime;

    return this.currentResult;
  }

  /**
   * Run main analysis entry point.
   */
  async analyze(targetPath?: string): Promise<AnalysisResult> {
    this.startAnalysis();

    const analyzePath = targetPath ?? this.config.targetPath;

    try {
      // Scan for files to analyze
      const filesToAnalyze = await this.scanDirectory(analyzePath);

      if (filesToAnalyze.length === 0) {
        this.currentResult!.metadata.info = 'No files found matching analyzer criteria';
        return this.completeAnalysis();
      }

      // Process files in batches
      const allFindings = await this.processFilesBatch(filesToAnalyze);

      // Convert findings to standardized format
      this.currentResult!.findings = allFindings.map((f, i) => this.createFinding(f, i + 1));

      // Add metadata
      this.addMetadataToResult(analyzePath, filesToAnalyze, allFindings);

    } catch (err) {
      this.currentResult!.success = false;
      this.currentResult!.error = `${this.analyzerType} analysis failed: ${err}`;
      this.log('analysis_failed', { error: String(err) });
    }

    return this.completeAnalysis();
  }

  /**
   * Add metadata to result.
   */
  private addMetadataToResult(
    targetPath: string,
    files: string[],
    findings: RawFinding[]
  ): void {
    const analyzerMetadata = this.getAnalyzerMetadata();

    this.currentResult!.metadata = {
      analyzerType: this.analyzerType,
      targetPath,
      filesAnalyzed: files.length,
      filesProcessed: this.filesProcessed,
      filesSkipped: this.filesSkipped,
      processingErrors: this.processingErrors,
      totalFindings: findings.length,
      severityBreakdown: this.calculateSeverityBreakdown(findings),
      analyzerConfig: {
        maxFiles: this.config.maxFiles,
        maxFileSizeMb: this.config.maxFileSizeMb,
        extensionsCount: this.config.codeExtensions.size,
        skipPatternsCount: this.config.skipPatterns.size,
      },
      ...analyzerMetadata,
    };
  }

  /**
   * Calculate breakdown of findings by severity.
   */
  private calculateSeverityBreakdown(findings: RawFinding[]): SeverityBreakdown {
    const breakdown: SeverityBreakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const finding of findings) {
      const severity = finding.severity.toLowerCase();
      if (severity in breakdown) {
        breakdown[severity as keyof SeverityBreakdown]++;
      }
    }

    return breakdown;
  }

  /**
   * Log an operation for debugging.
   */
  protected log(operation: string, data: Record<string, unknown>): void {
    if (process.env.DEBUG) {
      console.error(`[${this.analyzerType}] ${operation}:`, JSON.stringify(data));
    }
  }
}

/**
 * Create a standard finding with validation.
 */
export function createStandardFinding(
  title: string,
  description: string,
  severity: string,
  filePath: string,
  lineNumber: number,
  recommendation: string,
  metadata?: Record<string, unknown>
): RawFinding {
  // Validate severity
  const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
  if (!validSeverities.includes(severity.toLowerCase())) {
    throw new Error(`Invalid severity '${severity}'. Must be one of: ${validSeverities.join(', ')}`);
  }

  // Validate required fields
  if (!title?.trim()) throw new Error('Title cannot be empty');
  if (!description?.trim()) throw new Error('Description cannot be empty');
  if (!recommendation?.trim()) throw new Error('Recommendation cannot be empty');

  // Check for generic placeholder values
  const genericTitles = ['security finding', 'quality finding', 'performance finding', 'analysis finding'];
  if (genericTitles.includes(title.toLowerCase())) {
    throw new Error(`Generic title '${title}' not allowed. Provide specific finding title.`);
  }

  return {
    title,
    description,
    severity,
    filePath,
    lineNumber,
    recommendation,
    metadata: metadata ?? {},
  };
}
