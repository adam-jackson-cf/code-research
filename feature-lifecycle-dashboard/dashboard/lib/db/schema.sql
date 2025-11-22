-- Feature Lifecycle Dashboard Database Schema

-- Case Studies
CREATE TABLE IF NOT EXISTS case_studies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('project', 'sprint', 'ticket')),
  jira_project_key TEXT NOT NULL,
  jira_project_id TEXT,
  jira_sprint_id TEXT,
  jira_ticket_key TEXT,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  imported_at DATETIME NOT NULL,
  imported_by TEXT,
  ticket_count INTEGER DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  start_date DATETIME,
  end_date DATETIME,
  status TEXT NOT NULL CHECK(status IN ('importing', 'completed', 'error')),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_case_studies_status ON case_studies(status);
CREATE INDEX IF NOT EXISTS idx_case_studies_type ON case_studies(type);

-- Jira Tickets
CREATE TABLE IF NOT EXISTS jira_tickets (
  id TEXT PRIMARY KEY,
  case_study_id TEXT NOT NULL,
  jira_id TEXT NOT NULL,
  jira_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  issue_type TEXT NOT NULL,
  priority TEXT,
  current_status TEXT NOT NULL,
  status_category TEXT NOT NULL CHECK(status_category IN ('To Do', 'In Progress', 'Done')),
  assignee_id TEXT,
  assignee_name TEXT,
  reporter_id TEXT,
  reporter_name TEXT,
  sprint_id TEXT,
  sprint_name TEXT,
  story_points REAL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  resolved_at DATETIME,
  due_date DATETIME,
  lead_time INTEGER,
  cycle_time INTEGER,
  raw_jira_data TEXT NOT NULL, -- JSON
  FOREIGN KEY (case_study_id) REFERENCES case_studies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jira_tickets_case_study ON jira_tickets(case_study_id);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_key ON jira_tickets(jira_key);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_status ON jira_tickets(current_status);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_sprint ON jira_tickets(sprint_id);

-- Lifecycle Events
CREATE TABLE IF NOT EXISTS lifecycle_events (
  id TEXT PRIMARY KEY,
  case_study_id TEXT NOT NULL,
  ticket_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL CHECK(event_source IN ('jira', 'github')),
  event_date DATETIME NOT NULL,
  actor_name TEXT NOT NULL,
  actor_id TEXT,
  details TEXT NOT NULL, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_study_id) REFERENCES case_studies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_case_study ON lifecycle_events(case_study_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_ticket ON lifecycle_events(ticket_key);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_date ON lifecycle_events(event_date);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_type ON lifecycle_events(event_type);

-- GitHub Commits
CREATE TABLE IF NOT EXISTS github_commits (
  id TEXT PRIMARY KEY,
  case_study_id TEXT NOT NULL,
  ticket_key TEXT NOT NULL,
  sha TEXT NOT NULL,
  message TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  committed_at DATETIME NOT NULL,
  branch_name TEXT,
  pr_number INTEGER,
  additions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  files_changed INTEGER DEFAULT 0,
  url TEXT NOT NULL,
  FOREIGN KEY (case_study_id) REFERENCES case_studies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_github_commits_case_study ON github_commits(case_study_id);
CREATE INDEX IF NOT EXISTS idx_github_commits_ticket ON github_commits(ticket_key);
CREATE INDEX IF NOT EXISTS idx_github_commits_sha ON github_commits(sha);
CREATE INDEX IF NOT EXISTS idx_github_commits_pr ON github_commits(pr_number);

-- GitHub Pull Requests
CREATE TABLE IF NOT EXISTS github_pull_requests (
  id TEXT PRIMARY KEY,
  case_study_id TEXT NOT NULL,
  ticket_keys TEXT NOT NULL, -- JSON array
  pr_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  state TEXT NOT NULL CHECK(state IN ('open', 'closed', 'merged')),
  author_name TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  closed_at DATETIME,
  merged_at DATETIME,
  base_branch TEXT NOT NULL,
  head_branch TEXT NOT NULL,
  additions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  commits_count INTEGER DEFAULT 0,
  reviewers TEXT, -- JSON array
  approved_by TEXT, -- JSON array
  url TEXT NOT NULL,
  FOREIGN KEY (case_study_id) REFERENCES case_studies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_github_prs_case_study ON github_pull_requests(case_study_id);
CREATE INDEX IF NOT EXISTS idx_github_prs_number ON github_pull_requests(pr_number);
CREATE INDEX IF NOT EXISTS idx_github_prs_state ON github_pull_requests(state);
