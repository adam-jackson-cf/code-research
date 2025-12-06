/**
 * SQLGlot Database Analyzer - SQL Performance Anti-patterns.
 *
 * Analyzes SQL files for common performance issues using pattern-based detection.
 * Uses config-driven patterns from database.json configuration.
 */

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

interface SQLPattern {
  indicators: string[];
  severity: string;
  description: string;
}

/**
 * SQL performance analyzer with pattern-based detection.
 */
@registerAnalyzer('performance:sqlglot')
export class SQLGlotAnalyzer extends BaseAnalyzer {
  private patterns: Record<string, SQLPattern> = {};

  constructor(config?: Partial<AnalyzerConfig>) {
    const sqlConfig = createDefaultConfig({
      codeExtensions: new Set(['.sql']),
      ...config,
    });

    super('performance', sqlConfig);
    this.loadDatabasePatterns();
  }

  /**
   * Load SQL patterns from config file or use defaults.
   */
  private loadDatabasePatterns(): void {
    // Try to load from config file
    const configPaths = [
      path.join(process.cwd(), 'shared/config/patterns/scalability/database.json'),
      path.join(__dirname, '../../../config/patterns/scalability/database.json'),
    ];

    for (const configPath of configPaths) {
      try {
        if (fs.existsSync(configPath)) {
          const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          this.patterns = data.patterns || {};
          return;
        }
      } catch {
        // Continue to next path or use defaults
      }
    }

    // Default patterns if config not found
    this.patterns = {
      large_result_sets: {
        indicators: [
          'SELECT\\s+\\*',
          'SELECT.*FROM.*(?!.*LIMIT)',
        ],
        severity: 'medium',
        description: 'Query may return large unbounded result sets',
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
      n_plus_one: {
        indicators: [
          'SELECT.*WHERE.*IN\\s*\\(\\s*SELECT',
          'SELECT.*FROM.*,.*SELECT',
        ],
        severity: 'high',
        description: 'Potential N+1 query pattern detected',
      },
      no_pagination: {
        indicators: [
          'SELECT.*FROM.*(?!.*(LIMIT|OFFSET|FETCH))',
        ],
        severity: 'low',
        description: 'Query lacks pagination (LIMIT/OFFSET)',
      },
      cartesian_product: {
        indicators: [
          'SELECT.*FROM.*,.*(?!.*WHERE)',
          'CROSS\\s+JOIN',
        ],
        severity: 'high',
        description: 'Potential cartesian product (cross join without conditions)',
      },
      inefficient_like: {
        indicators: [
          "LIKE\\s+['\"]%",
          "LIKE\\s+['\"]_",
        ],
        severity: 'medium',
        description: 'LIKE pattern with leading wildcard prevents index usage',
      },
      select_in_loop: {
        indicators: [
          'CURSOR.*SELECT',
          'WHILE.*SELECT',
          'LOOP.*SELECT',
        ],
        severity: 'high',
        description: 'SELECT inside cursor/loop - consider batch operations',
      },
      missing_transaction: {
        indicators: [
          'INSERT.*INSERT',
          'UPDATE.*UPDATE',
          'DELETE.*DELETE',
        ],
        severity: 'medium',
        description: 'Multiple data modifications without explicit transaction',
      },
    };
  }

  /**
   * Get recommendation for a SQL pattern.
   */
  private getRecommendation(patternName: string): string {
    const recommendations: Record<string, string> = {
      large_result_sets: 'Add LIMIT/OFFSET or pagination to avoid returning excessive data.',
      missing_indexes: 'Ensure columns in WHERE/ORDER BY/GROUP BY clauses have appropriate indexes.',
      n_plus_one: 'Use JOINs or batch queries to avoid N+1 query patterns.',
      no_pagination: 'Add LIMIT/OFFSET or pagination for large result sets.',
      cartesian_product: 'Add appropriate JOIN conditions to avoid cartesian products.',
      inefficient_like: 'Consider full-text search or restructure query to avoid leading wildcards.',
      select_in_loop: 'Refactor to use batch operations, JOINs, or CTEs instead of cursors/loops.',
      missing_transaction: 'Wrap related modifications in a transaction for data consistency.',
    };

    return recommendations[patternName] || 'Review and optimize the SQL statement.';
  }

  /**
   * Analyze SQL content for anti-patterns.
   */
  private analyzeSQL(filePath: string, content: string): RawFinding[] {
    const findings: RawFinding[] = [];
    const lines = content.split('\n');

    // Pattern-based detection
    for (const [patternName, spec] of Object.entries(this.patterns)) {
      for (const indicator of spec.indicators) {
        try {
          const regex = new RegExp(indicator, 'gi');
          let match;

          while ((match = regex.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            const lineContent = lines[lineNumber - 1]?.trim() || '';

            // Skip if in a comment
            if (lineContent.startsWith('--') || lineContent.startsWith('/*')) {
              continue;
            }

            findings.push(createStandardFinding(
              `SQL Pattern: ${patternName.replace(/_/g, ' ')}`,
              spec.description,
              spec.severity,
              filePath,
              lineNumber,
              this.getRecommendation(patternName),
              {
                tool: 'sqlglot',
                pattern: patternName,
                lineContent: lineContent.substring(0, 150),
              }
            ));
          }
        } catch {
          // Invalid regex pattern, skip
        }
      }
    }

    // Additional AST-like analysis
    findings.push(...this.analyzeStatements(filePath, content));

    return findings;
  }

  /**
   * Analyze individual SQL statements for issues.
   */
  private analyzeStatements(filePath: string, content: string): RawFinding[] {
    const findings: RawFinding[] = [];
    const statements = content.split(';').filter(s => s.trim());

    for (const stmt of statements) {
      const stmtUpper = stmt.toUpperCase().trim();
      const lineNumber = content.indexOf(stmt) > -1
        ? content.substring(0, content.indexOf(stmt)).split('\n').length
        : 1;

      // SELECT * without LIMIT
      if (stmtUpper.includes('SELECT') &&
          stmtUpper.includes('*') &&
          !stmtUpper.includes('LIMIT') &&
          !stmtUpper.includes('TOP') &&
          !stmtUpper.includes('FETCH')) {
        findings.push(createStandardFinding(
          'SQL: SELECT * without LIMIT',
          'SELECT * may return unbounded result set',
          'medium',
          filePath,
          lineNumber,
          'Add LIMIT clause or select specific columns to control result size.',
          {
            tool: 'sqlglot',
            check: 'select_star_no_limit',
          }
        ));
      }

      // DELETE/UPDATE without WHERE
      if ((stmtUpper.includes('DELETE FROM') || stmtUpper.includes('UPDATE ')) &&
          !stmtUpper.includes('WHERE')) {
        findings.push(createStandardFinding(
          'SQL: Bulk operation without WHERE',
          'DELETE or UPDATE without WHERE clause will affect all rows',
          'high',
          filePath,
          lineNumber,
          'Add WHERE clause to limit affected rows, or confirm bulk operation is intended.',
          {
            tool: 'sqlglot',
            check: 'bulk_operation_no_where',
          }
        ));
      }

      // SELECT DISTINCT with ORDER BY
      if (stmtUpper.includes('SELECT DISTINCT') && stmtUpper.includes('ORDER BY')) {
        findings.push(createStandardFinding(
          'SQL: DISTINCT with ORDER BY',
          'SELECT DISTINCT with ORDER BY can be expensive',
          'low',
          filePath,
          lineNumber,
          'Consider using GROUP BY or optimizing the query structure.',
          {
            tool: 'sqlglot',
            check: 'distinct_with_order',
          }
        ));
      }

      // Nested subqueries
      const subqueryCount = (stmtUpper.match(/\(\s*SELECT/g) || []).length;
      if (subqueryCount > 2) {
        findings.push(createStandardFinding(
          'SQL: Deeply nested subqueries',
          `Query has ${subqueryCount} levels of nested subqueries`,
          'medium',
          filePath,
          lineNumber,
          'Consider using CTEs (WITH clause) or JOINs to flatten the query structure.',
          {
            tool: 'sqlglot',
            check: 'nested_subqueries',
            nestingLevel: subqueryCount,
          }
        ));
      }
    }

    return findings;
  }

  async analyzeTarget(targetPath: string): Promise<RawFinding[]> {
    try {
      const stat = fs.statSync(targetPath);
      if (!stat.isFile()) {
        return [];
      }

      const content = fs.readFileSync(targetPath, 'utf-8');
      return this.analyzeSQL(targetPath, content);
    } catch (err) {
      this.log('sql_analysis_error', { file: targetPath, error: String(err) });
      return [];
    }
  }

  getAnalyzerMetadata(): AnalyzerMetadata {
    return {
      name: 'SQLGlot Database Analyzer',
      version: '1.0.0',
      description: 'SQL performance analysis using pattern-based detection',
      category: 'performance',
      priority: 'medium',
      capabilities: [
        'Large result set detection',
        'Missing index hints',
        'N+1 query pattern detection',
        'Pagination analysis',
        'Cartesian product detection',
        'Inefficient LIKE patterns',
        'Cursor/loop optimization',
        'Transaction analysis',
      ],
      supportedLanguages: ['SQL'],
      tool: 'sqlglot',
    };
  }
}
