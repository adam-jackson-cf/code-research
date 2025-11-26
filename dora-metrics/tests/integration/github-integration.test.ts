/**
 * Integration Tests - GitHub API Integration
 * Tests data fetching from real public GitHub repositories
 */

import { describe, expect, it, beforeAll } from 'bun:test';
import { GitHubClient, createGitHubClient } from '../../src/api/github';
import { calculateDORAMetrics } from '../../src/metrics/calculator';
import { createMockJiraClient } from '../../src/api/jira';
import type { TimePeriod, Deployment } from '../../src/types';

// Test against a well-known public repository
const TEST_REPO = 'facebook/react';
const TEST_PERIOD: TimePeriod = {
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  end: new Date(),
};

// Short period for faster tests
const SHORT_PERIOD: TimePeriod = {
  start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  end: new Date(),
};

describe('GitHub API Integration', () => {
  let client: GitHubClient;

  beforeAll(() => {
    // Create client with token from environment for higher rate limits
    client = createGitHubClient({ token: process.env.GITHUB_TOKEN });
  });

  describe('Repository Parsing', () => {
    it('parses repository string correctly', () => {
      const repo = client.parseRepoString('facebook/react');

      expect(repo.owner).toBe('facebook');
      expect(repo.name).toBe('react');
      expect(repo.fullName).toBe('facebook/react');
    });

    it('throws on invalid repository string', () => {
      expect(() => client.parseRepoString('invalid')).toThrow();
      expect(() => client.parseRepoString('')).toThrow();
    });
  });

  describe('Pull Request Fetching', () => {
    it('fetches merged pull requests from public repo', async () => {
      const repo = client.parseRepoString(TEST_REPO);
      const pullRequests = await client.fetchMergedPullRequests(repo, SHORT_PERIOD);

      // React is very active, should have PRs in the last week
      expect(Array.isArray(pullRequests)).toBe(true);

      // Verify PR structure
      const pr = pullRequests[0];
      if (pr) {
        expect(pr.id).toBeDefined();
        expect(pr.number).toBeDefined();
        expect(pr.title).toBeDefined();
        expect(pr.state).toBe('merged');
        expect(pr.mergedAt).toBeInstanceOf(Date);
        expect(pr.repository.fullName).toBe(TEST_REPO);
      }
    }, 30000); // Extended timeout for API calls

    it('respects time period filters', async () => {
      const repo = client.parseRepoString(TEST_REPO);
      const pullRequests = await client.fetchMergedPullRequests(repo, SHORT_PERIOD);

      // All PRs should be within the period
      pullRequests.forEach((pr) => {
        if (pr.mergedAt) {
          expect(pr.mergedAt.getTime()).toBeGreaterThanOrEqual(SHORT_PERIOD.start.getTime());
          expect(pr.mergedAt.getTime()).toBeLessThanOrEqual(SHORT_PERIOD.end.getTime());
        }
      });
    }, 30000);
  });

  describe('Workflow Runs Fetching', () => {
    it('fetches workflow runs from public repo', async () => {
      const repo = client.parseRepoString(TEST_REPO);
      const runs = await client.fetchWorkflowRuns(repo, SHORT_PERIOD);

      expect(Array.isArray(runs)).toBe(true);

      const run = runs[0];
      if (run) {
        expect(run.id).toBeDefined();
        expect(run.name).toBeDefined();
        expect(run.status).toBeDefined();
        expect(run.createdAt).toBeInstanceOf(Date);
      }
    }, 30000);

    it('converts workflow runs to deployments', async () => {
      const repo = client.parseRepoString(TEST_REPO);
      const runs = await client.fetchWorkflowRuns(repo, SHORT_PERIOD);
      const deployments = client.convertWorkflowsToDeployments(runs);

      expect(Array.isArray(deployments)).toBe(true);

      deployments.forEach((d) => {
        expect(d.environment).toBe('production');
        expect(['success', 'failure', 'pending']).toContain(d.status);
      });
    }, 30000);
  });

  describe('Issue Fetching', () => {
    it('fetches incident-labeled issues', async () => {
      const repo = client.parseRepoString(TEST_REPO);
      const issues = await client.fetchIncidentIssues(repo, TEST_PERIOD);

      expect(Array.isArray(issues)).toBe(true);

      issues.forEach((issue) => {
        expect(issue.id).toBeDefined();
        expect(issue.title).toBeDefined();
        expect(issue.createdAt).toBeInstanceOf(Date);
      });
    }, 30000);
  });
});

describe('End-to-End DORA Metrics Calculation', () => {
  it('calculates DORA metrics from real GitHub data', async () => {
    const client = createGitHubClient({ token: process.env.GITHUB_TOKEN });
    const repo = client.parseRepoString(TEST_REPO);

    // Fetch data
    const [pullRequests, workflowRuns, issueData] = await Promise.all([
      client.fetchMergedPullRequests(repo, SHORT_PERIOD),
      client.fetchWorkflowRuns(repo, SHORT_PERIOD),
      client.fetchIncidentIssues(repo, SHORT_PERIOD),
    ]);

    // Convert workflows to deployments
    const deployments = client.convertWorkflowsToDeployments(workflowRuns);

    // Create mock Jira incidents from GitHub issues
    const jira = createMockJiraClient({ baseUrl: 'https://jira.example.com' });
    const incidents = jira.generateMockIncidentsFromGitHub(issueData, 'REACT');

    // Calculate metrics
    const metrics = calculateDORAMetrics(pullRequests, deployments, incidents, SHORT_PERIOD);

    // Verify all metrics are calculated
    expect(metrics.deploymentFrequency).toBeDefined();
    expect(metrics.deploymentFrequency.value).toBeGreaterThanOrEqual(0);
    expect(metrics.deploymentFrequency.level).toBeDefined();

    expect(metrics.leadTimeForChanges).toBeDefined();
    expect(metrics.leadTimeForChanges.median).toBeGreaterThanOrEqual(0);
    expect(metrics.leadTimeForChanges.level).toBeDefined();

    expect(metrics.changeFailureRate).toBeDefined();
    expect(metrics.changeFailureRate.rate).toBeGreaterThanOrEqual(0);
    expect(metrics.changeFailureRate.rate).toBeLessThanOrEqual(100);
    expect(metrics.changeFailureRate.level).toBeDefined();

    expect(metrics.failedDeploymentRecoveryTime).toBeDefined();
    expect(metrics.failedDeploymentRecoveryTime.median).toBeGreaterThanOrEqual(0);
    expect(metrics.failedDeploymentRecoveryTime.level).toBeDefined();

    expect(metrics.overallLevel).toBeDefined();
    expect(['elite', 'high', 'medium', 'low']).toContain(metrics.overallLevel);

    // Log results for manual verification
    console.log('\n=== DORA Metrics for facebook/react (last 7 days) ===');
    console.log(`Pull Requests Analyzed: ${pullRequests.length}`);
    console.log(`Deployments (from workflows): ${deployments.length}`);
    console.log(`Incidents: ${incidents.length}`);
    console.log('\nMetrics:');
    console.log(`  Deployment Frequency: ${metrics.deploymentFrequency.value} per ${metrics.deploymentFrequency.unit} (${metrics.deploymentFrequency.level})`);
    console.log(`  Lead Time: ${metrics.leadTimeForChanges.median} hours median (${metrics.leadTimeForChanges.level})`);
    console.log(`  Change Failure Rate: ${metrics.changeFailureRate.rate}% (${metrics.changeFailureRate.level})`);
    console.log(`  Recovery Time: ${metrics.failedDeploymentRecoveryTime.median} hours median (${metrics.failedDeploymentRecoveryTime.level})`);
    console.log(`\nOverall Performance: ${metrics.overallLevel.toUpperCase()}`);
  }, 60000);
});

describe('Multiple Repository Comparison', () => {
  // Requires GITHUB_TOKEN for authenticated requests (higher rate limits)
  it('can fetch data from multiple public repositories', async () => {
    const repos = ['facebook/react', 'vercel/next.js', 'microsoft/vscode'];
    const client = createGitHubClient({ token: process.env.GITHUB_TOKEN });
    const results: Map<string, { prCount: number; workflowCount: number }> = new Map();

    for (const repoStr of repos) {
      try {
        const repo = client.parseRepoString(repoStr);
        const [prs, workflows] = await Promise.all([
          client.fetchMergedPullRequests(repo, SHORT_PERIOD),
          client.fetchWorkflowRuns(repo, SHORT_PERIOD),
        ]);

        results.set(repoStr, {
          prCount: prs.length,
          workflowCount: workflows.length,
        });
      } catch (error) {
        // Some repos might have rate limiting issues
        console.log(`Skipping ${repoStr} due to error:`, error);
      }
    }

    // At least one repo should have data
    expect(results.size).toBeGreaterThan(0);

    console.log('\n=== Multi-Repo Data Summary ===');
    results.forEach((data, repo) => {
      console.log(`${repo}: ${data.prCount} PRs, ${data.workflowCount} workflow runs`);
    });
  }, 120000);
});

describe('Data Quality Validation', () => {
  // Requires GITHUB_TOKEN for authenticated requests (higher rate limits)
  it('validates PR data has required fields', async () => {
    const client = createGitHubClient({ token: process.env.GITHUB_TOKEN });
    const repo = client.parseRepoString(TEST_REPO);
    const pullRequests = await client.fetchMergedPullRequests(repo, SHORT_PERIOD);

    pullRequests.forEach((pr) => {
      // Required fields
      expect(typeof pr.id).toBe('number');
      expect(typeof pr.number).toBe('number');
      expect(typeof pr.title).toBe('string');
      expect(pr.state).toBe('merged');
      expect(pr.mergedAt).not.toBeNull();
      expect(pr.repository).toBeDefined();
      expect(Array.isArray(pr.labels)).toBe(true);

      // Date validation
      expect(pr.createdAt.getTime()).toBeLessThanOrEqual(pr.mergedAt!.getTime());
    });
  }, 30000);

  it('validates deployment data has required fields', async () => {
    const client = createGitHubClient({ token: process.env.GITHUB_TOKEN });
    const repo = client.parseRepoString(TEST_REPO);
    const workflows = await client.fetchWorkflowRuns(repo, SHORT_PERIOD);
    const deployments = client.convertWorkflowsToDeployments(workflows);

    deployments.forEach((d) => {
      expect(typeof d.id).toBe('string');
      expect(typeof d.environment).toBe('string');
      expect(['success', 'failure', 'pending', 'in_progress', 'queued']).toContain(d.status);
      expect(d.createdAt).toBeInstanceOf(Date);
      expect(d.repository).toBeDefined();
    });
  }, 30000);
});
