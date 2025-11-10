/**
 * Mock for OpenAI SDK
 */

export const mockSpeechCreate = jest.fn();
export const mockTranscriptionsCreate = jest.fn();

// Mock OpenAI client
export class MockOpenAI {
  audio = {
    speech: {
      create: mockSpeechCreate,
    },
    transcriptions: {
      create: mockTranscriptionsCreate,
    },
  };
}

// Default mock implementations
mockSpeechCreate.mockResolvedValue({
  arrayBuffer: async () => new ArrayBuffer(1024),
});

mockTranscriptionsCreate.mockResolvedValue({
  text: 'Mock transcription text',
});

jest.mock('openai', () => ({
  __esModule: true,
  default: MockOpenAI,
}));

export function mockTTSResponse(audioData: ArrayBuffer) {
  mockSpeechCreate.mockResolvedValueOnce({
    arrayBuffer: async () => audioData,
  });
}

export function mockSTTResponse(text: string) {
  mockTranscriptionsCreate.mockResolvedValueOnce({ text });
}

export function mockTTSError(error: Error) {
  mockSpeechCreate.mockRejectedValueOnce(error);
}

export function mockSTTError(error: Error) {
  mockTranscriptionsCreate.mockRejectedValueOnce(error);
}

export function resetOpenAIMocks() {
  mockSpeechCreate.mockReset();
  mockTranscriptionsCreate.mockReset();
  mockSpeechCreate.mockResolvedValue({
    arrayBuffer: async () => new ArrayBuffer(1024),
  });
  mockTranscriptionsCreate.mockResolvedValue({
    text: 'Mock transcription text',
  });
}
