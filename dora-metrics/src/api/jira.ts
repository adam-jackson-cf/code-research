/**
 * Jira API Client for DORA Metrics
 * Fetches issues, incidents, and project data
 */

import type {
  JiraProject,
  JiraIssue,
  JiraConfig,
  TimePeriod,
} from '../types';

export class JiraClient {
  private config: JiraConfig;
  private headers: HeadersInit;

  constructor(config: JiraConfig) {
    this.config = config;

    // Set up authentication headers if credentials provided
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (config.email && config.apiToken) {
      const auth = btoa(`${config.email}:${config.apiToken}`);
      this.headers['Authorization'] = `Basic ${auth}`;
    }
  }

  /**
   * Build API URL
   */
  private buildUrl(path: string): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    return `${baseUrl}/rest/api/2${path}`;
  }

  /**
   * Make authenticated request to Jira API
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch project details
   */
  async fetchProject(projectKey: string): Promise<JiraProject> {
    const data = await this.request<{
      id: string;
      key: string;
      name: string;
    }>(`/project/${projectKey}`);

    return {
      id: data.id,
      key: data.key,
      name: data.name,
    };
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(
    jql: string,
    maxResults = 100,
    startAt = 0
  ): Promise<{
    issues: JiraIssue[];
    total: number;
  }> {
    const data = await this.request<{
      issues: Array<{
        id: string;
        key: string;
        fields: {
          summary: string;
          issuetype: { name: string };
          status: { name: string };
          priority: { name: string };
          created: string;
          updated: string;
          resolutiondate: string | null;
          labels: string[];
          components: Array<{ name: string }>;
          project: { id: string; key: string; name: string };
          assignee: { displayName: string } | null;
          reporter: { displayName: string } | null;
          customfield_10000?: string; // Example: incident start time
          customfield_10001?: string; // Example: incident resolution time
          parent?: { key: string }; // Epic link
        };
      }>;
      total: number;
    }>(`/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}`);

    const issues: JiraIssue[] = data.issues.map((issue) => {
      const isIncident = this.isIncidentIssue(issue.fields.issuetype.name, issue.fields.labels);

      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        issueType: issue.fields.issuetype.name,
        status: issue.fields.status.name,
        priority: issue.fields.priority.name,
        created: new Date(issue.fields.created),
        updated: new Date(issue.fields.updated),
        resolved: issue.fields.resolutiondate
          ? new Date(issue.fields.resolutiondate)
          : null,
        labels: issue.fields.labels || [],
        components: issue.fields.components?.map((c) => c.name) || [],
        project: {
          id: issue.fields.project.id,
          key: issue.fields.project.key,
          name: issue.fields.project.name,
        },
        assignee: issue.fields.assignee?.displayName,
        reporter: issue.fields.reporter?.displayName,
        isIncident,
        incidentStartTime: issue.fields.customfield_10000
          ? new Date(issue.fields.customfield_10000)
          : undefined,
        incidentResolutionTime: issue.fields.customfield_10001
          ? new Date(issue.fields.customfield_10001)
          : undefined,
        featureKey: issue.fields.parent?.key,
      };
    });

    return { issues, total: data.total };
  }

  /**
   * Determine if an issue is an incident based on type and labels
   */
  private isIncidentIssue(issueType: string, labels: string[]): boolean {
    const incidentTypes = ['bug', 'incident', 'outage', 'hotfix', 'defect'];
    const incidentLabels = ['incident', 'outage', 'production-issue', 'p0', 'p1', 'critical'];

    if (incidentTypes.some((t) => issueType.toLowerCase().includes(t))) {
      return true;
    }

    return labels.some((label) =>
      incidentLabels.some((il) => label.toLowerCase().includes(il))
    );
  }

  /**
   * Fetch incidents within a time period
   */
  async fetchIncidents(
    projectKey: string,
    period: TimePeriod,
    incidentTypes: string[] = ['Bug', 'Incident']
  ): Promise<JiraIssue[]> {
    const typeFilter = incidentTypes.map((t) => `"${t}"`).join(', ');
    const jql = `project = ${projectKey} AND issuetype IN (${typeFilter}) AND created >= "${this.formatDate(period.start)}" AND created <= "${this.formatDate(period.end)}" ORDER BY created DESC`;

    const allIssues: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const { issues, total } = await this.searchIssues(jql, maxResults, startAt);
      allIssues.push(...issues.filter((i) => i.isIncident));

      if (startAt + issues.length >= total) break;
      startAt += maxResults;
    }

    return allIssues;
  }

  /**
   * Fetch all issues for a feature/epic
   */
  async fetchFeatureIssues(epicKey: string): Promise<JiraIssue[]> {
    const jql = `"Epic Link" = ${epicKey} OR parent = ${epicKey} ORDER BY created DESC`;

    const { issues } = await this.searchIssues(jql, 500);
    return issues;
  }

  /**
   * Fetch issues by label (for feature grouping)
   */
  async fetchIssuesByLabel(
    projectKey: string,
    label: string,
    period: TimePeriod
  ): Promise<JiraIssue[]> {
    const jql = `project = ${projectKey} AND labels = "${label}" AND created >= "${this.formatDate(period.start)}" AND created <= "${this.formatDate(period.end)}" ORDER BY created DESC`;

    const allIssues: JiraIssue[] = [];
    let startAt = 0;

    while (true) {
      const { issues, total } = await this.searchIssues(jql, 100, startAt);
      allIssues.push(...issues);

      if (startAt + issues.length >= total) break;
      startAt += 100;
    }

    return allIssues;
  }

  /**
   * Format date for JQL query
   */
  private formatDate(date: Date): string {
    const isoString = date.toISOString();
    return isoString.split('T')[0] ?? isoString.slice(0, 10);
  }
}

/**
 * Create a mock Jira client for testing with public data
 * Uses GitHub issues as a proxy since most public Jira instances
 * don't allow API access
 */
export class MockJiraClient extends JiraClient {
  private mockIssues: JiraIssue[] = [];

  constructor(config: JiraConfig) {
    super(config);
  }

  /**
   * Set mock issues for testing
   */
  setMockIssues(issues: JiraIssue[]): void {
    this.mockIssues = issues;
  }

  /**
   * Generate mock incidents from GitHub issues data
   */
  generateMockIncidentsFromGitHub(
    githubIssues: Array<{
      id: number;
      number: number;
      title: string;
      state: string;
      createdAt: Date;
      closedAt: Date | null;
      labels: string[];
    }>,
    projectKey: string
  ): JiraIssue[] {
    return githubIssues.map((issue, index) => ({
      id: issue.id.toString(),
      key: `${projectKey}-${issue.number}`,
      summary: issue.title,
      issueType: 'Bug',
      status: issue.state === 'closed' ? 'Done' : 'In Progress',
      priority: issue.labels.includes('critical') ? 'Critical' : 'Medium',
      created: issue.createdAt,
      updated: issue.closedAt || issue.createdAt,
      resolved: issue.closedAt,
      labels: issue.labels,
      components: [],
      project: {
        id: index.toString(),
        key: projectKey,
        name: projectKey,
      },
      isIncident: true,
      incidentStartTime: issue.createdAt,
      incidentResolutionTime: issue.closedAt || undefined,
    }));
  }

  override async fetchIncidents(
    projectKey: string,
    period: TimePeriod
  ): Promise<JiraIssue[]> {
    return this.mockIssues.filter(
      (issue) =>
        issue.project.key === projectKey &&
        issue.isIncident &&
        issue.created >= period.start &&
        issue.created <= period.end
    );
  }

  override async searchIssues(
    _jql: string,
    maxResults = 100,
    startAt = 0
  ): Promise<{ issues: JiraIssue[]; total: number }> {
    const filtered = this.mockIssues.slice(startAt, startAt + maxResults);
    return { issues: filtered, total: this.mockIssues.length };
  }
}

// Factory functions
export const createJiraClient = (config: JiraConfig) => new JiraClient(config);
export const createMockJiraClient = (config: JiraConfig) => new MockJiraClient(config);
