import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConsoleStore, ConsoleLogEntry } from '../../../src/storage/console-store.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('ConsoleStore', () => {
  let store: ConsoleStore;
  let tempDir: string;

  const createLogEntry = (
    level: ConsoleLogEntry['level'],
    message: string,
    timestamp?: number
  ): ConsoleLogEntry => ({
    timestamp: timestamp || Date.now(),
    level,
    message,
  });

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `console-store-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    store = new ConsoleStore({
      baseDir: tempDir,
      namespace: 'console-test',
    });

    await store.initialize();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('store', () => {
    it('should store console logs and return lightweight StorageRef', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Application started'),
        createLogEntry('info', 'User logged in'),
        createLogEntry('error', 'Failed to fetch data'),
      ];

      const ref = await store.store(entries, { url: 'https://example.com' });

      // Verify StorageRef is lightweight
      expect(ref).toHaveProperty('id');
      expect(ref).toHaveProperty('timestamp');
      expect(ref).toHaveProperty('type', 'console');
      expect(ref.metadata).toHaveProperty('url', 'https://example.com');
      expect(ref.metadata).toHaveProperty('entryCount', 3);
      expect(ref.metadata).toHaveProperty('errorCount', 1);
      expect(ref.metadata).toHaveProperty('warningCount', 0);
      expect(ref.metadata).toHaveProperty('startTime');
      expect(ref.metadata).toHaveProperty('endTime');

      // Verify no log content in ref
      const serialized = JSON.stringify(ref);
      expect(serialized).not.toContain('Application started');
      expect(serialized).not.toContain('Failed to fetch data');
    });

    it('should generate summary statistics', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log 1'),
        createLogEntry('log', 'Log 2'),
        createLogEntry('info', 'Info 1'),
        createLogEntry('warn', 'Warning 1'),
        createLogEntry('warn', 'Warning 2'),
        createLogEntry('error', 'Error 1'),
        createLogEntry('debug', 'Debug 1'),
      ];

      const ref = await store.store(entries);

      expect(ref.metadata?.entryCount).toBe(7);
      expect(ref.metadata?.errorCount).toBe(1);
      expect(ref.metadata?.warningCount).toBe(2);
    });

    it('should handle empty entries array', async () => {
      const entries: ConsoleLogEntry[] = [];
      const ref = await store.store(entries);

      expect(ref.metadata?.entryCount).toBe(0);
      expect(ref.metadata?.errorCount).toBe(0);
      expect(ref.metadata?.warningCount).toBe(0);
    });

    it('should store entries with stack traces', async () => {
      const entries: ConsoleLogEntry[] = [
        {
          timestamp: Date.now(),
          level: 'error',
          message: 'TypeError: Cannot read property',
          stackTrace: 'at Object.<anonymous> (index.js:10:5)',
          source: {
            url: 'https://example.com/index.js',
            line: 10,
            column: 5,
          },
        },
      ];

      const ref = await store.store(entries);
      expect(ref.id).toBeDefined();
    });
  });

  describe('retrieve', () => {
    it('should retrieve all console logs', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Message 1'),
        createLogEntry('error', 'Error message'),
        createLogEntry('warn', 'Warning message'),
      ];

      const ref = await store.store(entries);
      const retrieved = await store.retrieve(ref);

      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].message).toBe('Message 1');
      expect(retrieved[1].message).toBe('Error message');
      expect(retrieved[2].message).toBe('Warning message');
    });

    it('should throw error for non-existent reference', async () => {
      const fakeRef = {
        id: 'non-existent',
        timestamp: Date.now(),
        type: 'console',
      };

      await expect(async () => {
        await store.retrieve(fakeRef);
      }).rejects.toThrow();
    });
  });

  describe('retrieveFiltered', () => {
    it('should filter entries by level', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log 1'),
        createLogEntry('error', 'Error 1'),
        createLogEntry('error', 'Error 2'),
        createLogEntry('warn', 'Warning 1'),
      ];

      const ref = await store.store(entries);
      const errors = await store.retrieveFiltered(ref, { level: 'error' });

      expect(errors).toHaveLength(2);
      expect(errors[0].level).toBe('error');
      expect(errors[1].level).toBe('error');
    });

    it('should filter by multiple levels', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log 1'),
        createLogEntry('error', 'Error 1'),
        createLogEntry('warn', 'Warning 1'),
        createLogEntry('info', 'Info 1'),
      ];

      const ref = await store.store(entries);
      const filtered = await store.retrieveFiltered(ref, {
        level: ['error', 'warn'],
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.some(e => e.level === 'error')).toBe(true);
      expect(filtered.some(e => e.level === 'warn')).toBe(true);
    });

    it('should filter by text search', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'User clicked button'),
        createLogEntry('log', 'Data fetched successfully'),
        createLogEntry('error', 'Failed to fetch user data'),
      ];

      const ref = await store.store(entries);
      const filtered = await store.retrieveFiltered(ref, {
        searchText: 'user',
      });

      expect(filtered).toHaveLength(2);
    });

    it('should filter by time range', async () => {
      const now = Date.now();
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Old log', now - 5000),
        createLogEntry('log', 'Recent log', now - 1000),
        createLogEntry('log', 'Very recent log', now),
      ];

      const ref = await store.store(entries);
      const filtered = await store.retrieveFiltered(ref, {
        startTime: now - 2000,
      });

      expect(filtered.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect limit parameter', async () => {
      const entries: ConsoleLogEntry[] = Array.from({ length: 10 }, (_, i) =>
        createLogEntry('log', `Message ${i}`)
      );

      const ref = await store.store(entries);
      const filtered = await store.retrieveFiltered(ref, { limit: 5 });

      expect(filtered).toHaveLength(5);
    });
  });

  describe('getErrors', () => {
    it('should retrieve only error entries', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log message'),
        createLogEntry('error', 'Error 1'),
        createLogEntry('warn', 'Warning'),
        createLogEntry('error', 'Error 2'),
      ];

      const ref = await store.store(entries);
      const errors = await store.getErrors(ref);

      expect(errors).toHaveLength(2);
      expect(errors.every(e => e.level === 'error')).toBe(true);
    });

    it('should return empty array when no errors exist', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log message'),
        createLogEntry('info', 'Info message'),
      ];

      const ref = await store.store(entries);
      const errors = await store.getErrors(ref);

      expect(errors).toHaveLength(0);
    });
  });

  describe('getWarnings', () => {
    it('should retrieve only warning entries', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log message'),
        createLogEntry('warn', 'Warning 1'),
        createLogEntry('error', 'Error'),
        createLogEntry('warn', 'Warning 2'),
      ];

      const ref = await store.store(entries);
      const warnings = await store.getWarnings(ref);

      expect(warnings).toHaveLength(2);
      expect(warnings.every(e => e.level === 'warn')).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should retrieve summary without loading all entries', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log 1'),
        createLogEntry('log', 'Log 2'),
        createLogEntry('info', 'Info'),
        createLogEntry('warn', 'Warning'),
        createLogEntry('error', 'Error 1'),
        createLogEntry('error', 'Error 2'),
      ];

      const ref = await store.store(entries);
      const summary = await store.getSummary(ref);

      expect(summary.total).toBe(6);
      expect(summary.errorCount).toBe(2);
      expect(summary.warningCount).toBe(1);
      expect(summary.byLevel.log).toBe(2);
      expect(summary.byLevel.info).toBe(1);
      expect(summary.byLevel.warn).toBe(1);
      expect(summary.byLevel.error).toBe(2);
    });
  });

  describe('query', () => {
    it('should query console logs without loading entries', async () => {
      const entries1: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log 1'),
        createLogEntry('error', 'Error 1'),
      ];
      const entries2: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log 2'),
        createLogEntry('warn', 'Warning 1'),
      ];

      await store.store(entries1, { url: 'https://page1.com' });
      await store.store(entries2, { url: 'https://page2.com' });

      const results = await store.query();
      expect(results).toHaveLength(2);

      // Verify refs are lightweight
      const serialized = JSON.stringify(results);
      expect(serialized).not.toContain('Log 1');
      expect(serialized).not.toContain('Error 1');
    });

    it('should filter by URL', async () => {
      const entries: ConsoleLogEntry[] = [createLogEntry('log', 'Test')];

      await store.store(entries, { url: 'https://example.com' });
      await store.store(entries, { url: 'https://test.com' });
      await store.store(entries, { url: 'https://example.com' });

      const results = await store.query({ url: 'https://example.com' });
      expect(results).toHaveLength(2);
    });

    it('should filter by hasErrors', async () => {
      const withErrors: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log'),
        createLogEntry('error', 'Error'),
      ];
      const withoutErrors: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log'),
        createLogEntry('info', 'Info'),
      ];

      await store.store(withErrors);
      await store.store(withoutErrors);

      const results = await store.query({ hasErrors: true });
      expect(results).toHaveLength(1);
      expect(results[0].metadata?.errorCount).toBeGreaterThan(0);
    });

    it('should filter by hasWarnings', async () => {
      const withWarnings: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log'),
        createLogEntry('warn', 'Warning'),
      ];
      const withoutWarnings: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log'),
        createLogEntry('info', 'Info'),
      ];

      await store.store(withWarnings);
      await store.store(withoutWarnings);

      const results = await store.query({ hasWarnings: true });
      expect(results).toHaveLength(1);
      expect(results[0].metadata?.warningCount).toBeGreaterThan(0);
    });

    it('should filter by time range', async () => {
      const now = Date.now();
      const entries: ConsoleLogEntry[] = [createLogEntry('log', 'Test', now)];

      await store.store(entries, { url: 'page1' });
      await new Promise(resolve => setTimeout(resolve, 10));
      const midTime = Date.now();
      await store.store(entries, { url: 'page2' });

      const results = await store.query({ startTime: midTime });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit parameter', async () => {
      const entries: ConsoleLogEntry[] = [createLogEntry('log', 'Test')];

      await store.store(entries);
      await store.store(entries);
      await store.store(entries);

      const results = await store.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should return empty array when no logs are stored', async () => {
      const results = await store.query();
      expect(results).toHaveLength(0);
    });
  });

  describe('queryByLevel', () => {
    it('should query by error level using index', async () => {
      const entries1: ConsoleLogEntry[] = [createLogEntry('error', 'Error 1')];
      const entries2: ConsoleLogEntry[] = [createLogEntry('log', 'Log 1')];
      const entries3: ConsoleLogEntry[] = [createLogEntry('error', 'Error 2')];

      await store.store(entries1);
      await store.store(entries2);
      await store.store(entries3);

      const results = await store.queryByLevel('error');
      expect(results).toHaveLength(2);
    });

    it('should return empty array when no entries of level exist', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log 1'),
        createLogEntry('info', 'Info 1'),
      ];

      await store.store(entries);

      const results = await store.queryByLevel('error');
      expect(results).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('should search console logs by text', async () => {
      const entries1: ConsoleLogEntry[] = [
        createLogEntry('log', 'User clicked the submit button'),
        createLogEntry('error', 'Failed to validate user input'),
      ];
      const entries2: ConsoleLogEntry[] = [
        createLogEntry('log', 'Data fetched successfully'),
      ];

      const ref1 = await store.store(entries1);
      const ref2 = await store.store(entries2);

      const results = await store.search('user');

      expect(results).toHaveLength(1);
      expect(results[0].ref.id).toBe(ref1.id);
      expect(results[0].matches).toHaveLength(2);
    });

    it('should be case-insensitive', async () => {
      const entries: ConsoleLogEntry[] = [
        createLogEntry('log', 'USER clicked button'),
        createLogEntry('log', 'Error in USER module'),
      ];

      await store.store(entries);

      const results = await store.search('user');
      expect(results).toHaveLength(1);
      expect(results[0].matches).toHaveLength(2);
    });

    it('should combine search with filters', async () => {
      const entries1: ConsoleLogEntry[] = [
        createLogEntry('error', 'Network error occurred'),
      ];
      const entries2: ConsoleLogEntry[] = [
        createLogEntry('log', 'Network request sent'),
      ];

      await store.store(entries1);
      await store.store(entries2);

      const results = await store.search('network', { hasErrors: true });
      expect(results).toHaveLength(1);
      expect(results[0].matches[0].level).toBe('error');
    });

    it('should return empty array when no matches found', async () => {
      const entries: ConsoleLogEntry[] = [createLogEntry('log', 'Test message')];

      await store.store(entries);

      const results = await store.search('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('getGlobalStats', () => {
    it('should aggregate statistics across all collections', async () => {
      const entries1: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log 1'),
        createLogEntry('error', 'Error 1'),
      ];
      const entries2: ConsoleLogEntry[] = [
        createLogEntry('warn', 'Warning 1'),
        createLogEntry('error', 'Error 2'),
      ];
      const entries3: ConsoleLogEntry[] = [
        createLogEntry('info', 'Info 1'),
      ];

      await store.store(entries1);
      await store.store(entries2);
      await store.store(entries3);

      const stats = await store.getGlobalStats();

      expect(stats.totalCollections).toBe(3);
      expect(stats.totalEntries).toBe(5);
      expect(stats.totalErrors).toBe(2);
      expect(stats.totalWarnings).toBe(1);
      expect(stats.byLevel.log).toBe(1);
      expect(stats.byLevel.error).toBe(2);
      expect(stats.byLevel.warn).toBe(1);
      expect(stats.byLevel.info).toBe(1);
    });

    it('should return zeros when no logs exist', async () => {
      const stats = await store.getGlobalStats();

      expect(stats.totalCollections).toBe(0);
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.totalWarnings).toBe(0);
    });
  });

  describe('indexing', () => {
    it('should maintain main index', async () => {
      const entries: ConsoleLogEntry[] = [createLogEntry('log', 'Test')];

      await store.store(entries, { url: 'https://page1.com' });
      await store.store(entries, { url: 'https://page2.com' });

      const results = await store.query();
      expect(results).toHaveLength(2);
    });

    it('should maintain level-specific indexes', async () => {
      const errorEntries: ConsoleLogEntry[] = [createLogEntry('error', 'Error')];
      const warnEntries: ConsoleLogEntry[] = [createLogEntry('warn', 'Warning')];

      await store.store(errorEntries);
      await store.store(warnEntries);

      const errors = await store.queryByLevel('error');
      const warnings = await store.queryByLevel('warn');

      expect(errors).toHaveLength(1);
      expect(warnings).toHaveLength(1);
    });

    it('should maintain error index for collections with errors', async () => {
      const withErrors: ConsoleLogEntry[] = [
        createLogEntry('log', 'Log'),
        createLogEntry('error', 'Error 1'),
        createLogEntry('error', 'Error 2'),
      ];

      await store.store(withErrors, { url: 'https://example.com' });

      const results = await store.query({ hasErrors: true });
      expect(results).toHaveLength(1);
      expect(results[0].metadata?.errorCount).toBe(2);
    });
  });

  describe('progressive disclosure', () => {
    it('should not load entries when querying', async () => {
      const largeEntries: ConsoleLogEntry[] = Array.from({ length: 1000 }, (_, i) =>
        createLogEntry('log', `Message ${i}`)
      );

      await store.store(largeEntries);

      // Query should only read index, not the full collection
      const results = await store.query();
      expect(results).toHaveLength(1);

      // Verify no log messages in results
      const serialized = JSON.stringify(results);
      expect(serialized).not.toContain('Message 0');
      expect(serialized).not.toContain('Message 999');
    });

    it('should load summary without loading entries', async () => {
      const entries: ConsoleLogEntry[] = Array.from({ length: 100 }, (_, i) =>
        createLogEntry('log', `Long message ${i}`)
      );

      const ref = await store.store(entries);
      const summary = await store.getSummary(ref);

      expect(summary.total).toBe(100);
      // Summary should not include actual messages
      expect(JSON.stringify(summary)).not.toContain('Long message');
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error on storage failures', async () => {
      const invalidStore = new ConsoleStore({
        baseDir: '/invalid/path',
        namespace: 'test',
      });

      const entries: ConsoleLogEntry[] = [createLogEntry('log', 'Test')];

      await expect(async () => {
        await invalidStore.store(entries);
      }).rejects.toThrow('Failed to store console logs');
    });

    it('should handle retrieval errors gracefully', async () => {
      const fakeRef = {
        id: 'non-existent',
        timestamp: Date.now(),
        type: 'console',
      };

      await expect(async () => {
        await store.retrieve(fakeRef);
      }).rejects.toThrow('Failed to retrieve console logs');
    });
  });
});
