/**
 * Main Application Component
 * Sets up the DORA Metrics Dashboard with data fetching
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Dashboard } from './dashboard';
import { createGitHubClient } from './api/github';
import { createMockJiraClient } from './api/jira';
import type {
  PullRequest,
  Deployment,
  JiraIssue,
  GitHubRepository,
  Feature,
  TimePeriod,
} from './types';

interface AppProps {
  repositoryUrl?: string;
  githubToken?: string;
}

export const App: React.FC<AppProps> = ({
  repositoryUrl = 'facebook/react',
  githubToken,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    pullRequests: PullRequest[];
    deployments: Deployment[];
    incidents: JiraIssue[];
    repositories: GitHubRepository[];
    features: Feature[];
  } | null>(null);

  const period: TimePeriod = {
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    end: new Date(),
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const github = createGitHubClient({ token: githubToken });
      const repo = github.parseRepoString(repositoryUrl);

      // Fetch GitHub data
      const [pullRequests, workflowRuns, issueData] = await Promise.all([
        github.fetchMergedPullRequests(repo, period),
        github.fetchWorkflowRuns(repo, period),
        github.fetchIncidentIssues(repo, period),
      ]);

      // Convert workflow runs to deployments if no explicit deployments
      let deployments: Deployment[] = [];
      try {
        deployments = await github.fetchDeployments(repo, period);
      } catch {
        // Use workflow runs as deployment proxy
        deployments = github.convertWorkflowsToDeployments(workflowRuns);
      }

      // If still no deployments, create synthetic ones from merged PRs
      if (deployments.length === 0) {
        deployments = pullRequests.map((pr) => ({
          id: `pr-${pr.number}`,
          environment: 'production',
          status: 'success' as const,
          createdAt: pr.mergedAt!,
          completedAt: pr.mergedAt,
          repository: repo,
          sha: `pr-sha-${pr.number}`,
          ref: 'main',
          prNumber: pr.number,
        }));
      }

      // Create mock Jira incidents from GitHub issues
      const jira = createMockJiraClient({ baseUrl: 'https://jira.example.com' });
      const incidents = jira.generateMockIncidentsFromGitHub(issueData, repo.name.toUpperCase());

      // Extract features from PR labels
      const labelCounts = new Map<string, number>();
      pullRequests.forEach((pr) => {
        pr.labels.forEach((label) => {
          labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
        });
      });

      const features: Feature[] = Array.from(labelCounts.entries())
        .filter(([_, count]) => count >= 2)
        .slice(0, 10)
        .map(([label], idx) => ({
          id: `feature-${idx}`,
          name: label,
          labels: [label],
          pullRequests: pullRequests.filter((pr) => pr.labels.includes(label)).map((pr) => pr.number),
          deployments: [],
          incidents: [],
        }));

      setData({
        pullRequests,
        deployments,
        incidents,
        repositories: [repo],
        features,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [repositoryUrl, githubToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f3f4f6',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e5e7eb',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>Loading DORA metrics...</p>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>Fetching data from {repositoryUrl}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f3f4f6',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '32px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            maxWidth: '500px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#fee2e2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <span style={{ fontSize: '24px' }}>!</span>
          </div>
          <h2 style={{ margin: '0 0 8px 0', color: '#991b1b' }}>Failed to Load Data</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>{error}</p>
          <button
            onClick={fetchData}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Dashboard
      pullRequests={data.pullRequests}
      deployments={data.deployments}
      incidents={data.incidents}
      repositories={data.repositories}
      features={data.features}
      initialPeriod={period}
    />
  );
};

export default App;
