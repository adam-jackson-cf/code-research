# Feature Lifecycle Dashboard - System Architecture

## Overview

A comprehensive dashboard application that tracks the complete development lifecycle of features from Jira ticket creation through GitHub PR merge and release deployment.

## Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.7+
- **Framework**: Next.js 15 (App Router) with API routes
- **Data Integration**:
  - `jira.js` for Jira API
  - `octokit` for GitHub API
- **Database**: SQLite with `better-sqlite3`
- **Testing**: Vitest with msw (Mock Service Worker)
- **Validation**: Zod for runtime type safety

### Frontend
- **Framework**: React 19 + Next.js 15
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Timeline Visualization**: vis-timeline (react-vis-timeline)
- **Charts**: Recharts
- **State Management**: React Context + TanStack Query
- **Forms**: React Hook Form + Zod

### Quality Gates
- **Linting**: ESLint + @typescript-eslint
- **Formatting**: Prettier
- **Type Checking**: TypeScript strict mode
- **Pre-commit**: Husky + lint-staged
- **Testing**: Unit tests (Vitest) + Integration tests

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Dashboard   │  │  Case Study  │  │   Import     │          │
│  │     View     │  │     List     │  │    Wizard    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Timeline & Metrics Components                  │  │
│  │  - Lifecycle Timeline (vis-timeline)                      │  │
│  │  - Metrics Cards (Cycle Time, Lead Time, etc.)           │  │
│  │  - Status Distribution Chart (Recharts)                   │  │
│  │  - Sprint Velocity Chart                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ TanStack Query
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                    API LAYER (Next.js API Routes)              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /api/case-studies                                              │
│  ├─ GET /           - List all case studies                     │
│  ├─ GET /:id        - Get case study details                    │
│  ├─ POST /          - Create new case study                     │
│  └─ DELETE /:id     - Delete case study                         │
│                                                                 │
│  /api/import                                                    │
│  ├─ POST /jira/project  - Import Jira project                   │
│  ├─ POST /jira/sprint   - Import Jira sprint                    │
│  ├─ POST /jira/ticket   - Import single Jira ticket             │
│  └─ POST /github        - Import related GitHub data            │
│                                                                 │
│  /api/metrics                                                   │
│  ├─ GET /:caseStudyId/timeline   - Get lifecycle timeline       │
│  ├─ GET /:caseStudyId/cycle-time - Calculate cycle time         │
│  └─ GET /:caseStudyId/velocity   - Calculate sprint velocity    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                      SERVICE LAYER                              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐               │
│  │  JiraImportService │  │ GitHubImportService│               │
│  ├────────────────────┤  ├────────────────────┤               │
│  │ - importProject()  │  │ - importCommits()  │               │
│  │ - importSprint()   │  │ - importPRs()      │               │
│  │ - importTicket()   │  │ - importBranches() │               │
│  │ - fetchChangelog() │  │ - importReleases() │               │
│  └────────────────────┘  └────────────────────┘               │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐               │
│  │ CorrelationService │  │  CaseStudyService  │               │
│  ├────────────────────┤  ├────────────────────┤               │
│  │ - matchTicketIds() │  │ - create()         │               │
│  │ - linkCommits()    │  │ - get()            │               │
│  │ - linkPRs()        │  │ - list()           │               │
│  │ - buildTimeline()  │  │ - delete()         │               │
│  └────────────────────┘  └────────────────────┘               │
│                                                                 │
│  ┌────────────────────┐                                        │
│  │   MetricsService   │                                        │
│  ├────────────────────┤                                        │
│  │ - calcCycleTime()  │                                        │
│  │ - calcLeadTime()   │                                        │
│  │ - calcVelocity()   │                                        │
│  │ - getTimeline()    │                                        │
│  └────────────────────┘                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                    DATA ACCESS LAYER                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   CaseStudy  │  │  JiraTicket  │  │GitHubActivity│        │
│  │  Repository  │  │  Repository  │  │  Repository  │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │   Lifecycle  │  │    Metrics   │                           │
│  │EventRepository│  │  Repository  │                           │
│  └──────────────┘  └──────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                    DATABASE (SQLite)                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  case_studies  │  jira_tickets  │  github_commits              │
│  sprints       │  lifecycle_events  │  github_prs              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Data Models

### 1. CaseStudy

Represents an imported dataset (project, sprint, or ticket).

```typescript
interface CaseStudy {
  id: string; // UUID
  name: string; // User-defined name
  type: 'project' | 'sprint' | 'ticket';

  // Jira metadata
  jiraProjectKey: string; // e.g., "KAFKA"
  jiraProjectId?: string;
  jiraSprintId?: string;
  jiraTicketKey?: string; // If single ticket import

  // GitHub metadata
  githubOwner: string; // e.g., "apache"
  githubRepo: string; // e.g., "kafka"

  // Import metadata
  importedAt: Date;
  importedBy?: string; // User ID if auth is implemented
  ticketCount: number;
  eventCount: number;

  // Date range
  startDate: Date; // Earliest event
  endDate: Date; // Latest event

  // Status
  status: 'importing' | 'completed' | 'error';
  errorMessage?: string;
}
```

### 2. JiraTicket

Processed Jira ticket data optimized for lifecycle tracking.

```typescript
interface JiraTicket {
  id: string; // UUID (internal)
  caseStudyId: string; // FK to CaseStudy

  // Jira identifiers
  jiraId: string; // Jira internal ID
  jiraKey: string; // e.g., "KAFKA-19734"

  // Basic info
  summary: string;
  description?: string;
  issueType: string; // Story, Bug, Task, etc.
  priority: string; // High, Medium, Low

  // Status
  currentStatus: string; // Current status name
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
  rawJiraData: object; // Full Jira API response
}
```

### 3. LifecycleEvent

Unified timeline events from both Jira and GitHub.

```typescript
interface LifecycleEvent {
  id: string; // UUID
  caseStudyId: string; // FK to CaseStudy
  ticketKey: string; // e.g., "KAFKA-19734"

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

enum EventType {
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

interface EventDetails {
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
  metadata?: Record<string, any>;
}
```

### 4. GitHubActivity

Processed GitHub data linked to Jira tickets.

```typescript
interface GitHubCommit {
  id: string; // UUID
  caseStudyId: string;
  ticketKey: string; // Extracted from commit message

  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  committedAt: Date;

  branchName?: string;
  prNumber?: number; // If associated with PR

  additions: number;
  deletions: number;
  filesChanged: number;

  url: string;
}

interface GitHubPullRequest {
  id: string; // UUID
  caseStudyId: string;
  ticketKeys: string[]; // Multiple tickets may be in one PR

  prNumber: number;
  title: string;
  description?: string;
  state: 'open' | 'closed' | 'merged';

  authorName: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  mergedAt?: Date;

  baseBranch: string; // e.g., "main"
  headBranch: string; // e.g., "feature/KAFKA-19734"

  additions: number;
  deletions: number;
  commitsCount: number;

  // Review info
  reviewers: string[];
  approvedBy: string[];

  url: string;
}
```

---

## Database Schema (SQLite)

```sql
-- Case Studies
CREATE TABLE case_studies (
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

-- Jira Tickets
CREATE TABLE jira_tickets (
  id TEXT PRIMARY KEY,
  case_study_id TEXT NOT NULL,
  jira_id TEXT NOT NULL,
  jira_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  issue_type TEXT NOT NULL,
  priority TEXT,
  current_status TEXT NOT NULL,
  status_category TEXT NOT NULL,
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

CREATE INDEX idx_jira_tickets_case_study ON jira_tickets(case_study_id);
CREATE INDEX idx_jira_tickets_key ON jira_tickets(jira_key);

-- Lifecycle Events
CREATE TABLE lifecycle_events (
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

CREATE INDEX idx_lifecycle_events_case_study ON lifecycle_events(case_study_id);
CREATE INDEX idx_lifecycle_events_ticket ON lifecycle_events(ticket_key);
CREATE INDEX idx_lifecycle_events_date ON lifecycle_events(event_date);

-- GitHub Commits
CREATE TABLE github_commits (
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

CREATE INDEX idx_github_commits_case_study ON github_commits(case_study_id);
CREATE INDEX idx_github_commits_ticket ON github_commits(ticket_key);

-- GitHub Pull Requests
CREATE TABLE github_pull_requests (
  id TEXT PRIMARY KEY,
  case_study_id TEXT NOT NULL,
  ticket_keys TEXT NOT NULL, -- JSON array
  pr_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  state TEXT NOT NULL,
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

CREATE INDEX idx_github_prs_case_study ON github_pull_requests(case_study_id);
CREATE INDEX idx_github_prs_number ON github_pull_requests(pr_number);
```

---

## Service Layer Details

### JiraImportService

```typescript
class JiraImportService {
  async importProject(projectKey: string, caseStudyId: string): Promise<void>
  async importSprint(sprintId: string, caseStudyId: string): Promise<void>
  async importTicket(ticketKey: string, caseStudyId: string): Promise<void>

  private async fetchTickets(jql: string): Promise<JiraIssue[]>
  private async fetchChangelog(ticketKey: string): Promise<JiraChangelog>
  private async processTicket(ticket: JiraIssue, caseStudyId: string): Promise<void>
  private async createLifecycleEvents(ticket: JiraIssue, changelog: JiraChangelog): Promise<LifecycleEvent[]>
}
```

### GitHubImportService

```typescript
class GitHubImportService {
  async importForCaseStudy(caseStudyId: string): Promise<void>

  private async fetchCommits(owner: string, repo: string, since: Date): Promise<GitHubCommit[]>
  private async fetchPullRequests(owner: string, repo: string, since: Date): Promise<GitHubPR[]>
  private async fetchPRDetails(owner: string, repo: string, prNumber: number): Promise<PRDetails>
  private async extractTicketIds(text: string): string[]
  private async createLifecycleEvents(activity: GitHubCommit | GitHubPR): Promise<LifecycleEvent[]>
}
```

### CorrelationService

```typescript
class CorrelationService {
  async correlateData(caseStudyId: string): Promise<void>

  private async matchCommitsToTickets(caseStudyId: string): Promise<void>
  private async matchPRsToTickets(caseStudyId: string): Promise<void>
  private async buildTimeline(caseStudyId: string): Promise<LifecycleEvent[]>
  private async calculateMetrics(caseStudyId: string): Promise<void>
}
```

### MetricsService

```typescript
class MetricsService {
  async getCycleTime(ticketKey: string): Promise<number>
  async getLeadTime(ticketKey: string): Promise<number>
  async getSprintVelocity(sprintId: string): Promise<number>
  async getTimeInStatus(ticketKey: string): Promise<Map<string, number>>
  async getTimeline(caseStudyId: string): Promise<LifecycleEvent[]>
  async getMetricsSummary(caseStudyId: string): Promise<MetricsSummary>
}

interface MetricsSummary {
  totalTickets: number;
  completedTickets: number;
  avgCycleTime: number;
  avgLeadTime: number;
  totalCommits: number;
  totalPRs: number;
  velocityPoints: number;
}
```

---

## Data Flow

### Import Flow

```
1. User initiates import via UI
   ↓
2. POST /api/import/jira/{type}
   - Validates input
   - Creates CaseStudy record (status: 'importing')
   ↓
3. JiraImportService.importXXX()
   - Fetches tickets from Jira API
   - Processes each ticket
   - Fetches changelog for each ticket
   - Creates JiraTicket records
   - Creates LifecycleEvents (Jira source)
   ↓
4. POST /api/import/github (auto-triggered)
   ↓
5. GitHubImportService.importForCaseStudy()
   - Extracts date range from Jira tickets
   - Fetches commits in date range
   - Extracts ticket IDs from commit messages
   - Fetches PRs in date range
   - Creates GitHubCommit records
   - Creates GitHubPullRequest records
   - Creates LifecycleEvents (GitHub source)
   ↓
6. CorrelationService.correlateData()
   - Links commits to tickets
   - Links PRs to tickets
   - Builds unified timeline
   - Calculates metrics (lead time, cycle time)
   ↓
7. Update CaseStudy (status: 'completed')
   ↓
8. Return success to UI
```

### Dashboard View Flow

```
1. User opens dashboard
   ↓
2. GET /api/case-studies
   - Returns list of case studies
   ↓
3. User selects case study
   ↓
4. GET /api/case-studies/:id
   - Returns case study details
   ↓
5. GET /api/metrics/:id/timeline
   - Returns lifecycle events for timeline
   ↓
6. GET /api/metrics/:id/cycle-time
   - Returns cycle time metrics
   ↓
7. Render dashboard with:
   - Timeline visualization
   - Metrics cards
   - Charts
```

---

## Testing Strategy

### Unit Tests

Each service and repository will have comprehensive unit tests:

```typescript
// Example: jira-import.service.test.ts
describe('JiraImportService', () => {
  it('should import project tickets', async () => {
    // Mock Jira API responses
    // Test import logic
  });

  it('should create lifecycle events from changelog', async () => {
    // Mock changelog data
    // Verify event creation
  });

  it('should handle pagination correctly', async () => {
    // Mock paginated responses
    // Verify all pages are fetched
  });
});
```

### Integration Tests

Using Mock Service Worker (msw) to mock external APIs:

```typescript
// Example: import-flow.integration.test.ts
describe('Import Flow Integration', () => {
  beforeAll(() => {
    // Set up MSW handlers for Jira and GitHub APIs
    server.listen();
  });

  it('should complete full import from Jira to GitHub correlation', async () => {
    // 1. Create case study
    // 2. Import Jira tickets (mocked)
    // 3. Import GitHub data (mocked)
    // 4. Verify correlation
    // 5. Verify timeline generation
    // 6. Verify metrics calculation
  });

  it('should handle Apache Kafka test data', async () => {
    // Use real Kafka commit patterns
    // Verify ticket ID extraction
    // Verify PR linking
  });
});
```

### Test Data

- Mock Jira fixtures in `/tests/fixtures/jira/`
- Mock GitHub fixtures in `/tests/fixtures/github/`
- Based on real Apache Kafka patterns
- 30 sample tickets covering various scenarios

---

## API Endpoints

### Case Studies

- `GET /api/case-studies` - List all case studies
- `GET /api/case-studies/:id` - Get case study details
- `POST /api/case-studies` - Create new case study
- `DELETE /api/case-studies/:id` - Delete case study

### Import

- `POST /api/import/jira/project` - Import Jira project
- `POST /api/import/jira/sprint` - Import Jira sprint
- `POST /api/import/jira/ticket` - Import single Jira ticket
- `POST /api/import/github` - Import related GitHub data

### Metrics

- `GET /api/metrics/:caseStudyId/timeline` - Get lifecycle timeline
- `GET /api/metrics/:caseStudyId/summary` - Get metrics summary
- `GET /api/metrics/:caseStudyId/cycle-time` - Get cycle time data
- `GET /api/metrics/:caseStudyId/lead-time` - Get lead time data
- `GET /api/metrics/:caseStudyId/velocity` - Get sprint velocity

---

## Frontend Architecture

### Pages

```
/                          - Home (case study list)
/case-studies/[id]         - Dashboard view for specific case study
/case-studies/[id]/timeline - Full timeline view
/import/new                - Import wizard
```

### Components

```
/components
  /layout
    - Header.tsx
    - Sidebar.tsx
  /case-studies
    - CaseStudyList.tsx
    - CaseStudyCard.tsx
  /dashboard
    - DashboardView.tsx
    - MetricsCards.tsx
    - TimelineView.tsx
    - CycleTimeChart.tsx
    - LeadTimeChart.tsx
    - VelocityChart.tsx
    - StatusDistribution.tsx
  /import
    - ImportWizard.tsx
    - JiraImportForm.tsx
    - GitHubConfigForm.tsx
  /ui (shadcn/ui components)
    - button.tsx
    - card.tsx
    - form.tsx
    - etc.
```

---

## Deployment Considerations

### Environment Variables

```env
# Jira Configuration
JIRA_HOST=https://issues.apache.org/jira
JIRA_EMAIL=user@example.com
JIRA_API_TOKEN=xxx

# GitHub Configuration
GITHUB_TOKEN=ghp_xxx

# Database
DATABASE_PATH=./data/lifecycle.db

# Next.js
NODE_ENV=production
```

### Build Process

```bash
npm run build     # Build Next.js app
npm run test      # Run all tests
npm run lint      # Run ESLint
npm run typecheck # Run TypeScript check
```

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "vitest related --run"
    ]
  }
}
```

---

## Security Considerations

1. **API Tokens**: Store in environment variables, never commit
2. **Input Validation**: Use Zod schemas for all inputs
3. **SQL Injection**: Use parameterized queries (better-sqlite3 handles this)
4. **Rate Limiting**: Implement rate limiting for API calls
5. **Authentication**: Consider adding user auth for production use

---

## Performance Optimization

1. **Pagination**: All list endpoints support pagination
2. **Caching**: Use TanStack Query for client-side caching
3. **Incremental Import**: Support incremental updates (only new tickets)
4. **Database Indexing**: Strategic indexes on foreign keys and search fields
5. **Lazy Loading**: Load timeline data on-demand

---

## Future Enhancements

1. **Multi-user Support**: Add authentication and user management
2. **Real-time Updates**: WebSocket support for live import progress
3. **Export Features**: Export reports as PDF or CSV
4. **Custom Metrics**: Allow users to define custom metrics
5. **Bitbucket Support**: Add support for Bitbucket in addition to GitHub
6. **GitLab Support**: Add support for GitLab
7. **Advanced Analytics**: ML-based predictions for cycle time
8. **Team Dashboards**: Aggregate metrics across multiple case studies

---

## Technology Decisions

### Why Next.js?
- Unified frontend + backend in one framework
- API routes eliminate need for separate backend server
- Server-side rendering for better performance
- Built-in optimization and code splitting

### Why SQLite?
- Serverless, no additional infrastructure needed
- Perfect for single-machine deployments
- Excellent performance for read-heavy workloads
- Easy backup and portability
- Can be migrated to PostgreSQL if needed

### Why Vitest?
- 10-20x faster than Jest
- Native TypeScript and ESM support
- Jest-compatible API (easy migration path)
- Excellent developer experience

### Why vis-timeline?
- Mature, battle-tested library
- Rich interactive features (zoom, pan, drag)
- Handles large datasets efficiently
- Customizable styling

---

This architecture provides a solid foundation for building a comprehensive feature lifecycle dashboard with proper separation of concerns, testability, and scalability.
