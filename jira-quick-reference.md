# Jira API Quick Reference Guide

Quick reference for common Jira API operations for feature lifecycle tracking.

## Quick Links
- Full Documentation: [JIRA_API_DOCUMENTATION.md](./JIRA_API_DOCUMENTATION.md)
- TypeScript Types: [jira-api-schema.ts](./jira-api-schema.ts)

---

## Endpoints at a Glance

| Endpoint | URL | Purpose |
|----------|-----|---------|
| Get Project | `GET /rest/api/3/project/{key}` | Project metadata |
| Get Sprint | `GET /rest/agile/1.0/sprint/{id}` | Sprint details |
| Get Sprint Issues | `GET /rest/agile/1.0/sprint/{id}/issue` | All issues in sprint |
| Get Issue | `GET /rest/api/3/issue/{key}` | Single issue details |
| Get Changelog | `GET /rest/api/3/issue/{key}/changelog` | Status transitions |
| Search | `POST /rest/api/3/search` | JQL query |

---

## Common JQL Queries

### Sprint Queries
```jql
# Issues in specific sprint
sprint = 123

# Issues in current active sprint
sprint in openSprints() AND project = PROJ

# Issues in last closed sprint
sprint in closedSprints() ORDER BY sprint DESC

# Issues moved between sprints
sprint changed
```

### Status & Lifecycle Queries
```jql
# Completed this month
project = PROJ AND status = Done AND resolutiondate >= startOfMonth()

# In progress longer than 5 days
project = PROJ AND status = "In Progress" AND status changed to "In Progress" before "-5d"

# Recently updated
project = PROJ AND updated >= "-7d"

# Resolved but reopened
status WAS Done AND status != Done
```

### Developer Queries
```jql
# My open issues
assignee = currentUser() AND status != Done

# Unassigned issues in sprint
sprint in openSprints() AND assignee is EMPTY

# Issues assigned to specific user
assignee = "[email protected]"

# Reassigned issues
assignee changed
```

### Story Points & Estimation
```jql
# Issues with story points
"Story Points" is not EMPTY

# High effort stories
"Story Points" > 8

# Unestimated stories in backlog
"Story Points" is EMPTY AND status = "To Do"

# Sprint velocity (completed story points)
sprint = 123 AND status = Done AND "Story Points" is not EMPTY
```

### Blockers & Dependencies
```jql
# Flagged issues
flagged is not EMPTY

# Issues blocking others
issueFunction in linkedIssuesOf("status != Done", "blocks")

# Blocked issues
issueFunction in linkedIssuesOf("status != Done", "is blocked by")
```

### Date Range Queries
```jql
# Created last week
created >= startOfWeek(-1) AND created <= endOfWeek(-1)

# Due this week
duedate >= startOfWeek() AND duedate <= endOfWeek()

# Overdue
duedate < now() AND status != Done

# Completed in January 2024
resolutiondate >= "2024-01-01" AND resolutiondate <= "2024-01-31"
```

---

## Essential cURL Commands

### Get Issue with Changelog
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/api/3/issue/PROJ-123?expand=changelog' \
  -H 'Authorization: Basic YOUR_BASE64_CREDENTIALS' \
  -H 'Accept: application/json'
```

### Search Issues (JQL)
```bash
curl -X POST \
  'https://your-domain.atlassian.net/rest/api/3/search' \
  -H 'Authorization: Basic YOUR_BASE64_CREDENTIALS' \
  -H 'Content-Type: application/json' \
  -d '{
    "jql": "project = PROJ AND sprint = 123",
    "maxResults": 50,
    "fields": ["summary", "status", "assignee", "created", "customfield_10000"]
  }'
```

### Get Sprint Details
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/agile/1.0/sprint/123' \
  -H 'Authorization: Basic YOUR_BASE64_CREDENTIALS' \
  -H 'Accept: application/json'
```

### Get All Custom Fields
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/api/3/field' \
  -H 'Authorization: Basic YOUR_BASE64_CREDENTIALS' \
  -H 'Accept: application/json'
```

---

## TypeScript Snippets

### Basic Setup
```typescript
const JIRA_CONFIG = {
  domain: 'your-domain',
  email: '[email protected]',
  apiToken: 'your-api-token'
};

const auth = Buffer.from(`${JIRA_CONFIG.email}:${JIRA_CONFIG.apiToken}`).toString('base64');
const baseUrl = `https://${JIRA_CONFIG.domain}.atlassian.net`;

const headers = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};
```

### Fetch Issue with Types
```typescript
import type { JiraIssue } from './jira-api-schema';

async function getIssue(issueKey: string): Promise<JiraIssue> {
  const response = await fetch(
    `${baseUrl}/rest/api/3/issue/${issueKey}?expand=changelog`,
    { headers }
  );
  return response.json();
}
```

### Search with JQL
```typescript
import type { JiraSearchResponse } from './jira-api-schema';

async function searchIssues(jql: string): Promise<JiraSearchResponse> {
  const response = await fetch(
    `${baseUrl}/rest/api/3/search`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jql,
        maxResults: 100,
        fields: ['summary', 'status', 'assignee', 'created', 'resolutiondate']
      })
    }
  );
  return response.json();
}
```

### Get Sprint Metrics
```typescript
import type { JiraSprint, JiraIssue } from './jira-api-schema';

async function getSprintMetrics(sprintId: number) {
  // Get sprint
  const sprint: JiraSprint = await fetch(
    `${baseUrl}/rest/agile/1.0/sprint/${sprintId}`,
    { headers }
  ).then(r => r.json());

  // Get issues
  const searchResult = await searchIssues(`sprint = ${sprintId}`);

  // Calculate metrics
  const completedIssues = searchResult.issues.filter(
    i => i.fields.status.statusCategory.key === 'done'
  );

  const totalStoryPoints = completedIssues.reduce(
    (sum, issue) => sum + (Number(issue.fields.customfield_10000) || 0),
    0
  );

  return {
    sprint,
    totalIssues: searchResult.total,
    completedIssues: completedIssues.length,
    velocity: totalStoryPoints
  };
}
```

### Calculate Cycle Time
```typescript
import type { JiraIssue, JiraChangelog } from './jira-api-schema';

function calculateCycleTime(issue: JiraIssue, changelog: JiraChangelog): number | null {
  const transitions = changelog.histories
    .flatMap(h => h.items
      .filter(i => i.field === 'status')
      .map(i => ({
        to: i.toString!,
        timestamp: new Date(h.created)
      }))
    );

  const startTransition = transitions.find(t =>
    t.to === 'In Progress' || t.to === 'In Development'
  );

  const endTransition = [...transitions].reverse().find(t =>
    t.to === 'Done' || t.to === 'Closed'
  );

  if (!startTransition || !endTransition) return null;

  return endTransition.timestamp.getTime() - startTransition.timestamp.getTime();
}

// Usage
const issue = await getIssue('PROJ-123');
const cycleTimeMs = calculateCycleTime(issue, issue.changelog!);
const cycleTimeDays = cycleTimeMs ? cycleTimeMs / (1000 * 60 * 60 * 24) : null;
console.log(`Cycle time: ${cycleTimeDays?.toFixed(1)} days`);
```

---

## Field Reference

### Standard Fields
| Field | Path | Type | Description |
|-------|------|------|-------------|
| Key | `key` | string | Issue key (e.g., "PROJ-123") |
| Summary | `fields.summary` | string | Issue title |
| Status | `fields.status.name` | string | Current status |
| Status Category | `fields.status.statusCategory.key` | string | "new", "indeterminate", "done" |
| Assignee | `fields.assignee.displayName` | string | Assigned person |
| Reporter | `fields.reporter.displayName` | string | Issue creator |
| Created | `fields.created` | string | Creation timestamp |
| Updated | `fields.updated` | string | Last update timestamp |
| Resolved | `fields.resolutiondate` | string | Resolution timestamp |
| Due Date | `fields.duedate` | string | Due date (YYYY-MM-DD) |
| Issue Type | `fields.issuetype.name` | string | Story, Bug, Task, etc. |
| Priority | `fields.priority.name` | string | Priority level |
| Labels | `fields.labels` | string[] | Labels array |
| Components | `fields.components` | array | Component objects |
| Fix Versions | `fields.fixVersions` | array | Target versions |

### Custom Fields (Examples)
| Field | Path | Typical Type | Description |
|-------|------|--------------|-------------|
| Sprint | `fields.customfield_10104` | number | Sprint ID |
| Story Points | `fields.customfield_10000` | number | Estimation |
| Epic Link | `fields.customfield_10014` | string | Epic key |

**Note**: Custom field IDs vary by instance. Use `GET /rest/api/3/field` to find yours.

---

## Status Categories

Jira groups statuses into three categories:

| Category | Key | Color | Examples |
|----------|-----|-------|----------|
| To Do | `new` | Blue-gray | To Do, Backlog, Open |
| In Progress | `indeterminate` | Yellow | In Progress, In Review, In Development |
| Done | `done` | Green | Done, Closed, Resolved |

Access via: `issue.fields.status.statusCategory.key`

---

## Lifecycle Metrics Cheatsheet

### Cycle Time
**Formula**: Time from "In Progress" to "Done"
```typescript
const cycleTime = endDate - firstInProgressDate;
```

### Lead Time
**Formula**: Time from creation to resolution
```typescript
const leadTime = resolutionDate - createdDate;
```

### Velocity
**Formula**: Sum of story points completed in sprint
```typescript
const velocity = completedIssues.reduce(
  (sum, i) => sum + (i.fields.customfield_10000 || 0),
  0
);
```

### WIP (Work In Progress)
**Formula**: Count of issues in "In Progress" category
```typescript
const wip = issues.filter(
  i => i.fields.status.statusCategory.key === 'indeterminate'
).length;
```

### Throughput
**Formula**: Count of issues completed in time period
```typescript
const throughput = issues.filter(
  i => i.fields.resolutiondate >= startDate &&
       i.fields.resolutiondate <= endDate
).length;
```

---

## Pagination Pattern

### Standard Pagination
```typescript
async function fetchAll<T>(
  fetchPage: (startAt: number) => Promise<{ values: T[]; total: number }>
): Promise<T[]> {
  const allItems: T[] = [];
  let startAt = 0;
  const pageSize = 100;

  while (true) {
    const page = await fetchPage(startAt);
    allItems.push(...page.values);

    if (allItems.length >= page.total) break;
    startAt += pageSize;
  }

  return allItems;
}

// Usage
const allIssues = await fetchAll(async (startAt) => {
  const response = await fetch(
    `${baseUrl}/rest/agile/1.0/sprint/123/issue?startAt=${startAt}&maxResults=100`,
    { headers }
  );
  return response.json();
});
```

---

## Error Handling

### Basic Error Handler
```typescript
async function jiraRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options?.headers }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Jira API Error (${response.status}): ${
        error.errorMessages?.join(', ') || response.statusText
      }`
    );
  }

  return response.json();
}
```

### Retry on Rate Limit
```typescript
async function jiraRequestWithRetry<T>(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options?.headers }
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  throw new Error('Max retries exceeded');
}
```

---

## Mock Data for Testing

### Example Issue
```typescript
import { EXAMPLE_ISSUE_RESPONSE } from './jira-api-schema';

// Use in tests
const mockIssue = EXAMPLE_ISSUE_RESPONSE;
```

### Generate Mock Sprint
```typescript
function createMockSprint(id: number, state: 'future' | 'active' | 'closed'): JiraSprint {
  const now = new Date();
  const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    id,
    self: `https://example.atlassian.net/rest/agile/1.0/sprint/${id}`,
    state,
    name: `Sprint ${id}`,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    completeDate: state === 'closed' ? endDate.toISOString() : undefined,
    originBoardId: 1,
    goal: 'Complete feature implementation'
  };
}
```

---

## Performance Tips

### 1. Request Only Needed Fields
```typescript
// ❌ Bad: Fetch everything
const issue = await getIssue('PROJ-123');

// ✅ Good: Request specific fields
const issue = await fetch(
  `${baseUrl}/rest/api/3/issue/PROJ-123?fields=status,assignee,created`,
  { headers }
).then(r => r.json());
```

### 2. Use Search Instead of Individual Fetches
```typescript
// ❌ Bad: 100 API calls
for (const key of keys) {
  const issue = await getIssue(key);
}

// ✅ Good: 1 API call
const issues = await searchIssues(`key in (${keys.join(',')})`);
```

### 3. Batch Changelog Requests
```typescript
// ❌ Bad: Separate requests
const issue = await getIssue('PROJ-123');
const changelog = await getChangelog('PROJ-123');

// ✅ Good: Single request with expand
const issue = await fetch(
  `${baseUrl}/rest/api/3/issue/PROJ-123?expand=changelog`,
  { headers }
).then(r => r.json());
```

### 4. Cache Static Data
```typescript
// Cache project, user, and status data
const cache = new Map<string, any>();

async function getCachedProject(key: string) {
  if (!cache.has(key)) {
    const project = await getProject(key);
    cache.set(key, project);
  }
  return cache.get(key);
}
```

---

## Environment Variables

```bash
# .env file
JIRA_DOMAIN=your-domain
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token

# Custom field IDs (find via GET /rest/api/3/field)
JIRA_SPRINT_FIELD=customfield_10104
JIRA_STORY_POINTS_FIELD=customfield_10000
JIRA_EPIC_LINK_FIELD=customfield_10014
```

```typescript
// Load in TypeScript
const config = {
  domain: process.env.JIRA_DOMAIN!,
  email: process.env.JIRA_EMAIL!,
  apiToken: process.env.JIRA_API_TOKEN!,
  fields: {
    sprint: process.env.JIRA_SPRINT_FIELD!,
    storyPoints: process.env.JIRA_STORY_POINTS_FIELD!,
    epicLink: process.env.JIRA_EPIC_LINK_FIELD!
  }
};
```

---

## Common Pitfalls

### 1. Custom Field IDs
❌ **Don't**: Hardcode `customfield_10000`
✅ **Do**: Discover field IDs via API or use environment variables

### 2. Pagination
❌ **Don't**: Assume all results fit in one page
✅ **Do**: Always implement pagination for search results

### 3. Status Categories
❌ **Don't**: Hardcode status names like "Done"
✅ **Do**: Use `statusCategory.key === 'done'` for reliable checks

### 4. Rate Limits
❌ **Don't**: Make sequential requests in a loop
✅ **Do**: Batch requests and implement retry logic

### 5. Changelog Interpretation
❌ **Don't**: Assume changelog includes creation event
✅ **Do**: Use `fields.created` for initial timestamp

---

## Resources

- **Official Docs**: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- **JQL Guide**: https://support.atlassian.com/jira-software-cloud/docs/use-advanced-search-with-jira-query-language-jql/
- **Postman Collection**: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#postman

---

## Complete Example Script

```typescript
#!/usr/bin/env node
import type { JiraSearchResponse, JiraSprint } from './jira-api-schema';

// Configuration
const config = {
  domain: process.env.JIRA_DOMAIN || 'your-domain',
  email: process.env.JIRA_EMAIL || '[email protected]',
  apiToken: process.env.JIRA_API_TOKEN || 'your-token',
  sprintId: parseInt(process.env.SPRINT_ID || '123')
};

const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
const baseUrl = `https://${config.domain}.atlassian.net`;
const headers = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

// Main function
async function main() {
  console.log(`Analyzing Sprint ${config.sprintId}...\n`);

  // Get sprint details
  const sprint: JiraSprint = await fetch(
    `${baseUrl}/rest/agile/1.0/sprint/${config.sprintId}`,
    { headers }
  ).then(r => r.json());

  console.log(`Sprint: ${sprint.name} (${sprint.state})`);
  console.log(`Duration: ${sprint.startDate} to ${sprint.endDate}\n`);

  // Get all issues
  const searchResult: JiraSearchResponse = await fetch(
    `${baseUrl}/rest/api/3/search`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jql: `sprint = ${config.sprintId}`,
        fields: ['summary', 'status', 'assignee', 'customfield_10000'],
        maxResults: 100
      })
    }
  ).then(r => r.json());

  console.log(`Total Issues: ${searchResult.total}`);

  // Group by status
  const byStatus = searchResult.issues.reduce((acc, issue) => {
    const status = issue.fields.status.name;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nStatus Distribution:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // Calculate velocity
  const completedIssues = searchResult.issues.filter(
    i => i.fields.status.statusCategory.key === 'done'
  );

  const velocity = completedIssues.reduce(
    (sum, issue) => sum + (Number(issue.fields.customfield_10000) || 0),
    0
  );

  console.log(`\nVelocity: ${velocity} story points`);
  console.log(`Completion Rate: ${((completedIssues.length / searchResult.total) * 100).toFixed(1)}%`);
}

main().catch(console.error);
```

Run with:
```bash
export JIRA_DOMAIN=your-domain
export JIRA_EMAIL=[email protected]
export JIRA_API_TOKEN=your-token
export SPRINT_ID=123

npx tsx sprint-report.ts
```
