import { describe, it, expect } from 'vitest';
import {
  filterByPattern,
  filterByPatterns,
  filterByLevel,
  getErrors,
  getWarnings,
  categorizeErrors,
  generateSummary,
  filterAllowedPatterns,
  filterForbiddenPatterns,
} from '../../../src/validation/error-filter.js';
import { ConsoleLogEntry } from '../../../src/storage/console-store.js';

describe('error-filter', () => {
  const createLogEntry = (
    level: ConsoleLogEntry['level'],
    message: string,
    timestamp?: number
  ): ConsoleLogEntry => ({
    timestamp: timestamp || Date.now(),
    level,
    message,
  });

  describe('filterByPattern', () => {
    it('should filter entries by exact string match', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Network error'),
        createLogEntry('error', 'Validation error'),
        createLogEntry('error', 'Network error'),
      ];

      const result = filterByPattern(entries, 'Network error', 'exact');

      expect(result.matches).toHaveLength(2);
      expect(result.nonMatches).toHaveLength(1);
      expect(result.total).toBe(3);
    });

    it('should filter entries by contains match (default)', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Failed to fetch data'),
        createLogEntry('error', 'Connection timeout'),
        createLogEntry('error', 'Failed to save'),
      ];

      const result = filterByPattern(entries, 'Failed');

      expect(result.matches).toHaveLength(2);
      expect(result.nonMatches).toHaveLength(1);
    });

    it('should be case-insensitive for contains match', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'ERROR: Invalid input'),
        createLogEntry('error', 'Warning: deprecated'),
        createLogEntry('error', 'error in module'),
      ];

      const result = filterByPattern(entries, 'error', 'contains');

      expect(result.matches).toHaveLength(2);
    });

    it('should filter by regex pattern', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error code: 404'),
        createLogEntry('error', 'Error code: 500'),
        createLogEntry('error', 'Generic error'),
      ];

      const pattern = /Error code: \d+/;
      const result = filterByPattern(entries, pattern, 'regex');

      expect(result.matches).toHaveLength(2);
      expect(result.nonMatches).toHaveLength(1);
    });

    it('should filter by string regex pattern', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'user@example.com'),
        createLogEntry('error', 'test@test.com'),
        createLogEntry('error', 'not an email'),
      ];

      const result = filterByPattern(entries, '\\w+@\\w+\\.\\w+', 'regex');

      expect(result.matches).toHaveLength(2);
    });

    it('should handle invalid regex gracefully', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Test error'),
      ];

      const result = filterByPattern(entries, '[invalid(regex', 'regex');

      // Should fall back to string match
      expect(result).toBeDefined();
    });

    it('should return all non-matches when pattern does not match', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error 1'),
        createLogEntry('error', 'Error 2'),
      ];

      const result = filterByPattern(entries, 'NonExistent', 'contains');

      expect(result.matches).toHaveLength(0);
      expect(result.nonMatches).toHaveLength(2);
    });
  });

  describe('filterByPatterns', () => {
    it('should match entries against multiple patterns (OR logic)', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Network error'),
        createLogEntry('error', 'Validation failed'),
        createLogEntry('error', 'Timeout occurred'),
        createLogEntry('error', 'Unknown error'),
      ];

      const result = filterByPatterns(entries, ['Network', 'Timeout'], 'contains');

      expect(result.matches).toHaveLength(2);
      expect(result.nonMatches).toHaveLength(2);
    });

    it('should match if ANY pattern matches', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Failed to connect'),
        createLogEntry('error', 'Connection timeout'),
        createLogEntry('error', 'Generic error'),
      ];

      const patterns = ['Failed', 'timeout'];
      const result = filterByPatterns(entries, patterns, 'contains');

      expect(result.matches).toHaveLength(2);
    });

    it('should support regex patterns', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error 404'),
        createLogEntry('error', 'Error 500'),
        createLogEntry('error', 'Success'),
      ];

      const patterns = [/Error \d+/];
      const result = filterByPatterns(entries, patterns, 'regex');

      expect(result.matches).toHaveLength(2);
    });

    it('should handle empty patterns array', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Test'),
      ];

      const result = filterByPatterns(entries, [], 'contains');

      expect(result.matches).toHaveLength(0);
      expect(result.nonMatches).toHaveLength(1);
    });

    it('should handle mixed string and regex patterns', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Network error'),
        createLogEntry('error', 'Code: 404'),
        createLogEntry('error', 'Generic'),
      ];

      const patterns: Array<string | RegExp> = ['Network', /Code: \d+/];
      const result = filterByPatterns(entries, patterns as string[], 'contains');

      expect(result.matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('filterByLevel', () => {
    it('should filter entries by single level', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error 1'),
        createLogEntry('warn', 'Warning 1'),
        createLogEntry('error', 'Error 2'),
        createLogEntry('log', 'Log 1'),
      ];

      const result = filterByLevel(entries, 'error');

      expect(result).toHaveLength(2);
      expect(result.every(e => e.level === 'error')).toBe(true);
    });

    it('should filter by multiple levels', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error'),
        createLogEntry('warn', 'Warning'),
        createLogEntry('info', 'Info'),
        createLogEntry('log', 'Log'),
      ];

      const result = filterByLevel(entries, ['error', 'warn']);

      expect(result).toHaveLength(2);
      expect(result.some(e => e.level === 'error')).toBe(true);
      expect(result.some(e => e.level === 'warn')).toBe(true);
    });

    it('should return empty array when no matches', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log 1'),
        createLogEntry('info', 'Info 1'),
      ];

      const result = filterByLevel(entries, 'error');

      expect(result).toHaveLength(0);
    });
  });

  describe('getErrors', () => {
    it('should extract only error entries', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error 1'),
        createLogEntry('warn', 'Warning'),
        createLogEntry('error', 'Error 2'),
        createLogEntry('log', 'Log'),
      ];

      const errors = getErrors(entries);

      expect(errors).toHaveLength(2);
      expect(errors.every(e => e.level === 'error')).toBe(true);
    });

    it('should return empty array when no errors exist', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log'),
        createLogEntry('info', 'Info'),
      ];

      const errors = getErrors(entries);

      expect(errors).toHaveLength(0);
    });
  });

  describe('getWarnings', () => {
    it('should extract only warning entries', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('warn', 'Warning 1'),
        createLogEntry('error', 'Error'),
        createLogEntry('warn', 'Warning 2'),
        createLogEntry('log', 'Log'),
      ];

      const warnings = getWarnings(entries);

      expect(warnings).toHaveLength(2);
      expect(warnings.every(e => e.level === 'warn')).toBe(true);
    });
  });

  describe('categorizeErrors', () => {
    it('should categorize network errors', () => {
      const errors: ConsoleLogEntry[] = [
        createLogEntry('error', 'Network connection failed'),
        createLogEntry('error', 'Failed to fetch data'),
        createLogEntry('error', 'XHR request timeout'),
      ];

      const categories = categorizeErrors(errors);

      expect(categories.network).toHaveLength(3);
    });

    it('should categorize script errors', () => {
      const errors: ConsoleLogEntry[] = [
        createLogEntry('error', 'Uncaught TypeError: Cannot read property'),
        createLogEntry('error', 'ReferenceError: x is not defined'),
        createLogEntry('error', 'SyntaxError: Unexpected token'),
      ];

      const categories = categorizeErrors(errors);

      expect(categories.script).toHaveLength(3);
    });

    it('should categorize resource loading errors', () => {
      const errors: ConsoleLogEntry[] = [
        createLogEntry('error', 'Failed to load script.js'),
        createLogEntry('error', '404 Not Found: styles.css'),
        createLogEntry('error', 'Failed to load image.png'),
      ];

      const categories = categorizeErrors(errors);

      expect(categories.resource).toHaveLength(3);
    });

    it('should categorize CORS errors', () => {
      const errors: ConsoleLogEntry[] = [
        createLogEntry('error', 'CORS policy: No Access-Control-Allow-Origin'),
        createLogEntry('error', 'Cross-origin request blocked'),
        createLogEntry('error', 'Access-Control-Allow-Headers issue'),
      ];

      const categories = categorizeErrors(errors);

      expect(categories.cors).toHaveLength(3);
    });

    it('should categorize uncategorized errors as "other"', () => {
      const errors: ConsoleLogEntry[] = [
        createLogEntry('error', 'Some custom error message'),
        createLogEntry('error', 'Another unique error'),
      ];

      const categories = categorizeErrors(errors);

      expect(categories.other).toHaveLength(2);
    });

    it('should prioritize CORS over other categories', () => {
      const errors: ConsoleLogEntry[] = [
        createLogEntry('error', 'CORS policy blocked network request'),
      ];

      const categories = categorizeErrors(errors);

      expect(categories.cors).toHaveLength(1);
      expect(categories.network).toHaveLength(0);
    });

    it('should handle mixed error types', () => {
      const errors: ConsoleLogEntry[] = [
        createLogEntry('error', 'Network timeout'),
        createLogEntry('error', 'Uncaught TypeError'),
        createLogEntry('error', 'CORS policy error'),
        createLogEntry('error', 'Failed to load image.jpg'),
        createLogEntry('error', 'Custom error'),
      ];

      const categories = categorizeErrors(errors);

      expect(categories.network).toHaveLength(1);
      expect(categories.script).toHaveLength(1);
      expect(categories.cors).toHaveLength(1);
      expect(categories.resource).toHaveLength(1);
      expect(categories.other).toHaveLength(1);
    });
  });

  describe('generateSummary', () => {
    it('should generate summary with counts by level', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log 1'),
        createLogEntry('log', 'Log 2'),
        createLogEntry('info', 'Info 1'),
        createLogEntry('warn', 'Warning 1'),
        createLogEntry('warn', 'Warning 2'),
        createLogEntry('error', 'Error 1'),
        createLogEntry('debug', 'Debug 1'),
      ];

      const summary = generateSummary(entries);

      expect(summary.total).toBe(7);
      expect(summary.byLevel.log).toBe(2);
      expect(summary.byLevel.info).toBe(1);
      expect(summary.byLevel.warn).toBe(2);
      expect(summary.byLevel.error).toBe(1);
      expect(summary.byLevel.debug).toBe(1);
      expect(summary.errorCount).toBe(1);
      expect(summary.warningCount).toBe(2);
    });

    it('should collect unique error messages', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error A'),
        createLogEntry('error', 'Error B'),
        createLogEntry('error', 'Error A'), // Duplicate
        createLogEntry('log', 'Log'),
      ];

      const summary = generateSummary(entries);

      expect(summary.uniqueErrors).toHaveLength(2);
      expect(summary.uniqueErrors).toContain('Error A');
      expect(summary.uniqueErrors).toContain('Error B');
    });

    it('should collect unique warning messages', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('warn', 'Warning X'),
        createLogEntry('warn', 'Warning Y'),
        createLogEntry('warn', 'Warning X'), // Duplicate
      ];

      const summary = generateSummary(entries);

      expect(summary.uniqueWarnings).toHaveLength(2);
      expect(summary.uniqueWarnings).toContain('Warning X');
      expect(summary.uniqueWarnings).toContain('Warning Y');
    });

    it('should include error categorization when requested', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Network error'),
        createLogEntry('error', 'Uncaught TypeError'),
        createLogEntry('log', 'Log'),
      ];

      const summary = generateSummary(entries, true);

      expect(summary.errorCategories).toBeDefined();
      expect(summary.errorCategories?.network).toHaveLength(1);
      expect(summary.errorCategories?.script).toHaveLength(1);
    });

    it('should not include categorization by default', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error'),
      ];

      const summary = generateSummary(entries);

      expect(summary.errorCategories).toBeUndefined();
    });

    it('should handle empty entries', () => {
      const summary = generateSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.errorCount).toBe(0);
      expect(summary.warningCount).toBe(0);
      expect(summary.uniqueErrors).toHaveLength(0);
      expect(summary.uniqueWarnings).toHaveLength(0);
    });
  });

  describe('filterAllowedPatterns', () => {
    it('should return entries that do not match allowed patterns', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Known deprecation warning'),
        createLogEntry('error', 'Expected third-party error'),
        createLogEntry('error', 'Actual problem'),
      ];

      const allowedPatterns = ['deprecation', 'third-party'];
      const result = filterAllowedPatterns(entries, allowedPatterns, 'contains');

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Actual problem');
    });

    it('should return all entries when no allowed patterns provided', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error 1'),
        createLogEntry('error', 'Error 2'),
      ];

      const result = filterAllowedPatterns(entries, []);

      expect(result).toHaveLength(2);
    });

    it('should filter out entries matching allowed patterns', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('warn', 'React DevTools: warning'),
        createLogEntry('error', 'Google Analytics: timeout'),
        createLogEntry('error', 'Critical application error'),
      ];

      const allowedPatterns = ['React DevTools', 'Google Analytics'];
      const result = filterAllowedPatterns(entries, allowedPatterns, 'contains');

      expect(result).toHaveLength(1);
      expect(result[0].message).toContain('Critical');
    });

    it('should support regex patterns', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error code: 404'),
        createLogEntry('error', 'Error code: 500'),
        createLogEntry('error', 'Unexpected error'),
      ];

      const allowedPatterns = [/Error code: \d+/];
      const result = filterAllowedPatterns(entries, allowedPatterns as any, 'regex');

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Unexpected error');
    });
  });

  describe('filterForbiddenPatterns', () => {
    it('should return entries that match forbidden patterns', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Fatal error occurred'),
        createLogEntry('error', 'Normal warning'),
        createLogEntry('error', 'Critical failure'),
      ];

      const forbiddenPatterns = ['Fatal', 'Critical'];
      const result = filterForbiddenPatterns(entries, forbiddenPatterns, 'contains');

      expect(result).toHaveLength(2);
      expect(result.some(e => e.message.includes('Fatal'))).toBe(true);
      expect(result.some(e => e.message.includes('Critical'))).toBe(true);
    });

    it('should return empty array when no forbidden patterns provided', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error'),
      ];

      const result = filterForbiddenPatterns(entries, []);

      expect(result).toHaveLength(0);
    });

    it('should detect security-related errors', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'XSS attack detected'),
        createLogEntry('error', 'SQL injection attempt'),
        createLogEntry('error', 'Normal error'),
      ];

      const forbiddenPatterns = ['XSS', 'SQL injection'];
      const result = filterForbiddenPatterns(entries, forbiddenPatterns, 'contains');

      expect(result).toHaveLength(2);
    });

    it('should support regex patterns', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Unhandled exception'),
        createLogEntry('error', 'Uncaught error'),
        createLogEntry('error', 'Handled error'),
      ];

      const forbiddenPatterns = [/Un(handled|caught)/];
      const result = filterForbiddenPatterns(entries, forbiddenPatterns as any, 'regex');

      expect(result).toHaveLength(2);
    });

    it('should be case-insensitive for contains match', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'FATAL ERROR'),
        createLogEntry('error', 'fatal error'),
        createLogEntry('error', 'Normal'),
      ];

      const forbiddenPatterns = ['fatal'];
      const result = filterForbiddenPatterns(entries, forbiddenPatterns, 'contains');

      expect(result).toHaveLength(2);
    });
  });

  describe('integration scenarios', () => {
    it('should filter errors, remove allowed ones, and detect forbidden ones', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Application started'),
        createLogEntry('error', 'Third-party analytics timeout'),
        createLogEntry('error', 'CRITICAL: Database connection failed'),
        createLogEntry('warn', 'Deprecated API used'),
        createLogEntry('error', 'React DevTools warning'),
      ];

      // Get only errors
      const errors = getErrors(entries);
      expect(errors).toHaveLength(3);

      // Filter out allowed third-party errors
      const allowedPatterns = ['Third-party', 'React DevTools'];
      const actualErrors = filterAllowedPatterns(errors, allowedPatterns, 'contains');
      expect(actualErrors).toHaveLength(1);

      // Check for forbidden critical errors
      const forbiddenPatterns = ['CRITICAL'];
      const criticalErrors = filterForbiddenPatterns(actualErrors, forbiddenPatterns, 'contains');
      expect(criticalErrors).toHaveLength(1);
      expect(criticalErrors[0].message).toContain('Database connection failed');
    });

    it('should categorize and summarize filtered errors', () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Network timeout'),
        createLogEntry('error', 'Uncaught TypeError'),
        createLogEntry('error', 'CORS policy error'),
        createLogEntry('error', 'Failed to load script.js'),
        createLogEntry('log', 'Normal log'),
        createLogEntry('warn', 'Warning'),
      ];

      const errors = getErrors(entries);
      const categories = categorizeErrors(errors);
      const summary = generateSummary(entries, true);

      expect(categories.network).toHaveLength(1);
      expect(categories.script).toHaveLength(1);
      expect(categories.cors).toHaveLength(1);
      expect(categories.resource).toHaveLength(1);

      expect(summary.errorCount).toBe(4);
      expect(summary.warningCount).toBe(1);
      expect(summary.errorCategories).toBeDefined();
    });
  });
});
