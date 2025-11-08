/**
 * Screenshot capture utilities
 *
 * Handles capturing screenshots with retry logic and various options
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ScreenshotOptions } from '../core/types.js';

interface Screenshot {
  data: string;
  type: 'png' | 'jpeg' | 'webp';
  timestamp: number;
  viewport?: {
    width: number;
    height: number;
  };
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

/**
 * Capture a screenshot with retry logic
 */
export async function captureScreenshotWithRetry(
  client: Client,
  options: ScreenshotOptions = {},
  maxRetries: number = 3
): Promise<Screenshot> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await captureScreenshot(client, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw (
    lastError ||
    new Error(`Failed to capture screenshot after ${maxRetries} retries`)
  );
}

/**
 * Capture a screenshot
 */
export async function captureScreenshot(
  client: Client,
  options: ScreenshotOptions = {}
): Promise<Screenshot> {
  const type = options.type || 'png';
  const quality = options.quality || 80;
  const fullPage = options.fullPage ?? true;

  // Build the screenshot arguments
  const args: Record<string, unknown> = {
    type,
    fullPage,
  };

  // Add quality for JPEG/WebP
  if (type === 'jpeg' || type === 'webp') {
    args.quality = quality;
  }

  // Add clip region if specified
  if (options.clip) {
    args.clip = options.clip;
  }

  // Add omitBackground if specified
  if (options.omitBackground !== undefined) {
    args.omitBackground = options.omitBackground;
  }

  // Call the MCP screenshot tool
  const result = await callMCPTool(client, 'puppeteer_screenshot', args);

  if (result.isError) {
    throw new Error(`Screenshot failed: ${extractTextFromResult(result)}`);
  }

  // Extract the screenshot data
  let screenshotData = '';

  if (result.content && result.content.length > 0) {
    const content = result.content[0];

    // Check if it's base64 data
    if (content.data) {
      screenshotData = content.data;
    } else if (content.text) {
      screenshotData = content.text;
    }
  }

  if (!screenshotData) {
    throw new Error('No screenshot data returned from browser');
  }

  // Get viewport dimensions
  let viewport: Screenshot['viewport'] | undefined;
  try {
    const viewportResult = await callMCPTool(client, 'puppeteer_evaluate', {
      script: `JSON.stringify({
        width: window.innerWidth,
        height: window.innerHeight
      })`,
    });

    if (!viewportResult.isError) {
      const viewportText = extractTextFromResult(viewportResult);
      if (viewportText) {
        viewport = JSON.parse(viewportText);
      }
    }
  } catch {
    // Ignore viewport errors
  }

  return {
    data: screenshotData,
    type,
    timestamp: Date.now(),
    viewport,
  };
}

/**
 * Capture a screenshot of a specific element
 */
export async function captureElementScreenshot(
  client: Client,
  selector: string,
  options: ScreenshotOptions = {}
): Promise<Screenshot> {
  // First, get the element's bounding box
  const boundingBoxResult = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const element = document.querySelector('${selector}');
        if (!element) {
          throw new Error('Element not found: ${selector}');
        }
        const rect = element.getBoundingClientRect();
        return JSON.stringify({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        });
      })()
    `,
  });

  if (boundingBoxResult.isError) {
    throw new Error(
      `Failed to get element bounds: ${extractTextFromResult(boundingBoxResult)}`
    );
  }

  const boundingBoxText = extractTextFromResult(boundingBoxResult);
  if (!boundingBoxText) {
    throw new Error(`Element not found: ${selector}`);
  }

  const clip = JSON.parse(boundingBoxText);

  // Capture screenshot with the clip region
  return captureScreenshot(client, {
    ...options,
    clip,
    fullPage: false,
  });
}

/**
 * Save screenshot to base64 string (for storage or comparison)
 */
export function screenshotToBase64(screenshot: Screenshot): string {
  // If data already contains the data URI prefix, return as is
  if (screenshot.data.startsWith('data:')) {
    return screenshot.data;
  }

  // Otherwise, add the appropriate prefix
  const mimeType =
    screenshot.type === 'png'
      ? 'image/png'
      : screenshot.type === 'jpeg'
      ? 'image/jpeg'
      : 'image/webp';
  return `data:${mimeType};base64,${screenshot.data}`;
}

/**
 * Extract raw base64 data from screenshot (without data URI prefix)
 */
export function getRawBase64(screenshot: Screenshot): string {
  if (screenshot.data.startsWith('data:')) {
    // Remove the data URI prefix
    const base64Match = screenshot.data.match(/base64,(.+)$/);
    return base64Match ? base64Match[1] : screenshot.data;
  }
  return screenshot.data;
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
