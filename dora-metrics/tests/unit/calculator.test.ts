/**
 * Unit Tests for DORA Metrics Calculator
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import {
  calculateDeploymentFrequency,
  calculateLeadTimeForChanges,
  calculateChangeFailureRate,
  calculateRecoveryTime,
  calculateDORAMetrics,
  getDeploymentFrequencyLevel,
  getLeadTimeLevel,
  getChangeFailureRateLevel,
  getRecoveryTimeLevel,
  getOverallLevel,
  filterByFeature,
} from '../../src/metrics/calculator';
import type {
  PullRequest,
  Deployment,
  JiraIssue,
  TimePeriod,
  GitHubRepository,
  JiraProject,
} from '../../src/types';

// Test fixtures
const mockRepo: GitHubRepository = {
  owner: 'test',
  name: 'repo',
  fullName: 'test/repo',
};

const mockJiraProject: JiraProject = {
  id: '1',
  key: 'TEST',
  name: 'Test Project',
};

const createMockPR = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  id: 1,
  number: 1,
  title: 'Test PR',
  state: 'merged',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  mergedAt: new Date('2024-01-15T14:00:00Z'),
  closedAt: new Date('2024-01-15T14:00:00Z'),
  firstCommitAt: new Date('2024-01-15T08:00:00Z'),
  repository: mockRepo,
  labels: [],
  author: 'testuser',
  additions: 100,
  deletions: 50,
  changedFiles: 5,
  ...overrides,
});

const createMockDeployment = (overrides: Partial<Deployment> = {}): Deployment => ({
  id: '1',
  environment: 'production',
  status: 'success',
  createdAt: new Date('2024-01-15T15:00:00Z'),
  completedAt: new Date('2024-01-15T15:30:00Z'),
  repository: mockRepo,
  sha: 'abc123',
  ref: 'main',
  ...overrides,
});

const createMockIncident = (overrides: Partial<JiraIssue> = {}): JiraIssue => ({
  id: '1',
  key: 'TEST-1',
  summary: 'Test Incident',
  issueType: 'Bug',
  status: 'Done',
  priority: 'High',
  created: new Date('2024-01-15T16:00:00Z'),
  updated: new Date('2024-01-15T18:00:00Z'),
  resolved: new Date('2024-01-15T18:00:00Z'),
  labels: ['incident'],
  components: [],
  project: mockJiraProject,
  isIncident: true,
  incidentStartTime: new Date('2024-01-15T16:00:00Z'),
  incidentResolutionTime: new Date('2024-01-15T18:00:00Z'),
  ...overrides,
});

const defaultPeriod: TimePeriod = {
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31'),
};

describe('Performance Level Functions', () => {
  describe('getDeploymentFrequencyLevel', () => {
    it('returns elite for >= 1 deployment per day', () => {
      expect(getDeploymentFrequencyLevel(1)).toBe('elite');
      expect(getDeploymentFrequencyLevel(5)).toBe('elite');
    });

    it('returns high for weekly deployments', () => {
      expect(getDeploymentFrequencyLevel(1 / 7)).toBe('high');
      expect(getDeploymentFrequencyLevel(0.5)).toBe('high');
    });

    it('returns medium for monthly deployments', () => {
      expect(getDeploymentFrequencyLevel(1 / 30)).toBe('medium');
      expect(getDeploymentFrequencyLevel(0.1)).toBe('medium');
    });

    it('returns low for less than monthly', () => {
      expect(getDeploymentFrequencyLevel(1 / 60)).toBe('low');
      expect(getDeploymentFrequencyLevel(0)).toBe('low');
    });
  });

  describe('getLeadTimeLevel', () => {
    it('returns elite for <= 24 hours', () => {
      expect(getLeadTimeLevel(24)).toBe('elite');
      expect(getLeadTimeLevel(1)).toBe('elite');
    });

    it('returns high for 1 day to 1 week', () => {
      expect(getLeadTimeLevel(48)).toBe('high');
      expect(getLeadTimeLevel(168)).toBe('high');
    });

    it('returns medium for 1 week to 1 month', () => {
      expect(getLeadTimeLevel(200)).toBe('medium');
      expect(getLeadTimeLevel(720)).toBe('medium');
    });

    it('returns low for > 1 month', () => {
      expect(getLeadTimeLevel(721)).toBe('low');
      expect(getLeadTimeLevel(1000)).toBe('low');
    });
  });

  describe('getChangeFailureRateLevel', () => {
    it('returns elite for <= 5%', () => {
      expect(getChangeFailureRateLevel(5)).toBe('elite');
      expect(getChangeFailureRateLevel(0)).toBe('elite');
    });

    it('returns high for 5-10%', () => {
      expect(getChangeFailureRateLevel(6)).toBe('high');
      expect(getChangeFailureRateLevel(10)).toBe('high');
    });

    it('returns medium for 10-15%', () => {
      expect(getChangeFailureRateLevel(11)).toBe('medium');
      expect(getChangeFailureRateLevel(15)).toBe('medium');
    });

    it('returns low for > 15%', () => {
      expect(getChangeFailureRateLevel(16)).toBe('low');
      expect(getChangeFailureRateLevel(50)).toBe('low');
    });
  });

  describe('getRecoveryTimeLevel', () => {
    it('returns elite for <= 1 hour', () => {
      expect(getRecoveryTimeLevel(1)).toBe('elite');
      expect(getRecoveryTimeLevel(0.5)).toBe('elite');
    });

    it('returns high for <= 24 hours', () => {
      expect(getRecoveryTimeLevel(2)).toBe('high');
      expect(getRecoveryTimeLevel(24)).toBe('high');
    });

    it('returns medium for <= 168 hours (1 week)', () => {
      expect(getRecoveryTimeLevel(48)).toBe('medium');
      expect(getRecoveryTimeLevel(168)).toBe('medium');
    });

    it('returns low for > 1 week', () => {
      expect(getRecoveryTimeLevel(169)).toBe('low');
      expect(getRecoveryTimeLevel(500)).toBe('low');
    });
  });

  describe('getOverallLevel', () => {
    it('returns elite when all metrics are elite', () => {
      expect(getOverallLevel('elite', 'elite', 'elite', 'elite')).toBe('elite');
    });

    it('returns the lowest level (weakest link)', () => {
      expect(getOverallLevel('elite', 'elite', 'elite', 'low')).toBe('low');
      expect(getOverallLevel('high', 'medium', 'high', 'high')).toBe('medium');
      expect(getOverallLevel('elite', 'high', 'high', 'high')).toBe('high');
    });
  });
});

describe('Deployment Frequency', () => {
  it('calculates deployment frequency correctly', () => {
    const deployments = [
      createMockDeployment({ createdAt: new Date('2024-01-05T10:00:00Z') }),
      createMockDeployment({ id: '2', createdAt: new Date('2024-01-10T10:00:00Z') }),
      createMockDeployment({ id: '3', createdAt: new Date('2024-01-15T10:00:00Z') }),
      createMockDeployment({ id: '4', createdAt: new Date('2024-01-20T10:00:00Z') }),
    ];

    const result = calculateDeploymentFrequency(deployments, defaultPeriod);

    expect(result.deployments.length).toBe(4);
    expect(result.level).toBeDefined();
  });

  it('filters to successful production deployments only', () => {
    const deployments = [
      createMockDeployment({ status: 'success', environment: 'production' }),
      createMockDeployment({ id: '2', status: 'failure', environment: 'production' }),
      createMockDeployment({ id: '3', status: 'success', environment: 'staging' }),
    ];

    const result = calculateDeploymentFrequency(deployments, defaultPeriod);

    expect(result.deployments.length).toBe(1);
  });

  it('handles empty deployments', () => {
    const result = calculateDeploymentFrequency([], defaultPeriod);

    expect(result.deployments.length).toBe(0);
    expect(result.value).toBe(0);
    expect(result.level).toBe('low');
  });
});

describe('Lead Time for Changes', () => {
  it('calculates lead time from first commit to merge', () => {
    const pullRequests = [
      createMockPR({
        firstCommitAt: new Date('2024-01-15T08:00:00Z'),
        mergedAt: new Date('2024-01-15T14:00:00Z'), // 6 hours
      }),
      createMockPR({
        id: 2,
        number: 2,
        firstCommitAt: new Date('2024-01-16T08:00:00Z'),
        mergedAt: new Date('2024-01-16T20:00:00Z'), // 12 hours
      }),
    ];

    const result = calculateLeadTimeForChanges(pullRequests, []);

    // Median of [6, 12] = 9
    expect(result.median).toBe(9);
    expect(result.level).toBe('elite'); // < 24 hours
  });

  it('calculates lead time breakdown', () => {
    const pullRequests = [
      createMockPR({
        firstCommitAt: new Date('2024-01-15T08:00:00Z'),
        createdAt: new Date('2024-01-15T10:00:00Z'), // 2 hours coding
        mergedAt: new Date('2024-01-15T14:00:00Z'), // 4 hours review
      }),
    ];

    const result = calculateLeadTimeForChanges(pullRequests, []);

    expect(result.breakdown.codingTime).toBe(2);
    expect(result.breakdown.reviewTime).toBe(4);
  });

  it('handles PRs without firstCommitAt', () => {
    const pullRequests = [
      createMockPR({
        firstCommitAt: null,
        createdAt: new Date('2024-01-15T10:00:00Z'),
        mergedAt: new Date('2024-01-15T14:00:00Z'),
      }),
    ];

    const result = calculateLeadTimeForChanges(pullRequests, []);

    // Should use createdAt as fallback
    expect(result.median).toBe(4);
  });

  it('handles empty PRs', () => {
    const result = calculateLeadTimeForChanges([], []);

    expect(result.median).toBe(0);
    expect(result.mean).toBe(0);
  });
});

describe('Change Failure Rate', () => {
  it('calculates failure rate from failed deployments', () => {
    const deployments = [
      createMockDeployment({ status: 'success' }),
      createMockDeployment({ id: '2', status: 'success' }),
      createMockDeployment({ id: '3', status: 'success' }),
      createMockDeployment({ id: '4', status: 'failure' }),
    ];

    const result = calculateChangeFailureRate(deployments, []);

    expect(result.totalDeployments).toBe(4);
    expect(result.failedDeployments).toBe(1);
    expect(result.rate).toBe(25);
  });

  it('includes incident-causing deployments as failures', () => {
    const deployments = [
      createMockDeployment({
        status: 'success',
        createdAt: new Date('2024-01-15T15:00:00Z'),
        completedAt: new Date('2024-01-15T15:30:00Z'),
      }),
    ];

    const incidents = [
      createMockIncident({
        incidentStartTime: new Date('2024-01-15T16:00:00Z'), // Within 24 hours
      }),
    ];

    const result = calculateChangeFailureRate(deployments, incidents);

    expect(result.failedDeployments).toBe(1);
    expect(result.rate).toBe(100);
  });

  it('handles zero deployments', () => {
    const result = calculateChangeFailureRate([], []);

    expect(result.rate).toBe(0);
    expect(result.totalDeployments).toBe(0);
  });
});

describe('Failed Deployment Recovery Time', () => {
  it('calculates median recovery time', () => {
    const incidents = [
      createMockIncident({
        incidentStartTime: new Date('2024-01-15T10:00:00Z'),
        incidentResolutionTime: new Date('2024-01-15T12:00:00Z'), // 2 hours
      }),
      createMockIncident({
        id: '2',
        key: 'TEST-2',
        incidentStartTime: new Date('2024-01-16T10:00:00Z'),
        incidentResolutionTime: new Date('2024-01-16T14:00:00Z'), // 4 hours
      }),
    ];

    const result = calculateRecoveryTime(incidents);

    expect(result.median).toBe(3); // median of [2, 4]
    expect(result.incidents.length).toBe(2);
  });

  it('excludes unresolved incidents', () => {
    const incidents = [
      createMockIncident({
        incidentStartTime: new Date('2024-01-15T10:00:00Z'),
        incidentResolutionTime: new Date('2024-01-15T12:00:00Z'),
      }),
      createMockIncident({
        id: '2',
        key: 'TEST-2',
        incidentResolutionTime: undefined, // Unresolved
        resolved: null,
      }),
    ];

    const result = calculateRecoveryTime(incidents);

    expect(result.median).toBe(2); // Only resolved incident counted
  });

  it('handles empty incidents', () => {
    const result = calculateRecoveryTime([]);

    expect(result.median).toBe(0);
    expect(result.incidents.length).toBe(0);
  });
});

describe('Full DORA Metrics Calculation', () => {
  it('calculates all four metrics together', () => {
    const pullRequests = [
      createMockPR({
        firstCommitAt: new Date('2024-01-15T08:00:00Z'),
        mergedAt: new Date('2024-01-15T14:00:00Z'),
      }),
    ];

    const deployments = [
      createMockDeployment({
        status: 'success',
        createdAt: new Date('2024-01-15T15:00:00Z'),
      }),
    ];

    const incidents = [
      createMockIncident({
        incidentStartTime: new Date('2024-01-16T10:00:00Z'),
        incidentResolutionTime: new Date('2024-01-16T11:00:00Z'),
      }),
    ];

    const result = calculateDORAMetrics(pullRequests, deployments, incidents, defaultPeriod);

    expect(result.deploymentFrequency).toBeDefined();
    expect(result.leadTimeForChanges).toBeDefined();
    expect(result.changeFailureRate).toBeDefined();
    expect(result.failedDeploymentRecoveryTime).toBeDefined();
    expect(result.overallLevel).toBeDefined();
    expect(result.period).toEqual(defaultPeriod);
  });

  it('determines overall level based on weakest metric', () => {
    // Create data that results in mixed performance levels
    const pullRequests: PullRequest[] = [];
    const deployments: Deployment[] = [];
    const incidents: JiraIssue[] = [];

    const result = calculateDORAMetrics(pullRequests, deployments, incidents, defaultPeriod);

    // With no data, should be low performance
    expect(result.overallLevel).toBe('low');
  });
});

describe('Feature Filtering', () => {
  it('filters PRs by label', () => {
    const pullRequests = [
      createMockPR({ labels: ['feature-auth', 'enhancement'] }),
      createMockPR({ id: 2, number: 2, labels: ['feature-dashboard'] }),
      createMockPR({ id: 3, number: 3, labels: ['bug'] }),
    ];

    const result = filterByFeature(pullRequests, [], [], ['feature-auth']);

    expect(result.pullRequests.length).toBe(1);
    const firstPR = result.pullRequests[0];
    expect(firstPR?.labels).toContain('feature-auth');
  });

  it('filters incidents by labels', () => {
    const incidents = [
      createMockIncident({ labels: ['feature-auth', 'incident'] }),
      createMockIncident({ id: '2', key: 'TEST-2', labels: ['feature-dashboard', 'incident'] }),
    ];

    const result = filterByFeature([], [], incidents, ['feature-auth']);

    expect(result.incidents.length).toBe(1);
  });

  it('filters incidents by epic key', () => {
    const incidents = [
      createMockIncident({ featureKey: 'EPIC-1' }),
      createMockIncident({ id: '2', key: 'TEST-2', featureKey: 'EPIC-2' }),
    ];

    const result = filterByFeature([], [], incidents, ['EPIC-1']);

    expect(result.incidents.length).toBe(1);
  });

  it('handles empty feature labels', () => {
    const pullRequests = [createMockPR({ labels: ['test'] })];

    const result = filterByFeature(pullRequests, [], [], []);

    expect(result.pullRequests.length).toBe(0);
  });
});
