# Feature Lifecycle Dashboard - Research Documentation

**Project:** Feature Lifecycle Dashboard - Jira to GitHub Tracking
**Date:** 2025-11-21
**Status:** Research Complete, Implementation In Progress

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack Selection](#2-technology-stack-selection)
3. [Jira API Research](#3-jira-api-research)
4. [GitHub API Research](#4-github-api-research)
5. [Public Test Data Sources](#5-public-test-data-sources)
6. [Architecture Decisions](#6-architecture-decisions)
7. [Testing Strategy](#7-testing-strategy)

---

## 1. Executive Summary

### Project Goal
Build a dashboard application that tracks the complete development lifecycle of features from Jira ticket creation through GitHub PR merge and release deployment.

### Key Findings
- **Apache Kafka** is ideal for testing - has both public Jira (issues.apache.org/jira) and GitHub (apache/kafka)
- **jira.js** and **Octokit** are the recommended libraries for API integration
- Both APIs are publicly accessible without authentication for read-only access
- Commit messages consistently use `KAFKA-XXXXX:` format, enabling reliable correlation

### API Verification Results
```bash
# Jira API - VERIFIED WORKING
curl "https://issues.apache.org/jira/rest/api/2/issue/KAFKA-19734"
# Returns: Full issue details including status, assignee, dates

# GitHub API - VERIFIED WORKING
curl "https://api.github.com/repos/apache/kafka/commits?per_page=5"
# Returns: Commit history with messages containing KAFKA-XXXXX references
```

---

## 2. Technology Stack Selection

### Selected Stack

| Category | Selected | Rationale |
|----------|----------|-----------|
| **Backend Runtime** | Node.js 20+ | Modern LTS, native ESM support |
| **Language** | TypeScript 5.7+ | Type safety, better DX |
| **Framework** | Next.js 15 | Unified frontend + API routes |
| **Database** | SQLite (better-sqlite3) | Serverless, portable, easy backup |
| **Jira Integration** | jira.js | Most comprehensive, active development |
| **GitHub Integration** | Octokit | Official SDK, full coverage |
| **Data Transform** | remeda | TypeScript-native functional utils |
| **Timeline Viz** | vis-timeline | Interactive, mature, feature-rich |
| **Charts** | Recharts 3.0+ | React-native, declarative, typed |
| **Testing** | Vitest | 10-20x faster than Jest, ESM-first |
| **Linting** | ESLint + Prettier | Industry standard |
| **Pre-commit** | Husky + lint-staged | Automated quality gates |

### Installation Commands
```bash
# Core Integration
npm install jira.js octokit better-sqlite3 zod remeda uuid

# Frontend
npm install next react react-dom @tanstack/react-query recharts vis-timeline

# Development
npm install -D typescript vitest @vitest/ui eslint prettier husky lint-staged
npm install -D @types/better-sqlite3 @types/uuid @testing-library/react
```

---

## 3. Jira API Research

### Selected Library: jira.js

**Package:** `npm install jira.js`
**Documentation:** https://mrrefactoring.github.io/jira.js/
**GitHub:** https://github.com/MrRefactoring/jira.js

#### Key Capabilities
- Covers ~100% of Jira Cloud APIs
- Full TypeScript support with type definitions
- Built-in pagination with `startAt`/`maxResults`
- Supports API tokens, OAuth 2.0, Personal Access Tokens

#### Critical Endpoints for Lifecycle Tracking

| Endpoint | Purpose | Key Fields |
|----------|---------|------------|
| `GET /rest/api/3/issue/{key}` | Issue details | status, created, updated, assignee |
| `GET /rest/api/3/issue/{key}/changelog` | Status transitions | timestamps, from/to status |
| `GET /rest/api/3/search` | Bulk query (JQL) | pagination, field selection |
| `GET /rest/agile/1.0/sprint/{id}/issue` | Sprint issues | agile-specific fields |

#### Jira Issue Response Structure
```typescript
interface JiraIssue {
  id: string;
  key: string;  // e.g., "KAFKA-19734"
  fields: {
    summary: string;
    status: {
      name: string;  // "In Progress", "Done"
      statusCategory: {
        key: string;  // "new", "indeterminate", "done"
      };
    };
    created: string;  // ISO date
    updated: string;
    resolutiondate: string | null;
    assignee: { displayName: string; accountId: string } | null;
    reporter: { displayName: string; accountId: string };
    issuetype: { name: string };  // "Story", "Bug", "Task"
    priority: { name: string };
  };
}
```

#### Status Categories (Important!)
Jira groups all statuses into 3 categories:
- **To Do** (`key: "new"`) - Work not started
- **In Progress** (`key: "indeterminate"`) - Work underway
- **Done** (`key: "done"`) - Work complete

**Recommendation:** Use `statusCategory.key` for reliable status checks instead of hardcoding status names.

---

## 4. GitHub API Research

### Selected Library: Octokit

**Package:** `npm install octokit`
**Documentation:** Official GitHub SDK
**GitHub:** https://github.com/octokit/octokit.js

#### Key Capabilities
- Official GitHub SDK with complete coverage
- Full TypeScript definitions
- Built-in automatic pagination with `paginate()`
- Works in browsers, Node.js, and Deno

#### Critical Endpoints for Lifecycle Tracking

| Endpoint | Purpose | Key Data |
|----------|---------|----------|
| `repos.listCommits` | Commit history | sha, message, author, date |
| `pulls.list` | Pull requests | state, created, merged, reviews |
| `pulls.get` | PR details | files, additions, deletions |
| `pulls.listReviews` | PR reviews | state, reviewer, timestamp |

#### Commit Response Structure
```typescript
interface GitHubCommit {
  sha: string;
  commit: {
    message: string;  // Contains "KAFKA-XXXXX: description"
    author: {
      name: string;
      email: string;
      date: string;  // ISO date
    };
  };
  author: { login: string } | null;
  html_url: string;
  stats?: {
    additions: number;
    deletions: number;
  };
}
```

#### Ticket ID Extraction Pattern
```typescript
// Extract KAFKA-XXXXX from commit messages
const pattern = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const ticketIds = commitMessage.match(pattern) || [];
// Example: "KAFKA-17541: Fix issue" → ["KAFKA-17541"]
```

---

## 5. Public Test Data Sources

### Primary Source: Apache Kafka

**Selected for testing because:**
- ✅ Public Jira instance (no auth required for read)
- ✅ Public GitHub repository
- ✅ Consistent commit message format (`KAFKA-XXXXX:`)
- ✅ Active development (2,970 PRs merged in 3 months!)
- ✅ Clear version branches (trunk, 4.1, 4.0, 3.x)

#### Apache Kafka Jira
- **URL:** https://issues.apache.org/jira/projects/KAFKA
- **API:** https://issues.apache.org/jira/rest/api/2/issue/KAFKA-19734
- **Access:** Public read-only, no authentication needed

#### Apache Kafka GitHub
- **URL:** https://github.com/apache/kafka
- **API:** https://api.github.com/repos/apache/kafka/commits
- **Access:** Public, 60 req/hour unauthenticated

#### Test Tickets Used
| Ticket | Type | Status | GitHub Activity |
|--------|------|--------|-----------------|
| KAFKA-17541 | Bug | Done | Multiple commits, merged PR |
| KAFKA-19734 | Task | In Progress | Active development |

#### Example Correlated Data
```
Jira:   KAFKA-17541 - Improve handling of delivery count
        Created: 2024-06-15, Status: Done, Type: Bug

GitHub: Commit bcd3191 - "KAFKA-17541:[2/2] Improve handling..."
        Author: Lan Ding, Date: 2025-11-21
        PR #20837, Merged: Yes
```

### Alternative Public Sources
- Apache Hadoop (HADOOP-XXXXX)
- Apache Flink (FLINK-XXXXX)
- Apache Spark (SPARK-XXXXX)
- Apache Camel (CAMEL-XXXXX)

All use the same pattern: Jira ticket ID prefix in commit messages.

---

## 6. Architecture Decisions

### Data Model
```
CaseStudy (Project/Sprint/Ticket import)
    ├── JiraTicket (Processed Jira data)
    │       └── rawJiraData (Original API response)
    ├── LifecycleEvent (Timeline events from both sources)
    │       ├── Source: jira | github
    │       ├── Type: ticket_created | status_changed | commit_created | pr_merged
    │       └── Details: context-specific metadata
    ├── GitHubCommit (Commit data linked to tickets)
    └── GitHubPullRequest (PR data linked to tickets)
```

### Repository Pattern
- **CaseStudyRepository** - CRUD for case studies
- **JiraTicketRepository** - Ticket storage with metrics
- **LifecycleEventRepository** - Timeline event tracking
- **GitHubCommitRepository** - Commit data (future)
- **GitHubPullRequestRepository** - PR data (future)

### Service Layer
- **JiraImportService** - Fetch and import Jira issues
- **GitHubImportService** - Fetch and import commits/PRs
- **CorrelationService** - Match tickets to commits (future)
- **MetricsService** - Calculate lead time, cycle time (future)

### Database Schema (SQLite)
```sql
-- Core tables with foreign key relationships
case_studies      -- Import metadata and status
jira_tickets      -- Processed ticket data + raw JSON
lifecycle_events  -- Unified timeline (Jira + GitHub)
github_commits    -- Commit data linked to tickets
github_pull_requests -- PR data linked to tickets

-- Key indexes for performance
idx_jira_tickets_key
idx_lifecycle_events_ticket
idx_lifecycle_events_date
idx_github_commits_ticket
```

---

## 7. Testing Strategy

### Unit Tests (Mock Data)
- Use mock fixtures mimicking real API responses
- Test services and repositories in isolation
- In-memory SQLite database for fast tests
- **Current:** 8 passing tests for JiraImportService

### Integration Tests (Real APIs)
- Fetch real data from Apache Kafka Jira/GitHub
- Test complete import flow end-to-end
- Verify data correlation works with real patterns
- **Requires:** Network access (sandboxed envs may fail)

### Test Files Structure
```
tests/
├── fixtures/
│   ├── jira/mock-issues.ts     # 10 realistic Jira issues
│   └── github/mock-commits.ts  # 11 commits + 5 PRs
├── unit/
│   └── jira-import.service.test.ts  # 8 passing tests
└── integration/
    ├── README.md
    └── real-apache-kafka.integration.test.ts
```

### Quality Gates
All must pass before commit:
- ✅ TypeScript type checking (`tsc --noEmit`)
- ✅ ESLint linting (`eslint .`)
- ✅ Prettier formatting (`prettier --check`)
- ✅ Unit tests (`vitest run tests/unit/`)

### Running Tests
```bash
# Unit tests (offline, uses mock data)
npm run test:unit

# Integration tests (requires network)
npm run test:integration

# All tests
npm run test:run
```

---

## Appendix: API Response Examples

### Jira Issue (KAFKA-19734)
```json
{
  "key": "KAFKA-19734",
  "fields": {
    "summary": "Add application-id as a tag to the ClientState JMX metric",
    "status": {
      "name": "In Progress",
      "statusCategory": { "key": "indeterminate" }
    },
    "issuetype": { "name": "Task" },
    "priority": { "name": "Major" },
    "assignee": { "displayName": "Genseric Ghiro" },
    "reporter": { "displayName": "Bill Bejeck" },
    "created": "2025-09-24T22:54:42.148+0000",
    "updated": "2025-11-20T21:17:30.971+0000"
  }
}
```

### GitHub Commit (KAFKA-17541)
```json
{
  "sha": "bcd3191c792b90e1d17a0c3094ef7fe6b8655c53",
  "commit": {
    "message": "KAFKA-17541:[2/2] Improve handling of delivery count (#20837)\n\nFor records with a delivery count exceeding 2...",
    "author": {
      "name": "Lan Ding",
      "email": "isDing_L@163.com",
      "date": "2025-11-21T11:31:48Z"
    }
  },
  "html_url": "https://github.com/apache/kafka/commit/bcd3191c792b90e1d17a0c3094ef7fe6b8655c53"
}
```

---

## References

- [Apache Kafka Jira](https://issues.apache.org/jira/projects/KAFKA)
- [Apache Kafka GitHub](https://github.com/apache/kafka)
- [jira.js Documentation](https://mrrefactoring.github.io/jira.js/)
- [Octokit Documentation](https://octokit.github.io/)
- [Jira REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [GitHub REST API](https://docs.github.com/en/rest)
- [Vitest Documentation](https://vitest.dev/)
- [Recharts Documentation](https://recharts.org/)
- [vis-timeline Documentation](https://visjs.github.io/vis-timeline/)
