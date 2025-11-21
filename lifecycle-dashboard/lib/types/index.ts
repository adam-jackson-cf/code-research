// Core domain types for the Feature Lifecycle Dashboard

export interface CaseStudy {
  id: string; // UUID
  name: string;
  type: 'project' | 'sprint' | 'ticket';

  // Jira metadata
  jiraProjectKey: string;
  jiraProjectId?: string;
  jiraSprintId?: string;
  jiraTicketKey?: string;

  // GitHub metadata
  githubOwner: string;
  githubRepo: string;

  // Import metadata
  importedAt: Date;
  importedBy?: string;
  ticketCount: number;
  eventCount: number;

  // Date range
  startDate: Date;
  endDate: Date;

  // Status
  status: 'importing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface JiraTicket {
  id: string; // UUID (internal)
  caseStudyId: string;

  // Jira identifiers
  jiraId: string;
  jiraKey: string; // e.g., "KAFKA-19734"

  // Basic info
  summary: string;
  description?: string;
  issueType: string;
  priority: string;

  // Status
  currentStatus: string;
  statusCategory: 'To Do' | 'In Progress' | 'Done';

  // People
  assigneeId?: string;
  assigneeName?: string;
  reporterId?: string;
  reporterName?: string;

  // Sprint info
  sprintId?: string;
  sprintName?: string;
  storyPoints?: number;

  // Dates
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  dueDate?: Date;

  // Metrics (calculated)
  leadTime?: number; // milliseconds
  cycleTime?: number; // milliseconds

  // Raw data (for reference)
  rawJiraData: object;
}

export enum EventType {
  // Jira events
  TICKET_CREATED = 'ticket_created',
  STATUS_CHANGED = 'status_changed',
  ASSIGNEE_CHANGED = 'assignee_changed',
  SPRINT_ASSIGNED = 'sprint_assigned',
  COMMENT_ADDED = 'comment_added',
  RESOLVED = 'resolved',

  // GitHub events
  COMMIT_CREATED = 'commit_created',
  BRANCH_CREATED = 'branch_created',
  PR_OPENED = 'pr_opened',
  PR_REVIEWED = 'pr_reviewed',
  PR_APPROVED = 'pr_approved',
  PR_MERGED = 'pr_merged',
  DEPLOYED_TO_BRANCH = 'deployed_to_branch',
}

export interface EventDetails {
  // Status change
  fromStatus?: string;
  toStatus?: string;

  // Commit
  commitSha?: string;
  commitMessage?: string;
  commitUrl?: string;

  // PR
  prNumber?: number;
  prTitle?: string;
  prUrl?: string;
  prState?: 'open' | 'closed' | 'merged';

  // Branch
  branchName?: string;

  // Review
  reviewState?: 'approved' | 'changes_requested' | 'commented';
  reviewComment?: string;

  // Generic
  metadata?: Record<string, unknown>;
}

export interface LifecycleEvent {
  id: string; // UUID
  caseStudyId: string;
  ticketKey: string;

  // Event details
  eventType: EventType;
  eventSource: 'jira' | 'github';
  eventDate: Date;

  // Actor
  actorName: string;
  actorId?: string;

  // Event-specific data
  details: EventDetails;

  // Metadata
  createdAt: Date;
}

export interface GitHubCommit {
  id: string; // UUID
  caseStudyId: string;
  ticketKey: string;

  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  committedAt: Date;

  branchName?: string;
  prNumber?: number;

  additions: number;
  deletions: number;
  filesChanged: number;

  url: string;
}

export interface GitHubPullRequest {
  id: string; // UUID
  caseStudyId: string;
  ticketKeys: string[];

  prNumber: number;
  title: string;
  description?: string;
  state: 'open' | 'closed' | 'merged';

  authorName: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  mergedAt?: Date;

  baseBranch: string;
  headBranch: string;

  additions: number;
  deletions: number;
  commitsCount: number;

  // Review info
  reviewers: string[];
  approvedBy: string[];

  url: string;
}

export interface MetricsSummary {
  totalTickets: number;
  completedTickets: number;
  avgCycleTime: number;
  avgLeadTime: number;
  totalCommits: number;
  totalPRs: number;
  velocityPoints: number;
}

// Database row types (with JSON strings where needed)
export interface CaseStudyRow {
  id: string;
  name: string;
  type: string;
  jira_project_key: string;
  jira_project_id: string | null;
  jira_sprint_id: string | null;
  jira_ticket_key: string | null;
  github_owner: string;
  github_repo: string;
  imported_at: string; // ISO date string
  imported_by: string | null;
  ticket_count: number;
  event_count: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface JiraTicketRow {
  id: string;
  case_study_id: string;
  jira_id: string;
  jira_key: string;
  summary: string;
  description: string | null;
  issue_type: string;
  priority: string;
  current_status: string;
  status_category: string;
  assignee_id: string | null;
  assignee_name: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  sprint_id: string | null;
  sprint_name: string | null;
  story_points: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  due_date: string | null;
  lead_time: number | null;
  cycle_time: number | null;
  raw_jira_data: string; // JSON string
}

export interface LifecycleEventRow {
  id: string;
  case_study_id: string;
  ticket_key: string;
  event_type: string;
  event_source: string;
  event_date: string;
  actor_name: string;
  actor_id: string | null;
  details: string; // JSON string
  created_at: string;
}

export interface GitHubCommitRow {
  id: string;
  case_study_id: string;
  ticket_key: string;
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  committed_at: string;
  branch_name: string | null;
  pr_number: number | null;
  additions: number;
  deletions: number;
  files_changed: number;
  url: string;
}

export interface GitHubPullRequestRow {
  id: string;
  case_study_id: string;
  ticket_keys: string; // JSON array string
  pr_number: number;
  title: string;
  description: string | null;
  state: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  base_branch: string;
  head_branch: string;
  additions: number;
  deletions: number;
  commits_count: number;
  reviewers: string | null; // JSON array string
  approved_by: string | null; // JSON array string
  url: string;
}
