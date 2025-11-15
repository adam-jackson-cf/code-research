/**
 * Console log extraction and filtering utilities
 *
 * Handles reading and filtering browser console logs
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ConsoleEntry, ConsoleFilter } from '../core/types.js';

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
 * Extract console logs from the browser
 */
export async function extractConsoleLogs(
  client: Client,
  filterOptions?: ConsoleFilter
): Promise<ConsoleEntry[]> {
  // Get console logs via MCP evaluate
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        // Access the stored console logs if available
        if (window.__consoleLogs) {
          return window.__consoleLogs;
        }
        return [];
      })()
    `,
  });

  if (result.isError) {
    // If we can't get stored logs, return empty array
    return [];
  }

  let logs: ConsoleEntry[] = [];

  // Parse the console logs from the result
  const content = extractTextFromResult(result);
  if (content) {
    try {
      const parsedLogs = JSON.parse(content);
      if (Array.isArray(parsedLogs)) {
        logs = parsedLogs.map(normalizeConsoleLog);
      }
    } catch {
      // If parsing fails, try to get logs via alternative method
      logs = await getConsoleLogsAlternative(client);
    }
  }

  // Apply filters if provided
  if (filterOptions) {
    logs = filterConsoleLogs(logs, filterOptions);
  }

  return logs;
}

/**
 * Alternative method to get console logs by injecting a listener
 */
async function getConsoleLogsAlternative(
  client: Client
): Promise<ConsoleEntry[]> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        // Initialize console log storage if not exists
        if (!window.__consoleLogs) {
          window.__consoleLogs = [];

          // Intercept console methods
          const methods = ['log', 'warn', 'error', 'info', 'debug'];
          methods.forEach(method => {
            const original = console[method];
            console[method] = function(...args) {
              window.__consoleLogs.push({
                level: method,
                text: args.map(arg =>
                  typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                ).join(' '),
                timestamp: Date.now()
              });
              original.apply(console, args);
            };
          });
        }
        return window.__consoleLogs;
      })()
    `,
  });

  if (result.isError) {
    return [];
  }

  const content = extractTextFromResult(result);
  if (content) {
    try {
      const logs = JSON.parse(content);
      if (Array.isArray(logs)) {
        return logs.map(normalizeConsoleLog);
      }
    } catch {
      // Failed to parse
    }
  }

  return [];
}

/**
 * Clear browser console logs
 */
export async function clearBrowserConsole(client: Client): Promise<void> {
  // Clear the stored console logs
  await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        if (window.__consoleLogs) {
          window.__consoleLogs = [];
        }
        console.clear();
      })()
    `,
  });
}

/**
 * Filter console logs based on options
 */
export function filterConsoleLogs(
  logs: ConsoleEntry[],
  options: ConsoleFilter
): ConsoleEntry[] {
  let filtered = logs;

  // Filter by level
  if (options.level) {
    const levels = Array.isArray(options.level) ? options.level : [options.level];
    filtered = filtered.filter((log) => levels.includes(log.level));
  }

  // Filter by text
  if (options.text) {
    const pattern = typeof options.text === 'string'
      ? new RegExp(options.text, 'i')
      : options.text;
    filtered = filtered.filter((log) => pattern.test(log.text));
  }

  // Filter by timestamp range
  if (options.timestampRange) {
    const start = new Date(options.timestampRange.start).getTime();
    const end = new Date(options.timestampRange.end).getTime();
    filtered = filtered.filter((log) => {
      const timestamp = new Date(log.timestamp).getTime();
      return timestamp >= start && timestamp <= end;
    });
  }

  // Apply limit
  if (options.limit && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Get only error logs
 */
export async function getErrorLogs(client: Client): Promise<ConsoleEntry[]> {
  return extractConsoleLogs(client, {
    level: 'error',
  });
}

/**
 * Get only warning logs
 */
export async function getWarningLogs(client: Client): Promise<ConsoleEntry[]> {
  return extractConsoleLogs(client, {
    level: 'warn',
  });
}

/**
 * Check if there are any console errors
 */
export async function hasConsoleErrors(client: Client): Promise<boolean> {
  const errors = await getErrorLogs(client);
  return errors.length > 0;
}

/**
 * Normalize a console log entry to the standard format
 */
function normalizeConsoleLog(log: any): ConsoleEntry {
  const timestamp = log.timestamp
    ? new Date(log.timestamp).toISOString()
    : new Date().toISOString();

  return {
    level: log.level || 'log',
    text: log.text || log.message || String(log),
    timestamp,
    source: log.source || log.url
      ? {
          url: log.url,
          lineNumber: log.lineNumber,
          columnNumber: log.columnNumber,
        }
      : undefined,
    stackTrace: log.stackTrace,
    args: log.args,
  };
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
