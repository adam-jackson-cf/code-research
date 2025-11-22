/**
 * Mock GitHub API responses for Apache Kafka repository
 * These fixtures correspond to the mock Jira issues
 */

export interface MockCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
  } | null;
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
  files: {
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
  }[];
}

export interface MockPullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
  additions: number;
  deletions: number;
  commits: number;
  requested_reviewers: { login: string }[];
  reviews?: {
    user: { login: string };
    state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
    submitted_at: string;
  }[];
}

/**
 * Mock commits mapped to Jira tickets
 */
export const mockCommits: MockCommit[] = [
  // KAFKA-19734: Updating the docs for KIP-1221
  {
    sha: '5ab7f0b47b71e8c9d2f3a4b5c6d7e8f9a0b1c2d3',
    commit: {
      message:
        'KAFKA-19734: Updating the docs for KIP-1221\n\nUpdate consumer protocol documentation',
      author: {
        name: 'John Developer',
        email: 'john@example.com',
        date: '2024-10-22T14:30:00Z',
      },
    },
    author: {
      login: 'johndeveloper',
    },
    stats: {
      additions: 125,
      deletions: 45,
      total: 170,
    },
    files: [
      {
        filename: 'docs/consumer-protocol.md',
        additions: 100,
        deletions: 30,
        changes: 130,
      },
      {
        filename: 'docs/kip-1221.md',
        additions: 25,
        deletions: 15,
        changes: 40,
      },
    ],
  },
  {
    sha: '6bc8f1c58c82f9d0e3f4a5b6c7d8e9f0a1b2c3d4',
    commit: {
      message: 'KAFKA-19734: Address review comments',
      author: {
        name: 'John Developer',
        email: 'john@example.com',
        date: '2024-10-30T09:15:00Z',
      },
    },
    author: {
      login: 'johndeveloper',
    },
    stats: {
      additions: 15,
      deletions: 8,
      total: 23,
    },
    files: [
      {
        filename: 'docs/consumer-protocol.md',
        additions: 15,
        deletions: 8,
        changes: 23,
      },
    ],
  },

  // KAFKA-19860: Integration tests for KIP-1226
  {
    sha: '3fd489245636e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
    commit: {
      message: 'KAFKA-19860: Integration tests for KIP-1226\n\nAdd comprehensive test suite',
      author: {
        name: 'Alice Tester',
        email: 'alice@example.com',
        date: '2024-10-25T11:20:00Z',
      },
    },
    author: {
      login: 'alicetester',
    },
    stats: {
      additions: 450,
      deletions: 20,
      total: 470,
    },
    files: [
      {
        filename: 'tests/integration/kip_1226_test.py',
        additions: 350,
        deletions: 0,
        changes: 350,
      },
      {
        filename: 'tests/fixtures/kip_1226_data.json',
        additions: 100,
        deletions: 20,
        changes: 120,
      },
    ],
  },

  // KAFKA-19715: Consider bumping 3rd party Github Actions
  {
    sha: '19b655fa9959e6f7a8b9c0d1e2f3a4b5c6d7e8f9',
    commit: {
      message: 'KAFKA-19715: Consider bumping 3rd party Github Actions',
      author: {
        name: 'Bob DevOps',
        email: 'bob@example.com',
        date: '2024-10-24T16:45:00Z',
      },
    },
    author: {
      login: 'bobdevops',
    },
    stats: {
      additions: 12,
      deletions: 12,
      total: 24,
    },
    files: [
      {
        filename: '.github/workflows/ci.yml',
        additions: 8,
        deletions: 8,
        changes: 16,
      },
      {
        filename: '.github/workflows/release.yml',
        additions: 4,
        deletions: 4,
        changes: 8,
      },
    ],
  },

  // KAFKA-19882: Cleaning client level metric tags
  {
    sha: 'bb95e3ab195be5f6a7b8c9d0e1f2a3b4c5d6e7f8',
    commit: {
      message: 'KAFKA-19882: Cleaning client level metric tags',
      author: {
        name: 'Diana Metrics',
        email: 'diana@example.com',
        date: '2024-11-10T10:30:00Z',
      },
    },
    author: {
      login: 'dianametrics',
    },
    stats: {
      additions: 85,
      deletions: 120,
      total: 205,
    },
    files: [
      {
        filename: 'clients/src/main/java/org/apache/kafka/common/metrics/Metrics.java',
        additions: 50,
        deletions: 80,
        changes: 130,
      },
      {
        filename: 'clients/src/test/java/org/apache/kafka/common/metrics/MetricsTest.java',
        additions: 35,
        deletions: 40,
        changes: 75,
      },
    ],
  },

  // KAFKA-19757: Interface stability and deprecation
  {
    sha: 'fb56f8a98176e4f5a6b7c8d9e0f1a2b3c4d5e6f7',
    commit: {
      message: 'KAFKA-19757: Interface stability and deprecation',
      author: {
        name: 'Eve Docs',
        email: 'eve@example.com',
        date: '2024-10-28T13:20:00Z',
      },
    },
    author: {
      login: 'evedocs',
    },
    stats: {
      additions: 200,
      deletions: 50,
      total: 250,
    },
    files: [
      {
        filename: 'docs/api-stability.md',
        additions: 150,
        deletions: 30,
        changes: 180,
      },
      {
        filename: 'docs/deprecation-policy.md',
        additions: 50,
        deletions: 20,
        changes: 70,
      },
    ],
  },

  // KAFKA-17853: Fix termination issue in ConsoleConsumer
  {
    sha: 'b4431300026de3f4a5b6c7d8e9f0a1b2c3d4e5f6',
    commit: {
      message:
        'KAFKA-17853: Fix termination issue in ConsoleConsumer\n\nEnsure proper cleanup on shutdown',
      author: {
        name: 'Grace Bugfixer',
        email: 'grace@example.com',
        date: '2024-08-15T14:50:00Z',
      },
    },
    author: {
      login: 'gracebugfixer',
    },
    stats: {
      additions: 45,
      deletions: 25,
      total: 70,
    },
    files: [
      {
        filename: 'core/src/main/scala/kafka/tools/ConsoleConsumer.scala',
        additions: 30,
        deletions: 15,
        changes: 45,
      },
      {
        filename: 'core/src/test/scala/kafka/tools/ConsoleConsumerTest.scala',
        additions: 15,
        deletions: 10,
        changes: 25,
      },
    ],
  },
  {
    sha: 'c5542411137ef4f5a6b7c8d9e0f1a2b3c4d5e6f7',
    commit: {
      message: 'KAFKA-17853: Add additional edge case handling',
      author: {
        name: 'Grace Bugfixer',
        email: 'grace@example.com',
        date: '2024-10-20T10:15:00Z',
      },
    },
    author: {
      login: 'gracebugfixer',
    },
    stats: {
      additions: 25,
      deletions: 5,
      total: 30,
    },
    files: [
      {
        filename: 'core/src/main/scala/kafka/tools/ConsoleConsumer.scala',
        additions: 25,
        deletions: 5,
        changes: 30,
      },
    ],
  },

  // KAFKA-19186: Mark OffsetCommit and OffsetFetch APIs as stable
  {
    sha: '9599143bfd9ee3f4a5b6c7d8e9f0a1b2c3d4e5f6',
    commit: {
      message: 'KAFKA-19186: Mark OffsetCommit and OffsetFetch APIs as stable',
      author: {
        name: 'Ivy API',
        email: 'ivy@example.com',
        date: '2024-11-05T15:30:00Z',
      },
    },
    author: {
      login: 'ivyapi',
    },
    stats: {
      additions: 65,
      deletions: 35,
      total: 100,
    },
    files: [
      {
        filename: 'clients/src/main/java/org/apache/kafka/clients/consumer/OffsetCommit.java',
        additions: 30,
        deletions: 15,
        changes: 45,
      },
      {
        filename: 'clients/src/main/java/org/apache/kafka/clients/consumer/OffsetFetch.java',
        additions: 25,
        deletions: 10,
        changes: 35,
      },
      {
        filename: 'docs/api-changes.md',
        additions: 10,
        deletions: 10,
        changes: 20,
      },
    ],
  },

  // KAFKA-19683: Some more test replacements
  {
    sha: 'a7655881047fe2f3a4b5c6d7e8f9a0b1c2d3e4f5',
    commit: {
      message:
        'KAFKA-19683: Some more test replacements\n\nReplace deprecated JUnit 4 with JUnit 5',
      author: {
        name: 'Alice Tester',
        email: 'alice@example.com',
        date: '2024-11-02T09:40:00Z',
      },
    },
    author: {
      login: 'alicetester',
    },
    stats: {
      additions: 180,
      deletions: 200,
      total: 380,
    },
    files: [
      {
        filename: 'core/src/test/scala/kafka/server/ServerTest.scala',
        additions: 90,
        deletions: 100,
        changes: 190,
      },
      {
        filename: 'core/src/test/scala/kafka/log/LogTest.scala',
        additions: 90,
        deletions: 100,
        changes: 190,
      },
    ],
  },

  // KAFKA-19364: KIP-932 documentation updates
  {
    sha: '64cb839041fae1f2a3b4c5d6e7f8a9b0c1d2e3f4',
    commit: {
      message: 'KAFKA-19364: KIP-932 documentation updates',
      author: {
        name: 'Eve Docs',
        email: 'eve@example.com',
        date: '2024-10-30T11:00:00Z',
      },
    },
    author: {
      login: 'evedocs',
    },
    stats: {
      additions: 120,
      deletions: 30,
      total: 150,
    },
    files: [
      {
        filename: 'docs/kip-932.md',
        additions: 100,
        deletions: 20,
        changes: 120,
      },
      {
        filename: 'docs/consumer-metrics.md',
        additions: 20,
        deletions: 10,
        changes: 30,
      },
    ],
  },
];

/**
 * Mock pull requests
 */
export const mockPullRequests: MockPullRequest[] = [
  {
    number: 20929,
    title: 'KAFKA-19715: Consider bumping 3rd party Github Actions',
    body: 'Updates third-party GitHub Actions to latest versions.\n\nRelated Jira: KAFKA-19715',
    state: 'closed',
    user: {
      login: 'bobdevops',
    },
    created_at: '2024-10-24T16:50:00Z',
    updated_at: '2024-10-25T11:30:00Z',
    closed_at: '2024-10-25T11:30:00Z',
    merged_at: '2024-10-25T11:30:00Z',
    base: {
      ref: 'trunk',
    },
    head: {
      ref: 'feature/KAFKA-19715-github-actions',
    },
    additions: 12,
    deletions: 12,
    commits: 1,
    requested_reviewers: [],
    reviews: [
      {
        user: { login: 'reviewer1' },
        state: 'APPROVED',
        submitted_at: '2024-10-25T10:00:00Z',
      },
    ],
  },
  {
    number: 20909,
    title: 'KAFKA-19860: Integration tests for KIP-1226',
    body: 'Add comprehensive integration tests for KIP-1226.\n\nThis PR includes:\n- Test fixtures\n- Integration test suite\n- Documentation updates\n\nJira: KAFKA-19860',
    state: 'closed',
    user: {
      login: 'alicetester',
    },
    created_at: '2024-10-25T11:30:00Z',
    updated_at: '2024-11-02T16:45:00Z',
    closed_at: '2024-11-02T16:45:00Z',
    merged_at: '2024-11-02T16:45:00Z',
    base: {
      ref: 'trunk',
    },
    head: {
      ref: 'feature/KAFKA-19860-kip-1226-tests',
    },
    additions: 450,
    deletions: 20,
    commits: 1,
    requested_reviewers: [],
    reviews: [
      {
        user: { login: 'reviewer2' },
        state: 'APPROVED',
        submitted_at: '2024-11-01T14:00:00Z',
      },
      {
        user: { login: 'reviewer3' },
        state: 'APPROVED',
        submitted_at: '2024-11-02T10:00:00Z',
      },
    ],
  },
  {
    number: 20804,
    title: 'KAFKA-19734: Updating the docs for KIP-1221',
    body: 'Documentation updates for KIP-1221 consumer protocol changes.\n\nJira: KAFKA-19734',
    state: 'closed',
    user: {
      login: 'johndeveloper',
    },
    created_at: '2024-10-22T14:35:00Z',
    updated_at: '2024-11-05T14:22:00Z',
    closed_at: '2024-11-05T14:22:00Z',
    merged_at: '2024-11-05T14:22:00Z',
    base: {
      ref: 'trunk',
    },
    head: {
      ref: 'feature/KAFKA-19734-docs',
    },
    additions: 140,
    deletions: 53,
    commits: 2,
    requested_reviewers: [],
    reviews: [
      {
        user: { login: 'reviewer1' },
        state: 'CHANGES_REQUESTED',
        submitted_at: '2024-10-28T09:00:00Z',
      },
      {
        user: { login: 'reviewer1' },
        state: 'APPROVED',
        submitted_at: '2024-11-04T15:00:00Z',
      },
    ],
  },
  {
    number: 19886,
    title: 'KAFKA-17853: Fix termination issue in ConsoleConsumer',
    body: 'Fixes ConsoleConsumer hanging on shutdown by ensuring proper cleanup.\n\nThis is a long-running fix that includes:\n- Initial fix for shutdown handling\n- Additional edge case handling\n- Comprehensive tests\n\nJira: KAFKA-17853',
    state: 'closed',
    user: {
      login: 'gracebugfixer',
    },
    created_at: '2024-08-15T15:00:00Z',
    updated_at: '2024-11-10T13:25:00Z',
    closed_at: '2024-11-10T13:25:00Z',
    merged_at: '2024-11-10T13:25:00Z',
    base: {
      ref: 'trunk',
    },
    head: {
      ref: 'bugfix/KAFKA-17853-console-consumer',
    },
    additions: 70,
    deletions: 30,
    commits: 2,
    requested_reviewers: [],
    reviews: [
      {
        user: { login: 'reviewer2' },
        state: 'CHANGES_REQUESTED',
        submitted_at: '2024-09-01T10:00:00Z',
      },
      {
        user: { login: 'reviewer2' },
        state: 'APPROVED',
        submitted_at: '2024-11-08T14:00:00Z',
      },
      {
        user: { login: 'reviewer4' },
        state: 'APPROVED',
        submitted_at: '2024-11-09T09:00:00Z',
      },
    ],
  },
  {
    number: 20923,
    title: 'KAFKA-19186: Mark OffsetCommit and OffsetFetch APIs as stable',
    body: 'Promotes OffsetCommit and OffsetFetch APIs from beta to stable.\n\nJira: KAFKA-19186',
    state: 'closed',
    user: {
      login: 'ivyapi',
    },
    created_at: '2024-11-05T15:35:00Z',
    updated_at: '2024-11-08T12:00:00Z',
    closed_at: '2024-11-08T12:00:00Z',
    merged_at: '2024-11-08T12:00:00Z',
    base: {
      ref: 'trunk',
    },
    head: {
      ref: 'feature/KAFKA-19186-api-stability',
    },
    additions: 65,
    deletions: 35,
    commits: 1,
    requested_reviewers: [],
    reviews: [
      {
        user: { login: 'reviewer1' },
        state: 'APPROVED',
        submitted_at: '2024-11-07T16:00:00Z',
      },
    ],
  },
];

/**
 * Get mock commits by ticket key
 */
export function getMockCommitsByTicket(ticketKey: string): MockCommit[] {
  return mockCommits.filter(commit => commit.commit.message.includes(ticketKey));
}

/**
 * Get mock PR by number
 */
export function getMockPRByNumber(prNumber: number): MockPullRequest | undefined {
  return mockPullRequests.find(pr => pr.number === prNumber);
}

/**
 * Get mock PRs by ticket key
 */
export function getMockPRsByTicket(ticketKey: string): MockPullRequest[] {
  return mockPullRequests.filter(pr => pr.title.includes(ticketKey) || pr.body.includes(ticketKey));
}
