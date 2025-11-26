/**
 * Main Dashboard Component
 * Combines all DORA metrics visualizations with filtering
 */

import React, { useState, useMemo } from 'react';
import {
  MetricCard,
  MetricsChart,
  FilterPanel,
  OverallScore,
  BenchmarkTable,
  LeadTimeBreakdown,
} from './components';
import { calculateDORAMetrics, filterByFeature } from '../metrics/calculator';
import type {
  DORAMetrics,
  PullRequest,
  Deployment,
  JiraIssue,
  GitHubRepository,
  Feature,
  TimePeriod,
  TimeSeriesDataPoint,
} from '../types';

interface DashboardProps {
  pullRequests: PullRequest[];
  deployments: Deployment[];
  incidents: JiraIssue[];
  repositories: GitHubRepository[];
  features: Feature[];
  initialPeriod?: TimePeriod;
}

const defaultPeriod: TimePeriod = {
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  end: new Date(),
};

export const Dashboard: React.FC<DashboardProps> = ({
  pullRequests,
  deployments,
  incidents,
  repositories,
  features,
  initialPeriod = defaultPeriod,
}) => {
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | undefined>();
  const [selectedFeature, setSelectedFeature] = useState<Feature | undefined>();
  const [period, setPeriod] = useState<TimePeriod>(initialPeriod);

  // Filter data based on selections
  const filteredData = useMemo(() => {
    let prs = pullRequests;
    let deps = deployments;
    let incs = incidents;

    // Filter by repository
    if (selectedRepo) {
      prs = prs.filter((pr) => pr.repository.fullName === selectedRepo.fullName);
      deps = deps.filter((d) => d.repository.fullName === selectedRepo.fullName);
    }

    // Filter by time period
    prs = prs.filter(
      (pr) => pr.mergedAt && pr.mergedAt >= period.start && pr.mergedAt <= period.end
    );
    deps = deps.filter(
      (d) => d.createdAt >= period.start && d.createdAt <= period.end
    );
    incs = incs.filter(
      (i) => i.created >= period.start && i.created <= period.end
    );

    // Filter by feature
    if (selectedFeature) {
      const featureFiltered = filterByFeature(prs, deps, incs, selectedFeature.labels);
      prs = featureFiltered.pullRequests;
      deps = featureFiltered.deployments;
      incs = featureFiltered.incidents;
    }

    return { pullRequests: prs, deployments: deps, incidents: incs };
  }, [pullRequests, deployments, incidents, selectedRepo, selectedFeature, period]);

  // Calculate metrics
  const metrics: DORAMetrics = useMemo(() => {
    return calculateDORAMetrics(
      filteredData.pullRequests,
      filteredData.deployments,
      filteredData.incidents,
      period
    );
  }, [filteredData, period]);

  // Generate time series data for charts
  const deploymentTrendData: TimeSeriesDataPoint[] = useMemo(() => {
    return metrics.deploymentFrequency.deployments.map((d) => ({
      date: d.createdAt,
      value: 1,
    }));
  }, [metrics.deploymentFrequency.deployments]);

  const leadTimeTrendData: TimeSeriesDataPoint[] = useMemo(() => {
    return filteredData.pullRequests
      .filter((pr) => pr.mergedAt && pr.firstCommitAt)
      .map((pr) => ({
        date: pr.mergedAt!,
        value: (pr.mergedAt!.getTime() - pr.firstCommitAt!.getTime()) / (1000 * 60 * 60),
      }));
  }, [filteredData.pullRequests]);

  // View mode
  const viewContext = selectedFeature
    ? `Feature: ${selectedFeature.name}`
    : selectedRepo
      ? `Repository: ${selectedRepo.fullName}`
      : 'All Projects';

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        padding: '32px',
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: '32px' }}>
        <h1
          style={{
            margin: '0 0 8px 0',
            fontSize: '32px',
            fontWeight: 700,
            color: '#111827',
          }}
        >
          DORA Metrics Dashboard
        </h1>
        <p style={{ margin: 0, fontSize: '16px', color: '#6b7280' }}>
          Viewing: <strong>{viewContext}</strong>
        </p>
      </header>

      {/* Filters */}
      <div style={{ marginBottom: '32px' }}>
        <FilterPanel
          repositories={repositories}
          features={features}
          selectedRepository={selectedRepo}
          selectedFeature={selectedFeature}
          period={period}
          onRepositoryChange={setSelectedRepo}
          onFeatureChange={setSelectedFeature}
          onPeriodChange={setPeriod}
        />
      </div>

      {/* Overall Score */}
      <div style={{ marginBottom: '32px' }}>
        <OverallScore metrics={metrics} />
      </div>

      {/* Metric Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginBottom: '32px',
        }}
      >
        <MetricCard
          title="Deployment Frequency"
          value={metrics.deploymentFrequency.value}
          unit={`per ${metrics.deploymentFrequency.unit}`}
          level={metrics.deploymentFrequency.level}
          trend={metrics.deploymentFrequency.trend}
          subtitle={`${metrics.deploymentFrequency.deployments.length} total deployments`}
          description="How often code is deployed to production"
        />
        <MetricCard
          title="Lead Time for Changes"
          value={metrics.leadTimeForChanges.median}
          unit="hours (median)"
          level={metrics.leadTimeForChanges.level}
          trend={metrics.leadTimeForChanges.trend}
          subtitle={`P90: ${metrics.leadTimeForChanges.p90} hours`}
          description="Time from first commit to production"
        />
        <MetricCard
          title="Change Failure Rate"
          value={metrics.changeFailureRate.rate}
          unit="%"
          level={metrics.changeFailureRate.level}
          trend={metrics.changeFailureRate.trend}
          subtitle={`${metrics.changeFailureRate.failedDeployments} of ${metrics.changeFailureRate.totalDeployments} failed`}
          description="Percentage of deployments causing incidents"
        />
        <MetricCard
          title="Recovery Time"
          value={metrics.failedDeploymentRecoveryTime.median}
          unit="hours (median)"
          level={metrics.failedDeploymentRecoveryTime.level}
          trend={metrics.failedDeploymentRecoveryTime.trend}
          subtitle={`${metrics.failedDeploymentRecoveryTime.incidents.length} incidents`}
          description="Time to restore service after failure"
        />
      </div>

      {/* Charts Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '24px',
          marginBottom: '32px',
        }}
      >
        <MetricsChart
          title="Deployment Frequency Trend"
          data={deploymentTrendData}
          chartType="bar"
          color="#22c55e"
          yAxisLabel="Deployments"
        />
        <MetricsChart
          title="Lead Time Trend"
          data={leadTimeTrendData}
          chartType="line"
          color="#3b82f6"
          yAxisLabel="Hours"
        />
      </div>

      {/* Lead Time Breakdown & Benchmarks */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(350px, 1fr) minmax(500px, 2fr)',
          gap: '24px',
          marginBottom: '32px',
        }}
      >
        <LeadTimeBreakdown leadTime={metrics.leadTimeForChanges} />
        <BenchmarkTable metrics={metrics} />
      </div>

      {/* Data Summary */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#111827' }}>
          Data Summary
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
          }}
        >
          <SummaryItem label="Pull Requests" value={filteredData.pullRequests.length} />
          <SummaryItem label="Deployments" value={filteredData.deployments.length} />
          <SummaryItem label="Incidents" value={filteredData.incidents.length} />
          <SummaryItem label="Repositories" value={repositories.length} />
          <SummaryItem label="Features" value={features.length} />
          <SummaryItem
            label="Period"
            value={`${Math.ceil((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24))} days`}
          />
        </div>
      </div>
    </div>
  );
};

interface SummaryItemProps {
  label: string;
  value: number | string;
}

const SummaryItem: React.FC<SummaryItemProps> = ({ label, value }) => (
  <div
    style={{
      padding: '12px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{value}</div>
    <div style={{ fontSize: '12px', color: '#6b7280' }}>{label}</div>
  </div>
);

export default Dashboard;
