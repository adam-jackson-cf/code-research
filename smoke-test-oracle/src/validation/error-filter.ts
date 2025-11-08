import { ConsoleLogEntry } from '../storage/index.js';

/**
 * Pattern for matching console messages.
 * Can be a string (exact or contains match) or a RegExp.
 */
export type ConsolePattern = string | RegExp;

/**
 * Filter result for console entries.
 */
export interface FilterResult {
  /** Matching entries */
  matches: ConsoleLogEntry[];
  /** Non-matching entries */
  nonMatches: ConsoleLogEntry[];
  /** Total count of entries */
  total: number;
}

/**
 * Error categorization result.
 */
export interface ErrorCategories {
  /** Network-related errors */
  network: ConsoleLogEntry[];
  /** Script/JavaScript errors */
  script: ConsoleLogEntry[];
  /** Resource loading errors */
  resource: ConsoleLogEntry[];
  /** CORS errors */
  cors: ConsoleLogEntry[];
  /** Other uncategorized errors */
  other: ConsoleLogEntry[];
}

/**
 * Console log summary.
 */
export interface ConsoleSummary {
  /** Total number of entries */
  total: number;
  /** Count by level */
  byLevel: {
    log: number;
    info: number;
    warn: number;
    error: number;
    debug: number;
  };
  /** Total errors */
  errorCount: number;
  /** Total warnings */
  warningCount: number;
  /** Unique error messages */
  uniqueErrors: string[];
  /** Unique warning messages */
  uniqueWarnings: string[];
  /** Error categories */
  errorCategories?: ErrorCategories;
}

/**
 * Filter console entries by pattern.
 * Supports both string matching and regex patterns.
 *
 * @param entries - Console log entries to filter
 * @param pattern - Pattern to match against (string or regex)
 * @param matchType - Type of matching: 'exact', 'contains', or 'regex'
 * @returns Filter result with matches and non-matches
 */
export function filterByPattern(
  entries: ConsoleLogEntry[],
  pattern: ConsolePattern,
  matchType: 'exact' | 'contains' | 'regex' = 'contains'
): FilterResult {
  const matches: ConsoleLogEntry[] = [];
  const nonMatches: ConsoleLogEntry[] = [];

  for (const entry of entries) {
    let isMatch = false;

    if (pattern instanceof RegExp) {
      isMatch = pattern.test(entry.message);
    } else {
      // String pattern
      if (matchType === 'exact') {
        isMatch = entry.message === pattern;
      } else if (matchType === 'contains') {
        isMatch = entry.message.toLowerCase().includes(pattern.toLowerCase());
      } else if (matchType === 'regex') {
        try {
          const regex = new RegExp(pattern);
          isMatch = regex.test(entry.message);
        } catch (error) {
          // Invalid regex, treat as string match
          isMatch = entry.message.toLowerCase().includes(pattern.toLowerCase());
        }
      }
    }

    if (isMatch) {
      matches.push(entry);
    } else {
      nonMatches.push(entry);
    }
  }

  return {
    matches,
    nonMatches,
    total: entries.length,
  };
}

/**
 * Filter console entries by multiple patterns (OR logic).
 * An entry matches if it matches ANY of the provided patterns.
 *
 * @param entries - Console log entries to filter
 * @param patterns - Array of patterns to match
 * @param matchType - Type of matching
 * @returns Filter result
 */
export function filterByPatterns(
  entries: ConsoleLogEntry[],
  patterns: ConsolePattern[],
  matchType: 'exact' | 'contains' | 'regex' = 'contains'
): FilterResult {
  const matches: ConsoleLogEntry[] = [];
  const nonMatches: ConsoleLogEntry[] = [];

  for (const entry of entries) {
    let isMatch = false;

    for (const pattern of patterns) {
      const result = filterByPattern([entry], pattern, matchType);
      if (result.matches.length > 0) {
        isMatch = true;
        break;
      }
    }

    if (isMatch) {
      matches.push(entry);
    } else {
      nonMatches.push(entry);
    }
  }

  return {
    matches,
    nonMatches,
    total: entries.length,
  };
}

/**
 * Filter console entries by level.
 *
 * @param entries - Console log entries to filter
 * @param level - Level or levels to filter by
 * @returns Filtered entries
 */
export function filterByLevel(
  entries: ConsoleLogEntry[],
  level: ConsoleLogEntry['level'] | ConsoleLogEntry['level'][]
): ConsoleLogEntry[] {
  const levels = Array.isArray(level) ? level : [level];
  return entries.filter(entry => levels.includes(entry.level));
}

/**
 * Get only error entries.
 *
 * @param entries - Console log entries
 * @returns Error entries
 */
export function getErrors(entries: ConsoleLogEntry[]): ConsoleLogEntry[] {
  return filterByLevel(entries, 'error');
}

/**
 * Get only warning entries.
 *
 * @param entries - Console log entries
 * @returns Warning entries
 */
export function getWarnings(entries: ConsoleLogEntry[]): ConsoleLogEntry[] {
  return filterByLevel(entries, 'warn');
}

/**
 * Categorize errors by type.
 * Analyzes error messages to categorize them into common types.
 *
 * @param errors - Error console entries
 * @returns Categorized errors
 */
export function categorizeErrors(errors: ConsoleLogEntry[]): ErrorCategories {
  const categories: ErrorCategories = {
    network: [],
    script: [],
    resource: [],
    cors: [],
    other: [],
  };

  // Patterns for error categorization
  const networkPatterns = [
    /network/i,
    /fetch/i,
    /xhr/i,
    /ajax/i,
    /request failed/i,
    /timeout/i,
    /connection/i,
  ];

  const scriptPatterns = [
    /syntax error/i,
    /reference error/i,
    /type error/i,
    /uncaught/i,
    /undefined/i,
    /is not a function/i,
    /cannot read property/i,
  ];

  const resourcePatterns = [
    /failed to load/i,
    /404/i,
    /not found/i,
    /resource/i,
    /\.js/i,
    /\.css/i,
    /\.png/i,
    /\.jpg/i,
    /\.svg/i,
  ];

  const corsPatterns = [
    /cors/i,
    /cross-origin/i,
    /access-control/i,
    /blocked by cors/i,
  ];

  for (const error of errors) {
    const message = error.message;
    let categorized = false;

    // Check CORS first as it's most specific
    if (corsPatterns.some(pattern => pattern.test(message))) {
      categories.cors.push(error);
      categorized = true;
    } else if (networkPatterns.some(pattern => pattern.test(message))) {
      categories.network.push(error);
      categorized = true;
    } else if (scriptPatterns.some(pattern => pattern.test(message))) {
      categories.script.push(error);
      categorized = true;
    } else if (resourcePatterns.some(pattern => pattern.test(message))) {
      categories.resource.push(error);
      categorized = true;
    }

    if (!categorized) {
      categories.other.push(error);
    }
  }

  return categories;
}

/**
 * Generate a summary of console entries.
 *
 * @param entries - Console log entries
 * @param includeCategories - Whether to include error categorization
 * @returns Console summary
 */
export function generateSummary(
  entries: ConsoleLogEntry[],
  includeCategories = false
): ConsoleSummary {
  const byLevel = {
    log: 0,
    info: 0,
    warn: 0,
    error: 0,
    debug: 0,
  };

  const uniqueErrorsSet = new Set<string>();
  const uniqueWarningsSet = new Set<string>();

  for (const entry of entries) {
    byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;

    if (entry.level === 'error') {
      uniqueErrorsSet.add(entry.message);
    } else if (entry.level === 'warn') {
      uniqueWarningsSet.add(entry.message);
    }
  }

  const summary: ConsoleSummary = {
    total: entries.length,
    byLevel,
    errorCount: byLevel.error,
    warningCount: byLevel.warn,
    uniqueErrors: Array.from(uniqueErrorsSet),
    uniqueWarnings: Array.from(uniqueWarningsSet),
  };

  if (includeCategories && byLevel.error > 0) {
    const errors = getErrors(entries);
    summary.errorCategories = categorizeErrors(errors);
  }

  return summary;
}

/**
 * Filter console entries that match any of the allowed patterns.
 * Returns entries that DON'T match any pattern (i.e., entries to keep as errors).
 *
 * @param entries - Console log entries to filter
 * @param allowedPatterns - Patterns that are allowed (won't be considered errors)
 * @param matchType - Type of matching
 * @returns Entries that don't match any allowed pattern
 */
export function filterAllowedPatterns(
  entries: ConsoleLogEntry[],
  allowedPatterns: ConsolePattern[],
  matchType: 'exact' | 'contains' | 'regex' = 'contains'
): ConsoleLogEntry[] {
  if (allowedPatterns.length === 0) {
    return entries;
  }

  const result = filterByPatterns(entries, allowedPatterns, matchType);
  // Return non-matches (entries that didn't match allowed patterns)
  return result.nonMatches;
}

/**
 * Filter console entries that match any of the forbidden patterns.
 * Returns entries that DO match a forbidden pattern.
 *
 * @param entries - Console log entries to filter
 * @param forbiddenPatterns - Patterns that are forbidden
 * @param matchType - Type of matching
 * @returns Entries that match forbidden patterns
 */
export function filterForbiddenPatterns(
  entries: ConsoleLogEntry[],
  forbiddenPatterns: ConsolePattern[],
  matchType: 'exact' | 'contains' | 'regex' = 'contains'
): ConsoleLogEntry[] {
  if (forbiddenPatterns.length === 0) {
    return [];
  }

  const result = filterByPatterns(entries, forbiddenPatterns, matchType);
  // Return matches (entries that matched forbidden patterns)
  return result.matches;
}
