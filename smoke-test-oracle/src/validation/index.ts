/**
 * Validation module exports.
 *
 * This module provides validation capabilities for checkpoint testing:
 * - CheckpointValidator: Main validator for orchestrating all validation types
 * - AssertionEngine: Engine for evaluating DOM and console assertions
 * - Error filtering utilities: Pattern matching and categorization for console logs
 */

// Export main validator
export { CheckpointValidator } from './checkpoint-validator.js';
export type { CheckpointValidationResult } from './checkpoint-validator.js';

// Export assertion engine
export { AssertionEngine } from './assertion-engine.js';

// Export error filtering utilities
export {
  filterByPattern,
  filterByPatterns,
  filterByLevel,
  getErrors,
  getWarnings,
  categorizeErrors,
  generateSummary,
  filterAllowedPatterns,
  filterForbiddenPatterns,
} from './error-filter.js';

export type {
  ConsolePattern,
  FilterResult,
  ErrorCategories,
  ConsoleSummary,
} from './error-filter.js';
