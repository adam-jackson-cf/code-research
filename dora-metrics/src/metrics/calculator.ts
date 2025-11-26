/**
 * DORA Metrics Calculator
 * Computes the four DORA metrics from pull requests, deployments, and incidents
 */

import {
  differenceInHours,
  differenceInDays,
  differenceInWeeks,
} from 'date-fns';
import type {
  PullRequest,
  Deployment,
  JiraIssue,
  TimePeriod,
  DORAMetrics,
  DeploymentFrequency,
  LeadTimeForChanges,
  ChangeFailureRate,
  FailedDeploymentRecoveryTime,
  PerformanceLevel,
} from '../types';

/**
 * Calculate the performance level for deployment frequency
 * Based on DORA research benchmarks
 */
export function getDeploymentFrequencyLevel(
  deploymentsPerDay: number
): PerformanceLevel {
  if (deploymentsPerDay >= 1) return 'elite'; // Multiple times per day or daily
  if (deploymentsPerDay >= 1 / 7) return 'high'; // At least weekly
  if (deploymentsPerDay >= 1 / 30) return 'medium'; // At least monthly
  return 'low'; // Less than monthly
}

/**
 * Calculate the performance level for lead time
 * Based on DORA research benchmarks (in hours)
 */
export function getLeadTimeLevel(medianHours: number): PerformanceLevel {
  if (medianHours <= 24) return 'elite'; // Less than 1 day
  if (medianHours <= 168) return 'high'; // 1 day to 1 week
  if (medianHours <= 720) return 'medium'; // 1 week to 1 month
  return 'low'; // More than 1 month
}

/**
 * Calculate the performance level for change failure rate
 * Based on DORA research benchmarks (percentage)
 */
export function getChangeFailureRateLevel(rate: number): PerformanceLevel {
  if (rate <= 5) return 'elite';
  if (rate <= 10) return 'high';
  if (rate <= 15) return 'medium';
  return 'low'; // > 15%
}

/**
 * Calculate the performance level for recovery time
 * Based on DORA research benchmarks (in hours)
 */
export function getRecoveryTimeLevel(medianHours: number): PerformanceLevel {
  if (medianHours <= 1) return 'elite'; // Less than 1 hour
  if (medianHours <= 24) return 'high'; // Less than 1 day
  if (medianHours <= 168) return 'medium'; // Less than 1 week
  return 'low'; // More than 1 week
}

/**
 * Calculate overall DORA performance level
 * Uses the lowest level among all metrics (weakest link)
 */
export function getOverallLevel(
  df: PerformanceLevel,
  lt: PerformanceLevel,
  cfr: PerformanceLevel,
  rt: PerformanceLevel
): PerformanceLevel {
  const levels: PerformanceLevel[] = [df, lt, cfr, rt];
  const order: PerformanceLevel[] = ['elite', 'high', 'medium', 'low'];

  // Return the worst level (highest index in order array)
  let worst = 0;
  for (const level of levels) {
    const index = order.indexOf(level);
    if (index > worst) worst = index;
  }

  return order[worst] ?? 'low';
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const firstVal = sortedValues[0];
  if (sortedValues.length === 1 || firstVal === undefined) return firstVal ?? 0;

  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  const lastVal = sortedValues[sortedValues.length - 1];
  if (upper >= sortedValues.length) return lastVal ?? 0;

  const lowerVal = sortedValues[lower] ?? 0;
  const upperVal = sortedValues[upper] ?? 0;
  return lowerVal * (1 - weight) + upperVal * weight;
}

/**
 * Calculate median from array
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 50);
}

/**
 * Calculate mean from array
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate trend based on comparing first half vs second half of data
 */
function calculateTrend(
  values: Array<{ date: Date; value: number }>,
  isLowerBetter = false
): 'improving' | 'stable' | 'declining' {
  if (values.length < 4) return 'stable';

  const sorted = [...values].sort((a, b) => a.date.getTime() - b.date.getTime());
  const midpoint = Math.floor(sorted.length / 2);

  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const firstMean = mean(firstHalf.map((v) => v.value));
  const secondMean = mean(secondHalf.map((v) => v.value));

  const changePct = ((secondMean - firstMean) / (firstMean || 1)) * 100;

  // 10% threshold for significant change
  if (Math.abs(changePct) < 10) return 'stable';

  if (isLowerBetter) {
    return changePct < 0 ? 'improving' : 'declining';
  }
  return changePct > 0 ? 'improving' : 'declining';
}

/**
 * Calculate Deployment Frequency
 */
export function calculateDeploymentFrequency(
  deployments: Deployment[],
  period: TimePeriod
): DeploymentFrequency {
  // Filter to successful production deployments
  const successfulDeployments = deployments.filter(
    (d) =>
      d.status === 'success' &&
      d.environment.toLowerCase().includes('prod')
  );

  const totalDays = differenceInDays(period.end, period.start) || 1;
  const deploymentsPerDay = successfulDeployments.length / totalDays;

  // Determine best unit for display
  let value: number;
  let unit: 'day' | 'week' | 'month';

  if (deploymentsPerDay >= 1) {
    value = deploymentsPerDay;
    unit = 'day';
  } else if (deploymentsPerDay >= 1 / 7) {
    value = deploymentsPerDay * 7;
    unit = 'week';
  } else {
    value = deploymentsPerDay * 30;
    unit = 'month';
  }

  // Calculate trend
  const deploymentsByDate = successfulDeployments.map((d) => ({
    date: d.createdAt,
    value: 1,
  }));

  return {
    value: Math.round(value * 100) / 100,
    unit,
    level: getDeploymentFrequencyLevel(deploymentsPerDay),
    trend: calculateTrend(deploymentsByDate, false),
    deployments: successfulDeployments,
  };
}

/**
 * Calculate Lead Time for Changes
 */
export function calculateLeadTimeForChanges(
  pullRequests: PullRequest[],
  deployments: Deployment[]
): LeadTimeForChanges {
  // Calculate lead times for each PR
  const leadTimes: number[] = [];
  const codingTimes: number[] = [];
  const reviewTimes: number[] = [];
  const deployTimes: number[] = [];
  const trendData: Array<{ date: Date; value: number }> = [];

  for (const pr of pullRequests) {
    if (!pr.mergedAt) continue;

    // Total lead time: first commit to merge (approximation)
    // Ideally would track to deployment, but merge is a good proxy
    const firstCommit = pr.firstCommitAt || pr.createdAt;
    const totalHours = differenceInHours(pr.mergedAt, firstCommit);

    if (totalHours > 0) {
      leadTimes.push(totalHours);
      trendData.push({ date: pr.mergedAt, value: totalHours });
    }

    // Coding time: first commit to PR creation
    const codingHours = differenceInHours(pr.createdAt, firstCommit);
    if (codingHours > 0) codingTimes.push(codingHours);

    // Review time: PR creation to merge
    const reviewHours = differenceInHours(pr.mergedAt, pr.createdAt);
    if (reviewHours > 0) reviewTimes.push(reviewHours);
  }

  // Deploy time: time from merge to deployment (if we can correlate)
  // For now, estimate based on deployment frequency
  if (deployments.length > 0 && pullRequests.length > 0) {
    const avgDeployDelay = 2; // Default 2 hours if deployments exist
    deployTimes.push(avgDeployDelay);
  }

  const sortedLeadTimes = [...leadTimes].sort((a, b) => a - b);
  const medianLeadTime = median(leadTimes);

  return {
    median: Math.round(medianLeadTime * 100) / 100,
    mean: Math.round(mean(leadTimes) * 100) / 100,
    p90: Math.round(percentile(sortedLeadTimes, 90) * 100) / 100,
    level: getLeadTimeLevel(medianLeadTime),
    trend: calculateTrend(trendData, true),
    breakdown: {
      codingTime: Math.round(median(codingTimes) * 100) / 100,
      pickupTime: 0, // Would require more data to calculate
      reviewTime: Math.round(median(reviewTimes) * 100) / 100,
      deployTime: Math.round(median(deployTimes) * 100) / 100,
    },
  };
}

/**
 * Calculate Change Failure Rate
 */
export function calculateChangeFailureRate(
  deployments: Deployment[],
  incidents: JiraIssue[]
): ChangeFailureRate {
  // Filter to production deployments
  const prodDeployments = deployments.filter((d) =>
    d.environment.toLowerCase().includes('prod')
  );

  const totalDeployments = prodDeployments.length;

  // Count failed deployments
  // A deployment is considered failed if:
  // 1. Its status is 'failure', OR
  // 2. An incident was created within 24 hours of the deployment
  let failedDeployments = prodDeployments.filter(
    (d) => d.status === 'failure'
  ).length;

  // Also count deployments that resulted in incidents
  for (const deployment of prodDeployments) {
    if (deployment.status === 'failure') continue; // Already counted

    const deployTime = deployment.completedAt || deployment.createdAt;

    // Check if any incident was created within 24 hours after deployment
    const relatedIncident = incidents.find((incident) => {
      const incidentTime = incident.incidentStartTime || incident.created;
      const hoursDiff = differenceInHours(incidentTime, deployTime);
      return hoursDiff >= 0 && hoursDiff <= 24;
    });

    if (relatedIncident) {
      failedDeployments++;
    }
  }

  const rate = totalDeployments > 0
    ? (failedDeployments / totalDeployments) * 100
    : 0;

  // Calculate trend
  const deploymentResults = prodDeployments.map((d) => ({
    date: d.createdAt,
    value: d.status === 'failure' ? 1 : 0,
  }));

  return {
    rate: Math.round(rate * 100) / 100,
    totalDeployments,
    failedDeployments,
    level: getChangeFailureRateLevel(rate),
    trend: calculateTrend(deploymentResults, true),
  };
}

/**
 * Calculate Failed Deployment Recovery Time
 */
export function calculateRecoveryTime(
  incidents: JiraIssue[]
): FailedDeploymentRecoveryTime {
  const recoveryTimes: number[] = [];
  const trendData: Array<{ date: Date; value: number }> = [];

  for (const incident of incidents) {
    if (!incident.isIncident) continue;

    const startTime = incident.incidentStartTime || incident.created;
    const endTime = incident.incidentResolutionTime || incident.resolved;

    if (!endTime) continue; // Unresolved incident

    const recoveryHours = differenceInHours(endTime, startTime);

    if (recoveryHours >= 0) {
      recoveryTimes.push(recoveryHours);
      trendData.push({ date: startTime, value: recoveryHours });
    }
  }

  const sortedRecoveryTimes = [...recoveryTimes].sort((a, b) => a - b);
  const medianRecovery = median(recoveryTimes);

  return {
    median: Math.round(medianRecovery * 100) / 100,
    mean: Math.round(mean(recoveryTimes) * 100) / 100,
    p90: Math.round(percentile(sortedRecoveryTimes, 90) * 100) / 100,
    level: getRecoveryTimeLevel(medianRecovery),
    trend: calculateTrend(trendData, true),
    incidents: incidents.filter((i) => i.isIncident),
  };
}

/**
 * Calculate all DORA metrics
 */
export function calculateDORAMetrics(
  pullRequests: PullRequest[],
  deployments: Deployment[],
  incidents: JiraIssue[],
  period: TimePeriod
): DORAMetrics {
  const deploymentFrequency = calculateDeploymentFrequency(deployments, period);
  const leadTimeForChanges = calculateLeadTimeForChanges(pullRequests, deployments);
  const changeFailureRate = calculateChangeFailureRate(deployments, incidents);
  const failedDeploymentRecoveryTime = calculateRecoveryTime(incidents);

  const overallLevel = getOverallLevel(
    deploymentFrequency.level,
    leadTimeForChanges.level,
    changeFailureRate.level,
    failedDeploymentRecoveryTime.level
  );

  return {
    period,
    deploymentFrequency,
    leadTimeForChanges,
    changeFailureRate,
    failedDeploymentRecoveryTime,
    overallLevel,
  };
}

/**
 * Filter data by feature (using labels or epic key)
 */
export function filterByFeature(
  pullRequests: PullRequest[],
  deployments: Deployment[],
  incidents: JiraIssue[],
  featureLabels: string[]
): {
  pullRequests: PullRequest[];
  deployments: Deployment[];
  incidents: JiraIssue[];
} {
  const filteredPRs = pullRequests.filter((pr) =>
    pr.labels.some((label) =>
      featureLabels.some((fl) => label.toLowerCase().includes(fl.toLowerCase()))
    )
  );

  // Filter deployments to those that deployed filtered PRs
  // This is an approximation - real implementation would need deployment-PR mapping
  const prShas = new Set(filteredPRs.map((pr) => pr.number.toString()));
  const filteredDeployments = deployments.filter((d) =>
    prShas.has(d.prNumber?.toString() || '')
  );

  // Filter incidents by feature labels
  const filteredIncidents = incidents.filter((incident) =>
    incident.labels.some((label) =>
      featureLabels.some((fl) => label.toLowerCase().includes(fl.toLowerCase()))
    ) ||
    featureLabels.some((fl) =>
      incident.featureKey?.toLowerCase().includes(fl.toLowerCase())
    )
  );

  return {
    pullRequests: filteredPRs,
    deployments: filteredDeployments,
    incidents: filteredIncidents,
  };
}

export class DORAMetricsCalculator {
  /**
   * Calculate metrics for a project
   */
  calculateProjectMetrics(
    pullRequests: PullRequest[],
    deployments: Deployment[],
    incidents: JiraIssue[],
    period: TimePeriod
  ): DORAMetrics {
    return calculateDORAMetrics(pullRequests, deployments, incidents, period);
  }

  /**
   * Calculate metrics for a specific feature
   */
  calculateFeatureMetrics(
    pullRequests: PullRequest[],
    deployments: Deployment[],
    incidents: JiraIssue[],
    period: TimePeriod,
    featureLabels: string[]
  ): DORAMetrics {
    const filtered = filterByFeature(pullRequests, deployments, incidents, featureLabels);
    return calculateDORAMetrics(
      filtered.pullRequests,
      filtered.deployments,
      filtered.incidents,
      period
    );
  }
}
