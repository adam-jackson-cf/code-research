# Jira REST API v3 Schema Documentation

Complete documentation for Jira REST API endpoints needed for feature lifecycle tracking.

## Table of Contents

1. [Get Project](#1-get-project)
2. [Get Sprint](#2-get-sprint)
3. [Get Issues in Sprint](#3-get-issues-in-sprint)
4. [Get Single Issue](#4-get-single-issue)
5. [Get Issue Changelog](#5-get-issue-changelog)
6. [Search Issues (JQL)](#6-search-issues-jql)
7. [Lifecycle Tracking Guide](#lifecycle-tracking-guide)
8. [Custom Fields Reference](#custom-fields-reference)

---

## 1. Get Project

### Endpoint
```
GET /rest/api/3/project/{projectIdOrKey}
```

### Description
Retrieves complete project information including components, versions, issue types, and team members.

### Key Fields for Lifecycle Tracking
- **components**: Track which component/area a feature belongs to
- **versions**: Track target release versions (fix versions)
- **issueTypes**: Available issue types for the project
- **lead**: Project owner/lead information

### Example Request
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/api/3/project/PROJ' \
  -H 'Authorization: Basic {base64-encoded-credentials}' \
  -H 'Accept: application/json'
```

### Example Response
```json
{
  "self": "https://your-domain.atlassian.net/rest/api/3/project/10000",
  "id": "10000",
  "key": "PROJ",
  "name": "My Project",
  "description": "Example project for feature tracking",
  "lead": {
    "self": "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
    "accountId": "5b10ac8d82e05b22cc7d4ef5",
    "displayName": "John Doe",
    "active": true,
    "avatarUrls": {
      "48x48": "https://avatar-management.services.atlassian.com/example/48",
      "24x24": "https://avatar-management.services.atlassian.com/example/24",
      "16x16": "https://avatar-management.services.atlassian.com/example/16",
      "32x32": "https://avatar-management.services.atlassian.com/example/32"
    }
  },
  "components": [
    {
      "self": "https://your-domain.atlassian.net/rest/api/3/component/10000",
      "id": "10000",
      "name": "Frontend",
      "description": "Frontend components and features"
    },
    {
      "self": "https://your-domain.atlassian.net/rest/api/3/component/10001",
      "id": "10001",
      "name": "Backend",
      "description": "Backend services and APIs"
    }
  ],
  "issueTypes": [
    {
      "self": "https://your-domain.atlassian.net/rest/api/3/issuetype/10001",
      "id": "10001",
      "name": "Story",
      "description": "User story",
      "iconUrl": "https://your-domain.atlassian.net/images/icons/issuetypes/story.svg",
      "subtask": false
    },
    {
      "self": "https://your-domain.atlassian.net/rest/api/3/issuetype/10002",
      "id": "10002",
      "name": "Bug",
      "description": "Bug or defect",
      "iconUrl": "https://your-domain.atlassian.net/images/icons/issuetypes/bug.svg",
      "subtask": false
    }
  ],
  "versions": [
    {
      "self": "https://your-domain.atlassian.net/rest/api/3/version/10000",
      "id": "10000",
      "name": "Version 1.0",
      "description": "First major release",
      "archived": false,
      "released": false,
      "releaseDate": "2024-12-31"
    }
  ],
  "roles": {
    "Administrators": "https://your-domain.atlassian.net/rest/api/3/project/10000/role/10002",
    "Developers": "https://your-domain.atlassian.net/rest/api/3/project/10000/role/10001"
  },
  "avatarUrls": {
    "48x48": "https://your-domain.atlassian.net/secure/projectavatar?pid=10000&avatarId=10324",
    "24x24": "https://your-domain.atlassian.net/secure/projectavatar?size=small&pid=10000&avatarId=10324",
    "16x16": "https://your-domain.atlassian.net/secure/projectavatar?size=xsmall&pid=10000&avatarId=10324",
    "32x32": "https://your-domain.atlassian.net/secure/projectavatar?size=medium&pid=10000&avatarId=10324"
  },
  "assigneeType": "PROJECT_LEAD",
  "projectTypeKey": "software",
  "simplified": false,
  "style": "next-gen"
}
```

### TypeScript Interface
See `JiraProject` in `/home/user/code-research/jira-api-schema.ts`

---

## 2. Get Sprint

### Endpoint
```
GET /rest/agile/1.0/sprint/{sprintId}
```

### Description
Retrieves sprint details including state, dates, and goal. Part of the Jira Agile/Software REST API.

### Key Fields for Lifecycle Tracking
- **state**: Sprint status (`"future"`, `"active"`, or `"closed"`)
- **startDate**: When sprint started (or will start)
- **endDate**: When sprint ends (or will end)
- **completeDate**: When sprint was actually completed (closed sprints only)
- **goal**: Sprint goal/objective

### Sprint State Transitions
1. **future** → **active**: Sprint starts (requires startDate and endDate)
2. **active** → **closed**: Sprint completes (sets completeDate automatically)

### Example Request
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/agile/1.0/sprint/123' \
  -H 'Authorization: Basic {base64-encoded-credentials}' \
  -H 'Accept: application/json'
```

### Example Response
```json
{
  "id": 123,
  "self": "https://your-domain.atlassian.net/rest/agile/1.0/sprint/123",
  "state": "active",
  "name": "Sprint 23",
  "startDate": "2024-01-15T09:00:00.000Z",
  "endDate": "2024-01-29T17:00:00.000Z",
  "originBoardId": 5,
  "goal": "Complete user authentication and profile management features"
}
```

### Date Format
All dates use ISO 8601 format: `YYYY-MM-DDThh:mm:ss.sss+TZ`

Example: `"2015-04-11T15:22:00.000+10:00"`

### TypeScript Interface
See `JiraSprint` in `/home/user/code-research/jira-api-schema.ts`

---

## 3. Get Issues in Sprint

### Endpoint
```
GET /rest/agile/1.0/sprint/{sprintId}/issue
```

### Description
Retrieves all issues assigned to a sprint with full issue details including Agile-specific fields.

### Query Parameters
- **startAt**: Starting index for pagination (default: 0)
- **maxResults**: Maximum results per page (default: 50, max: 100)
- **jql**: Optional JQL filter to further filter issues
- **validateQuery**: Query validation mode (`"strict"`, `"warn"`, `"none"`)
- **fields**: Comma-separated list of fields to return
- **expand**: Comma-separated list of sections to expand (e.g., `"changelog"`)

### Key Fields for Lifecycle Tracking
- All standard issue fields (see [Get Single Issue](#4-get-single-issue))
- **sprint**: Current sprint information (Agile extension)
- **closedSprints**: Array of previous sprints (Agile extension)
- **flagged**: Whether issue is flagged (Agile extension)
- **epic**: Epic information (Agile extension)

### Example Request
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/agile/1.0/sprint/123/issue?maxResults=50&fields=summary,status,assignee,customfield_10000' \
  -H 'Authorization: Basic {base64-encoded-credentials}' \
  -H 'Accept: application/json'
```

### Example Response
```json
{
  "expand": "schema,names",
  "startAt": 0,
  "maxResults": 50,
  "total": 12,
  "isLast": true,
  "issues": [
    {
      "id": "10001",
      "key": "PROJ-123",
      "self": "https://your-domain.atlassian.net/rest/agile/1.0/issue/10001",
      "fields": {
        "summary": "Implement user login feature",
        "status": {
          "self": "https://your-domain.atlassian.net/rest/api/3/status/10001",
          "id": "10001",
          "name": "In Progress",
          "description": "Work is in progress",
          "iconUrl": "https://your-domain.atlassian.net/images/icons/statuses/inprogress.png",
          "statusCategory": {
            "self": "https://your-domain.atlassian.net/rest/api/3/statuscategory/4",
            "id": 4,
            "key": "indeterminate",
            "colorName": "yellow",
            "name": "In Progress"
          }
        },
        "assignee": {
          "self": "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
          "accountId": "5b10ac8d82e05b22cc7d4ef5",
          "displayName": "Jane Smith",
          "active": true,
          "avatarUrls": {
            "48x48": "https://avatar-management.services.atlassian.com/example/48",
            "24x24": "https://avatar-management.services.atlassian.com/example/24",
            "16x16": "https://avatar-management.services.atlassian.com/example/16",
            "32x32": "https://avatar-management.services.atlassian.com/example/32"
          }
        },
        "created": "2024-01-10T10:30:00.000Z",
        "updated": "2024-01-20T14:45:00.000Z",
        "resolutiondate": null,
        "customfield_10104": 123,
        "customfield_10000": 5
      },
      "sprint": {
        "id": 123,
        "self": "https://your-domain.atlassian.net/rest/agile/1.0/sprint/123",
        "state": "active",
        "name": "Sprint 23"
      },
      "closedSprints": [],
      "flagged": false
    }
  ]
}
```

### Pagination Example
```typescript
// Fetch all issues in a sprint with pagination
async function getAllSprintIssues(sprintId: number): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 50;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `https://your-domain.atlassian.net/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}`,
      { headers: { 'Authorization': 'Basic ...' } }
    );
    const data = await response.json();

    allIssues.push(...data.issues);
    startAt += maxResults;
    hasMore = !data.isLast && data.issues.length === maxResults;
  }

  return allIssues;
}
```

### TypeScript Interface
See `JiraSprintIssuesResponse` in `/home/user/code-research/jira-api-schema.ts`

---

## 4. Get Single Issue

### Endpoint
```
GET /rest/api/3/issue/{issueIdOrKey}
```

### Description
Retrieves complete issue details including all fields, custom fields, and optionally expanded sections like changelog and transitions.

### Query Parameters
- **fields**: Comma-separated list of fields (default: all fields)
- **expand**: Comma-separated list of sections to expand
  - `changelog`: Include change history
  - `transitions`: Include available transitions
  - `renderedFields`: Include rendered HTML versions of fields
  - `names`: Include field name mappings
  - `schema`: Include field schema definitions

### Critical Lifecycle Tracking Fields

#### Core Status & Dates
- **fields.status**: Current status with category (To Do, In Progress, Done)
- **fields.created**: Ticket creation timestamp
- **fields.updated**: Last modification timestamp
- **fields.resolutiondate**: When ticket was resolved/completed (null if not resolved)
- **fields.duedate**: Due date (YYYY-MM-DD format)

#### People
- **fields.assignee**: Current developer/person assigned
- **fields.reporter**: Who created the ticket
- **fields.creator**: Original creator (usually same as reporter)

#### Sprint & Estimation
- **fields.customfield_XXXXX**: Sprint assignment (field ID varies)
- **fields.customfield_YYYYY**: Story points (field ID varies)
- **sprint**: Current sprint object (Agile API extension)
- **closedSprints**: Previous sprints (Agile API extension)

#### Work Tracking
- **fields.timetracking**: Time estimates and tracking
- **fields.progress**: Work progress information

#### Relationships
- **fields.issuelinks**: Dependencies, blockers, related issues
- **fields.parent**: Parent issue (for subtasks)
- **fields.subtasks**: Array of subtask issues

#### Communication
- **fields.comment**: Comments/discussion
- **fields.watches**: Watchers count

### Example Request
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/api/3/issue/PROJ-123?expand=changelog,transitions' \
  -H 'Authorization: Basic {base64-encoded-credentials}' \
  -H 'Accept: application/json'
```

### Example Response (Abbreviated)
```json
{
  "id": "10001",
  "key": "PROJ-123",
  "self": "https://your-domain.atlassian.net/rest/api/3/issue/10001",
  "expand": "changelog,transitions",
  "fields": {
    "summary": "Implement user login feature",
    "description": "As a user, I want to log in to the application...",
    "status": {
      "self": "https://your-domain.atlassian.net/rest/api/3/status/10001",
      "id": "10001",
      "name": "In Progress",
      "statusCategory": {
        "id": 4,
        "key": "indeterminate",
        "name": "In Progress",
        "colorName": "yellow"
      }
    },
    "issuetype": {
      "id": "10001",
      "name": "Story",
      "subtask": false
    },
    "priority": {
      "id": "3",
      "name": "Medium"
    },
    "assignee": {
      "accountId": "5b10ac8d82e05b22cc7d4ef5",
      "displayName": "Jane Smith",
      "active": true,
      "emailAddress": "[email protected]"
    },
    "reporter": {
      "accountId": "5b10ac8d82e05b22cc7d4ef6",
      "displayName": "John Doe"
    },
    "created": "2024-01-10T10:30:00.000+0000",
    "updated": "2024-01-20T14:45:00.000+0000",
    "resolutiondate": null,
    "duedate": "2024-01-29",
    "labels": ["authentication", "security"],
    "components": [
      {
        "id": "10000",
        "name": "Frontend"
      }
    ],
    "fixVersions": [
      {
        "id": "10000",
        "name": "Version 1.0",
        "released": false,
        "releaseDate": "2024-12-31"
      }
    ],
    "issuelinks": [
      {
        "id": "10050",
        "type": {
          "name": "Blocks",
          "inward": "is blocked by",
          "outward": "blocks"
        },
        "outwardIssue": {
          "key": "PROJ-124",
          "fields": {
            "summary": "Setup authentication backend",
            "status": {
              "name": "To Do"
            }
          }
        }
      }
    ],
    "timetracking": {
      "originalEstimate": "2d",
      "remainingEstimate": "1d",
      "timeSpent": "1d",
      "originalEstimateSeconds": 57600,
      "remainingEstimateSeconds": 28800,
      "timeSpentSeconds": 28800
    },
    "customfield_10104": 123,
    "customfield_10000": 5
  }
}
```

### Status Categories
Jira groups statuses into three categories for workflow tracking:

1. **To Do** (key: `"new"`, color: blue-gray)
   - Work hasn't started
   - Example statuses: To Do, Backlog, Open

2. **In Progress** (key: `"indeterminate"`, color: yellow)
   - Work is underway
   - Example statuses: In Progress, In Development, In Review

3. **Done** (key: `"done"`, color: green)
   - Work is complete
   - Example statuses: Done, Closed, Resolved

### TypeScript Interface
See `JiraIssue` and `JiraIssueFields` in `/home/user/code-research/jira-api-schema.ts`

---

## 5. Get Issue Changelog

### Endpoint
```
GET /rest/api/3/issue/{issueIdOrKey}/changelog
```

### Description
Retrieves the complete change history for an issue, including all field changes and status transitions with exact timestamps.

### Query Parameters
- **startAt**: Starting index for pagination (default: 0)
- **maxResults**: Maximum results per page (default: 100, max: 100)

### Critical for Lifecycle Tracking

This endpoint is **essential** for:
- Tracking exact timestamps of status transitions
- Calculating time spent in each status
- Identifying workflow bottlenecks
- Generating cycle time and lead time metrics
- Creating audit trails

### Key Fields
- **histories[].created**: Timestamp when changes occurred
- **histories[].author**: Who made the changes
- **histories[].items[]**: Array of field changes that occurred together
- **items[].field**: Field name (e.g., `"status"`, `"assignee"`, `"Sprint"`)
- **items[].fieldtype**: Either `"jira"` (standard field) or `"custom"`
- **items[].from**: Previous value ID
- **items[].fromString**: Previous value display name
- **items[].to**: New value ID
- **items[].toString**: New value display name

### Important Notes

1. **Multiple changes grouped**: Changes that occur at the same time are grouped in one history entry
2. **No creation event**: Changelog does NOT include the initial creation - use `fields.created` for that
3. **Unordered items**: Items within a history entry are not guaranteed to be in any order
4. **Status category missing**: Need separate API call to get status category (To Do/In Progress/Done)

### Example Request
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/api/3/issue/PROJ-123/changelog' \
  -H 'Authorization: Basic {base64-encoded-credentials}' \
  -H 'Accept: application/json'
```

### Example Response
```json
{
  "startAt": 0,
  "maxResults": 100,
  "total": 4,
  "histories": [
    {
      "id": "10000",
      "author": {
        "accountId": "5b10ac8d82e05b22cc7d4ef6",
        "displayName": "John Doe"
      },
      "created": "2024-01-10T10:30:00.000+0000",
      "items": [
        {
          "field": "status",
          "fieldtype": "jira",
          "fieldId": "status",
          "from": null,
          "fromString": null,
          "to": "10000",
          "toString": "To Do"
        }
      ]
    },
    {
      "id": "10001",
      "author": {
        "accountId": "5b10ac8d82e05b22cc7d4ef5",
        "displayName": "Jane Smith"
      },
      "created": "2024-01-15T09:15:00.000+0000",
      "items": [
        {
          "field": "status",
          "fieldtype": "jira",
          "fieldId": "status",
          "from": "10000",
          "fromString": "To Do",
          "to": "10001",
          "toString": "In Progress"
        },
        {
          "field": "assignee",
          "fieldtype": "jira",
          "fieldId": "assignee",
          "from": null,
          "fromString": null,
          "to": "5b10ac8d82e05b22cc7d4ef5",
          "toString": "Jane Smith"
        }
      ]
    },
    {
      "id": "10002",
      "author": {
        "accountId": "5b10ac8d82e05b22cc7d4ef5",
        "displayName": "Jane Smith"
      },
      "created": "2024-01-18T14:30:00.000+0000",
      "items": [
        {
          "field": "status",
          "fieldtype": "jira",
          "fieldId": "status",
          "from": "10001",
          "fromString": "In Progress",
          "to": "10002",
          "toString": "In Review"
        }
      ]
    },
    {
      "id": "10003",
      "author": {
        "accountId": "5b10ac8d82e05b22cc7d4ef7",
        "displayName": "Bob Johnson"
      },
      "created": "2024-01-19T10:00:00.000+0000",
      "items": [
        {
          "field": "status",
          "fieldtype": "jira",
          "fieldId": "status",
          "from": "10002",
          "fromString": "In Review",
          "to": "10001",
          "toString": "In Progress"
        },
        {
          "field": "Comment",
          "fieldtype": "jira",
          "from": null,
          "fromString": null,
          "to": null,
          "toString": "Please update the error handling"
        }
      ]
    }
  ]
}
```

### Calculating Time in Status

Use the changelog to calculate how long an issue spent in each status:

```typescript
interface StatusDuration {
  status: string;
  durationMs: number;
  durationDays: number;
}

function calculateTimeInEachStatus(
  issue: JiraIssue,
  changelog: JiraChangelog
): StatusDuration[] {
  const durations: Map<string, number> = new Map();
  const transitions: Array<{ status: string; timestamp: Date }> = [];

  // Add creation as first status
  transitions.push({
    status: changelog.histories[0]?.items.find(i => i.field === 'status')?.fromString || 'To Do',
    timestamp: new Date(issue.fields.created)
  });

  // Add all status transitions
  for (const history of changelog.histories) {
    for (const item of history.items) {
      if (item.field === 'status' && item.toString) {
        transitions.push({
          status: item.toString,
          timestamp: new Date(history.created)
        });
      }
    }
  }

  // Calculate duration for each status
  for (let i = 0; i < transitions.length; i++) {
    const current = transitions[i];
    const next = transitions[i + 1];
    const endTime = next ? next.timestamp : new Date();
    const durationMs = endTime.getTime() - current.timestamp.getTime();

    durations.set(
      current.status,
      (durations.get(current.status) || 0) + durationMs
    );
  }

  // Convert to array
  return Array.from(durations.entries()).map(([status, durationMs]) => ({
    status,
    durationMs,
    durationDays: durationMs / (1000 * 60 * 60 * 24)
  }));
}
```

### TypeScript Interface
See `JiraChangelog`, `JiraChangelogHistory`, and `JiraChangelogItem` in `/home/user/code-research/jira-api-schema.ts`

---

## 6. Search Issues (JQL)

### Endpoint
```
GET /rest/api/3/search
POST /rest/api/3/search
```

### Description
Search for issues using JQL (Jira Query Language) with pagination support. Returns multiple issues matching the query.

### Request Body (POST)
```json
{
  "jql": "project = PROJ AND sprint = 123",
  "startAt": 0,
  "maxResults": 50,
  "fields": ["summary", "status", "assignee", "created", "updated", "resolutiondate"],
  "expand": ["changelog"],
  "validateQuery": "strict"
}
```

### Query Parameters (GET)
- **jql**: JQL query string (required)
- **startAt**: Starting index for pagination (default: 0)
- **maxResults**: Maximum results per page (default: 50, max: 100)
- **fields**: Comma-separated list of fields
- **expand**: Comma-separated list of sections to expand
- **validateQuery**: `"strict"`, `"warn"`, or `"none"` (default: `"strict"`)

### JQL Examples for Lifecycle Tracking

#### Get All Issues in a Sprint
```jql
sprint = 123
```

#### Get Issues in Current/Active Sprints
```jql
project = PROJ AND sprint in openSprints()
```

#### Get Completed Issues in Date Range
```jql
project = PROJ AND status = Done AND resolutiondate >= "2024-01-01" AND resolutiondate <= "2024-01-31"
```

#### Get Issues by Assignee
```jql
assignee = currentUser() AND status != Done
```

#### Get Issues by Story Points
```jql
project = PROJ AND "Story Points" > 5
```

#### Get Issues by Component
```jql
project = PROJ AND component = "Frontend"
```

#### Get In Progress Issues Updated This Week
```jql
project = PROJ AND status = "In Progress" AND updated >= startOfWeek()
```

#### Get Blocked Issues
```jql
project = PROJ AND status != Done AND issueFunction in linkedIssuesOf("project = PROJ AND status != Done", "is blocked by")
```

#### Complex Query for Sprint Velocity
```jql
project = PROJ AND sprint = 123 AND status = Done AND issuetype in (Story, Task) AND "Story Points" is not EMPTY
```

### JQL Functions Reference

| Function | Description | Example |
|----------|-------------|---------|
| `openSprints()` | Current active sprints | `sprint in openSprints()` |
| `closedSprints()` | Completed sprints | `sprint in closedSprints()` |
| `currentUser()` | Logged-in user | `assignee = currentUser()` |
| `startOfWeek()` | Start of current week | `updated >= startOfWeek()` |
| `endOfWeek()` | End of current week | `due <= endOfWeek()` |
| `now()` | Current date/time | `created >= now() - 7d` |
| `issueHistory()` | Issues with history | `status WAS "In Progress"` |

### Example Request
```bash
curl -X POST \
  'https://your-domain.atlassian.net/rest/api/3/search' \
  -H 'Authorization: Basic {base64-encoded-credentials}' \
  -H 'Content-Type: application/json' \
  -d '{
    "jql": "project = PROJ AND sprint = 123",
    "maxResults": 50,
    "fields": ["summary", "status", "assignee", "customfield_10000"],
    "expand": ["changelog"]
  }'
```

### Example Response
```json
{
  "expand": "schema,names",
  "startAt": 0,
  "maxResults": 50,
  "total": 2,
  "issues": [
    {
      "id": "10001",
      "key": "PROJ-123",
      "self": "https://your-domain.atlassian.net/rest/api/3/issue/10001",
      "fields": {
        "summary": "Implement user login feature",
        "status": {
          "name": "In Progress",
          "statusCategory": {
            "key": "indeterminate",
            "name": "In Progress"
          }
        },
        "assignee": {
          "displayName": "Jane Smith"
        },
        "customfield_10000": 5
      }
    },
    {
      "id": "10002",
      "key": "PROJ-124",
      "self": "https://your-domain.atlassian.net/rest/api/3/issue/10002",
      "fields": {
        "summary": "Setup authentication backend",
        "status": {
          "name": "To Do",
          "statusCategory": {
            "key": "new",
            "name": "To Do"
          }
        },
        "assignee": null,
        "customfield_10000": 8
      }
    }
  ]
}
```

### Pagination Best Practices

```typescript
async function searchAllIssues(jql: string): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 100; // Maximum allowed
  let total = 0;

  do {
    const response = await fetch(
      'https://your-domain.atlassian.net/rest/api/3/search',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ...',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jql,
          startAt,
          maxResults,
          fields: ['summary', 'status', 'assignee', 'created', 'updated']
        })
      }
    );

    const data: JiraSearchResponse = await response.json();
    allIssues.push(...data.issues);

    total = data.total;
    startAt += maxResults;
  } while (startAt < total);

  return allIssues;
}
```

### TypeScript Interface
See `JiraSearchRequest` and `JiraSearchResponse` in `/home/user/code-research/jira-api-schema.ts`

---

## Lifecycle Tracking Guide

### Key Metrics to Track

#### 1. Cycle Time
**Definition**: Time from when work starts (In Progress) to when it's done

**Calculation**:
```typescript
function calculateCycleTime(issue: JiraIssue, changelog: JiraChangelog): number | null {
  const transitions = extractStatusTransitions(changelog);

  // Find first "In Progress" transition
  const startTransition = transitions.find(t =>
    t.to === 'In Progress' || t.to === 'In Development'
  );

  // Find last "Done" transition
  const endTransition = [...transitions].reverse().find(t =>
    t.to === 'Done' || t.to === 'Closed'
  );

  if (!startTransition || !endTransition) return null;

  return new Date(endTransition.timestamp).getTime() -
         new Date(startTransition.timestamp).getTime();
}
```

**Use Case**: Measure team efficiency and identify slow-moving work

---

#### 2. Lead Time
**Definition**: Total time from ticket creation to completion

**Calculation**:
```typescript
function calculateLeadTime(issue: JiraIssue): number | null {
  if (!issue.fields.resolutiondate) return null;

  return new Date(issue.fields.resolutiondate).getTime() -
         new Date(issue.fields.created).getTime();
}
```

**Use Case**: Understand end-to-end delivery time from customer perspective

---

#### 3. Sprint Velocity
**Definition**: Total story points completed per sprint

**Calculation**:
```typescript
async function calculateSprintVelocity(sprintId: number): Promise<number> {
  const response = await fetch(
    `https://your-domain.atlassian.net/rest/api/3/search`,
    {
      method: 'POST',
      body: JSON.stringify({
        jql: `sprint = ${sprintId} AND status = Done AND "Story Points" is not EMPTY`,
        fields: ['customfield_10000'] // Story points field
      })
    }
  );

  const data: JiraSearchResponse = await response.json();

  return data.issues.reduce((sum, issue) => {
    const storyPoints = issue.fields.customfield_10000 || 0;
    return sum + Number(storyPoints);
  }, 0);
}
```

**Use Case**: Predict future capacity and plan sprints

---

#### 4. Work In Progress (WIP)
**Definition**: Number of issues currently in progress

**Query**:
```jql
project = PROJ AND status = "In Progress"
```

**Use Case**: Identify team overload and enforce WIP limits

---

#### 5. Throughput
**Definition**: Number of issues completed per time period

**Query**:
```jql
project = PROJ AND resolutiondate >= "2024-01-01" AND resolutiondate <= "2024-01-31"
```

**Use Case**: Measure delivery rate over time

---

#### 6. Time in Status
**Definition**: How long issues spend in each workflow status

**Calculation**: See [Get Issue Changelog](#5-get-issue-changelog) section

**Use Case**: Identify bottlenecks in workflow (e.g., too much time in "In Review")

---

### Complete Lifecycle Tracking Workflow

```typescript
// 1. Get all sprints for a project
const sprints = await fetchProjectSprints(projectId);

// 2. For each sprint, get all issues
for (const sprint of sprints) {
  const issues = await fetchSprintIssues(sprint.id);

  // 3. For each issue, get changelog for status transitions
  for (const issue of issues) {
    const changelog = await fetchIssueChangelog(issue.key);

    // 4. Calculate metrics
    const cycleTime = calculateCycleTime(issue, changelog);
    const leadTime = calculateLeadTime(issue);
    const timeInStatus = calculateTimeInEachStatus(issue, changelog);

    // 5. Store metrics for analysis
    await storeMetrics({
      issueKey: issue.key,
      sprint: sprint.name,
      assignee: issue.fields.assignee?.displayName,
      storyPoints: issue.fields.customfield_10000,
      status: issue.fields.status.name,
      cycleTime,
      leadTime,
      timeInStatus,
      created: issue.fields.created,
      resolved: issue.fields.resolutiondate
    });
  }
}
```

---

### Data Points for Dashboard

#### Feature Lifecycle Dashboard
- Current status distribution (pie chart)
- Cycle time trend over sprints (line chart)
- Time in each status (stacked bar chart)
- Sprint velocity (bar chart)
- Cumulative flow diagram
- Lead time distribution (histogram)

#### Developer Performance
- Issues per developer
- Average cycle time per developer
- WIP per developer
- Completed story points per developer

#### Sprint Health
- Sprint burndown chart
- Remaining work
- Velocity vs. capacity
- Blocked issues count
- Issues added/removed mid-sprint

---

## Custom Fields Reference

### Discovering Custom Field IDs

Custom field IDs vary between Jira instances. To find your custom field IDs:

#### Method 1: Get Field Definitions
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/api/3/field' \
  -H 'Authorization: Basic {base64-encoded-credentials}'
```

Response includes all fields with their IDs and names:
```json
[
  {
    "id": "customfield_10104",
    "name": "Sprint",
    "custom": true,
    "schema": {
      "type": "array",
      "items": "json",
      "custom": "com.pyxis.greenhopper.jira:gh-sprint"
    }
  },
  {
    "id": "customfield_10000",
    "name": "Story Points",
    "custom": true,
    "schema": {
      "type": "number",
      "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float"
    }
  }
]
```

#### Method 2: Inspect Issue Response
Fetch any issue and look for `customfield_*` fields:
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/api/3/issue/PROJ-1' \
  -H 'Authorization: Basic {base64-encoded-credentials}'
```

#### Method 3: Use Field Names API
```bash
curl -X GET \
  'https://your-domain.atlassian.net/rest/api/3/search?jql=project=PROJ&maxResults=1&expand=names' \
  -H 'Authorization: Basic {base64-encoded-credentials}'
```

The `names` object maps field IDs to names.

### Common Custom Fields

| Field Name | Common IDs | Type | Description |
|------------|-----------|------|-------------|
| Sprint | `customfield_10104`, `customfield_10020` | Array | Current sprint assignment |
| Story Points | `customfield_10000`, `customfield_10016` | Number | Effort estimation |
| Epic Link | `customfield_10014`, `customfield_10100` | String | Link to parent epic |
| Epic Name | `customfield_10011` | String | Epic title |
| Epic Status | `customfield_10012` | String | Epic status |
| Development | `customfield_10015` | Object | Dev info (commits, PRs) |
| Rank | `customfield_10019` | String | Backlog ranking |
| Team | `customfield_10200` | Object | Assigned team |

### Using Custom Fields in TypeScript

```typescript
// Type-safe custom field access
interface CustomFields {
  sprint?: number | null;
  storyPoints?: number | null;
  epicLink?: string | null;
}

function getCustomFields(issue: JiraIssue): CustomFields {
  return {
    sprint: issue.fields.customfield_10104 as number | null,
    storyPoints: issue.fields.customfield_10000 as number | null,
    epicLink: issue.fields.customfield_10014 as string | null
  };
}

// Or create a type guard
function hasStoryPoints(issue: JiraIssue): boolean {
  return issue.fields.customfield_10000 !== null &&
         issue.fields.customfield_10000 !== undefined;
}
```

---

## API Rate Limits & Best Practices

### Rate Limits (Jira Cloud)
- **Standard**: ~100-200 requests per minute per user
- **Premium**: Higher limits based on plan
- **Burst**: Short bursts allowed, then throttled

### Best Practices

1. **Use Pagination**: Always paginate large result sets
2. **Field Filtering**: Only request fields you need
3. **Batch Requests**: Use search instead of individual issue fetches
4. **Caching**: Cache project, user, and status data
5. **Expand Wisely**: Only expand (changelog, transitions) when needed
6. **JQL Optimization**: Use indexed fields (project, sprint, status)
7. **Webhooks**: Use webhooks for real-time updates instead of polling

### Efficient Data Collection

```typescript
// ❌ BAD: Fetch issues one by one
for (const key of issueKeys) {
  const issue = await fetchIssue(key); // 100 requests!
}

// ✅ GOOD: Use search with JQL
const issues = await searchIssues({
  jql: `key in (${issueKeys.join(',')})`,
  maxResults: 100
}); // 1 request!
```

```typescript
// ❌ BAD: Fetch full issue when you only need status
const issue = await fetchIssue(key);
const status = issue.fields.status.name;

// ✅ GOOD: Request only needed fields
const issue = await fetchIssue(key, { fields: 'status' });
const status = issue.fields.status.name;
```

---

## Authentication

### Basic Auth (Simple)
```typescript
const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
const headers = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json'
};
```

### OAuth 2.0 (Recommended for Apps)
See [Atlassian OAuth 2.0 docs](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)

### API Token Generation
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create API token
3. Use with Basic Auth (email + token)

---

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad Request | Check request syntax |
| 401 | Unauthorized | Verify credentials |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Verify resource exists |
| 429 | Too Many Requests | Implement retry with backoff |
| 500 | Server Error | Retry after delay |

### Error Response Format
```json
{
  "errorMessages": [
    "The issue key is invalid."
  ],
  "errors": {
    "issueKey": "The issue key 'INVALID' does not exist."
  }
}
```

### Retry Logic
```typescript
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  throw new Error('Max retries exceeded');
}
```

---

## Complete Example: Feature Lifecycle Tracker

```typescript
import type {
  JiraIssue,
  JiraChangelog,
  JiraSearchResponse,
  JiraSprint
} from './jira-api-schema';

class FeatureLifecycleTracker {
  private baseUrl: string;
  private auth: string;

  constructor(domain: string, email: string, apiToken: string) {
    this.baseUrl = `https://${domain}.atlassian.net`;
    this.auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async getSprintMetrics(sprintId: number) {
    // 1. Get sprint details
    const sprint = await this.request<JiraSprint>(
      `/rest/agile/1.0/sprint/${sprintId}`
    );

    // 2. Get all issues in sprint
    const searchResult = await this.request<JiraSearchResponse>(
      `/rest/api/3/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          jql: `sprint = ${sprintId}`,
          fields: ['summary', 'status', 'assignee', 'created', 'resolutiondate', 'customfield_10000'],
          expand: ['changelog']
        })
      }
    );

    // 3. Calculate metrics for each issue
    const metrics = await Promise.all(
      searchResult.issues.map(async issue => {
        const changelog = issue.changelog || await this.getChangelog(issue.key);

        return {
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          assignee: issue.fields.assignee?.displayName,
          storyPoints: issue.fields.customfield_10000,
          cycleTime: this.calculateCycleTime(issue, changelog),
          leadTime: this.calculateLeadTime(issue),
          timeInStatus: this.calculateTimeInStatus(issue, changelog)
        };
      })
    );

    // 4. Aggregate sprint metrics
    const completedIssues = metrics.filter(m =>
      m.status === 'Done' || m.status === 'Closed'
    );

    const totalStoryPoints = completedIssues.reduce(
      (sum, m) => sum + (Number(m.storyPoints) || 0),
      0
    );

    const avgCycleTime = completedIssues
      .filter(m => m.cycleTime)
      .reduce((sum, m) => sum + m.cycleTime!, 0) / completedIssues.length;

    return {
      sprint,
      metrics,
      summary: {
        totalIssues: searchResult.total,
        completedIssues: completedIssues.length,
        velocity: totalStoryPoints,
        avgCycleTimeDays: avgCycleTime / (1000 * 60 * 60 * 24)
      }
    };
  }

  private async getChangelog(issueKey: string): Promise<JiraChangelog> {
    return this.request<JiraChangelog>(
      `/rest/api/3/issue/${issueKey}/changelog`
    );
  }

  private calculateCycleTime(issue: JiraIssue, changelog: JiraChangelog): number | null {
    const transitions = this.extractStatusTransitions(changelog);

    const startTransition = transitions.find(t =>
      t.to === 'In Progress' || t.to === 'In Development'
    );

    const endTransition = [...transitions].reverse().find(t =>
      t.to === 'Done' || t.to === 'Closed'
    );

    if (!startTransition || !endTransition) return null;

    return new Date(endTransition.timestamp).getTime() -
           new Date(startTransition.timestamp).getTime();
  }

  private calculateLeadTime(issue: JiraIssue): number | null {
    if (!issue.fields.resolutiondate) return null;

    return new Date(issue.fields.resolutiondate).getTime() -
           new Date(issue.fields.created).getTime();
  }

  private calculateTimeInStatus(
    issue: JiraIssue,
    changelog: JiraChangelog
  ): Record<string, number> {
    const durations: Record<string, number> = {};
    const transitions = this.extractStatusTransitions(changelog);

    // Add initial status
    if (transitions.length > 0) {
      const createdTime = new Date(issue.fields.created).getTime();
      const firstTransitionTime = new Date(transitions[0].timestamp).getTime();
      const initialStatus = transitions[0].from || 'To Do';
      durations[initialStatus] = firstTransitionTime - createdTime;
    }

    // Calculate time between transitions
    for (let i = 0; i < transitions.length - 1; i++) {
      const currentTime = new Date(transitions[i].timestamp).getTime();
      const nextTime = new Date(transitions[i + 1].timestamp).getTime();
      const status = transitions[i].to;

      durations[status] = (durations[status] || 0) + (nextTime - currentTime);
    }

    // Add time in current status
    if (transitions.length > 0) {
      const lastTransition = transitions[transitions.length - 1];
      const lastTime = new Date(lastTransition.timestamp).getTime();
      const now = new Date().getTime();
      const currentStatus = lastTransition.to;

      durations[currentStatus] = (durations[currentStatus] || 0) + (now - lastTime);
    }

    return durations;
  }

  private extractStatusTransitions(changelog: JiraChangelog) {
    const transitions: Array<{ from: string | null; to: string; timestamp: string }> = [];

    for (const history of changelog.histories) {
      for (const item of history.items) {
        if (item.field === 'status') {
          transitions.push({
            from: item.fromString || null,
            to: item.toString!,
            timestamp: history.created
          });
        }
      }
    }

    return transitions;
  }
}

// Usage
const tracker = new FeatureLifecycleTracker(
  'your-domain',
  '[email protected]',
  'your-api-token'
);

const metrics = await tracker.getSprintMetrics(123);
console.log(metrics);
```

---

## Additional Resources

- **Official Jira Cloud REST API v3**: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- **Jira Software (Agile) REST API**: https://developer.atlassian.com/cloud/jira/software/rest/
- **JQL Reference**: https://support.atlassian.com/jira-software-cloud/docs/use-advanced-search-with-jira-query-language-jql/
- **Webhooks**: https://developer.atlassian.com/cloud/jira/platform/webhooks/
- **OAuth 2.0**: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- **Rate Limits**: https://developer.atlassian.com/cloud/jira/platform/rate-limiting/

---

## Summary

This documentation provides complete TypeScript interfaces and examples for tracking feature lifecycle in Jira:

### Essential Endpoints
1. **Get Project**: Component and version metadata
2. **Get Sprint**: Sprint dates and state
3. **Get Issues in Sprint**: All sprint work with pagination
4. **Get Single Issue**: Complete issue details with dates, assignee, status
5. **Get Issue Changelog**: Status transitions and field changes
6. **Search (JQL)**: Bulk queries with flexible filtering

### Key Metrics
- **Cycle Time**: Time from In Progress to Done
- **Lead Time**: Time from creation to completion
- **Velocity**: Story points completed per sprint
- **Time in Status**: Identify workflow bottlenecks
- **WIP**: Current in-progress work
- **Throughput**: Completion rate

### Custom Fields
Sprint and Story Points use custom fields with instance-specific IDs. Use `/rest/api/3/field` to discover your field IDs.

### TypeScript Support
Complete type definitions in `/home/user/code-research/jira-api-schema.ts` with example responses and helper functions for lifecycle calculations.
