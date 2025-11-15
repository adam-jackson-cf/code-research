import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageManager } from '../../src/storage/index.js';
import { ConsoleLogEntry } from '../../src/storage/console-store.js';
import { CheckpointState } from '../../src/storage/checkpoint-store.js';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

describe('Storage Integration Tests', () => {
  let storageManager: StorageManager;
  let tempDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = path.join(process.cwd(), 'tmp', `test-storage-${Date.now()}`);
    await fs.ensureDir(tempDir);

    storageManager = new StorageManager({
      baseDir: tempDir,
      domChunkSize: 100,
      thumbnailWidth: 200,
      thumbnailHeight: 150,
      quality: 80,
    });

    await storageManager.initialize();
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
  });

  describe('DOM Storage Workflow', () => {
    it('should store and retrieve HTML content', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Hello World</h1>
            <p>This is a test page</p>
          </body>
        </html>
      `;

      // Store HTML
      const ref = await storageManager.storeDOM(html, {
        url: 'https://example.com',
        testId: 'test-1',
        timestamp: Date.now(),
      });

      expect(ref).toBeDefined();
      expect(ref.testId).toBe('test-1');
      expect(ref.category).toBe('html');

      // Retrieve HTML
      const retrieved = await storageManager.retrieveDOM(ref);
      expect(retrieved).toContain('Hello World');
      expect(retrieved).toContain('Test Page');
    });

    it('should query DOM by selector', async () => {
      const html = `
        <html>
          <body>
            <div class="container">
              <h1 id="title">Main Title</h1>
              <p class="description">Description text</p>
            </div>
          </body>
        </html>
      `;

      const ref = await storageManager.storeDOM(html, { url: 'https://example.com' });

      // Query by selector
      const results = await storageManager.queryDOMBySelector(ref, 'h1#title');
      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('Main Title');
    });

    it('should get DOM statistics', async () => {
      const html = '<html><body><div><p>Test</p></div></body></html>';
      const ref = await storageManager.storeDOM(html, { url: 'https://example.com' });

      const stats = await storageManager.getDOMStats(ref);
      expect(stats.totalNodes).toBeGreaterThan(0);
      expect(stats.chunkCount).toBeGreaterThan(0);
    });
  });

  describe('Screenshot Storage Workflow', () => {
    it('should store and retrieve screenshots', async () => {
      // Create a simple test image
      const testImage = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      // Store screenshot
      const ref = await storageManager.storeScreenshot(testImage, {
        url: 'https://example.com',
        testId: 'test-1',
        timestamp: Date.now(),
      });

      expect(ref).toBeDefined();
      expect(ref.testId).toBe('test-1');
      expect(ref.category).toBe('screenshot');
      expect(ref.tags?.width).toBe('800');
      expect(ref.tags?.height).toBe('600');

      // Retrieve screenshot
      const retrieved = await storageManager.retrieveScreenshot(ref);
      expect(Buffer.isBuffer(retrieved)).toBe(true);
      expect(retrieved.length).toBeGreaterThan(0);

      // Verify image dimensions
      const metadata = await sharp(retrieved).metadata();
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
    });

    it('should generate and retrieve thumbnails', async () => {
      const testImage = await sharp({
        create: {
          width: 1920,
          height: 1080,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const ref = await storageManager.storeScreenshot(testImage);

      // Retrieve thumbnail
      const thumbnail = await storageManager.retrieveScreenshotThumbnail(ref);
      expect(Buffer.isBuffer(thumbnail)).toBe(true);

      // Verify thumbnail is smaller
      const thumbMetadata = await sharp(thumbnail).metadata();
      expect(thumbMetadata.width).toBeLessThanOrEqual(200);
      expect(thumbMetadata.height).toBeLessThanOrEqual(150);
    });

    it('should compare screenshots and detect differences', async () => {
      // Create two similar images
      const image1 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const image2 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const ref1 = await storageManager.storeScreenshot(image1);
      const ref2 = await storageManager.storeScreenshot(image2);

      // Compare identical images
      const result = await storageManager.compareScreenshots(ref1, ref2);
      expect(result.diffPercentage).toBe(0);
      expect(result.differentPixels).toBe(0);
    });

    it('should detect visual differences between screenshots', async () => {
      // Create two different images
      const image1 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }, // Red
        },
      })
        .png()
        .toBuffer();

      const image2 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }, // Blue
        },
      })
        .png()
        .toBuffer();

      const ref1 = await storageManager.storeScreenshot(image1);
      const ref2 = await storageManager.storeScreenshot(image2);

      // Compare different images
      const result = await storageManager.compareScreenshots(ref1, ref2);
      expect(result.diffPercentage).toBeGreaterThan(0);
      expect(result.differentPixels).toBeGreaterThan(0);
    });
  });

  describe('Console Log Storage Workflow', () => {
    it('should store and retrieve console logs', async () => {
      const consoleLogs: ConsoleLogEntry[] = [
        {
          timestamp: Date.now(),
          level: 'log',
          message: 'Application started',
        },
        {
          timestamp: Date.now() + 1000,
          level: 'warn',
          message: 'Deprecated API used',
        },
        {
          timestamp: Date.now() + 2000,
          level: 'error',
          message: 'Failed to load resource',
          stackTrace: 'Error: Resource not found\n  at loadResource (app.js:42)',
        },
      ];

      // Store console logs
      const ref = await storageManager.storeConsoleLogs(consoleLogs, {
        url: 'https://example.com',
        testId: 'test-1',
      });

      expect(ref).toBeDefined();
      expect(ref.testId).toBe('test-1');
      expect(ref.tags?.entryCount).toBe('3');
      expect(ref.tags?.errorCount).toBe('1');
      expect(ref.tags?.warningCount).toBe('1');

      // Retrieve console logs
      const retrieved = await storageManager.retrieveConsoleLogs(ref);
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].message).toBe('Application started');
      expect(retrieved[2].level).toBe('error');
    });

    it('should filter console logs by level', async () => {
      const consoleLogs: ConsoleLogEntry[] = [
        { timestamp: Date.now(), level: 'log', message: 'Log message' },
        { timestamp: Date.now(), level: 'error', message: 'Error message 1' },
        { timestamp: Date.now(), level: 'error', message: 'Error message 2' },
        { timestamp: Date.now(), level: 'warn', message: 'Warning message' },
      ];

      const ref = await storageManager.storeConsoleLogs(consoleLogs);

      // Get only errors
      const errors = await storageManager.getConsoleErrors(ref);
      expect(errors).toHaveLength(2);
      expect(errors.every(e => e.level === 'error')).toBe(true);

      // Get only warnings
      const warnings = await storageManager.getConsoleWarnings(ref);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('warn');
    });

    it('should provide console log summary', async () => {
      const consoleLogs: ConsoleLogEntry[] = [
        { timestamp: Date.now(), level: 'log', message: 'Log 1' },
        { timestamp: Date.now(), level: 'log', message: 'Log 2' },
        { timestamp: Date.now(), level: 'error', message: 'Error 1' },
        { timestamp: Date.now(), level: 'warn', message: 'Warning 1' },
      ];

      const ref = await storageManager.storeConsoleLogs(consoleLogs);

      const summary = await storageManager.getConsoleSummary(ref);
      expect(summary.total).toBe(4);
      expect(summary.byLevel.log).toBe(2);
      expect(summary.byLevel.error).toBe(1);
      expect(summary.byLevel.warn).toBe(1);
      expect(summary.errorCount).toBe(1);
      expect(summary.warningCount).toBe(1);
    });
  });

  describe('Checkpoint Storage Workflow', () => {
    it('should create and retrieve complete checkpoint', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      const screenshot = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();
      const consoleLogs: ConsoleLogEntry[] = [
        { timestamp: Date.now(), level: 'log', message: 'Test log' },
      ];

      // Create complete checkpoint
      const ref = await storageManager.captureCheckpoint({
        name: 'homepage-loaded',
        url: 'https://example.com',
        html,
        screenshot,
        consoleLogs,
        description: 'Homepage loaded successfully',
        tags: ['homepage', 'smoke-test'],
      });

      expect(ref).toBeDefined();
      expect(ref.category).toBe('metadata');

      // Load complete checkpoint
      const loaded = await storageManager.loadCheckpoint(ref);
      expect(loaded.checkpoint).toBeDefined();
      expect(loaded.checkpoint.name).toBe('homepage-loaded');
      expect(loaded.checkpoint.url).toBe('https://example.com');
      expect(loaded.dom).toContain('Test');
      expect(Buffer.isBuffer(loaded.screenshot)).toBe(true);
      expect(loaded.consoleLogs).toHaveLength(1);
    });

    it('should query checkpoints by filters', async () => {
      // Create multiple checkpoints
      await storageManager.captureCheckpoint({
        name: 'checkpoint-1',
        url: 'https://example.com/page1',
        html: '<html><body>Page 1</body></html>',
        tags: ['page1'],
      });

      await storageManager.captureCheckpoint({
        name: 'checkpoint-2',
        url: 'https://example.com/page2',
        html: '<html><body>Page 2</body></html>',
        tags: ['page2'],
      });

      // Query all checkpoints
      const allCheckpoints = await storageManager.queryCheckpoints();
      expect(allCheckpoints.length).toBeGreaterThanOrEqual(2);

      // Query by tag
      const page1Checkpoints = await storageManager.queryCheckpoints({
        tags: ['page1'],
      });
      expect(page1Checkpoints.length).toBeGreaterThanOrEqual(1);
    });

    it('should get checkpoint by name', async () => {
      await storageManager.captureCheckpoint({
        name: 'unique-checkpoint',
        url: 'https://example.com',
        html: '<html><body>Test</body></html>',
      });

      const ref = await storageManager.getCheckpointByName('unique-checkpoint');
      expect(ref).toBeDefined();
      expect(ref?.category).toBe('metadata');
    });
  });

  describe('Cross-Store Integration', () => {
    it('should maintain referential integrity across stores', async () => {
      // Create related data across all stores
      const html = '<html><body><h1>Integration Test</h1></body></html>';
      const screenshot = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .png()
        .toBuffer();
      const consoleLogs: ConsoleLogEntry[] = [
        { timestamp: Date.now(), level: 'log', message: 'Integration test' },
      ];

      // Create checkpoint with all data
      const checkpointRef = await storageManager.captureCheckpoint({
        name: 'integration-checkpoint',
        url: 'https://example.com',
        html,
        screenshot,
        consoleLogs,
      });

      // Load and verify all related data
      const loaded = await storageManager.loadCheckpoint(checkpointRef);

      expect(loaded.checkpoint).toBeDefined();
      expect(loaded.dom).toBeDefined();
      expect(loaded.screenshot).toBeDefined();
      expect(loaded.consoleLogs).toBeDefined();

      // Verify data integrity
      expect(loaded.dom).toContain('Integration Test');
      const screenshotMeta = await sharp(loaded.screenshot!).metadata();
      expect(screenshotMeta.width).toBe(200);
      expect(loaded.consoleLogs![0].message).toBe('Integration test');
    });

    it('should handle partial checkpoint data', async () => {
      // Create checkpoint with only HTML
      const ref = await storageManager.captureCheckpoint({
        name: 'partial-checkpoint',
        url: 'https://example.com',
        html: '<html><body>Partial</body></html>',
      });

      const loaded = await storageManager.loadCheckpoint(ref);
      expect(loaded.checkpoint).toBeDefined();
      expect(loaded.dom).toBeDefined();
      expect(loaded.screenshot).toBeUndefined();
      expect(loaded.consoleLogs).toBeUndefined();
    });
  });

  describe('Storage Management', () => {
    it('should get storage statistics', async () => {
      // Create some test data
      await storageManager.storeDOM('<html><body>Test</body></html>');
      await storageManager.storeScreenshot(
        await sharp({
          create: {
            width: 10,
            height: 10,
            channels: 3,
            background: { r: 0, g: 0, b: 0 },
          },
        })
          .png()
          .toBuffer()
      );
      await storageManager.storeConsoleLogs([
        { timestamp: Date.now(), level: 'log', message: 'Test' },
      ]);

      const stats = await storageManager.getStats();
      expect(stats.doms).toBeGreaterThanOrEqual(1);
      expect(stats.screenshots).toBeGreaterThanOrEqual(1);
      expect(stats.consoleLogs).toBeGreaterThanOrEqual(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should export and import storage data', async () => {
      // Create test data
      const checkpointRef = await storageManager.captureCheckpoint({
        name: 'export-test',
        url: 'https://example.com',
        html: '<html><body>Export Test</body></html>',
      });

      // Export storage to a separate directory
      const exportDir = path.join(process.cwd(), 'tmp', `export-${Date.now()}`);
      await storageManager.export(exportDir);

      // Verify export directory exists
      const exportExists = await fs.pathExists(exportDir);
      expect(exportExists).toBe(true);

      // Create new storage manager and import
      const importDir = path.join(tempDir, 'import-storage');
      const newStorage = new StorageManager({ baseDir: importDir });
      await newStorage.initialize();
      await newStorage.import(exportDir);

      // Verify imported data
      const ref = await newStorage.getCheckpointByName('export-test');
      expect(ref).toBeDefined();

      const loaded = await newStorage.loadCheckpoint(ref!);
      expect(loaded.dom).toContain('Export Test');

      // Cleanup export directory
      await fs.remove(exportDir);
    });

    it('should clear all storage data', async () => {
      // Create test data
      await storageManager.captureCheckpoint({
        name: 'to-be-cleared',
        url: 'https://example.com',
        html: '<html><body>Clear me</body></html>',
      });

      // Verify data exists
      let checkpoints = await storageManager.queryCheckpoints();
      expect(checkpoints.length).toBeGreaterThan(0);

      // Clear storage
      await storageManager.clear();

      // Verify data is cleared
      checkpoints = await storageManager.queryCheckpoints();
      expect(checkpoints.length).toBe(0);
    });
  });
});
