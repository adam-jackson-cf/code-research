/**
 * Chrome DevTools MCP Wrapper
 *
 * Provides async wrapper methods around Chrome DevTools MCP server tools.
 * Handles retries, error handling, and response parsing.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  ConsoleEntry,
  NavigationResult,
  NavigateOptions,
  ScreenshotOptions,
} from '../core/types.js';

// Local types for Chrome wrapper
interface Screenshot {
  data: string;
  type: 'png' | 'jpeg' | 'webp';
  timestamp: number;
  viewport?: {
    width: number;
    height: number;
  };
}

interface DOMExtractionResult {
  html: string;
  title: string;
  url: string;
  timestamp: number;
}

interface WaitForSelectorOptions {
  visible?: boolean;
  hidden?: boolean;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface TypeOptions {
  delay?: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

interface RetryableError extends Error {
  retryable: boolean;
}

import { navigateWithRetry } from './navigation.js';
import { extractConsoleLogs, clearBrowserConsole } from './console-reader.js';
import { captureScreenshotWithRetry } from './screenshot-capture.js';
import { extractDOM, querySelectorInDOM } from './dom-extractor.js';

/**
 * Main wrapper class for Chrome DevTools MCP operations
 */
export class ChromeDevToolsWrapper {
  private client: Client;
  private currentUrl: string | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Get the current URL
   */
  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  /**
   * Navigate to a URL
   */
  async navigate(
    url: string,
    options: NavigateOptions = {}
  ): Promise<NavigationResult> {
    const result = await navigateWithRetry(this.client, url, options);
    this.currentUrl = result.url;
    return result;
  }

  /**
   * Get the full DOM content
   */
  async getDOM(): Promise<DOMExtractionResult> {
    return extractDOM(this.client);
  }

  /**
   * Query for elements in the DOM using a CSS selector
   */
  async querySelector(selector: string): Promise<string | null> {
    return querySelectorInDOM(this.client, selector);
  }

  /**
   * Get console logs
   */
  async getConsoleLogs(): Promise<ConsoleEntry[]> {
    return extractConsoleLogs(this.client);
  }

  /**
   * Clear console logs
   */
  async clearConsole(): Promise<void> {
    await clearBrowserConsole(this.client);
  }

  /**
   * Capture a screenshot
   */
  async captureScreenshot(
    options: ScreenshotOptions = {}
  ): Promise<Screenshot> {
    return captureScreenshotWithRetry(this.client, options);
  }

  /**
   * Click on an element
   */
  async click(
    selector: string,
    options: ClickOptions = {}
  ): Promise<void> {
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 1000;
    const timeout = options.timeout ?? 30000;

    await this.retryOperation(
      async () => {
        // First wait for the selector to be visible
        await this.waitForSelector(selector, {
          visible: true,
          timeout,
        });

        // Call the MCP click tool
        const result = await this.callTool('puppeteer_click', {
          selector,
          button: options.button || 'left',
          clickCount: options.clickCount || 1,
          delay: options.delay || 0,
        });

        if (result.isError) {
          throw new Error(`Click failed: ${this.extractErrorMessage(result)}`);
        }
      },
      maxRetries,
      retryDelay
    );
  }

  /**
   * Type text into an element
   */
  async type(
    selector: string,
    text: string,
    options: TypeOptions = {}
  ): Promise<void> {
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 1000;
    const timeout = options.timeout ?? 30000;

    await this.retryOperation(
      async () => {
        // First wait for the selector to be visible
        await this.waitForSelector(selector, {
          visible: true,
          timeout,
        });

        // Call the MCP type tool
        const result = await this.callTool('puppeteer_type', {
          selector,
          text,
          delay: options.delay || 0,
        });

        if (result.isError) {
          throw new Error(`Type failed: ${this.extractErrorMessage(result)}`);
        }
      },
      maxRetries,
      retryDelay
    );
  }

  /**
   * Wait for a selector to appear in the DOM
   */
  async waitForSelector(
    selector: string,
    options: WaitForSelectorOptions = {}
  ): Promise<void> {
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 500;
    const timeout = options.timeout ?? 30000;
    const startTime = Date.now();

    await this.retryOperation(
      async () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          throw new Error(
            `Timeout waiting for selector: ${selector} (${timeout}ms)`
          );
        }

        const result = await this.callTool('puppeteer_wait_for_selector', {
          selector,
          visible: options.visible ?? true,
          hidden: options.hidden ?? false,
          timeout: Math.max(timeout - elapsed, 1000),
        });

        if (result.isError) {
          const errorMsg = this.extractErrorMessage(result);
          if (errorMsg.includes('timeout')) {
            throw new Error(`Selector not found: ${selector}`);
          }
          throw new Error(`Wait for selector failed: ${errorMsg}`);
        }
      },
      maxRetries,
      retryDelay
    );
  }

  /**
   * Call an MCP tool
   */
  private async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    try {
      const result = await this.client.callTool({ name, arguments: args });
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
   * Extract error message from MCP result
   */
  private extractErrorMessage(result: MCPToolResult): string {
    if (result.content && result.content.length > 0) {
      const firstContent = result.content[0];
      return firstContent.text || 'Unknown error';
    }
    return 'Unknown error';
  }

  /**
   * Retry an operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    retryDelay: number
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry if it's the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (error instanceof Error && 'retryable' in error) {
          const retryableError = error as RetryableError;
          if (!retryableError.retryable) {
            throw error;
          }
        }

        // Wait before retrying with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Evaluate JavaScript in the page context
   */
  async evaluate<T = unknown>(script: string): Promise<T> {
    const result = await this.callTool('puppeteer_evaluate', {
      script,
    });

    if (result.isError) {
      throw new Error(`Evaluate failed: ${this.extractErrorMessage(result)}`);
    }

    // Parse the result
    if (result.content && result.content.length > 0) {
      const content = result.content[0];
      if (content.text) {
        try {
          return JSON.parse(content.text) as T;
        } catch {
          return content.text as T;
        }
      }
    }

    return undefined as T;
  }

  /**
   * Get the page title
   */
  async getTitle(): Promise<string> {
    return this.evaluate<string>('document.title');
  }

  /**
   * Get the page URL
   */
  async getUrl(): Promise<string> {
    return this.evaluate<string>('window.location.href');
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    await this.callTool('puppeteer_close', {});
  }
}
