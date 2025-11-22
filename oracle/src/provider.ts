/**
 * Model Provider Abstraction
 *
 * Supports two authentication modes:
 * 1. API Key mode - uses ANTHROPIC_API_KEY directly with Claude Agent SDK
 * 2. Subscription mode - uses Claude Code CLI auth (claude login) with ai-sdk-provider-claude-code
 */

import { query as agentQuery } from '@anthropic-ai/claude-agent-sdk';
import { generateText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import type { ProviderConfig, QueryOptions, QueryResult } from './types.js';

export type ModelName = 'sonnet' | 'haiku' | 'opus';

/**
 * Unified query function that works with both API key and subscription modes
 */
export async function query(
  prompt: string,
  options: QueryOptions,
  providerConfig: ProviderConfig
): Promise<QueryResult> {
  if (providerConfig.mode === 'subscription') {
    return queryWithSubscription(prompt, options);
  } else {
    return queryWithApiKey(prompt, options);
  }
}

/**
 * Query using API key mode (direct Claude Agent SDK)
 */
async function queryWithApiKey(
  prompt: string,
  options: QueryOptions
): Promise<QueryResult> {
  const result = await agentQuery({
    prompt,
    options: {
      model: options.model || 'sonnet',
      allowedTools: options.allowedTools || [],
      ...(options.agents && { agents: options.agents })
    }
  });

  const text = typeof result === 'string' ? result : String(result);
  return {
    text,
    provider: 'api-key'
  };
}

/**
 * Query using subscription mode (Claude Code CLI auth via ai-sdk-provider-claude-code)
 */
async function queryWithSubscription(
  prompt: string,
  options: QueryOptions
): Promise<QueryResult> {
  // Map model names to claude-code provider
  const model = claudeCode(options.model || 'sonnet', {
    // Enable tools if specified
    ...(options.allowedTools && options.allowedTools.length > 0 && {
      permissionMode: 'bypassPermissions'
    })
  });

  const { text } = await generateText({
    model,
    prompt,
    // Note: For subscription mode, tool use and agents work through the
    // Claude Code CLI's native capabilities
  });

  return {
    text,
    provider: 'subscription'
  };
}

/**
 * Check if subscription mode is available (Claude Code CLI is authenticated)
 */
export async function isSubscriptionAvailable(): Promise<boolean> {
  try {
    // Try a minimal query to check if auth is working
    const model = claudeCode('haiku');
    await generateText({
      model,
      prompt: 'Say "ok"',
      maxTokens: 10
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get provider display name for UI
 */
export function getProviderDisplayName(mode: ProviderConfig['mode']): string {
  return mode === 'subscription'
    ? 'Claude Subscription (Pro/Max)'
    : 'Anthropic API Key';
}

/**
 * Create a provider-aware query function with bound config
 */
export function createQueryFunction(providerConfig: ProviderConfig) {
  return (prompt: string, options: QueryOptions) =>
    query(prompt, options, providerConfig);
}
