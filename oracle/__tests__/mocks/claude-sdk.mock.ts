/**
 * Mock for Claude Agent SDK
 */

export const mockQuery = jest.fn();

// Mock the Claude Agent SDK
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Default successful response
mockQuery.mockResolvedValue(`
{
  "mainTopic": "Test Research Topic",
  "subTopics": ["Subtopic 1", "Subtopic 2", "Subtopic 3"],
  "searchQueries": ["query 1", "query 2", "query 3"],
  "estimatedSources": 30,
  "estimatedDuration": "15 minutes",
  "approach": "Comprehensive multi-source research with critical analysis"
}
`);

export function mockQueryResponse(response: string) {
  mockQuery.mockResolvedValueOnce(response);
}

export function mockQueryError(error: Error) {
  mockQuery.mockRejectedValueOnce(error);
}

export function resetQueryMock() {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue(`
{
  "mainTopic": "Test Research Topic",
  "subTopics": ["Subtopic 1", "Subtopic 2", "Subtopic 3"],
  "searchQueries": ["query 1", "query 2", "query 3"],
  "estimatedSources": 30,
  "estimatedDuration": "15 minutes",
  "approach": "Comprehensive multi-source research"
}
`);
}
