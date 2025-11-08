/**
 * Output module exports
 *
 * This module provides utilities for formatting, visualizing, and generating
 * reports from test results, including visual diff comparisons.
 */

export { TestResultFormatter } from './formatter.js';
export type { OutputFormat, FormatOptions } from './formatter.js';

export { VisualDiffVisualizer } from './visualizer.js';
export type { VisualizerOptions } from './visualizer.js';

export { ReportGenerator } from './report-generator.js';
export type { ReportConfig, TestSummary } from './report-generator.js';
