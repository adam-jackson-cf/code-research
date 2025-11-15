/**
 * DOM content extraction utilities
 *
 * Handles extracting and querying DOM content from the browser
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { DOMElement } from '../core/types.js';

interface DOMExtractionResult {
  html: string;
  title: string;
  url: string;
  timestamp: number;
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
 * Extract the full DOM content
 */
export async function extractDOM(client: Client): Promise<DOMExtractionResult> {
  // Get the HTML content
  const htmlResult = await callMCPTool(client, 'puppeteer_evaluate', {
    script: 'document.documentElement.outerHTML',
  });

  if (htmlResult.isError) {
    throw new Error(`Failed to extract DOM: ${extractTextFromResult(htmlResult)}`);
  }

  const html = extractTextFromResult(htmlResult);

  // Get the title
  const titleResult = await callMCPTool(client, 'puppeteer_evaluate', {
    script: 'document.title',
  });
  const title = titleResult.isError ? '' : extractTextFromResult(titleResult);

  // Get the URL
  const urlResult = await callMCPTool(client, 'puppeteer_evaluate', {
    script: 'window.location.href',
  });
  const url = urlResult.isError ? '' : extractTextFromResult(urlResult);

  return {
    html,
    title,
    url,
    timestamp: Date.now(),
  };
}

/**
 * Query for elements in the DOM using a CSS selector
 */
export async function querySelectorInDOM(
  client: Client,
  selector: string
): Promise<string | null> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const element = document.querySelector('${selector}');
        if (!element) {
          return null;
        }
        return element.outerHTML;
      })()
    `,
  });

  if (result.isError) {
    return null;
  }

  const content = extractTextFromResult(result);
  return content === 'null' ? null : content;
}

/**
 * Query for all matching elements in the DOM
 */
export async function querySelectorAllInDOM(
  client: Client,
  selector: string
): Promise<string[]> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const elements = document.querySelectorAll('${selector}');
        return JSON.stringify(Array.from(elements).map(el => el.outerHTML));
      })()
    `,
  });

  if (result.isError) {
    return [];
  }

  const content = extractTextFromResult(result);
  if (!content) {
    return [];
  }

  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Get the text content of an element
 */
export async function getElementText(
  client: Client,
  selector: string
): Promise<string | null> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const element = document.querySelector('${selector}');
        if (!element) {
          return null;
        }
        return element.textContent;
      })()
    `,
  });

  if (result.isError) {
    return null;
  }

  const content = extractTextFromResult(result);
  return content === 'null' ? null : content;
}

/**
 * Get the value of an input element
 */
export async function getInputValue(
  client: Client,
  selector: string
): Promise<string | null> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const element = document.querySelector('${selector}');
        if (!element) {
          return null;
        }
        return element.value;
      })()
    `,
  });

  if (result.isError) {
    return null;
  }

  const content = extractTextFromResult(result);
  return content === 'null' ? null : content;
}

/**
 * Get an attribute value from an element
 */
export async function getElementAttribute(
  client: Client,
  selector: string,
  attribute: string
): Promise<string | null> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const element = document.querySelector('${selector}');
        if (!element) {
          return null;
        }
        return element.getAttribute('${attribute}');
      })()
    `,
  });

  if (result.isError) {
    return null;
  }

  const content = extractTextFromResult(result);
  return content === 'null' ? null : content;
}

/**
 * Check if an element exists in the DOM
 */
export async function elementExists(
  client: Client,
  selector: string
): Promise<boolean> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const element = document.querySelector('${selector}');
        return element !== null;
      })()
    `,
  });

  if (result.isError) {
    return false;
  }

  const content = extractTextFromResult(result);
  return content === 'true';
}

/**
 * Count matching elements in the DOM
 */
export async function countElements(
  client: Client,
  selector: string
): Promise<number> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const elements = document.querySelectorAll('${selector}');
        return elements.length;
      })()
    `,
  });

  if (result.isError) {
    return 0;
  }

  const content = extractTextFromResult(result);
  const count = parseInt(content, 10);
  return isNaN(count) ? 0 : count;
}

/**
 * Extract structured DOM element information
 */
export async function extractElementInfo(
  client: Client,
  selector: string
): Promise<DOMElement | null> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const element = document.querySelector('${selector}');
        if (!element) {
          return null;
        }

        const attributes = {};
        for (const attr of element.attributes) {
          attributes[attr.name] = attr.value;
        }

        return JSON.stringify({
          tagName: element.tagName.toLowerCase(),
          attributes: attributes,
          textContent: element.textContent,
          innerHTML: element.innerHTML
        });
      })()
    `,
  });

  if (result.isError) {
    return null;
  }

  const content = extractTextFromResult(result);
  if (content === 'null' || !content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get all links from the page
 */
export async function extractLinks(client: Client): Promise<string[]> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return JSON.stringify(links.map(link => link.href));
      })()
    `,
  });

  if (result.isError) {
    return [];
  }

  const content = extractTextFromResult(result);
  if (!content) {
    return [];
  }

  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Get all images from the page
 */
export async function extractImages(client: Client): Promise<string[]> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: `
      (function() {
        const images = Array.from(document.querySelectorAll('img[src]'));
        return JSON.stringify(images.map(img => img.src));
      })()
    `,
  });

  if (result.isError) {
    return [];
  }

  const content = extractTextFromResult(result);
  if (!content) {
    return [];
  }

  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Get the inner text of the page (visible text only)
 */
export async function getPageText(client: Client): Promise<string> {
  const result = await callMCPTool(client, 'puppeteer_evaluate', {
    script: 'document.body.innerText',
  });

  if (result.isError) {
    return '';
  }

  return extractTextFromResult(result);
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
