/**
 * GitHub API Client for DORA Metrics
 * Fetches pull requests, deployments, and workflow runs
 */

import { Octokit } from 'octokit';
import type {
  GitHubRepository,
  PullRequest,
  Deployment,
  WorkflowRun,
  GitHubConfig,
  TimePeriod,
} from '../types';

export class GitHubClient {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig = {}) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
      baseUrl: config.baseUrl,
    });
  }

  /**
   * Parse a repository string like "owner/repo" into GitHubRepository
   */
  parseRepoString(repoString: string): GitHubRepository {
    const [owner, name] = repoString.split('/');
    if (!owner || !name) {
      throw new Error(`Invalid repository string: ${repoString}`);
    }
    return { owner, name, fullName: repoString };
  }

  /**
   * Fetch merged pull requests within a time period
   */
  async fetchMergedPullRequests(
    repo: GitHubRepository,
    period: TimePeriod
  ): Promise<PullRequest[]> {
    const pullRequests: PullRequest[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.octokit.rest.pulls.list({
        owner: repo.owner,
        repo: repo.name,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: perPage,
        page,
      });

      if (response.data.length === 0) break;

      for (const pr of response.data) {
        if (!pr.merged_at) continue;

        const mergedAt = new Date(pr.merged_at);
        if (mergedAt < period.start) {
          // PRs are sorted by updated date, so we might still find relevant ones
          continue;
        }
        if (mergedAt > period.end) continue;

        // Use PR creation date as approximation for first commit
        // This avoids additional API calls and provides reasonable lead time estimates
        const firstCommitAt = new Date(pr.created_at);

        pullRequests.push({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: 'merged',
          createdAt: new Date(pr.created_at),
          mergedAt,
          closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
          firstCommitAt,
          repository: repo,
          labels: pr.labels.map((l) => l.name ?? ''),
          author: pr.user?.login || 'unknown',
          additions: 0, // Not fetched to reduce API calls
          deletions: 0,
          changedFiles: 0,
        });
      }

      // Check if oldest PR in this page is before our period start
      const oldestUpdated = response.data[response.data.length - 1]?.updated_at;
      if (oldestUpdated && new Date(oldestUpdated) < period.start) {
        break;
      }

      page++;
      if (page > 10) break; // Safety limit
    }

    return pullRequests;
  }

  /**
   * Fetch deployments for a repository
   */
  async fetchDeployments(
    repo: GitHubRepository,
    period: TimePeriod,
    environment?: string
  ): Promise<Deployment[]> {
    const deployments: Deployment[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.octokit.rest.repos.listDeployments({
        owner: repo.owner,
        repo: repo.name,
        environment,
        per_page: perPage,
        page,
      });

      if (response.data.length === 0) break;

      for (const deployment of response.data) {
        const createdAt = new Date(deployment.created_at);
        if (createdAt < period.start || createdAt > period.end) continue;

        // Get deployment status
        const statuses = await this.octokit.rest.repos.listDeploymentStatuses({
          owner: repo.owner,
          repo: repo.name,
          deployment_id: deployment.id,
          per_page: 1,
        });

        const latestStatus = statuses.data[0];
        let status: Deployment['status'] = 'pending';
        let completedAt: Date | null = null;

        if (latestStatus) {
          status = latestStatus.state as Deployment['status'];
          completedAt = new Date(latestStatus.created_at);
        }

        deployments.push({
          id: deployment.id.toString(),
          environment: deployment.environment || 'unknown',
          status,
          createdAt,
          completedAt,
          repository: repo,
          sha: deployment.sha,
          ref: deployment.ref,
          description: deployment.description || undefined,
        });
      }

      page++;
      if (page > 10) break; // Safety limit
    }

    return deployments;
  }

  /**
   * Fetch workflow runs (can be used as deployment proxy if no explicit deployments)
   */
  async fetchWorkflowRuns(
    repo: GitHubRepository,
    period: TimePeriod,
    workflowFileName?: string
  ): Promise<WorkflowRun[]> {
    const runs: WorkflowRun[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const params: Parameters<typeof this.octokit.rest.actions.listWorkflowRunsForRepo>[0] = {
        owner: repo.owner,
        repo: repo.name,
        per_page: perPage,
        page,
        created: `${period.start.toISOString()}..${period.end.toISOString()}`,
      };

      const response = await this.octokit.rest.actions.listWorkflowRunsForRepo(params);

      if (response.data.workflow_runs.length === 0) break;

      for (const run of response.data.workflow_runs) {
        // Filter by workflow file if specified
        if (workflowFileName && !run.path?.includes(workflowFileName)) {
          continue;
        }

        runs.push({
          id: run.id,
          name: run.name || 'Unknown',
          status: run.status as WorkflowRun['status'],
          conclusion: run.conclusion as WorkflowRun['conclusion'],
          createdAt: new Date(run.created_at),
          updatedAt: new Date(run.updated_at),
          repository: repo,
          headSha: run.head_sha,
          event: run.event,
        });
      }

      page++;
      if (page > 10) break; // Safety limit
    }

    return runs;
  }

  /**
   * Convert workflow runs to deployments (for repos without explicit deployments)
   * Filters for production-like workflows
   */
  convertWorkflowsToDeployments(
    runs: WorkflowRun[],
    deploymentWorkflowPatterns: RegExp[] = [/deploy/i, /release/i, /prod/i]
  ): Deployment[] {
    const deploymentRuns = runs.filter((run) =>
      deploymentWorkflowPatterns.some((pattern) => pattern.test(run.name))
    );

    return deploymentRuns.map((run) => ({
      id: run.id.toString(),
      environment: 'production',
      status: run.conclusion === 'success'
        ? 'success'
        : run.conclusion === 'failure'
          ? 'failure'
          : 'pending',
      createdAt: run.createdAt,
      completedAt: run.updatedAt,
      repository: run.repository,
      sha: run.headSha,
      ref: 'main',
    }));
  }

  /**
   * Fetch issues labeled as bugs/incidents for failure rate calculation
   */
  async fetchIncidentIssues(
    repo: GitHubRepository,
    period: TimePeriod,
    incidentLabels: string[] = ['bug', 'incident', 'outage', 'hotfix']
  ): Promise<Array<{
    id: number;
    number: number;
    title: string;
    state: string;
    createdAt: Date;
    closedAt: Date | null;
    labels: string[];
  }>> {
    const issues: Array<{
      id: number;
      number: number;
      title: string;
      state: string;
      createdAt: Date;
      closedAt: Date | null;
      labels: string[];
    }> = [];

    for (const label of incidentLabels) {
      try {
        const response = await this.octokit.rest.issues.listForRepo({
          owner: repo.owner,
          repo: repo.name,
          labels: label,
          state: 'all',
          since: period.start.toISOString(),
          per_page: 100,
        });

        for (const issue of response.data) {
          if (issue.pull_request) continue; // Skip PRs

          const createdAt = new Date(issue.created_at);
          if (createdAt > period.end) continue;

          // Avoid duplicates
          if (issues.some((i) => i.id === issue.id)) continue;

          issues.push({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            state: issue.state,
            createdAt,
            closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
            labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
          });
        }
      } catch {
        // Label might not exist, continue
      }
    }

    return issues;
  }
}

// Default export for convenience
export const createGitHubClient = (config?: GitHubConfig) => new GitHubClient(config);
