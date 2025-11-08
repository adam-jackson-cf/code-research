/**
 * Represents information about a language model available in VS Code.
 * This includes metadata like the model's capabilities and context window size.
 */
export interface ModelInfo {
  /** Unique identifier for the model (e.g., "gpt-4o", "claude-3.5-sonnet") */
  id: string;

  /** Model family/name for display purposes (e.g., "GPT-4o", "Claude 3.5 Sonnet") */
  family: string;

  /** Model vendor (e.g., "OpenAI", "Anthropic", "Google") */
  vendor: string;

  /** Maximum number of tokens in the context window */
  maxTokens: number;

  /** Version information if available */
  version?: string;

  /** Additional metadata about the model */
  metadata?: {
    /** Whether the model supports vision/image inputs */
    supportsVision?: boolean;

    /** Whether the model supports function calling */
    supportsFunctionCalling?: boolean;

    /** Any other vendor-specific metadata */
    [key: string]: unknown;
  };
}

/**
 * Known model configurations with their context window sizes.
 * These are used as fallbacks when exact information isn't available from the API.
 */
export const KNOWN_MODELS: Record<string, Partial<ModelInfo>> = {
  'gpt-4o': {
    family: 'GPT-4o',
    vendor: 'OpenAI',
    maxTokens: 128000,
    metadata: {
      supportsVision: true,
      supportsFunctionCalling: true,
    },
  },
  'gpt-4o-mini': {
    family: 'GPT-4o Mini',
    vendor: 'OpenAI',
    maxTokens: 128000,
    metadata: {
      supportsVision: true,
      supportsFunctionCalling: true,
    },
  },
  'gpt-4-turbo': {
    family: 'GPT-4 Turbo',
    vendor: 'OpenAI',
    maxTokens: 128000,
  },
  'gpt-4': {
    family: 'GPT-4',
    vendor: 'OpenAI',
    maxTokens: 8192,
  },
  'gpt-3.5-turbo': {
    family: 'GPT-3.5 Turbo',
    vendor: 'OpenAI',
    maxTokens: 16384,
  },
  'claude-3.5-sonnet': {
    family: 'Claude 3.5 Sonnet',
    vendor: 'Anthropic',
    maxTokens: 200000,
    metadata: {
      supportsVision: true,
    },
  },
  'claude-3-opus': {
    family: 'Claude 3 Opus',
    vendor: 'Anthropic',
    maxTokens: 200000,
    metadata: {
      supportsVision: true,
    },
  },
  'claude-3-sonnet': {
    family: 'Claude 3 Sonnet',
    vendor: 'Anthropic',
    maxTokens: 200000,
    metadata: {
      supportsVision: true,
    },
  },
  'claude-3-haiku': {
    family: 'Claude 3 Haiku',
    vendor: 'Anthropic',
    maxTokens: 200000,
    metadata: {
      supportsVision: true,
    },
  },
  'o1-preview': {
    family: 'o1 Preview',
    vendor: 'OpenAI',
    maxTokens: 128000,
  },
  'o1-mini': {
    family: 'o1 Mini',
    vendor: 'OpenAI',
    maxTokens: 128000,
  },
  'gemini-1.5-pro': {
    family: 'Gemini 1.5 Pro',
    vendor: 'Google',
    maxTokens: 2097152, // 2M tokens
    metadata: {
      supportsVision: true,
    },
  },
  'gemini-1.5-flash': {
    family: 'Gemini 1.5 Flash',
    vendor: 'Google',
    maxTokens: 1048576, // 1M tokens
    metadata: {
      supportsVision: true,
    },
  },
  'gemini-pro': {
    family: 'Gemini Pro',
    vendor: 'Google',
    maxTokens: 32768,
  },
};

/**
 * Extracts model information from a model ID string.
 * Uses pattern matching to determine the vendor and model family.
 */
export function parseModelId(modelId: string): Partial<ModelInfo> {
  const lowerModelId = modelId.toLowerCase();

  // Check known models first
  const knownModel = Object.entries(KNOWN_MODELS).find(([key]) =>
    lowerModelId.includes(key.toLowerCase())
  );

  if (knownModel) {
    return { ...knownModel[1] };
  }

  // Try to infer vendor from model ID
  if (lowerModelId.includes('gpt')) {
    return {
      vendor: 'OpenAI',
      family: modelId,
      maxTokens: 8192, // Conservative default
    };
  }

  if (lowerModelId.includes('claude')) {
    return {
      vendor: 'Anthropic',
      family: modelId,
      maxTokens: 200000,
    };
  }

  if (lowerModelId.includes('gemini')) {
    return {
      vendor: 'Google',
      family: modelId,
      maxTokens: 32768,
    };
  }

  if (lowerModelId.includes('o1')) {
    return {
      vendor: 'OpenAI',
      family: modelId,
      maxTokens: 128000,
    };
  }

  // Unknown model
  return {
    vendor: 'Unknown',
    family: modelId,
    maxTokens: 0,
  };
}
