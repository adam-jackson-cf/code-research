/**
 * Navigation utilities for Chrome DevTools MCP
 *
 * Handles page navigation with retry logic and wait conditions
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  NavigationResult,
  NavigateOptions,
} from '../core/types.js';

interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Navigate to a URL with retry logic
 */
export async function navigateWithRetry(
  client: Client,
  url: string,
  options: NavigateOptions = {}
): Promise<NavigationResult> {
  const maxRetries = 3;
  const retryDelay = 2000;
  const timeout = options.timeout ?? 30000;
  const waitUntil = options.waitUntil ?? 'load';

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();

      // Call the MCP navigate tool
      const result = await callMCPTool(client, 'puppeteer_navigate', {
        url,
        waitUntil,
        timeout,
      });

      if (result.isError) {
        throw new Error(`Navigation failed: ${extractTextFromResult(result)}`);
      }

      const duration = Date.now() - startTime;

      // Try to get the final URL after navigation (in case of redirects)
      let finalUrl = url;
      try {
        const finalUrlResult = await callMCPTool(
          client,
          'puppeteer_evaluate',
          {
            script: 'window.location.href',
          }
        );

        if (!finalUrlResult.isError) {
          const retrievedUrl = extractTextFromResult(finalUrlResult);
          if (retrievedUrl) {
            finalUrl = retrievedUrl;
          }
        }
      } catch {
        // Ignore errors getting final URL
      }

      // Extract navigation result
      const navResult: NavigationResult = {
        url: finalUrl,
        status: 200, // Default, MCP may not provide status
        success: true,
        duration,
        timing: {
          domContentLoaded: duration,
          loadComplete: duration,
        },
      };

      return navResult;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  // Return failed navigation result
  return {
    url,
    status: 0,
    success: false,
    duration: 0,
    error: {
      message: lastError?.message || `Failed to navigate to ${url} after ${maxRetries} retries`,
    },
  };
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(
  client: Client,
  options: NavigateOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 30000;
  const waitUntil = options.waitUntil ?? 'load';

  const result = await callMCPTool(client, 'puppeteer_wait_for_navigation', {
    waitUntil,
    timeout,
  });

  if (result.isError) {
    throw new Error(
      `Wait for navigation failed: ${extractTextFromResult(result)}`
    );
  }
}

/**
 * Go back in browser history
 */
export async function goBack(
  client: Client,
  options: NavigateOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 30000;

  const result = await callMCPTool(client, 'puppeteer_go_back', {
    timeout,
  });

  if (result.isError) {
    throw new Error(`Go back failed: ${extractTextFromResult(result)}`);
  }
}

/**
 * Go forward in browser history
 */
export async function goForward(
  client: Client,
  options: NavigateOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 30000;

  const result = await callMCPTool(client, 'puppeteer_go_forward', {
    timeout,
  });

  if (result.isError) {
    throw new Error(`Go forward failed: ${extractTextFromResult(result)}`);
  }
}

/**
 * Reload the current page
 */
export async function reload(
  client: Client,
  options: NavigateOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 30000;
  const waitUntil = options.waitUntil ?? 'load';

  const result = await callMCPTool(client, 'puppeteer_reload', {
    waitUntil,
    timeout,
  });

  if (result.isError) {
    throw new Error(`Reload failed: ${extractTextFromResult(result)}`);
  }
}

/**
 * Call an MCP tool
 */
async function callMCPTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<MCPToolResult> {
  try {
    const result = await client.callTool({ name, arguments: args });
    return result as MCPToolResult;
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Extract text content from MCP result
 */
function extractTextFromResult(result: MCPToolResult): string {
  if (result.content && result.content.length > 0) {
    const firstContent = result.content[0];
    return firstContent.text || '';
  }
  return '';
}
