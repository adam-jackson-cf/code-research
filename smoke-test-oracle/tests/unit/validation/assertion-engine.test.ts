import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssertionEngine } from '../../../src/validation/assertion-engine.js';
import { StorageManager, ConsoleLogEntry } from '../../../src/storage/index.js';
import { DOMValidations, ConsoleValidations, StorageRef } from '../../../src/core/types.js';

describe('AssertionEngine', () => {
  let engine: AssertionEngine;
  let mockStorage: StorageManager;

  beforeEach(() => {
    // Create a mock storage manager
    mockStorage = {
      retrieveDOM: vi.fn(),
      retrieveConsoleLogs: vi.fn(),
    } as any;

    engine = new AssertionEngine(mockStorage);
  });

  describe('evaluateDOMValidations', () => {
    const createDOMRef = (): StorageRef => ({
      category: 'HTML' as any,
      testId: 'test-1',
      path: '/test/dom.html',
      size: 1024,
      hash: 'abc123',
      timestamp: new Date().toISOString(),
      compressed: false,
    });

    it('should validate element existence', async () => {
      const html = '<html><body><div class="container"><h1>Title</h1></div></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        exists: ['.container', 'h1'],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(true);
      expect(results[0].description).toContain('.container');
      expect(results[1].passed).toBe(true);
      expect(results[1].description).toContain('h1');
    });

    it('should fail when element does not exist', async () => {
      const html = '<html><body><div>Content</div></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        exists: ['.nonexistent'],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('not found');
    });

    it('should validate element non-existence', async () => {
      const html = '<html><body><div class="container"></div></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        notExists: ['.error-message', '.warning'],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(true);
    });

    it('should fail when element exists but should not', async () => {
      const html = '<html><body><div class="error">Error!</div></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        notExists: ['.error'],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('should not exist');
    });

    it('should validate element visibility', async () => {
      const html = '<html><body><div class="visible">Visible</div></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        visible: ['.visible'],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results[0].passed).toBe(true);
    });

    it('should detect hidden elements', async () => {
      const html = '<html><body><div style="display:none" class="hidden">Hidden</div></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        hidden: ['.hidden'],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results[0].passed).toBe(true);
    });

    it('should validate text content with exact match', async () => {
      const html = '<html><body><h1>Welcome to our site</h1></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        textContent: [
          {
            selector: 'h1',
            text: 'Welcome to our site',
            match: 'exact',
          },
        ],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results[0].passed).toBe(true);
    });

    it('should validate text content with contains match', async () => {
      const html = '<html><body><p>This is a long paragraph with some text</p></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        textContent: [
          {
            selector: 'p',
            text: 'long paragraph',
            match: 'contains',
          },
        ],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results[0].passed).toBe(true);
    });

    it('should validate text content with regex match', async () => {
      const html = '<html><body><span>Email: user@example.com</span></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        textContent: [
          {
            selector: 'span',
            text: '\\w+@\\w+\\.\\w+',
            match: 'regex',
          },
        ],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results[0].passed).toBe(true);
    });

    it('should validate attribute values', async () => {
      const html = '<html><body><a href="https://example.com" class="link">Link</a></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        attributes: [
          {
            selector: 'a',
            attribute: 'href',
            value: 'https://example.com',
            match: 'exact',
          },
          {
            selector: 'a',
            attribute: 'class',
            value: 'link',
            match: 'contains',
          },
        ],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(true);
    });

    it('should validate element count', async () => {
      const html = '<html><body><li>1</li><li>2</li><li>3</li></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        count: [
          {
            selector: 'li',
            count: 3,
            operator: 'equal',
          },
        ],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results[0].passed).toBe(true);
    });

    it('should validate element count with comparison operators', async () => {
      const html = '<html><body><div class="item">1</div><div class="item">2</div><div class="item">3</div></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        count: [
          {
            selector: '.item',
            count: 2,
            operator: 'greaterThan',
          },
          {
            selector: '.item',
            count: 5,
            operator: 'lessThan',
          },
        ],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(true);
    });

    it('should return error when HTML ref is not provided', async () => {
      const validations: DOMValidations = {
        exists: ['.test'],
      };

      const results = await engine.evaluateDOMValidations(validations, undefined);

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('No HTML snapshot');
    });

    it('should handle DOM loading errors gracefully', async () => {
      vi.mocked(mockStorage.retrieveDOM).mockRejectedValue(new Error('Failed to load DOM'));

      const validations: DOMValidations = {
        exists: ['.test'],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('Failed to load or parse HTML');
    });

    it('should handle invalid regex gracefully', async () => {
      const html = '<html><body><p>Test</p></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        textContent: [
          {
            selector: 'p',
            text: '[invalid(regex',
            match: 'regex',
          },
        ],
      };

      const results = await engine.evaluateDOMValidations(validations, createDOMRef());

      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('Invalid regex');
    });
  });

  describe('evaluateConsoleValidations', () => {
    const createConsoleRef = (): StorageRef => ({
      category: 'CONSOLE_LOG' as any,
      testId: 'test-1',
      path: '/test/console.json',
      size: 512,
      hash: 'def456',
      timestamp: new Date().toISOString(),
      compressed: false,
    });

    const createLogEntry = (level: ConsoleLogEntry['level'], message: string): ConsoleLogEntry => ({
      timestamp: Date.now(),
      level,
      message,
    });

    it('should validate max errors', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error 1'),
        createLogEntry('error', 'Error 2'),
        createLogEntry('log', 'Normal log'),
      ];

      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        maxErrors: 2,
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
    });

    it('should fail when errors exceed maximum', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error 1'),
        createLogEntry('error', 'Error 2'),
        createLogEntry('error', 'Error 3'),
      ];

      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        maxErrors: 1,
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('maximum allowed is 1');
    });

    it('should validate max warnings', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('warn', 'Warning 1'),
        createLogEntry('log', 'Normal log'),
      ];

      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        maxWarnings: 1,
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results[0].passed).toBe(true);
    });

    it('should validate expected messages', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Application initialized'),
        createLogEntry('info', 'User logged in'),
      ];

      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        expectedMessages: [
          {
            level: 'log',
            text: 'Application initialized',
            match: 'exact',
          },
          {
            level: 'info',
            text: 'logged in',
            match: 'contains',
          },
        ],
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(true);
    });

    it('should fail when expected message is not found', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Some other message'),
      ];

      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        expectedMessages: [
          {
            level: 'log',
            text: 'Expected message',
            match: 'contains',
          },
        ],
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('not found');
    });

    it('should validate forbidden messages', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Normal log message'),
        createLogEntry('info', 'Info message'),
      ];

      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        forbiddenMessages: [
          {
            level: 'error',
            text: 'Fatal error',
            match: 'contains',
          },
        ],
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results[0].passed).toBe(true);
    });

    it('should fail when forbidden message is found', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Normal log'),
        createLogEntry('error', 'Uncaught exception occurred'),
      ];

      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        forbiddenMessages: [
          {
            level: 'error',
            text: 'Uncaught exception',
            match: 'contains',
          },
        ],
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('Forbidden');
    });

    it('should validate forbidden messages without level filter', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Deprecated API used'),
        createLogEntry('warn', 'Deprecated feature'),
      ];

      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        forbiddenMessages: [
          {
            text: 'Deprecated',
            match: 'contains',
          },
        ],
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results[0].passed).toBe(false);
    });

    it('should support regex matching for expected messages', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'User ID: 12345'),
        createLogEntry('log', 'Session ID: abc-def-123'),
      ];

      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        expectedMessages: [
          {
            level: 'log',
            text: 'User ID: \\d+',
            match: 'regex',
          },
        ],
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results[0].passed).toBe(true);
    });

    it('should return error when console ref is not provided', async () => {
      const validations: ConsoleValidations = {
        maxErrors: 0,
      };

      const results = await engine.evaluateConsoleValidations(validations, undefined);

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('No console logs');
    });

    it('should handle console loading errors gracefully', async () => {
      vi.mocked(mockStorage.retrieveConsoleLogs).mockRejectedValue(new Error('Failed to load logs'));

      const validations: ConsoleValidations = {
        maxErrors: 0,
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('Failed to load console logs');
    });

    it('should handle multiple validation types together', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('error', 'Error 1'),
        createLogEntry('warn', 'Warning 1'),
        createLogEntry('log', 'Application started'),
      ];

      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        maxErrors: 1,
        maxWarnings: 1,
        expectedMessages: [
          {
            level: 'log',
            text: 'Application started',
            match: 'exact',
          },
        ],
        forbiddenMessages: [
          {
            text: 'Critical error',
            match: 'contains',
          },
        ],
      };

      const results = await engine.evaluateConsoleValidations(validations, createConsoleRef());

      expect(results).toHaveLength(4);
      expect(results.every(r => r.passed)).toBe(true);
    });
  });

  describe('progressive disclosure', () => {
    it('should only load DOM when validations require it', async () => {
      const html = '<html><body><div>Test</div></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        exists: ['.test'],
      };

      const ref: StorageRef = {
        category: 'HTML' as any,
        testId: 'test-1',
        path: '/test/dom.html',
        size: 1024,
        hash: 'abc123',
        timestamp: new Date().toISOString(),
        compressed: false,
      };

      await engine.evaluateDOMValidations(validations, ref);

      // Verify DOM was loaded exactly once
      expect(mockStorage.retrieveDOM).toHaveBeenCalledTimes(1);
      expect(mockStorage.retrieveDOM).toHaveBeenCalledWith(ref);
    });

    it('should only load console logs when validations require it', async () => {
      const entries: ConsoleLogEntry[] = [
        { timestamp: Date.now(), level: 'log', message: 'Test' },
      ];
      vi.mocked(mockStorage.retrieveConsoleLogs).mockResolvedValue(entries);

      const validations: ConsoleValidations = {
        maxErrors: 0,
      };

      const ref: StorageRef = {
        category: 'CONSOLE_LOG' as any,
        testId: 'test-1',
        path: '/test/console.json',
        size: 512,
        hash: 'def456',
        timestamp: new Date().toISOString(),
        compressed: false,
      };

      await engine.evaluateConsoleValidations(validations, ref);

      // Verify console logs were loaded exactly once
      expect(mockStorage.retrieveConsoleLogs).toHaveBeenCalledTimes(1);
      expect(mockStorage.retrieveConsoleLogs).toHaveBeenCalledWith(ref);
    });
  });

  describe('error handling', () => {
    it('should continue processing validations even when one fails', async () => {
      const html = '<html><body><div class="exists">Test</div></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        exists: ['.exists', '.does-not-exist', '.also-exists'],
      };

      const ref: StorageRef = {
        category: 'HTML' as any,
        testId: 'test-1',
        path: '/test/dom.html',
        size: 1024,
        hash: 'abc123',
        timestamp: new Date().toISOString(),
        compressed: false,
      };

      const results = await engine.evaluateDOMValidations(validations, ref);

      // Should return results for all validations
      expect(results).toHaveLength(3);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
    });

    it('should handle missing attributes gracefully', async () => {
      const html = '<html><body><div class="test">No href</div></body></html>';
      vi.mocked(mockStorage.retrieveDOM).mockResolvedValue(html);

      const validations: DOMValidations = {
        attributes: [
          {
            selector: 'div',
            attribute: 'href',
            value: 'test',
          },
        ],
      };

      const ref: StorageRef = {
        category: 'HTML' as any,
        testId: 'test-1',
        path: '/test/dom.html',
        size: 1024,
        hash: 'abc123',
        timestamp: new Date().toISOString(),
        compressed: false,
      };

      const results = await engine.evaluateDOMValidations(validations, ref);

      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('Attribute');
      expect(results[0].error).toContain('not found');
    });
  });
});
