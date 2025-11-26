/**
 * DORA Metrics Types
 * Core type definitions for the DORA metrics dashboard
 */

// Performance levels based on DORA research
export type PerformanceLevel = 'elite' | 'high' | 'medium' | 'low';

// Time period for metric calculations
export interface TimePeriod {
  start: Date;
  end: Date;
}

// GitHub-related types
export interface GitHubRepository {
  owner: string;
  name: string;
  fullName: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: Date;
  mergedAt: Date | null;
  closedAt: Date | null;
  firstCommitAt: Date | null;
  repository: GitHubRepository;
  labels: string[];
  author: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface Deployment {
  id: string;
  environment: string;
  status: 'success' | 'failure' | 'in_progress' | 'pending' | 'queued';
  createdAt: Date;
  completedAt: Date | null;
  repository: GitHubRepository;
  sha: string;
  ref: string;
  description?: string;
  prNumber?: number;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'completed' | 'in_progress' | 'queued';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  createdAt: Date;
  updatedAt: Date;
  repository: GitHubRepository;
  headSha: string;
  event: string;
}

// Jira-related types
export interface JiraProject {
  key: string;
  name: string;
  id: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  issueType: string;
  status: string;
  priority: string;
  created: Date;
  updated: Date;
  resolved: Date | null;
  labels: string[];
  components: string[];
  project: JiraProject;
  assignee?: string;
  reporter?: string;
  // DORA-specific fields
  isIncident: boolean;
  incidentStartTime?: Date;
  incidentResolutionTime?: Date;
  linkedDeploymentId?: string;
  featureKey?: string;
}

// Feature tracking for filtering
export interface Feature {
  id: string;
  name: string;
  jiraEpicKey?: string;
  labels: string[];
  pullRequests: number[];
  deployments: string[];
  incidents: string[];
}

// DORA Metrics
export interface DeploymentFrequency {
  value: number; // deployments per time unit
  unit: 'day' | 'week' | 'month';
  level: PerformanceLevel;
  trend: 'improving' | 'stable' | 'declining';
  deployments: Deployment[];
}

export interface LeadTimeForChanges {
  median: number; // in hours
  mean: number;
  p90: number;
  level: PerformanceLevel;
  trend: 'improving' | 'stable' | 'declining';
  breakdown: {
    codingTime: number;
    pickupTime: number;
    reviewTime: number;
    deployTime: number;
  };
}

export interface ChangeFailureRate {
  rate: number; // percentage (0-100)
  totalDeployments: number;
  failedDeployments: number;
  level: PerformanceLevel;
  trend: 'improving' | 'stable' | 'declining';
}

export interface FailedDeploymentRecoveryTime {
  median: number; // in hours
  mean: number;
  p90: number;
  level: PerformanceLevel;
  trend: 'improving' | 'stable' | 'declining';
  incidents: JiraIssue[];
}

export interface DORAMetrics {
  period: TimePeriod;
  deploymentFrequency: DeploymentFrequency;
  leadTimeForChanges: LeadTimeForChanges;
  changeFailureRate: ChangeFailureRate;
  failedDeploymentRecoveryTime: FailedDeploymentRecoveryTime;
  overallLevel: PerformanceLevel;
}

// Dashboard filter state
export interface DashboardFilters {
  repository?: GitHubRepository;
  project?: JiraProject;
  feature?: Feature;
  period: TimePeriod;
  environment?: string;
}

// API configuration
export interface GitHubConfig {
  token?: string;
  baseUrl?: string;
}

export interface JiraConfig {
  baseUrl: string;
  email?: string;
  apiToken?: string;
}

export interface DataSourceConfig {
  github: GitHubConfig;
  jira?: JiraConfig;
}

// Aggregated data for dashboard
export interface ProjectMetrics {
  project: {
    name: string;
    repository: GitHubRepository;
    jiraProject?: JiraProject;
  };
  metrics: DORAMetrics;
  features: FeatureMetrics[];
}

export interface FeatureMetrics {
  feature: Feature;
  metrics: DORAMetrics;
}

// Chart data types
export interface TimeSeriesDataPoint {
  date: Date;
  value: number;
}

export interface MetricTrendData {
  metric: keyof Pick<DORAMetrics, 'deploymentFrequency' | 'leadTimeForChanges' | 'changeFailureRate' | 'failedDeploymentRecoveryTime'>;
  data: TimeSeriesDataPoint[];
}
