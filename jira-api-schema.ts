/**
 * Jira REST API v3 & Agile API TypeScript Schema Definitions
 *
 * Complete interface definitions for lifecycle tracking including:
 * - Status transitions
 * - Sprint assignments
 * - Story points
 * - Developer assignments
 * - Timeline dates
 *
 * Based on official Atlassian documentation:
 * - Jira Platform REST API v3: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 * - Jira Agile REST API: https://developer.atlassian.com/cloud/jira/software/rest/
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Standard self-reference object used throughout Jira API
 */
export interface JiraSelfReference {
  self: string;
}

/**
 * User object representing assignees, reporters, and other users
 */
export interface JiraUser extends JiraSelfReference {
  accountId?: string;
  accountType?: string;
  name?: string; // Deprecated in Cloud, still present in Server
  key?: string; // Deprecated in Cloud
  emailAddress?: string;
  displayName: string;
  active: boolean;
  timeZone?: string;
  avatarUrls: {
    '48x48': string;
    '24x24': string;
    '16x16': string;
    '32x32': string;
  };
}

/**
 * Avatar URLs for projects, issue types, etc.
 */
export interface AvatarUrls {
  '48x48': string;
  '24x24': string;
  '16x16': string;
  '32x32': string;
}

/**
 * ISO 8601 date-time string format used by Jira
 * Example: "2015-04-11T15:22:00.000+10:00"
 */
export type JiraDateTime = string;

/**
 * Issue status object
 */
export interface JiraStatus extends JiraSelfReference {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  statusCategory: {
    self: string;
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
}

/**
 * Issue type object
 */
export interface JiraIssueType extends JiraSelfReference {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  subtask: boolean;
  avatarId?: number;
}

/**
 * Priority object
 */
export interface JiraPriority extends JiraSelfReference {
  id: string;
  name: string;
  iconUrl: string;
}

/**
 * Project component
 */
export interface JiraComponent extends JiraSelfReference {
  id: string;
  name: string;
  description?: string;
  lead?: JiraUser;
  assigneeType?: string;
  assignee?: JiraUser;
  realAssigneeType?: string;
  realAssignee?: JiraUser;
  isAssigneeTypeValid?: boolean;
  project?: string;
  projectId?: number;
  ari?: string;
}

/**
 * Project version (fix version)
 */
export interface JiraVersion extends JiraSelfReference {
  id: string;
  name: string;
  description?: string;
  archived: boolean;
  released: boolean;
  startDate?: string; // YYYY-MM-DD format
  releaseDate?: string; // YYYY-MM-DD format
  overdue?: boolean;
  userStartDate?: string;
  userReleaseDate?: string;
  projectId?: number;
}

/**
 * Time tracking information
 */
export interface JiraTimeTracking {
  originalEstimate?: string;
  remainingEstimate?: string;
  timeSpent?: string;
  originalEstimateSeconds?: number;
  remainingEstimateSeconds?: number;
  timeSpentSeconds?: number;
}

/**
 * Issue link object
 */
export interface JiraIssueLink extends JiraSelfReference {
  id: string;
  type: {
    id: string;
    name: string;
    inward: string;
    outward: string;
    self: string;
  };
  inwardIssue?: JiraIssueReference;
  outwardIssue?: JiraIssueReference;
}

/**
 * Minimal issue reference used in links
 */
export interface JiraIssueReference extends JiraSelfReference {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: JiraStatus;
    priority: JiraPriority;
    issuetype: JiraIssueType;
  };
}

/**
 * Comment object
 */
export interface JiraComment extends JiraSelfReference {
  id: string;
  author: JiraUser;
  body: string;
  updateAuthor: JiraUser;
  created: JiraDateTime;
  updated: JiraDateTime;
  visibility?: {
    type: string;
    value: string;
  };
}

/**
 * Pagination wrapper
 */
export interface JiraPaginated<T> {
  startAt: number;
  maxResults: number;
  total: number;
  isLast?: boolean;
  values?: T[];
  issues?: T[]; // Used in search results
}

// ============================================================================
// 1. GET PROJECT: /rest/api/3/project/{projectIdOrKey}
// ============================================================================

/**
 * Project response from /rest/api/3/project/{projectIdOrKey}
 *
 * KEY FIELDS FOR LIFECYCLE TRACKING:
 * - components: Track which component a feature belongs to
 * - versions: Track target release versions (fix versions)
 * - issueTypes: Available issue types for the project
 * - lead: Project owner information
 */
export interface JiraProject extends JiraSelfReference {
  id: string;
  key: string;
  name: string;
  description?: string;
  lead: JiraUser;
  components: JiraComponent[];
  issueTypes: JiraIssueType[];
  url?: string;
  email?: string;
  assigneeType: string;
  versions: JiraVersion[];
  roles: {
    [key: string]: string;
  };
  avatarUrls: AvatarUrls;
  projectCategory?: {
    self: string;
    id: string;
    name: string;
    description: string;
  };
  projectTypeKey?: string;
  simplified?: boolean;
  style?: string;
  isPrivate?: boolean;
  properties?: {
    [key: string]: any;
  };
  entityId?: string;
  uuid?: string;
}

// ============================================================================
// 2. GET SPRINT: /rest/agile/1.0/sprint/{sprintId}
// ============================================================================

/**
 * Sprint response from /rest/agile/1.0/sprint/{sprintId}
 *
 * KEY FIELDS FOR LIFECYCLE TRACKING:
 * - state: "future" | "active" | "closed" - Current sprint status
 * - startDate: When sprint started (or will start)
 * - endDate: When sprint ends (or will end)
 * - completeDate: When sprint was actually completed (closed sprints only)
 *
 * USAGE:
 * - Track which sprint a feature is assigned to
 * - Calculate sprint velocity and burndown
 * - Identify sprint timeline for feature delivery
 */
export interface JiraSprint extends JiraSelfReference {
  id: number;
  name: string;
  state: 'future' | 'active' | 'closed';
  startDate?: JiraDateTime;
  endDate?: JiraDateTime;
  completeDate?: JiraDateTime;
  originBoardId: number;
  goal?: string;
}

// ============================================================================
// 3. GET ISSUES IN SPRINT: /rest/agile/1.0/sprint/{sprintId}/issue
// ============================================================================

/**
 * Response from /rest/agile/1.0/sprint/{sprintId}/issue
 *
 * Returns paginated list of issues in a sprint with full issue details
 * including Agile-specific fields like sprint, closedSprints, flagged, epic
 *
 * PAGINATION PARAMS:
 * - startAt: Starting index (default 0)
 * - maxResults: Max issues per page (default 50)
 *
 * KEY FIELDS FOR LIFECYCLE TRACKING:
 * - All standard issue fields plus Agile extensions
 * - Use for sprint burndown and velocity calculations
 */
export interface JiraSprintIssuesResponse extends JiraPaginated<JiraIssue> {
  expand: string;
  issues: JiraIssue[];
}

// ============================================================================
// 4. GET SINGLE ISSUE: /rest/api/3/issue/{issueIdOrKey}
// ============================================================================

/**
 * Epic information (Agile extension)
 */
export interface JiraEpic extends JiraSelfReference {
  id: number;
  key?: string;
  name: string;
  summary: string;
  color: {
    key: string;
  };
  done: boolean;
}

/**
 * Complete issue object from /rest/api/3/issue/{issueIdOrKey}
 *
 * CRITICAL LIFECYCLE TRACKING FIELDS:
 * - fields.status: Current status (To Do, In Progress, Done, etc.)
 * - fields.created: Ticket creation timestamp
 * - fields.updated: Last modification timestamp
 * - fields.resolutiondate: When ticket was resolved/completed
 * - fields.assignee: Current developer assigned
 * - fields.reporter: Who created the ticket
 * - fields.customfield_XXXXX: Sprint assignment (ID varies by instance)
 * - fields.customfield_YYYYY: Story points (ID varies by instance)
 * - fields.issuelinks: Dependencies and blockers
 * - fields.comment: Discussion and updates
 *
 * USAGE:
 * - Track feature lifecycle from creation to completion
 * - Calculate cycle time and lead time
 * - Monitor status transitions
 * - Track developer workload
 */
export interface JiraIssue extends JiraSelfReference {
  id: string;
  key: string;
  expand?: string;
  fields: JiraIssueFields;

  // Agile-specific fields (when fetched from Agile API)
  sprint?: JiraSprint | null;
  closedSprints?: JiraSprint[];
  flagged?: boolean;
  epic?: JiraEpic | null;

  // Optional expanded sections
  changelog?: JiraChangelog;
  transitions?: JiraTransition[];
  names?: { [key: string]: string };
  schema?: { [key: string]: JiraFieldSchema };
}

/**
 * Issue fields container
 *
 * NOTE: Custom fields are accessed as customfield_{ID}
 * - Sprint: Often customfield_10104 or similar
 * - Story Points: Often customfield_10000 or similar
 * - Use /rest/api/3/field to discover custom field IDs for your instance
 */
export interface JiraIssueFields {
  // Core identification
  summary: string;
  description?: string;

  // Status and classification
  status: JiraStatus;
  issuetype: JiraIssueType;
  priority: JiraPriority;
  resolution?: {
    self: string;
    id: string;
    name: string;
    description: string;
  };

  // People
  assignee?: JiraUser | null;
  reporter: JiraUser;
  creator?: JiraUser;

  // Dates - CRITICAL FOR LIFECYCLE TRACKING
  created: JiraDateTime;
  updated: JiraDateTime;
  resolutiondate?: JiraDateTime | null;
  duedate?: string | null; // YYYY-MM-DD format

  // Project context
  project: {
    self: string;
    id: string;
    key: string;
    name: string;
    avatarUrls?: AvatarUrls;
    projectTypeKey?: string;
    simplified?: boolean;
  };

  // Organization
  labels: string[];
  components: JiraComponent[];
  fixVersions: JiraVersion[];
  versions?: JiraVersion[]; // Affects versions

  // Work tracking
  timetracking?: JiraTimeTracking;
  aggregatetimetracking?: JiraTimeTracking;
  timeestimate?: number | null;
  timeoriginalestimate?: number | null;
  timespent?: number | null;
  aggregatetimespent?: number | null;
  aggregatetimeoriginalestimate?: number | null;
  aggregatetimeestimate?: number | null;
  workratio?: number;

  // Progress
  progress?: {
    progress: number;
    total: number;
    percent?: number;
  };
  aggregateprogress?: {
    progress: number;
    total: number;
    percent?: number;
  };

  // Relationships
  issuelinks: JiraIssueLink[];
  parent?: JiraIssueReference;
  subtasks: JiraIssueReference[];

  // Comments
  comment?: {
    comments: JiraComment[];
    maxResults: number;
    total: number;
    startAt: number;
  };

  // Watchers
  watches?: {
    self: string;
    watchCount: number;
    isWatching: boolean;
  };

  // Votes
  votes?: {
    self: string;
    votes: number;
    hasVoted: boolean;
  };

  // Attachments
  attachment?: Array<{
    self: string;
    id: string;
    filename: string;
    author: JiraUser;
    created: JiraDateTime;
    size: number;
    mimeType: string;
    content: string;
    thumbnail?: string;
  }>;

  // Environment
  environment?: string;

  // Security
  security?: {
    self: string;
    id: string;
    name: string;
    description: string;
  };

  // Custom fields - THESE VARY BY JIRA INSTANCE
  // Sprint assignment (example - actual ID varies)
  customfield_10104?: number | null; // Sprint ID

  // Story points (example - actual ID varies)
  customfield_10000?: number | string | null; // Story points

  // Epic link (example - actual ID varies)
  customfield_10014?: string | null; // Epic link

  // Development information
  customfield_10015?: any; // Development field

  // Additional custom fields indexed by field ID
  [key: `customfield_${string}`]: any;
}

/**
 * Field schema metadata
 */
export interface JiraFieldSchema {
  type: string;
  system?: string;
  custom?: string;
  customId?: number;
  items?: string;
}

/**
 * Transition object (available status changes)
 */
export interface JiraTransition {
  id: string;
  name: string;
  to: {
    self: string;
    id: string;
    name: string;
    description: string;
    iconUrl: string;
    statusCategory: {
      self: string;
      id: number;
      key: string;
      colorName: string;
      name: string;
    };
  };
  hasScreen?: boolean;
  isGlobal?: boolean;
  isInitial?: boolean;
  isConditional?: boolean;
  fields?: {
    [key: string]: {
      required: boolean;
      schema: JiraFieldSchema;
      name: string;
      key?: string;
      operations?: string[];
      allowedValues?: any[];
      defaultValue?: any;
    };
  };
}

// ============================================================================
// 5. GET ISSUE CHANGELOG: /rest/api/3/issue/{issueIdOrKey}/changelog
// ============================================================================

/**
 * Changelog response from /rest/api/3/issue/{issueIdOrKey}/changelog
 *
 * CRITICAL FOR LIFECYCLE TRACKING:
 * - Track ALL status transitions with exact timestamps
 * - Calculate time in each status (To Do, In Progress, Review, Done)
 * - Identify bottlenecks in workflow
 * - Audit trail of all changes
 *
 * KEY FIELDS:
 * - histories[].created: When changes occurred
 * - histories[].items[]: Array of field changes
 * - items[].field: "status" for status transitions
 * - items[].fromString: Previous status name
 * - items[].toString: New status name
 *
 * IMPORTANT NOTES:
 * - Multiple field changes with same timestamp are grouped in one history entry
 * - Changelog does NOT include initial creation - use fields.created for that
 * - Items are not guaranteed to be in any particular order
 * - Need separate API call to get status category (To Do/In Progress/Done)
 */
export interface JiraChangelog extends JiraPaginated<JiraChangelogHistory> {
  histories: JiraChangelogHistory[];
}

/**
 * Single changelog entry (one timestamp, possibly multiple field changes)
 */
export interface JiraChangelogHistory {
  id: string;
  author: JiraUser;
  created: JiraDateTime;
  items: JiraChangelogItem[];
}

/**
 * Individual field change
 *
 * For status transitions:
 * - field: "status"
 * - fieldtype: "jira"
 * - fieldId: "status"
 * - from: Status ID (e.g., "10000")
 * - fromString: Status name (e.g., "To Do")
 * - to: New status ID (e.g., "10001")
 * - toString: New status name (e.g., "In Progress")
 */
export interface JiraChangelogItem {
  field: string;
  fieldtype: 'jira' | 'custom';
  fieldId?: string;
  from?: string | null;
  fromString?: string | null;
  to?: string | null;
  toString?: string | null;
}

// ============================================================================
// 6. SEARCH ISSUES (JQL): /rest/api/3/search
// ============================================================================

/**
 * Search request parameters for /rest/api/3/search
 *
 * JQL EXAMPLES FOR LIFECYCLE TRACKING:
 *
 * // Get all issues in a sprint
 * jql: "sprint = 123"
 *
 * // Get all issues for a project in current sprint
 * jql: "project = PROJ AND sprint in openSprints()"
 *
 * // Get completed issues in date range
 * jql: "project = PROJ AND status = Done AND resolutiondate >= 2024-01-01 AND resolutiondate <= 2024-01-31"
 *
 * // Get issues assigned to user
 * jql: "assignee = currentUser() AND status != Done"
 *
 * // Get issues by story points
 * jql: "project = PROJ AND 'Story Points' > 5"
 *
 * PAGINATION:
 * - Use startAt for offset-based pagination
 * - maxResults for page size (max 100, default 50)
 * - Check total for total result count
 *
 * FIELDS:
 * - Specify fields to reduce payload size
 * - Use expand to include changelog, transitions, etc.
 */
export interface JiraSearchRequest {
  jql: string;
  startAt?: number;
  maxResults?: number;
  fields?: string[];
  expand?: string[];
  validateQuery?: 'strict' | 'warn' | 'none';
  properties?: string[];
  fieldsByKeys?: boolean;
}

/**
 * Search response from /rest/api/3/search
 *
 * KEY FIELDS FOR LIFECYCLE TRACKING:
 * - issues: Array of full issue objects
 * - total: Total matching issues (for pagination)
 * - Use for bulk analysis of features across sprints
 */
export interface JiraSearchResponse extends JiraPaginated<JiraIssue> {
  expand: string;
  issues: JiraIssue[];
  warningMessages?: string[];
  names?: { [key: string]: string };
  schema?: { [key: string]: JiraFieldSchema };
}

// ============================================================================
// Example JSON Responses
// ============================================================================

/**
 * EXAMPLE 1: Get Project Response
 * GET /rest/api/3/project/PROJ
 */
export const EXAMPLE_PROJECT_RESPONSE: JiraProject = {
  self: "https://your-domain.atlassian.net/rest/api/3/project/10000",
  id: "10000",
  key: "PROJ",
  name: "My Project",
  description: "Example project for feature tracking",
  lead: {
    self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
    accountId: "5b10ac8d82e05b22cc7d4ef5",
    displayName: "John Doe",
    active: true,
    avatarUrls: {
      "48x48": "https://avatar-management.services.atlassian.com/example/48",
      "24x24": "https://avatar-management.services.atlassian.com/example/24",
      "16x16": "https://avatar-management.services.atlassian.com/example/16",
      "32x32": "https://avatar-management.services.atlassian.com/example/32"
    }
  },
  components: [
    {
      self: "https://your-domain.atlassian.net/rest/api/3/component/10000",
      id: "10000",
      name: "Frontend",
      description: "Frontend components and features"
    },
    {
      self: "https://your-domain.atlassian.net/rest/api/3/component/10001",
      id: "10001",
      name: "Backend",
      description: "Backend services and APIs"
    }
  ],
  issueTypes: [
    {
      self: "https://your-domain.atlassian.net/rest/api/3/issuetype/10001",
      id: "10001",
      name: "Story",
      description: "User story",
      iconUrl: "https://your-domain.atlassian.net/images/icons/issuetypes/story.svg",
      subtask: false
    },
    {
      self: "https://your-domain.atlassian.net/rest/api/3/issuetype/10002",
      id: "10002",
      name: "Bug",
      description: "Bug or defect",
      iconUrl: "https://your-domain.atlassian.net/images/icons/issuetypes/bug.svg",
      subtask: false
    }
  ],
  versions: [
    {
      self: "https://your-domain.atlassian.net/rest/api/3/version/10000",
      id: "10000",
      name: "Version 1.0",
      description: "First major release",
      archived: false,
      released: false,
      releaseDate: "2024-12-31"
    }
  ],
  roles: {
    "Administrators": "https://your-domain.atlassian.net/rest/api/3/project/10000/role/10002",
    "Developers": "https://your-domain.atlassian.net/rest/api/3/project/10000/role/10001"
  },
  avatarUrls: {
    "48x48": "https://your-domain.atlassian.net/secure/projectavatar?pid=10000&avatarId=10324",
    "24x24": "https://your-domain.atlassian.net/secure/projectavatar?size=small&pid=10000&avatarId=10324",
    "16x16": "https://your-domain.atlassian.net/secure/projectavatar?size=xsmall&pid=10000&avatarId=10324",
    "32x32": "https://your-domain.atlassian.net/secure/projectavatar?size=medium&pid=10000&avatarId=10324"
  },
  assigneeType: "PROJECT_LEAD",
  projectTypeKey: "software",
  simplified: false,
  style: "next-gen"
};

/**
 * EXAMPLE 2: Get Sprint Response
 * GET /rest/agile/1.0/sprint/123
 */
export const EXAMPLE_SPRINT_RESPONSE: JiraSprint = {
  id: 123,
  self: "https://your-domain.atlassian.net/rest/agile/1.0/sprint/123",
  state: "active",
  name: "Sprint 23",
  startDate: "2024-01-15T09:00:00.000Z",
  endDate: "2024-01-29T17:00:00.000Z",
  originBoardId: 5,
  goal: "Complete user authentication and profile management features"
};

/**
 * EXAMPLE 3: Get Issues in Sprint Response
 * GET /rest/agile/1.0/sprint/123/issue
 */
export const EXAMPLE_SPRINT_ISSUES_RESPONSE: JiraSprintIssuesResponse = {
  expand: "schema,names",
  startAt: 0,
  maxResults: 50,
  total: 12,
  isLast: true,
  issues: [
    {
      id: "10001",
      key: "PROJ-123",
      self: "https://your-domain.atlassian.net/rest/agile/1.0/issue/10001",
      fields: {
        summary: "Implement user login feature",
        status: {
          self: "https://your-domain.atlassian.net/rest/api/3/status/10001",
          id: "10001",
          name: "In Progress",
          description: "Work is in progress",
          iconUrl: "https://your-domain.atlassian.net/images/icons/statuses/inprogress.png",
          statusCategory: {
            self: "https://your-domain.atlassian.net/rest/api/3/statuscategory/4",
            id: 4,
            key: "indeterminate",
            colorName: "yellow",
            name: "In Progress"
          }
        },
        assignee: {
          self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
          accountId: "5b10ac8d82e05b22cc7d4ef5",
          displayName: "Jane Smith",
          active: true,
          avatarUrls: {
            "48x48": "https://avatar-management.services.atlassian.com/example/48",
            "24x24": "https://avatar-management.services.atlassian.com/example/24",
            "16x16": "https://avatar-management.services.atlassian.com/example/16",
            "32x32": "https://avatar-management.services.atlassian.com/example/32"
          }
        },
        reporter: {
          self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
          accountId: "5b10ac8d82e05b22cc7d4ef5",
          displayName: "John Doe",
          active: true,
          avatarUrls: {
            "48x48": "https://avatar-management.services.atlassian.com/example/48",
            "24x24": "https://avatar-management.services.atlassian.com/example/24",
            "16x16": "https://avatar-management.services.atlassian.com/example/16",
            "32x32": "https://avatar-management.services.atlassian.com/example/32"
          }
        },
        created: "2024-01-10T10:30:00.000Z",
        updated: "2024-01-20T14:45:00.000Z",
        resolutiondate: null,
        issuetype: {
          self: "https://your-domain.atlassian.net/rest/api/3/issuetype/10001",
          id: "10001",
          name: "Story",
          description: "User story",
          iconUrl: "https://your-domain.atlassian.net/images/icons/issuetypes/story.svg",
          subtask: false
        },
        priority: {
          self: "https://your-domain.atlassian.net/rest/api/3/priority/3",
          id: "3",
          name: "Medium",
          iconUrl: "https://your-domain.atlassian.net/images/icons/priorities/medium.svg"
        },
        labels: ["authentication", "security"],
        components: [],
        fixVersions: [],
        issuelinks: [],
        subtasks: [],
        project: {
          self: "https://your-domain.atlassian.net/rest/api/3/project/10000",
          id: "10000",
          key: "PROJ",
          name: "My Project"
        },
        customfield_10104: 123, // Sprint ID
        customfield_10000: 5 // Story points
      },
      sprint: {
        id: 123,
        self: "https://your-domain.atlassian.net/rest/agile/1.0/sprint/123",
        state: "active",
        name: "Sprint 23"
      },
      closedSprints: [],
      flagged: false
    }
  ]
};

/**
 * EXAMPLE 4: Get Single Issue Response (Full Details)
 * GET /rest/api/3/issue/PROJ-123?expand=changelog,transitions
 */
export const EXAMPLE_ISSUE_RESPONSE: JiraIssue = {
  id: "10001",
  key: "PROJ-123",
  self: "https://your-domain.atlassian.net/rest/api/3/issue/10001",
  expand: "changelog,transitions",
  fields: {
    summary: "Implement user login feature",
    description: "As a user, I want to log in to the application so that I can access my account.",
    status: {
      self: "https://your-domain.atlassian.net/rest/api/3/status/10001",
      id: "10001",
      name: "In Progress",
      description: "Work is in progress",
      iconUrl: "https://your-domain.atlassian.net/images/icons/statuses/inprogress.png",
      statusCategory: {
        self: "https://your-domain.atlassian.net/rest/api/3/statuscategory/4",
        id: 4,
        key: "indeterminate",
        colorName: "yellow",
        name: "In Progress"
      }
    },
    issuetype: {
      self: "https://your-domain.atlassian.net/rest/api/3/issuetype/10001",
      id: "10001",
      name: "Story",
      description: "User story",
      iconUrl: "https://your-domain.atlassian.net/images/icons/issuetypes/story.svg",
      subtask: false
    },
    priority: {
      self: "https://your-domain.atlassian.net/rest/api/3/priority/3",
      id: "3",
      name: "Medium",
      iconUrl: "https://your-domain.atlassian.net/images/icons/priorities/medium.svg"
    },
    assignee: {
      self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
      accountId: "5b10ac8d82e05b22cc7d4ef5",
      displayName: "Jane Smith",
      active: true,
      emailAddress: "[email protected]",
      avatarUrls: {
        "48x48": "https://avatar-management.services.atlassian.com/example/48",
        "24x24": "https://avatar-management.services.atlassian.com/example/24",
        "16x16": "https://avatar-management.services.atlassian.com/example/16",
        "32x32": "https://avatar-management.services.atlassian.com/example/32"
      }
    },
    reporter: {
      self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef6",
      accountId: "5b10ac8d82e05b22cc7d4ef6",
      displayName: "John Doe",
      active: true,
      emailAddress: "[email protected]",
      avatarUrls: {
        "48x48": "https://avatar-management.services.atlassian.com/example/48",
        "24x24": "https://avatar-management.services.atlassian.com/example/24",
        "16x16": "https://avatar-management.services.atlassian.com/example/16",
        "32x32": "https://avatar-management.services.atlassian.com/example/32"
      }
    },
    created: "2024-01-10T10:30:00.000+0000",
    updated: "2024-01-20T14:45:00.000+0000",
    resolutiondate: null,
    duedate: "2024-01-29",
    project: {
      self: "https://your-domain.atlassian.net/rest/api/3/project/10000",
      id: "10000",
      key: "PROJ",
      name: "My Project",
      avatarUrls: {
        "48x48": "https://your-domain.atlassian.net/secure/projectavatar?pid=10000&avatarId=10324",
        "24x24": "https://your-domain.atlassian.net/secure/projectavatar?size=small&pid=10000&avatarId=10324",
        "16x16": "https://your-domain.atlassian.net/secure/projectavatar?size=xsmall&pid=10000&avatarId=10324",
        "32x32": "https://your-domain.atlassian.net/secure/projectavatar?size=medium&pid=10000&avatarId=10324"
      },
      projectTypeKey: "software"
    },
    labels: ["authentication", "security"],
    components: [
      {
        self: "https://your-domain.atlassian.net/rest/api/3/component/10000",
        id: "10000",
        name: "Frontend"
      }
    ],
    fixVersions: [
      {
        self: "https://your-domain.atlassian.net/rest/api/3/version/10000",
        id: "10000",
        name: "Version 1.0",
        archived: false,
        released: false,
        releaseDate: "2024-12-31"
      }
    ],
    issuelinks: [
      {
        id: "10050",
        self: "https://your-domain.atlassian.net/rest/api/3/issueLink/10050",
        type: {
          id: "10003",
          name: "Blocks",
          inward: "is blocked by",
          outward: "blocks",
          self: "https://your-domain.atlassian.net/rest/api/3/issueLinkType/10003"
        },
        outwardIssue: {
          id: "10002",
          key: "PROJ-124",
          self: "https://your-domain.atlassian.net/rest/api/3/issue/10002",
          fields: {
            summary: "Setup authentication backend",
            status: {
              self: "https://your-domain.atlassian.net/rest/api/3/status/10000",
              id: "10000",
              name: "To Do",
              description: "Work has not started",
              iconUrl: "https://your-domain.atlassian.net/images/icons/statuses/todo.png",
              statusCategory: {
                self: "https://your-domain.atlassian.net/rest/api/3/statuscategory/2",
                id: 2,
                key: "new",
                colorName: "blue-gray",
                name: "To Do"
              }
            },
            priority: {
              self: "https://your-domain.atlassian.net/rest/api/3/priority/2",
              id: "2",
              name: "High",
              iconUrl: "https://your-domain.atlassian.net/images/icons/priorities/high.svg"
            },
            issuetype: {
              self: "https://your-domain.atlassian.net/rest/api/3/issuetype/10001",
              id: "10001",
              name: "Story",
              description: "User story",
              iconUrl: "https://your-domain.atlassian.net/images/icons/issuetypes/story.svg",
              subtask: false
            }
          }
        }
      }
    ],
    subtasks: [],
    comment: {
      comments: [
        {
          self: "https://your-domain.atlassian.net/rest/api/3/issue/10001/comment/10000",
          id: "10000",
          author: {
            self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
            accountId: "5b10ac8d82e05b22cc7d4ef5",
            displayName: "Jane Smith",
            active: true,
            avatarUrls: {
              "48x48": "https://avatar-management.services.atlassian.com/example/48",
              "24x24": "https://avatar-management.services.atlassian.com/example/24",
              "16x16": "https://avatar-management.services.atlassian.com/example/16",
              "32x32": "https://avatar-management.services.atlassian.com/example/32"
            }
          },
          body: "Started working on the frontend implementation",
          updateAuthor: {
            self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
            accountId: "5b10ac8d82e05b22cc7d4ef5",
            displayName: "Jane Smith",
            active: true,
            avatarUrls: {
              "48x48": "https://avatar-management.services.atlassian.com/example/48",
              "24x24": "https://avatar-management.services.atlassian.com/example/24",
              "16x16": "https://avatar-management.services.atlassian.com/example/16",
              "32x32": "https://avatar-management.services.atlassian.com/example/32"
            }
          },
          created: "2024-01-15T11:00:00.000+0000",
          updated: "2024-01-15T11:00:00.000+0000"
        }
      ],
      maxResults: 1,
      total: 1,
      startAt: 0
    },
    timetracking: {
      originalEstimate: "2d",
      remainingEstimate: "1d",
      timeSpent: "1d",
      originalEstimateSeconds: 57600,
      remainingEstimateSeconds: 28800,
      timeSpentSeconds: 28800
    },
    // Custom fields - Sprint and Story Points
    customfield_10104: 123, // Sprint ID
    customfield_10000: 5 // Story points
  },
  sprint: {
    id: 123,
    self: "https://your-domain.atlassian.net/rest/agile/1.0/sprint/123",
    state: "active",
    name: "Sprint 23",
    startDate: "2024-01-15T09:00:00.000Z",
    endDate: "2024-01-29T17:00:00.000Z",
    originBoardId: 5,
    goal: "Complete user authentication and profile management features"
  },
  closedSprints: [
    {
      id: 122,
      self: "https://your-domain.atlassian.net/rest/agile/1.0/sprint/122",
      state: "closed",
      name: "Sprint 22",
      startDate: "2024-01-01T09:00:00.000Z",
      endDate: "2024-01-14T17:00:00.000Z",
      completeDate: "2024-01-14T17:30:00.000Z",
      originBoardId: 5
    }
  ],
  flagged: false
};

/**
 * EXAMPLE 5: Get Issue Changelog Response
 * GET /rest/api/3/issue/PROJ-123/changelog
 *
 * CRITICAL FOR LIFECYCLE ANALYSIS:
 * - Track exact timestamps of status transitions
 * - Calculate time spent in each status
 * - Identify workflow bottlenecks
 */
export const EXAMPLE_CHANGELOG_RESPONSE: JiraChangelog = {
  startAt: 0,
  maxResults: 100,
  total: 4,
  histories: [
    {
      id: "10000",
      author: {
        self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef6",
        accountId: "5b10ac8d82e05b22cc7d4ef6",
        displayName: "John Doe",
        active: true,
        avatarUrls: {
          "48x48": "https://avatar-management.services.atlassian.com/example/48",
          "24x24": "https://avatar-management.services.atlassian.com/example/24",
          "16x16": "https://avatar-management.services.atlassian.com/example/16",
          "32x32": "https://avatar-management.services.atlassian.com/example/32"
        }
      },
      created: "2024-01-10T10:30:00.000+0000",
      items: [
        {
          field: "status",
          fieldtype: "jira",
          fieldId: "status",
          from: null,
          fromString: null,
          to: "10000",
          toString: "To Do"
        }
      ]
    },
    {
      id: "10001",
      author: {
        self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
        accountId: "5b10ac8d82e05b22cc7d4ef5",
        displayName: "Jane Smith",
        active: true,
        avatarUrls: {
          "48x48": "https://avatar-management.services.atlassian.com/example/48",
          "24x24": "https://avatar-management.services.atlassian.com/example/24",
          "16x16": "https://avatar-management.services.atlassian.com/example/16",
          "32x32": "https://avatar-management.services.atlassian.com/example/32"
        }
      },
      created: "2024-01-15T09:15:00.000+0000",
      items: [
        {
          field: "status",
          fieldtype: "jira",
          fieldId: "status",
          from: "10000",
          fromString: "To Do",
          to: "10001",
          toString: "In Progress"
        },
        {
          field: "assignee",
          fieldtype: "jira",
          fieldId: "assignee",
          from: null,
          fromString: null,
          to: "5b10ac8d82e05b22cc7d4ef5",
          toString: "Jane Smith"
        }
      ]
    },
    {
      id: "10002",
      author: {
        self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
        accountId: "5b10ac8d82e05b22cc7d4ef5",
        displayName: "Jane Smith",
        active: true,
        avatarUrls: {
          "48x48": "https://avatar-management.services.atlassian.com/example/48",
          "24x24": "https://avatar-management.services.atlassian.com/example/24",
          "16x16": "https://avatar-management.services.atlassian.com/example/16",
          "32x32": "https://avatar-management.services.atlassian.com/example/32"
        }
      },
      created: "2024-01-18T14:30:00.000+0000",
      items: [
        {
          field: "status",
          fieldtype: "jira",
          fieldId: "status",
          from: "10001",
          fromString: "In Progress",
          to: "10002",
          toString: "In Review"
        }
      ]
    },
    {
      id: "10003",
      author: {
        self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef7",
        accountId: "5b10ac8d82e05b22cc7d4ef7",
        displayName: "Bob Johnson",
        active: true,
        avatarUrls: {
          "48x48": "https://avatar-management.services.atlassian.com/example/48",
          "24x24": "https://avatar-management.services.atlassian.com/example/24",
          "16x16": "https://avatar-management.services.atlassian.com/example/16",
          "32x32": "https://avatar-management.services.atlassian.com/example/32"
        }
      },
      created: "2024-01-19T10:00:00.000+0000",
      items: [
        {
          field: "status",
          fieldtype: "jira",
          fieldId: "status",
          from: "10002",
          fromString: "In Review",
          to: "10001",
          toString: "In Progress"
        },
        {
          field: "Comment",
          fieldtype: "jira",
          from: null,
          fromString: null,
          to: null,
          toString: "Please update the error handling"
        }
      ]
    }
  ]
};

/**
 * EXAMPLE 6: Search Issues Response
 * POST /rest/api/3/search
 * Body: { "jql": "project = PROJ AND sprint = 123", "maxResults": 50 }
 */
export const EXAMPLE_SEARCH_RESPONSE: JiraSearchResponse = {
  expand: "schema,names",
  startAt: 0,
  maxResults: 50,
  total: 2,
  issues: [
    {
      id: "10001",
      key: "PROJ-123",
      self: "https://your-domain.atlassian.net/rest/api/3/issue/10001",
      fields: {
        summary: "Implement user login feature",
        status: {
          self: "https://your-domain.atlassian.net/rest/api/3/status/10001",
          id: "10001",
          name: "In Progress",
          description: "Work is in progress",
          iconUrl: "https://your-domain.atlassian.net/images/icons/statuses/inprogress.png",
          statusCategory: {
            self: "https://your-domain.atlassian.net/rest/api/3/statuscategory/4",
            id: 4,
            key: "indeterminate",
            colorName: "yellow",
            name: "In Progress"
          }
        },
        assignee: {
          self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5",
          accountId: "5b10ac8d82e05b22cc7d4ef5",
          displayName: "Jane Smith",
          active: true,
          avatarUrls: {
            "48x48": "https://avatar-management.services.atlassian.com/example/48",
            "24x24": "https://avatar-management.services.atlassian.com/example/24",
            "16x16": "https://avatar-management.services.atlassian.com/example/16",
            "32x32": "https://avatar-management.services.atlassian.com/example/32"
          }
        },
        reporter: {
          self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef6",
          accountId: "5b10ac8d82e05b22cc7d4ef6",
          displayName: "John Doe",
          active: true,
          avatarUrls: {
            "48x48": "https://avatar-management.services.atlassian.com/example/48",
            "24x24": "https://avatar-management.services.atlassian.com/example/24",
            "16x16": "https://avatar-management.services.atlassian.com/example/16",
            "32x32": "https://avatar-management.services.atlassian.com/example/32"
          }
        },
        created: "2024-01-10T10:30:00.000+0000",
        updated: "2024-01-20T14:45:00.000+0000",
        resolutiondate: null,
        issuetype: {
          self: "https://your-domain.atlassian.net/rest/api/3/issuetype/10001",
          id: "10001",
          name: "Story",
          description: "User story",
          iconUrl: "https://your-domain.atlassian.net/images/icons/issuetypes/story.svg",
          subtask: false
        },
        priority: {
          self: "https://your-domain.atlassian.net/rest/api/3/priority/3",
          id: "3",
          name: "Medium",
          iconUrl: "https://your-domain.atlassian.net/images/icons/priorities/medium.svg"
        },
        labels: ["authentication", "security"],
        components: [],
        fixVersions: [],
        issuelinks: [],
        subtasks: [],
        project: {
          self: "https://your-domain.atlassian.net/rest/api/3/project/10000",
          id: "10000",
          key: "PROJ",
          name: "My Project"
        },
        customfield_10104: 123,
        customfield_10000: 5
      }
    },
    {
      id: "10002",
      key: "PROJ-124",
      self: "https://your-domain.atlassian.net/rest/api/3/issue/10002",
      fields: {
        summary: "Setup authentication backend",
        status: {
          self: "https://your-domain.atlassian.net/rest/api/3/status/10000",
          id: "10000",
          name: "To Do",
          description: "Work has not started",
          iconUrl: "https://your-domain.atlassian.net/images/icons/statuses/todo.png",
          statusCategory: {
            self: "https://your-domain.atlassian.net/rest/api/3/statuscategory/2",
            id: 2,
            key: "new",
            colorName: "blue-gray",
            name: "To Do"
          }
        },
        assignee: null,
        reporter: {
          self: "https://your-domain.atlassian.net/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef6",
          accountId: "5b10ac8d82e05b22cc7d4ef6",
          displayName: "John Doe",
          active: true,
          avatarUrls: {
            "48x48": "https://avatar-management.services.atlassian.com/example/48",
            "24x24": "https://avatar-management.services.atlassian.com/example/24",
            "16x16": "https://avatar-management.services.atlassian.com/example/16",
            "32x32": "https://avatar-management.services.atlassian.com/example/32"
          }
        },
        created: "2024-01-10T11:00:00.000+0000",
        updated: "2024-01-10T11:00:00.000+0000",
        resolutiondate: null,
        issuetype: {
          self: "https://your-domain.atlassian.net/rest/api/3/issuetype/10001",
          id: "10001",
          name: "Story",
          description: "User story",
          iconUrl: "https://your-domain.atlassian.net/images/icons/issuetypes/story.svg",
          subtask: false
        },
        priority: {
          self: "https://your-domain.atlassian.net/rest/api/3/priority/2",
          id: "2",
          name: "High",
          iconUrl: "https://your-domain.atlassian.net/images/icons/priorities/high.svg"
        },
        labels: ["authentication", "backend"],
        components: [],
        fixVersions: [],
        issuelinks: [],
        subtasks: [],
        project: {
          self: "https://your-domain.atlassian.net/rest/api/3/project/10000",
          id: "10000",
          key: "PROJ",
          name: "My Project"
        },
        customfield_10104: 123,
        customfield_10000: 8
      }
    }
  ]
};

// ============================================================================
// Lifecycle Tracking Utilities
// ============================================================================

/**
 * Helper type for extracting status transitions from changelog
 */
export interface StatusTransition {
  from: string | null;
  to: string;
  timestamp: JiraDateTime;
  author: JiraUser;
}

/**
 * Extract status transitions from changelog histories
 *
 * @param changelog - Issue changelog
 * @returns Array of status transitions in chronological order
 */
export function extractStatusTransitions(changelog: JiraChangelog): StatusTransition[] {
  const transitions: StatusTransition[] = [];

  for (const history of changelog.histories) {
    for (const item of history.items) {
      if (item.field === 'status') {
        transitions.push({
          from: item.fromString || null,
          to: item.toString!,
          timestamp: history.created,
          author: history.author
        });
      }
    }
  }

  return transitions;
}

/**
 * Calculate time spent in each status (in milliseconds)
 *
 * @param issue - Issue with changelog
 * @returns Map of status name to time spent in milliseconds
 */
export function calculateTimeInStatus(issue: JiraIssue): Map<string, number> {
  if (!issue.changelog) {
    throw new Error('Issue must include changelog data');
  }

  const timeMap = new Map<string, number>();
  const transitions = extractStatusTransitions(issue.changelog);

  // Add initial status (from creation to first transition)
  if (transitions.length > 0) {
    const createdTime = new Date(issue.fields.created).getTime();
    const firstTransitionTime = new Date(transitions[0].timestamp).getTime();
    const initialStatus = transitions[0].from || 'To Do';
    timeMap.set(initialStatus, firstTransitionTime - createdTime);
  }

  // Calculate time between transitions
  for (let i = 0; i < transitions.length - 1; i++) {
    const currentTime = new Date(transitions[i].timestamp).getTime();
    const nextTime = new Date(transitions[i + 1].timestamp).getTime();
    const status = transitions[i].to;
    const duration = nextTime - currentTime;

    timeMap.set(status, (timeMap.get(status) || 0) + duration);
  }

  // Add time in current status
  if (transitions.length > 0) {
    const lastTransition = transitions[transitions.length - 1];
    const lastTime = new Date(lastTransition.timestamp).getTime();
    const now = new Date().getTime();
    const currentStatus = lastTransition.to;

    timeMap.set(currentStatus, (timeMap.get(currentStatus) || 0) + (now - lastTime));
  }

  return timeMap;
}

/**
 * Calculate cycle time (time from first "In Progress" to "Done")
 *
 * @param issue - Issue with changelog
 * @returns Cycle time in milliseconds, or null if not applicable
 */
export function calculateCycleTime(issue: JiraIssue): number | null {
  if (!issue.changelog) {
    throw new Error('Issue must include changelog data');
  }

  const transitions = extractStatusTransitions(issue.changelog);

  // Find first transition to "In Progress" (or similar active state)
  const startTransition = transitions.find(t =>
    t.to === 'In Progress' || t.to === 'In Development'
  );

  // Find last transition to "Done" (or similar completed state)
  const endTransition = [...transitions].reverse().find(t =>
    t.to === 'Done' || t.to === 'Closed' || t.to === 'Resolved'
  );

  if (!startTransition || !endTransition) {
    return null;
  }

  const startTime = new Date(startTransition.timestamp).getTime();
  const endTime = new Date(endTransition.timestamp).getTime();

  return endTime - startTime;
}

/**
 * Calculate lead time (time from creation to completion)
 *
 * @param issue - Issue object
 * @returns Lead time in milliseconds, or null if not completed
 */
export function calculateLeadTime(issue: JiraIssue): number | null {
  if (!issue.fields.resolutiondate) {
    return null;
  }

  const createdTime = new Date(issue.fields.created).getTime();
  const resolvedTime = new Date(issue.fields.resolutiondate).getTime();

  return resolvedTime - createdTime;
}
