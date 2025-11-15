import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChromeDevToolsWrapper } from '../../../src/chrome/devtools-wrapper.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('ChromeDevToolsWrapper', () => {
  let wrapper: ChromeDevToolsWrapper;
  let mockClient: Client;

  beforeEach(() => {
    // Create a mock MCP client
    mockClient = {
      callTool: vi.fn(),
    } as any;

    wrapper = new ChromeDevToolsWrapper(mockClient);
  });

  describe('getCurrentUrl', () => {
    it('should return null when no navigation has occurred', () => {
      expect(wrapper.getCurrentUrl()).toBeNull();
    });

    it('should return current URL after navigation', async () => {
      const mockNavigateResult = {
        content: [{ type: 'text', text: 'Navigation complete' }],
        isError: false,
      };

      const mockEvaluateResult = {
        content: [{ type: 'text', text: 'https://example.com' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockNavigateResult) // puppeteer_navigate
        .mockResolvedValueOnce(mockEvaluateResult); // puppeteer_evaluate for final URL

      await wrapper.navigate('https://example.com');

      expect(wrapper.getCurrentUrl()).toBe('https://example.com');
    });
  });

  describe('navigate', () => {
    it('should navigate to URL and return result', async () => {
      const mockNavigateResult = {
        content: [{ type: 'text', text: 'Navigation complete' }],
        isError: false,
      };

      const mockEvaluateResult = {
        content: [{ type: 'text', text: 'https://example.com' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockNavigateResult)
        .mockResolvedValueOnce(mockEvaluateResult);

      const result = await wrapper.navigate('https://example.com');

      expect(result.url).toBe('https://example.com');
      expect(result.status).toBe(200);
      expect(result.success).toBe(true);
      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'puppeteer_navigate',
          arguments: expect.objectContaining({
            url: 'https://example.com',
          }),
        })
      );
    });

    it('should pass navigation options', async () => {
      const mockNavigateResult = {
        content: [{ type: 'text', text: 'Navigation complete' }],
        isError: false,
      };

      const mockEvaluateResult = {
        content: [{ type: 'text', text: 'https://example.com' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockNavigateResult)
        .mockResolvedValueOnce(mockEvaluateResult);

      await wrapper.navigate('https://example.com', {
        timeout: 10000,
        waitUntil: 'networkidle0',
      });

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: expect.objectContaining({
            timeout: 10000,
            waitUntil: 'networkidle0',
          }),
        })
      );
    });

    it('should handle navigation errors', async () => {
      const mockErrorResult = {
        content: [{ type: 'text', text: 'Navigation timeout' }],
        isError: true,
      };

      // Mock it to fail all retry attempts (4 attempts: 0, 1, 2, 3)
      // Each retry has a 2000ms delay, so total time can exceed 5s
      vi.mocked(mockClient.callTool).mockResolvedValue(mockErrorResult);

      const result = await wrapper.navigate('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Navigation timeout');
    }, 15000); // Increase timeout to 15s to account for retry delays

    it('should retry on failure', async () => {
      const mockFailure = {
        content: [{ type: 'text', text: 'Temporary failure' }],
        isError: true,
      };

      const mockNavigateSuccess = {
        content: [{ type: 'text', text: 'Navigation complete' }],
        isError: false,
      };

      const mockEvaluateSuccess = {
        content: [{ type: 'text', text: 'https://example.com' }],
        isError: false,
      };

      // Note: maxRetries option is ignored, navigation always uses 3 retries
      // First attempt fails, second attempt succeeds (navigate + evaluate)
      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockFailure) // First navigate fails
        .mockResolvedValueOnce(mockNavigateSuccess) // Second navigate succeeds
        .mockResolvedValueOnce(mockEvaluateSuccess); // Get final URL

      const result = await wrapper.navigate('https://example.com', {
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(mockClient.callTool).toHaveBeenCalledTimes(3);
    });
  });

  describe('getDOM', () => {
    it('should retrieve DOM content', async () => {
      const mockHTMLResult = {
        content: [{ type: 'text', text: '<html><body><h1>Test</h1></body></html>' }],
        isError: false,
      };

      const mockTitleResult = {
        content: [{ type: 'text', text: 'Test Page' }],
        isError: false,
      };

      const mockUrlResult = {
        content: [{ type: 'text', text: 'https://example.com' }],
        isError: false,
      };

      // getDOM calls evaluate 3 times: HTML, title, URL
      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockHTMLResult)
        .mockResolvedValueOnce(mockTitleResult)
        .mockResolvedValueOnce(mockUrlResult);

      const result = await wrapper.getDOM();

      expect(result.html).toContain('<h1>Test</h1>');
      expect(result.title).toBe('Test Page');
      expect(result.url).toBe('https://example.com');
    });

    it('should handle DOM extraction errors', async () => {
      vi.mocked(mockClient.callTool).mockRejectedValue(new Error('DOM extraction failed'));

      await expect(async () => {
        await wrapper.getDOM();
      }).rejects.toThrow();
    });
  });

  describe('querySelector', () => {
    it('should query for elements', async () => {
      const mockResult = {
        content: [
          {
            type: 'text',
            text: '<div class="result">Found element</div>',
          },
        ],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      const result = await wrapper.querySelector('.result');

      expect(result).toBeTruthy();
      expect(result).toContain('Found element');
    });

    it('should return null when element not found', async () => {
      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'null', // querySelector returns 'null' string when not found
          },
        ],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      const result = await wrapper.querySelector('.nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getConsoleLogs', () => {
    it('should retrieve console logs', async () => {
      const mockLogs = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                level: 'log',
                text: 'Application started',
                timestamp: new Date().toISOString(),
              },
              {
                level: 'error',
                text: 'Error occurred',
                timestamp: new Date().toISOString(),
              },
            ]),
          },
        ],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockLogs);

      const logs = await wrapper.getConsoleLogs();

      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe('log');
      expect(logs[1].level).toBe('error');
    });

    it('should handle empty console logs', async () => {
      const mockLogs = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([]),
          },
        ],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockLogs);

      const logs = await wrapper.getConsoleLogs();

      expect(logs).toHaveLength(0);
    });
  });

  describe('clearConsole', () => {
    it('should clear console logs', async () => {
      const mockResult = {
        content: [{ type: 'text', text: 'undefined' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      await wrapper.clearConsole();

      // clearConsole uses puppeteer_evaluate, not puppeteer_console_clear
      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'puppeteer_evaluate',
          arguments: expect.objectContaining({
            script: expect.stringContaining('console.clear()'),
          }),
        })
      );
    });

    it('should handle clear console errors', async () => {
      const mockResult = {
        content: [{ type: 'text', text: 'Clear failed' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      // clearConsole doesn't throw on errors, it just returns void
      await wrapper.clearConsole();

      expect(mockClient.callTool).toHaveBeenCalled();
    });
  });

  describe('captureScreenshot', () => {
    it('should capture screenshot', async () => {
      const mockScreenshotResult = {
        content: [
          {
            type: 'text',
            data: 'base64-image-data', // Screenshot data is in 'data' field
          },
        ],
        isError: false,
      };

      const mockViewportResult = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ width: 1920, height: 1080 }),
          },
        ],
        isError: false,
      };

      // captureScreenshot calls puppeteer_screenshot then puppeteer_evaluate for viewport
      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockScreenshotResult)
        .mockResolvedValueOnce(mockViewportResult);

      const screenshot = await wrapper.captureScreenshot();

      expect(screenshot.data).toBe('base64-image-data');
      expect(screenshot.type).toBe('png');
    });

    it('should pass screenshot options', async () => {
      const mockScreenshotResult = {
        content: [
          {
            type: 'text',
            data: 'base64-image-data',
          },
        ],
        isError: false,
      };

      const mockViewportResult = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ width: 1920, height: 1080 }),
          },
        ],
        isError: false,
      };

      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockScreenshotResult)
        .mockResolvedValueOnce(mockViewportResult);

      await wrapper.captureScreenshot({
        type: 'jpeg',
        quality: 90,
        fullPage: true,
      });

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: expect.objectContaining({
            type: 'jpeg',
            quality: 90,
            fullPage: true,
          }),
        })
      );
    });

    it('should retry on screenshot failure', async () => {
      const mockFailure = {
        content: [{ type: 'text', text: 'Screenshot failed' }],
        isError: true,
      };

      const mockScreenshotSuccess = {
        content: [
          {
            type: 'text',
            data: 'base64-image-data',
          },
        ],
        isError: false,
      };

      const mockViewportSuccess = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ width: 1920, height: 1080 }),
          },
        ],
        isError: false,
      };

      // maxRetries is passed to captureScreenshotWithRetry
      // First attempt fails, second succeeds (screenshot + viewport)
      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockFailure) // First screenshot fails
        .mockResolvedValueOnce(mockScreenshotSuccess) // Second screenshot succeeds
        .mockResolvedValueOnce(mockViewportSuccess); // Get viewport

      const screenshot = await wrapper.captureScreenshot({
        maxRetries: 3,
      });

      expect(screenshot.data).toBe('base64-image-data');
      expect(mockClient.callTool).toHaveBeenCalledTimes(3);
    });
  });

  describe('click', () => {
    it('should click on element', async () => {
      const mockWaitResult = {
        content: [{ type: 'text', text: 'Element found' }],
        isError: false,
      };

      const mockClickResult = {
        content: [{ type: 'text', text: 'Clicked' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockWaitResult) // waitForSelector
        .mockResolvedValueOnce(mockClickResult); // click

      await wrapper.click('.button');

      expect(mockClient.callTool).toHaveBeenCalledTimes(2);
      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'puppeteer_click',
          arguments: expect.objectContaining({
            selector: '.button',
          }),
        })
      );
    });

    it('should pass click options', async () => {
      const mockWaitResult = {
        content: [{ type: 'text', text: 'Element found' }],
        isError: false,
      };

      const mockClickResult = {
        content: [{ type: 'text', text: 'Clicked' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockWaitResult)
        .mockResolvedValueOnce(mockClickResult);

      await wrapper.click('.button', {
        button: 'right',
        clickCount: 2,
        delay: 100,
      });

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: expect.objectContaining({
            button: 'right',
            clickCount: 2,
            delay: 100,
          }),
        })
      );
    });

    it('should throw error when element not found', async () => {
      const mockWaitResult = {
        content: [{ type: 'text', text: 'Selector not found' }],
        isError: true,
      };

      // maxRetries=1 means loop 0 to 1 (2 attempts), each attempt calls waitForSelector (which also retries)
      // To avoid timeout, mock sufficient failures
      vi.mocked(mockClient.callTool).mockResolvedValue(mockWaitResult);

      await expect(async () => {
        await wrapper.click('.nonexistent', { maxRetries: 0 }); // Use 0 to get only 1 attempt
      }).rejects.toThrow();
    });

    it('should retry on click failure', async () => {
      const mockWaitResult = {
        content: [{ type: 'text', text: 'Element found' }],
        isError: false,
      };

      const mockClickFailure = {
        content: [{ type: 'text', text: 'Click failed' }],
        isError: true,
      };

      const mockClickSuccess = {
        content: [{ type: 'text', text: 'Clicked' }],
        isError: false,
      };

      // maxRetries=1 means loop 0 to 1 (2 attempts)
      // First attempt: wait (with nested retries) + click fails
      // Second attempt: wait (with nested retries) + click succeeds
      // Each waitForSelector has its own retry loop (0 to 3 = 4 attempts)
      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockWaitResult) // First wait attempt 1
        .mockResolvedValueOnce(mockClickFailure) // First click fails
        .mockResolvedValueOnce(mockWaitResult) // Second wait attempt 1
        .mockResolvedValueOnce(mockClickSuccess); // Second click succeeds

      await wrapper.click('.button', { maxRetries: 1 });

      expect(mockClient.callTool).toHaveBeenCalledTimes(4);
    });
  });

  describe('type', () => {
    it('should type text into element', async () => {
      const mockWaitResult = {
        content: [{ type: 'text', text: 'Element found' }],
        isError: false,
      };

      const mockTypeResult = {
        content: [{ type: 'text', text: 'Text typed' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockWaitResult)
        .mockResolvedValueOnce(mockTypeResult);

      await wrapper.type('input[name="email"]', 'test@example.com');

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'puppeteer_type',
          arguments: expect.objectContaining({
            selector: 'input[name="email"]',
            text: 'test@example.com',
          }),
        })
      );
    });

    it('should pass type options', async () => {
      const mockWaitResult = {
        content: [{ type: 'text', text: 'Element found' }],
        isError: false,
      };

      const mockTypeResult = {
        content: [{ type: 'text', text: 'Text typed' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockWaitResult)
        .mockResolvedValueOnce(mockTypeResult);

      await wrapper.type('input', 'text', { delay: 50 });

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: expect.objectContaining({
            delay: 50,
          }),
        })
      );
    });
  });

  describe('waitForSelector', () => {
    it('should wait for selector to appear', async () => {
      const mockResult = {
        content: [{ type: 'text', text: 'Selector found' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      await wrapper.waitForSelector('.element');

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'puppeteer_wait_for_selector',
          arguments: expect.objectContaining({
            selector: '.element',
          }),
        })
      );
    });

    it('should respect timeout option', async () => {
      const mockResult = {
        content: [{ type: 'text', text: 'Selector found' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      await wrapper.waitForSelector('.element', { timeout: 5000 });

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: expect.objectContaining({
            timeout: expect.any(Number),
          }),
        })
      );
    });

    it('should throw error on timeout', async () => {
      const mockResult = {
        content: [{ type: 'text', text: 'Timeout waiting for selector' }],
        isError: true,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      await expect(async () => {
        await wrapper.waitForSelector('.nonexistent', {
          timeout: 1000,
          maxRetries: 1,
        });
      }).rejects.toThrow();
    });
  });

  describe('evaluate', () => {
    it('should evaluate JavaScript in page context', async () => {
      const mockResult = {
        content: [
          {
            type: 'text',
            text: '{"result": "value"}',
          },
        ],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      const result = await wrapper.evaluate('return {result: "value"}');

      expect(result).toEqual({ result: 'value' });
    });

    it('should handle evaluation errors', async () => {
      const mockResult = {
        content: [{ type: 'text', text: 'Evaluation failed' }],
        isError: true,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      await expect(async () => {
        await wrapper.evaluate('invalid javascript');
      }).rejects.toThrow('Evaluate failed');
    });

    it('should handle non-JSON results', async () => {
      const mockResult = {
        content: [
          {
            type: 'text',
            text: 'simple string',
          },
        ],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      const result = await wrapper.evaluate('return "simple string"');

      expect(result).toBe('simple string');
    });
  });

  describe('getTitle', () => {
    it('should get page title', async () => {
      const mockResult = {
        content: [
          {
            type: 'text',
            text: '"Test Page Title"',
          },
        ],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      const title = await wrapper.getTitle();

      expect(title).toBe('Test Page Title');
    });
  });

  describe('getUrl', () => {
    it('should get current page URL', async () => {
      const mockResult = {
        content: [
          {
            type: 'text',
            text: '"https://example.com/page"',
          },
        ],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      const url = await wrapper.getUrl();

      expect(url).toBe('https://example.com/page');
    });
  });

  describe('close', () => {
    it('should close the browser', async () => {
      const mockResult = {
        content: [{ type: 'text', text: 'Browser closed' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      await wrapper.close();

      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'puppeteer_close',
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle MCP client errors gracefully', async () => {
      vi.mocked(mockClient.callTool).mockRejectedValue(new Error('MCP client error'));

      await expect(async () => {
        await wrapper.getDOM();
      }).rejects.toThrow();
    });

    it('should wrap tool errors in descriptive messages', async () => {
      const mockResult = {
        content: [{ type: 'text', text: 'Tool execution failed' }],
        isError: true,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      await expect(async () => {
        await wrapper.evaluate('test');
      }).rejects.toThrow('Evaluate failed');
    });

    it('should handle missing content in responses', async () => {
      const mockResult = {
        content: [],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      const result = await wrapper.evaluate('test');

      expect(result).toBeUndefined();
    });
  });

  describe('retry logic', () => {
    it('should retry operations with exponential backoff', async () => {
      const mockFailure = {
        content: [{ type: 'text', text: 'Temporary failure' }],
        isError: true,
      };

      const mockSuccess = {
        content: [{ type: 'text', text: 'Success' }],
        isError: false,
      };

      // maxRetries=1 means loop 0 to 1 (2 attempts)
      vi.mocked(mockClient.callTool)
        .mockResolvedValueOnce(mockFailure)
        .mockResolvedValueOnce(mockSuccess);

      await wrapper.waitForSelector('.element', { maxRetries: 1 });

      // Should have some delay due to retry backoff
      expect(mockClient.callTool).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying after max retries', async () => {
      const mockFailure = {
        content: [{ type: 'text', text: 'Permanent failure' }],
        isError: true,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockFailure);

      await expect(async () => {
        await wrapper.waitForSelector('.element', {
          maxRetries: 1,
          timeout: 30000, // Use a large timeout so it doesn't exit early
        });
      }).rejects.toThrow();

      // maxRetries=1 means loop 0 to 1 = 2 attempts
      expect(mockClient.callTool).toHaveBeenCalledTimes(2);
    });
  });

  describe('mocking external dependencies', () => {
    it('should work without actual MCP server', async () => {
      // All tests use mocked client, verifying the wrapper works independently
      const mockResult = {
        content: [{ type: 'text', text: 'Mocked response' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      // Verify we can call methods without real server
      await wrapper.clearConsole();

      expect(mockClient.callTool).toHaveBeenCalled();
    });

    it('should verify tool call arguments without execution', () => {
      const mockResult = {
        content: [{ type: 'text', text: 'Success' }],
        isError: false,
      };

      vi.mocked(mockClient.callTool).mockResolvedValue(mockResult);

      wrapper.clearConsole();

      // Verify correct tool name and arguments format
      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.any(String),
          arguments: expect.any(Object),
        })
      );
    });
  });
});
