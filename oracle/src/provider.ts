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
 *
 * Note: Subscription mode has limited support for tools and agents compared to API key mode.
 * Tool calls and multi-agent orchestration may behave differently or have reduced functionality.
 */
async function queryWithSubscription(
  prompt: string,
  options: QueryOptions
): Promise<QueryResult> {
  // Warn about limited tool/agent support in subscription mode
  if (options.allowedTools && options.allowedTools.length > 0) {
    console.warn(
      '[provider] Warning: Tool support in subscription mode is limited. ' +
      'Some tools may not work as expected. Consider using api-key mode for full tool support.'
    );
  }

  if (options.agents && Object.keys(options.agents).length > 0) {
    console.warn(
      '[provider] Warning: Multi-agent orchestration in subscription mode is limited. ' +
      'Agent delegation may not work as expected. Consider using api-key mode for full agent support.'
    );
  }

  // Map model names to claude-code provider
  const model = claudeCode(options.model || 'sonnet', {
    // Enable tools if specified
    ...(options.allowedTools && options.allowedTools.length > 0 && {
      permissionMode: 'bypassPermissions'
    })
  });

  try {
    const { text } = await generateText({
      model,
      prompt
    });

    return {
      text,
      provider: 'subscription'
    };
  } catch (error) {
    // Provide more helpful error messages for subscription mode failures
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('auth') || errorMessage.includes('login') || errorMessage.includes('unauthorized')) {
      throw new Error(
        `Subscription authentication failed. Please run 'claude login' to authenticate. Original error: ${errorMessage}`
      );
    }

    throw error;
  }
}

/**
 * Result of subscription availability check
 */
export interface SubscriptionCheckResult {
  available: boolean;
  error?: 'auth_failed' | 'network_error' | 'unknown';
  message?: string;
}

/**
 * Check if subscription mode is available (Claude Code CLI is authenticated)
 * Returns detailed information about the check result to distinguish auth failures from network issues.
 */
export async function isSubscriptionAvailable(): Promise<boolean> {
  const result = await checkSubscriptionStatus();
  return result.available;
}

/**
 * Detailed subscription status check with error categorization
 */
export async function checkSubscriptionStatus(): Promise<SubscriptionCheckResult> {
  try {
    // Try a minimal query to check if auth is working
    const model = claudeCode('haiku');
    await generateText({
      model,
      prompt: 'Say "ok"'
    });
    return { available: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    // Categorize the error
    if (lowerMessage.includes('auth') || lowerMessage.includes('login') ||
        lowerMessage.includes('unauthorized') || lowerMessage.includes('unauthenticated') ||
        lowerMessage.includes('credential') || lowerMessage.includes('token')) {
      return {
        available: false,
        error: 'auth_failed',
        message: 'Not authenticated. Run "claude login" to authenticate with your subscription.'
      };
    }

    if (lowerMessage.includes('network') || lowerMessage.includes('econnrefused') ||
        lowerMessage.includes('timeout') || lowerMessage.includes('enotfound') ||
        lowerMessage.includes('socket')) {
      return {
        available: false,
        error: 'network_error',
        message: 'Network error. Check your internet connection and try again.'
      };
    }

    return {
      available: false,
      error: 'unknown',
      message: `Subscription check failed: ${errorMessage}`
    };
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

