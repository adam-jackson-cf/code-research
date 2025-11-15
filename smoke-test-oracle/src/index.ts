/**
 * smoke-test-oracle - Main Library Exports
 *
 * Composable smoke testing tool using Chrome DevTools MCP with context-aware storage.
 * This module provides the main programmatic API for building and running smoke tests.
 */

// ============================================================================
// Core Test Builder API
// ============================================================================

export { TestBuilder, SmokeTest } from './api/test-builder.js';

// ============================================================================
// High-Level APIs
// ============================================================================

// Checkpoint Management API
export {
  CheckpointApi,
  type CheckpointApiConfig,
  type CheckpointComparisonResult,
} from './api/checkpoint-api.js';

// Query API
export {
  QueryApi,
  type QueryApiConfig,
  type QueryResult,
  type TimeRange,
} from './api/query-api.js';

// ============================================================================
// Core Orchestration
// ============================================================================

export {
  TestOrchestrator,
  type OrchestratorConfig,
} from './core/orchestrator.js';

export { TestRunner } from './core/test-runner.js';

export { CheckpointManager } from './core/checkpoint-manager.js';

// ============================================================================
// Storage Management
// ============================================================================

export {
  StorageManager,
  type StorageManagerConfig,
  type StorageStats,
} from './storage/index.js';

export {
  DOMStore,
  type DOMQueryFilter,
} from './storage/dom-store.js';

export {
  ScreenshotStore,
  type ScreenshotData,
  type ScreenshotQueryFilter,
} from './storage/screenshot-store.js';

export {
  ConsoleStore,
  type ConsoleLogEntry,
  type ConsoleQueryFilter,
} from './storage/console-store.js';

export {
  CheckpointStore,
  type CheckpointState,
  type CheckpointQueryFilter,
} from './storage/checkpoint-store.js';

export {
  type StorageRef,
} from './storage/storage-provider.js';

// ============================================================================
// Chrome DevTools Integration
// ============================================================================

export { ChromeDevToolsWrapper } from './chrome/devtools-wrapper.js';

// Navigation utilities
export {
  navigateWithRetry,
  waitForNavigation,
  goBack,
  goForward,
  reload,
} from './chrome/navigation.js';

// Console utilities
export {
  extractConsoleLogs,
  clearBrowserConsole,
  filterConsoleLogs,
  getErrorLogs,
  getWarningLogs,
  hasConsoleErrors,
} from './chrome/console-reader.js';

// Screenshot utilities
export {
  captureScreenshot,
  captureScreenshotWithRetry,
  captureElementScreenshot,
  screenshotToBase64,
  getRawBase64,
} from './chrome/screenshot-capture.js';

// DOM utilities
export {
  extractDOM,
  querySelectorInDOM,
  querySelectorAllInDOM,
  getElementText,
  getInputValue,
  getElementAttribute,
  elementExists,
  countElements,
  extractElementInfo,
  extractLinks,
  extractImages,
  getPageText,
} from './chrome/dom-extractor.js';

// ============================================================================
// Validation
// ============================================================================

export {
  CheckpointValidator,
  type CheckpointValidationResult,
} from './validation/checkpoint-validator.js';

export { AssertionEngine } from './validation/assertion-engine.js';

// Error filtering utilities
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
  type ConsolePattern,
  type FilterResult,
  type ErrorCategories,
  type ConsoleSummary,
} from './validation/error-filter.js';

// Visual diff
export { VisualDiffEngine } from './validation/visual-diff.js';

// ============================================================================
// Output & Reporting
// ============================================================================

export {
  TestResultFormatter,
  type OutputFormat,
  type FormatOptions,
} from './output/formatter.js';

export {
  VisualDiffVisualizer,
  type VisualizerOptions,
} from './output/visualizer.js';

export {
  ReportGenerator,
  type ReportConfig,
  type TestSummary,
} from './output/report-generator.js';

// ============================================================================
// Core Types
// ============================================================================

export type {
  // Storage types
  StorageCategory,
  StorageMetadata,
  QueryFilter,
  StorageProvider,

  // Test types
  TestStepAction,
  TestStep,
  NavigateStep,
  ClickStep,
  TypeStep,
  WaitStep,
  ScrollStep,
  SelectStep,
  HoverStep,
  PressStep,
  CheckpointStep,
  NavigateOptions,
  WaitCondition,
  TestConfig,
  TestDefinition,
  TestResult,

  // Checkpoint types
  CheckpointDefinition,
  CheckpointRefs,
  CheckpointValidations,
  ValidationResult,
  AssertionResult,

  // Validation types
  DOMValidations,
  ConsoleValidations,
  VisualValidations,
  ValidationContext,
  VisualRegion,

  // Chrome DevTools types
  NavigationResult,
  ConsoleEntry,
  ConsoleFilter,
  DOMNode,
  DOMElement,
  ScreenshotOptions,

  // Visual diff types
  DiffOptions,
  DiffResult,
} from './core/types.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '0.1.0';

// ============================================================================
// Default Export (Main Entry Point)
// ============================================================================

import { TestBuilder as TB } from './api/test-builder.js';
export default TB;
