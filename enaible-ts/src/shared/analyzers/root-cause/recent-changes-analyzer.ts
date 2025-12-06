/**
 * Recent Changes Analyzer - Root Cause Analysis Through Git History.
 *
 * Analyzes recent code changes using git history to identify potential root causes.
 * Detects risky commits, hotspots, and suspicious timing patterns.
 */

import { spawnSync } from 'child_process';
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

interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: string[];
}

interface RiskCommit {
  commit: CommitInfo;
  risks: string[];
  riskLevel: string;
}

interface TimingIssue {
  commit: CommitInfo;
  timingConcern: string;
  riskLevel: string;
  timeDiffMinutes?: number;
  previousCommit?: string;
}

interface FileHotspot {
  filePath: string;
  changeCount: number;
  changeTypes: string[];
  recentCommits: string[];
  riskLevel: string;
}

interface ErrorContext {
  errorType: string;
  message: string;
  file: string | null;
  line: number | null;
}

interface ChangePattern {
  patterns: string[];
  severity: string;
  description: string;
}

/**
 * Recent changes analyzer for root cause analysis.
 */
@registerAnalyzer('root_cause:recent_changes')
export class RecentChangesAnalyzer extends BaseAnalyzer {
  private daysBack: number;
  private maxCommits: number;
  private errorInfo: string;

  /** Change patterns to look for */
  private changePatterns: Record<string, ChangePattern> = {
    auth_changes: {
      patterns: ['auth', 'login', 'session', 'token', 'permission'],
      severity: 'high',
      description: 'Authentication/authorization changes',
    },
    database_changes: {
      patterns: ['database', 'query', 'sql', 'migration', 'schema'],
      severity: 'high',
      description: 'Database-related changes',
    },
    api_changes: {
      patterns: ['api', 'endpoint', 'route', 'controller', 'handler'],
      severity: 'medium',
      description: 'API endpoint changes',
    },
    config_changes: {
      patterns: ['config', 'settings', 'environment', '\\.env', 'constants'],
      severity: 'medium',
      description: 'Configuration changes',
    },
    dependency_changes: {
      patterns: ['package\\.json', 'requirements\\.txt', 'Gemfile', 'pom\\.xml', 'Cargo\\.toml'],
      severity: 'medium',
      description: 'Dependency changes',
    },
    critical_file_changes: {
      patterns: ['main\\.', 'app\\.', 'index\\.', 'server\\.', '__init__\\.'],
      severity: 'high',
      description: 'Critical application file changes',
    },
  };

  constructor(
    config?: Partial<AnalyzerConfig>,
    daysBack = 30,
    maxCommits = 100,
    errorInfo = ''
  ) {
    const changesConfig = createDefaultConfig({
      codeExtensions: new Set(['.py', '.js', '.ts', '.java', '.go', '.rs']),
      skipPatterns: new Set(),
      ...config,
    });

    super('root_cause', changesConfig);
    this.daysBack = daysBack;
    this.maxCommits = maxCommits;
    this.errorInfo = errorInfo;
  }

  /**
   * Set error info for targeted analysis.
   */
  setErrorInfo(errorInfo: string): void {
    this.errorInfo = errorInfo;
  }

  /**
   * Parse error to extract context.
   */
  private parseError(errorInfo: string): ErrorContext {
    const context: ErrorContext = {
      errorType: 'unknown',
      message: errorInfo,
      file: null,
      line: null,
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
    const pyMatch = errorInfo.match(/File "(.+?)", line (\d+)/m);
    if (pyMatch) {
      context.file = pyMatch[1];
      context.line = parseInt(pyMatch[2], 10);
    }

    // General file:line pattern
    const generalMatch = errorInfo.match(/([a-zA-Z_./\\]+\.\w+):?(\d+)?/);
    if (generalMatch && !context.file) {
      context.file = generalMatch[1];
      if (generalMatch[2]) {
        context.line = parseInt(generalMatch[2], 10);
      }
    }

    return context;
  }

  /**
   * Find git root directory.
   */
  private findGitRoot(startPath: string): string | null {
    let current = path.resolve(startPath);
    while (current !== path.dirname(current)) {
      if (fs.existsSync(path.join(current, '.git'))) {
        return current;
      }
      current = path.dirname(current);
    }
    return null;
  }

  /**
   * Run git command and return output.
   */
  private runGitCommand(args: string[], cwd: string): string | null {
    try {
      const result = spawnSync('git', args, {
        cwd,
        encoding: 'utf-8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return result.status === 0 ? result.stdout : null;
    } catch {
      return null;
    }
  }

  /**
   * Get recent commits.
   */
  private getRecentCommits(repoPath: string): CommitInfo[] {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - this.daysBack);
    const dateStr = sinceDate.toISOString().split('T')[0];

    const output = this.runGitCommand([
      'log',
      '--oneline',
      '--since', dateStr,
      '--pretty=format:%H|%an|%ad|%s',
      '--date=iso',
      `--max-count=${this.maxCommits}`,
    ], repoPath);

    if (!output) return [];

    const commits: CommitInfo[] = [];
    for (const line of output.trim().split('\n')) {
      if (!line.includes('|')) continue;

      const parts = line.split('|', 4);
      if (parts.length >= 4) {
        const commitHash = parts[0];
        const commit: CommitInfo = {
          hash: commitHash,
          author: parts[1],
          date: parts[2],
          message: parts[3],
          filesChanged: [],
        };

        // Get files changed
        const filesOutput = this.runGitCommand([
          'show', '--name-only', '--pretty=format:', commitHash,
        ], repoPath);

        if (filesOutput) {
          commit.filesChanged = filesOutput.split('\n').filter(f => f.trim());
        }

        commits.push(commit);
      }
    }

    return commits;
  }

  /**
   * Analyze commits for risk.
   */
  private analyzeChangeRisk(commits: CommitInfo[]): RiskCommit[] {
    const riskFindings: RiskCommit[] = [];

    const riskyPatterns: Record<string, RegExp> = {
      hotfix: /\b(hotfix|urgent|emergency|critical)\b/i,
      rollback: /\b(rollback|revert|undo)\b/i,
      temp_fix: /\b(temp|temporary|quick|hack)\b/i,
      major_change: /\b(refactor|rewrite|major|breaking)\b/i,
      merge_conflict: /\b(merge|conflict|resolution)\b/i,
    };

    for (const commit of commits) {
      const risks: string[] = [];
      const messageLower = commit.message.toLowerCase();

      // Check risky patterns
      for (const [riskType, pattern] of Object.entries(riskyPatterns)) {
        if (pattern.test(commit.message)) {
          risks.push(riskType);
        }
      }

      // Check change categories
      for (const [category, info] of Object.entries(this.changePatterns)) {
        for (const pattern of info.patterns) {
          if (new RegExp(pattern, 'i').test(messageLower)) {
            risks.push(category);
            break;
          }
        }
      }

      if (risks.length > 0) {
        riskFindings.push({
          commit,
          risks: [...new Set(risks)],
          riskLevel: this.calculateRiskLevel(risks),
        });
      }
    }

    return riskFindings;
  }

  /**
   * Calculate risk level.
   */
  private calculateRiskLevel(risks: string[]): string {
    const criticalRisks = ['hotfix', 'rollback', 'temp_fix', 'auth_changes', 'database_changes'];
    const highRisks = ['major_change', 'merge_conflict', 'critical_file_changes'];

    if (risks.some(r => criticalRisks.includes(r))) return 'critical';
    if (risks.some(r => highRisks.includes(r))) return 'high';
    if (risks.length > 2) return 'medium';
    return 'low';
  }

  /**
   * Analyze commit timing patterns.
   */
  private analyzeCommitTimingPatterns(commits: CommitInfo[]): TimingIssue[] {
    const timingIssues: TimingIssue[] = [];

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];

      try {
        const commitDate = new Date(commit.date.replace(' ', 'T').split('+')[0]);

        // Weekend or late night commits
        const isWeekend = commitDate.getDay() === 0 || commitDate.getDay() === 6;
        const isLateNight = commitDate.getHours() < 6 || commitDate.getHours() > 22;

        if (isWeekend || isLateNight) {
          timingIssues.push({
            commit,
            timingConcern: isWeekend ? 'weekend' : 'late_night',
            riskLevel: 'medium',
          });
        }

        // Rapid consecutive commits
        if (i > 0) {
          const prevCommit = commits[i - 1];
          const prevDate = new Date(prevCommit.date.replace(' ', 'T').split('+')[0]);
          const timeDiff = Math.abs(commitDate.getTime() - prevDate.getTime()) / 1000;

          if (timeDiff < 600 && commit.author === prevCommit.author) {
            timingIssues.push({
              commit,
              timingConcern: 'rapid_consecutive',
              timeDiffMinutes: timeDiff / 60,
              previousCommit: prevCommit.hash.substring(0, 8),
              riskLevel: 'high',
            });
          }
        }
      } catch {
        // Skip commits with invalid dates
      }
    }

    return timingIssues;
  }

  /**
   * Analyze file change frequency.
   */
  private analyzeFileChangeFrequency(commits: CommitInfo[]): FileHotspot[] {
    const fileChanges: Map<string, Array<{ commit: string; changeType: string }>> = new Map();

    for (const commit of commits) {
      for (const file of commit.filesChanged) {
        if (!fileChanges.has(file)) {
          fileChanges.set(file, []);
        }
        fileChanges.get(file)!.push({
          commit: commit.hash,
          changeType: 'M', // Simplified
        });
      }
    }

    const hotspots: FileHotspot[] = [];
    for (const [filePath, changes] of fileChanges) {
      if (changes.length >= 5) {
        hotspots.push({
          filePath,
          changeCount: changes.length,
          changeTypes: changes.map(c => c.changeType),
          recentCommits: changes.slice(0, 5).map(c => c.commit),
          riskLevel: changes.length >= 10 ? 'high' : 'medium',
        });
      }
    }

    return hotspots;
  }

  /**
   * Get recommendation for risks.
   */
  private getRiskRecommendation(risks: string[]): string {
    const recommendations: Record<string, string> = {
      hotfix: 'Review urgency and add automated tests to prevent similar issues',
      rollback: 'Investigate root cause of issue that required rollback',
      temp_fix: 'Ensure temporary fixes are tracked and replaced with permanent solutions',
      major_change: 'Ensure adequate testing and monitoring for major changes',
      merge_conflict: 'Review merge resolution for potential integration issues',
      auth_changes: 'Thoroughly test authentication flows and security implications',
      database_changes: 'Verify database migration safety and backup procedures',
      api_changes: 'Ensure API compatibility and update documentation',
      config_changes: 'Verify configuration changes across all environments',
      dependency_changes: 'Test for breaking changes and security vulnerabilities',
      critical_file_changes: 'Extra scrutiny needed for changes to critical application files',
    };

    const primaryRecs = risks
      .slice(0, 3)
      .map(r => recommendations[r] || `Review ${r} implications`);

    return primaryRecs.join('; ');
  }

  /**
   * Get recommendation for timing issues.
   */
  private getTimingRecommendation(concern: string): string {
    const recommendations: Record<string, string> = {
      weekend: 'Weekend commits may indicate emergency fixes - review for proper testing',
      late_night: 'Late night commits may indicate emergency fixes - ensure proper code review',
      rapid_consecutive: 'Rapid consecutive commits may indicate incomplete initial fix - review sequence',
    };

    return recommendations[concern] || 'Review commit timing context for emergency fix patterns';
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    // Error info is required
    if (!this.errorInfo) {
      return [createStandardFinding(
        'Error Information Required',
        'Root cause analysis requires an error message or issue to investigate.',
        'critical',
        targetPath,
        0,
        'Call setErrorInfo() or pass errorInfo to constructor before analysis.',
        {
          tool: 'recent-changes-analyzer',
          errorType: 'missing_error_context',
        }
      )];
    }

    const findings: RawFinding[] = [];
    // Parse error for context (used in future enhancements)
    void this.parseError(this.errorInfo);

    // Find git root
    const gitRoot = this.findGitRoot(targetPath);
    if (!gitRoot) {
      return [createStandardFinding(
        'No Git Repository Found',
        'Not in a git repository - cannot analyze recent changes',
        'low',
        targetPath,
        0,
        'Run analysis from within a git repository',
        { tool: 'recent-changes-analyzer', errorType: 'no_git_repo' }
      )];
    }

    try {
      // Get recent commits
      const commits = this.getRecentCommits(gitRoot);

      if (commits.length === 0) {
        return [createStandardFinding(
          'No Recent Commits Found',
          `No relevant commits found in the last ${this.daysBack} days`,
          'low',
          gitRoot,
          0,
          'Check git history or increase analysis period',
          {
            tool: 'recent-changes-analyzer',
            analysisPeriod: this.daysBack,
          }
        )];
      }

      // Analyze risky commits
      const riskyCommits = this.analyzeChangeRisk(commits);
      for (const risk of riskyCommits) {
        findings.push(createStandardFinding(
          `Risky Commit: ${risk.commit.hash.substring(0, 8)}`,
          `Commit contains risk factors: ${risk.risks.join(', ')} - ${risk.commit.message.substring(0, 100)}`,
          risk.riskLevel,
          'git_history',
          0,
          this.getRiskRecommendation(risk.risks),
          {
            tool: 'recent-changes-analyzer',
            commitHash: risk.commit.hash,
            author: risk.commit.author,
            date: risk.commit.date,
            message: risk.commit.message,
            riskFactors: risk.risks,
            riskLevel: risk.riskLevel,
          }
        ));
      }

      // Analyze timing patterns
      const timingIssues = this.analyzeCommitTimingPatterns(commits);
      for (const issue of timingIssues) {
        let description = `Commit ${issue.commit.hash.substring(0, 8)} made during ${issue.timingConcern.replace(/_/g, ' ')}`;
        if (issue.timeDiffMinutes) {
          description += ` (${issue.timeDiffMinutes.toFixed(1)} minutes after previous)`;
        }

        findings.push(createStandardFinding(
          'Suspicious Commit Timing',
          description,
          issue.riskLevel,
          'git_history',
          0,
          this.getTimingRecommendation(issue.timingConcern),
          {
            tool: 'recent-changes-analyzer',
            commitHash: issue.commit.hash,
            author: issue.commit.author,
            date: issue.commit.date,
            timingConcern: issue.timingConcern,
          }
        ));
      }

      // Analyze file hotspots
      const hotspots = this.analyzeFileChangeFrequency(commits);
      for (const hotspot of hotspots) {
        findings.push(createStandardFinding(
          'File Change Hotspot',
          `File ${hotspot.filePath} changed ${hotspot.changeCount} times recently - potential instability`,
          hotspot.riskLevel,
          hotspot.filePath,
          0,
          'Review file stability, consider refactoring or additional testing',
          {
            tool: 'recent-changes-analyzer',
            changeCount: hotspot.changeCount,
            recentCommits: hotspot.recentCommits,
          }
        ));
      }

    } catch (err) {
      this.log('git_analysis_error', { error: String(err) });
      findings.push(createStandardFinding(
        'Git Analysis Error',
        `Could not analyze git repository: ${String(err)}`,
        'medium',
        targetPath,
        0,
        'Check git repository integrity and permissions',
        { tool: 'recent-changes-analyzer', errorType: 'git_analysis_error' }
      ));
    }

    return findings;
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'Recent Changes Analyzer',
      version: '1.0.0',
      description: 'Analyzes recent code changes using git history for root cause analysis',
      category: 'root_cause',
      priority: 'high',
      capabilities: [
        'Git commit risk pattern analysis',
        'File change frequency analysis',
        'Commit timing pattern analysis',
        'Authentication/database change detection',
        'API endpoint change tracking',
        'Configuration change detection',
        'Hotspot identification',
      ],
      supportedLanguages: ['git'],
      tool: 'recent-changes-analyzer',
    };
  }
}
