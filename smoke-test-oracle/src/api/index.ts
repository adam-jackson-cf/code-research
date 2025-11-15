/**
 * API Module Exports
 *
 * Main export file for the smoke-test-oracle API.
 * Provides fluent test builder, checkpoint management, and query capabilities.
 */

// Test Builder API
export { TestBuilder, SmokeTest } from './test-builder.js';

// Checkpoint API
export {
  CheckpointApi,
  type CheckpointApiConfig,
  type CheckpointComparisonResult,
} from './checkpoint-api.js';

// Query API
export {
  QueryApi,
  type QueryApiConfig,
  type QueryResult,
  type TimeRange,
} from './query-api.js';

// Re-export core types for convenience
export type {
  TestDefinition,
  TestConfig,
  TestStep,
  TestResult,
  CheckpointDefinition,
  CheckpointState,
  CheckpointValidations,
  ValidationResult,
  StorageRef,
  NavigateOptions,
  ScreenshotOptions,
  WaitCondition,
} from '../core/types.js';

// Re-export orchestrator
export {
  TestOrchestrator,
  type OrchestratorConfig,
} from '../core/orchestrator.js';

// Re-export storage manager
export { StorageManager } from '../storage/index.js';

// Re-export chrome wrapper
export { ChromeDevToolsWrapper } from '../chrome/index.js';
