/**
 * Mock Jira API responses based on Apache Kafka patterns
 * These fixtures mimic real Jira API responses for testing
 */

// Note: These types are based on jira-api-schema.ts in the parent directory
// For actual usage, we'll define simplified versions here

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

export interface JiraStatusCategory {
  id: number;
  key: string;
  name: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: JiraStatusCategory;
}

export interface JiraPriority {
  id: string;
  name: string;
}

export interface JiraIssueFields {
  summary: string;
  description?: string;
  issuetype: JiraIssueType;
  status: JiraStatus;
  priority: JiraPriority;
  assignee: JiraUser | null;
  reporter: JiraUser;
  created: string;
  updated: string;
  resolutiondate: string | null;
  customfield_10104?: string; // Sprint
  customfield_10016?: number; // Story points
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}

export interface JiraSearchResponse {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraChangelogItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}

export interface JiraChangelogHistory {
  id: string;
  created: string;
  items: JiraChangelogItem[];
}

export interface JiraChangelog {
  startAt: number;
  maxResults: number;
  total: number;
  histories: JiraChangelogHistory[];
}

export interface JiraChangelogResponse {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
  changelog: JiraChangelog;
}

/**
 * Sample issues based on real Apache Kafka tickets
 */
export const mockIssues: JiraIssue[] = [
  {
    id: '13271403',
    key: 'KAFKA-19734',
    self: 'https://issues.apache.org/jira/rest/api/3/issue/13271403',
    fields: {
      summary: 'Updating the docs for KIP-1221',
      description:
        'Update documentation to reflect the changes in KIP-1221 for new consumer protocol',
      issuetype: {
        id: '1',
        name: 'Story',
        subtask: false,
      },
      status: {
        id: '6',
        name: 'Done',
        statusCategory: {
          id: 3,
          key: 'done',
          name: 'Done',
        },
      },
      priority: {
        id: '3',
        name: 'Medium',
      },
      assignee: {
        accountId: 'user123',
        displayName: 'John Developer',
        emailAddress: 'john@example.com',
      },
      reporter: {
        accountId: 'user456',
        displayName: 'Jane Reporter',
        emailAddress: 'jane@example.com',
      },
      created: '2024-10-15T10:30:00.000Z',
      updated: '2024-11-05T14:22:00.000Z',
      resolutiondate: '2024-11-05T14:22:00.000Z',
      customfield_10104: '2024-Q4-Sprint-3', // Sprint
      customfield_10016: 5, // Story points
    },
  },
  {
    id: '13271502',
    key: 'KAFKA-19860',
    self: 'https://issues.apache.org/jira/rest/api/3/issue/13271502',
    fields: {
      summary: 'Integration tests for KIP-1226',
      description: 'Add comprehensive integration tests for the new KIP-1226 feature',
      issuetype: {
        id: '1',
        name: 'Story',
        subtask: false,
      },
      status: {
        id: '6',
        name: 'Done',
        statusCategory: {
          id: 3,
          key: 'done',
          name: 'Done',
        },
      },
      priority: {
        id: '3',
        name: 'Medium',
      },
      assignee: {
        accountId: 'user789',
        displayName: 'Alice Tester',
        emailAddress: 'alice@example.com',
      },
      reporter: {
        accountId: 'user456',
        displayName: 'Jane Reporter',
        emailAddress: 'jane@example.com',
      },
      created: '2024-10-20T09:15:00.000Z',
      updated: '2024-11-02T16:45:00.000Z',
      resolutiondate: '2024-11-02T16:45:00.000Z',
      customfield_10104: '2024-Q4-Sprint-3',
      customfield_10016: 8,
    },
  },
  {
    id: '13271301',
    key: 'KAFKA-19715',
    self: 'https://issues.apache.org/jira/rest/api/3/issue/13271301',
    fields: {
      summary: 'Consider bumping 3rd party Github Actions',
      description: 'Update third-party GitHub Actions to latest versions for security and features',
      issuetype: {
        id: '3',
        name: 'Task',
        subtask: false,
      },
      status: {
        id: '6',
        name: 'Done',
        statusCategory: {
          id: 3,
          key: 'done',
          name: 'Done',
        },
      },
      priority: {
        id: '4',
        name: 'Low',
      },
      assignee: {
        accountId: 'user111',
        displayName: 'Bob DevOps',
        emailAddress: 'bob@example.com',
      },
      reporter: {
        accountId: 'user222',
        displayName: 'Charlie Security',
        emailAddress: 'charlie@example.com',
      },
      created: '2024-10-10T14:00:00.000Z',
      updated: '2024-10-25T11:30:00.000Z',
      resolutiondate: '2024-10-25T11:30:00.000Z',
      customfield_10104: '2024-Q4-Sprint-2',
      customfield_10016: 2,
    },
  },
  {
    id: '13271650',
    key: 'KAFKA-19882',
    self: 'https://issues.apache.org/jira/rest/api/3/issue/13271650',
    fields: {
      summary: 'Cleaning client level metric tags',
      description: 'Clean up and standardize client-level metric tags for better observability',
      issuetype: {
        id: '4',
        name: 'Improvement',
        subtask: false,
      },
      status: {
        id: '3',
        name: 'In Progress',
        statusCategory: {
          id: 4,
          key: 'indeterminate',
          name: 'In Progress',
        },
      },
      priority: {
        id: '3',
        name: 'Medium',
      },
      assignee: {
        accountId: 'user333',
        displayName: 'Diana Metrics',
        emailAddress: 'diana@example.com',
      },
      reporter: {
        accountId: 'user456',
        displayName: 'Jane Reporter',
        emailAddress: 'jane@example.com',
      },
      created: '2024-10-28T08:45:00.000Z',
      updated: '2024-11-18T10:15:00.000Z',
      resolutiondate: null,
      customfield_10104: '2024-Q4-Sprint-4',
      customfield_10016: 5,
    },
  },
  {
    id: '13271450',
    key: 'KAFKA-19757',
    self: 'https://issues.apache.org/jira/rest/api/3/issue/13271450',
    fields: {
      summary: 'Interface stability and deprecation',
      description: 'Document interface stability guarantees and deprecation policy',
      issuetype: {
        id: '1',
        name: 'Story',
        subtask: false,
      },
      status: {
        id: '6',
        name: 'Done',
        statusCategory: {
          id: 3,
          key: 'done',
          name: 'Done',
        },
      },
      priority: {
        id: '3',
        name: 'Medium',
      },
      assignee: {
        accountId: 'user444',
        displayName: 'Eve Docs',
        emailAddress: 'eve@example.com',
      },
      reporter: {
        accountId: 'user555',
        displayName: 'Frank PM',
        emailAddress: 'frank@example.com',
      },
      created: '2024-10-18T11:20:00.000Z',
      updated: '2024-11-01T15:40:00.000Z',
      resolutiondate: '2024-11-01T15:40:00.000Z',
      customfield_10104: '2024-Q4-Sprint-3',
      customfield_10016: 3,
    },
  },
  {
    id: '13270950',
    key: 'KAFKA-17853',
    self: 'https://issues.apache.org/jira/rest/api/3/issue/13270950',
    fields: {
      summary: 'Fix termination issue in ConsoleConsumer',
      description: 'ConsoleConsumer hangs on shutdown, needs proper cleanup',
      issuetype: {
        id: '2',
        name: 'Bug',
        subtask: false,
      },
      status: {
        id: '6',
        name: 'Done',
        statusCategory: {
          id: 3,
          key: 'done',
          name: 'Done',
        },
      },
      priority: {
        id: '2',
        name: 'High',
      },
      assignee: {
        accountId: 'user666',
        displayName: 'Grace Bugfixer',
        emailAddress: 'grace@example.com',
      },
      reporter: {
        accountId: 'user777',
        displayName: 'Henry User',
        emailAddress: 'henry@example.com',
      },
      created: '2024-06-15T09:00:00.000Z',
      updated: '2024-11-10T13:25:00.000Z',
      resolutiondate: '2024-11-10T13:25:00.000Z',
      customfield_10104: '2024-Q4-Sprint-3',
      customfield_10016: 5,
    },
  },
  {
    id: '13271100',
    key: 'KAFKA-19186',
    self: 'https://issues.apache.org/jira/rest/api/3/issue/13271100',
    fields: {
      summary: 'Mark OffsetCommit and OffsetFetch APIs as stable',
      description: 'Promote OffsetCommit and OffsetFetch APIs from beta to stable',
      issuetype: {
        id: '1',
        name: 'Story',
        subtask: false,
      },
      status: {
        id: '6',
        name: 'Done',
        statusCategory: {
          id: 3,
          key: 'done',
          name: 'Done',
        },
      },
      priority: {
        id: '3',
        name: 'Medium',
      },
      assignee: {
        accountId: 'user888',
        displayName: 'Ivy API',
        emailAddress: 'ivy@example.com',
      },
      reporter: {
        accountId: 'user555',
        displayName: 'Frank PM',
        emailAddress: 'frank@example.com',
      },
      created: '2024-09-20T10:10:00.000Z',
      updated: '2024-11-08T12:00:00.000Z',
      resolutiondate: '2024-11-08T12:00:00.000Z',
      customfield_10104: '2024-Q4-Sprint-3',
      customfield_10016: 3,
    },
  },
  {
    id: '13271700',
    key: 'KAFKA-19898',
    self: 'https://issues.apache.org/jira/rest/api/3/issue/13271700',
    fields: {
      summary: 'Close ConsumerNetworkThread on failed start',
      description: 'Ensure ConsumerNetworkThread is properly closed when initialization fails',
      issuetype: {
        id: '2',
        name: 'Bug',
        subtask: false,
      },
      status: {
        id: '1',
        name: 'To Do',
        statusCategory: {
          id: 2,
          key: 'new',
          name: 'To Do',
        },
      },
      priority: {
        id: '2',
        name: 'High',
      },
      assignee: {
        accountId: 'user999',
        displayName: 'Jack Threads',
        emailAddress: 'jack@example.com',
      },
      reporter: {
        accountId: 'user777',
        displayName: 'Henry User',
        emailAddress: 'henry@example.com',
      },
      created: '2024-11-15T14:30:00.000Z',
      updated: '2024-11-15T14:30:00.000Z',
      resolutiondate: null,
      customfield_10104: '2024-Q4-Sprint-4',
      customfield_10016: 3,
    },
  },
  {
    id: '13271600',
    key: 'KAFKA-19683',
    self: 'https://issues.apache.org/jira/rest/api/3/issue/13271600',
    fields: {
      summary: 'Some more test replacements',
      description: 'Replace deprecated test utilities with new testing framework',
      issuetype: {
        id: '3',
        name: 'Task',
        subtask: false,
      },
      status: {
        id: '6',
        name: 'Done',
        statusCategory: {
          id: 3,
          key: 'done',
          name: 'Done',
        },
      },
      priority: {
        id: '4',
        name: 'Low',
      },
      assignee: {
        accountId: 'user789',
        displayName: 'Alice Tester',
        emailAddress: 'alice@example.com',
      },
      reporter: {
        accountId: 'user789',
        displayName: 'Alice Tester',
        emailAddress: 'alice@example.com',
      },
      created: '2024-10-05T13:45:00.000Z',
      updated: '2024-11-08T09:20:00.000Z',
      resolutiondate: '2024-11-08T09:20:00.000Z',
      customfield_10104: '2024-Q4-Sprint-3',
      customfield_10016: 2,
    },
  },
  {
    id: '13271250',
    key: 'KAFKA-19364',
    self: 'https://issues.apache.org/jira/rest/api/3/issue/13271250',
    fields: {
      summary: 'KIP-932 documentation updates',
      description: 'Update documentation for KIP-932: Add consumer group metrics',
      issuetype: {
        id: '1',
        name: 'Story',
        subtask: false,
      },
      status: {
        id: '6',
        name: 'Done',
        statusCategory: {
          id: 3,
          key: 'done',
          name: 'Done',
        },
      },
      priority: {
        id: '3',
        name: 'Medium',
      },
      assignee: {
        accountId: 'user444',
        displayName: 'Eve Docs',
        emailAddress: 'eve@example.com',
      },
      reporter: {
        accountId: 'user555',
        displayName: 'Frank PM',
        emailAddress: 'frank@example.com',
      },
      created: '2024-09-25T10:00:00.000Z',
      updated: '2024-11-01T14:15:00.000Z',
      resolutiondate: '2024-11-01T14:15:00.000Z',
      customfield_10104: '2024-Q4-Sprint-3',
      customfield_10016: 3,
    },
  },
];

/**
 * Mock search response
 */
export const mockSearchResponse: JiraSearchResponse = {
  expand: 'schema,names',
  startAt: 0,
  maxResults: 50,
  total: mockIssues.length,
  issues: mockIssues,
};

/**
 * Mock changelog for KAFKA-19734
 */
export const mockChangelog19734: JiraChangelogResponse = {
  id: '13271403',
  key: 'KAFKA-19734',
  self: 'https://issues.apache.org/jira/rest/api/3/issue/13271403',
  fields: mockIssues[0].fields,
  changelog: {
    startAt: 0,
    maxResults: 100,
    total: 4,
    histories: [
      {
        id: '1001',
        created: '2024-10-15T10:30:00.000Z',
        items: [
          {
            field: 'status',
            fieldtype: 'jira',
            from: '10000',
            fromString: 'To Do',
            to: '3',
            toString: 'In Progress',
          },
        ],
      },
      {
        id: '1002',
        created: '2024-10-20T15:45:00.000Z',
        items: [
          {
            field: 'assignee',
            fieldtype: 'jira',
            from: null,
            fromString: null,
            to: 'user123',
            toString: 'John Developer',
          },
        ],
      },
      {
        id: '1003',
        created: '2024-11-01T09:00:00.000Z',
        items: [
          {
            field: 'status',
            fieldtype: 'jira',
            from: '3',
            fromString: 'In Progress',
            to: '10001',
            toString: 'Code Review',
          },
        ],
      },
      {
        id: '1004',
        created: '2024-11-05T14:22:00.000Z',
        items: [
          {
            field: 'status',
            fieldtype: 'jira',
            from: '10001',
            fromString: 'Code Review',
            to: '6',
            toString: 'Done',
          },
          {
            field: 'resolution',
            fieldtype: 'jira',
            from: null,
            fromString: null,
            to: '1',
            toString: 'Fixed',
          },
        ],
      },
    ],
  },
};

/**
 * Get mock issue by key
 */
export function getMockIssueByKey(key: string): JiraIssue | undefined {
  return mockIssues.find(issue => issue.key === key);
}

/**
 * Get mock issues by status
 */
export function getMockIssuesByStatus(statusName: string): JiraIssue[] {
  return mockIssues.filter(issue => issue.fields.status.name === statusName);
}

/**
 * Get mock issues by sprint
 */
export function getMockIssuesBySprint(sprintName: string): JiraIssue[] {
  return mockIssues.filter(issue => issue.fields.customfield_10104 === sprintName);
}
