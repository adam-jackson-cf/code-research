/**
 * DORA Metrics Dashboard
 * Main entry point
 */

// Types
export * from './types';

// API Clients
export { GitHubClient, createGitHubClient } from './api/github';
export { JiraClient, MockJiraClient, createJiraClient, createMockJiraClient } from './api/jira';

// Metrics Calculator
export {
  DORAMetricsCalculator,
  calculateDORAMetrics,
  calculateDeploymentFrequency,
  calculateLeadTimeForChanges,
  calculateChangeFailureRate,
  calculateRecoveryTime,
  filterByFeature,
  getDeploymentFrequencyLevel,
  getLeadTimeLevel,
  getChangeFailureRateLevel,
  getRecoveryTimeLevel,
  getOverallLevel,
} from './metrics/calculator';

// Dashboard Components
export { Dashboard } from './dashboard';
export * from './dashboard/components';
