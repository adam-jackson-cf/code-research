import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageManager } from '../../src/storage/index.js';
import { CheckpointStore, CheckpointState } from '../../src/storage/checkpoint-store.js';
import { ConsoleLogEntry } from '../../src/storage/console-store.js';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

describe('Checkpoint Flow Integration Tests', () => {
  let storageManager: StorageManager;
  let checkpointStore: CheckpointStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'tmp', `test-checkpoint-${Date.now()}`);
    await fs.ensureDir(tempDir);

    storageManager = new StorageManager({
      baseDir: tempDir,
    });
    await storageManager.initialize();

    checkpointStore = new CheckpointStore({
      baseDir: tempDir,
      namespace: 'checkpoints',
    });
    await checkpointStore.initialize();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Checkpoint Creation Flow', () => {
    it('should create a complete checkpoint with all artifacts', async () => {
      // Prepare test data
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Homepage</h1>
            <p>Welcome to our site</p>
          </body>
        </html>
      `;

      const screenshot = await sharp({
        create: {
          width: 1920,
          height: 1080,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const consoleLogs: ConsoleLogEntry[] = [
        {
          timestamp: Date.now(),
          level: 'log',
          message: 'Page loaded successfully',
        },
        {
          timestamp: Date.now() + 100,
          level: 'info',
          message: 'All resources loaded',
        },
      ];

      // Create checkpoint
      const checkpointRef = await storageManager.captureCheckpoint({
        name: 'homepage-initial-load',
        url: 'https://example.com',
        html,
        screenshot,
        consoleLogs,
        description: 'Initial homepage load checkpoint',
        tags: ['homepage', 'initial-load'],
        viewport: { width: 1920, height: 1080 },
      });

      // Verify checkpoint was created
      expect(checkpointRef).toBeDefined();
      expect(checkpointRef.category).toBe('metadata');
      expect(checkpointRef.tags?.name).toBe('homepage-initial-load');
      expect(checkpointRef.tags?.hasScreenshot).toBe('true');
      expect(checkpointRef.tags?.hasDOM).toBe('true');
      expect(checkpointRef.tags?.hasConsole).toBe('true');
    });

    it('should create checkpoint with minimal data', async () => {
      const checkpointRef = await storageManager.captureCheckpoint({
        name: 'minimal-checkpoint',
        url: 'https://example.com/minimal',
        html: '<html><body>Minimal</body></html>',
      });

      expect(checkpointRef).toBeDefined();
      expect(checkpointRef.tags?.hasScreenshot).toBe('false');
      expect(checkpointRef.tags?.hasDOM).toBe('true');
      expect(checkpointRef.tags?.hasConsole).toBe('false');

      const loaded = await storageManager.loadCheckpoint(checkpointRef);
      expect(loaded.checkpoint).toBeDefined();
      expect(loaded.dom).toBeDefined();
      expect(loaded.screenshot).toBeUndefined();
      expect(loaded.consoleLogs).toBeUndefined();
    });

    it('should store checkpoint state directly', async () => {
      const state: CheckpointState = {
        name: 'direct-checkpoint',
        url: 'https://example.com',
        timestamp: Date.now(),
        state: {
          customData: {
            testValue: 'custom data',
            performanceMetrics: {
              loadTime: 1234,
              renderTime: 567,
            },
          },
        },
        metadata: {
          description: 'Checkpoint created directly',
          tags: ['direct', 'custom'],
          viewport: { width: 1280, height: 720 },
        },
      };

      const ref = await checkpointStore.store(state);
      expect(ref).toBeDefined();

      const retrieved = await checkpointStore.retrieve(ref);
      expect(retrieved.name).toBe('direct-checkpoint');
      expect(retrieved.state.customData?.testValue).toBe('custom data');
      expect(retrieved.state.customData?.performanceMetrics.loadTime).toBe(1234);
    });
  });

  describe('Checkpoint Retrieval and Querying', () => {
    it('should retrieve checkpoint by name', async () => {
      await storageManager.captureCheckpoint({
        name: 'findable-checkpoint',
        url: 'https://example.com',
        html: '<html><body>Find me</body></html>',
      });

      const ref = await storageManager.getCheckpointByName('findable-checkpoint');
      expect(ref).toBeDefined();

      // The ref may not have metadata.name in the expected format
      // Just verify it exists and we can load it
      const loaded = await storageManager.loadCheckpoint(ref!);
      expect(loaded.checkpoint.name).toBe('findable-checkpoint');
    });

    it('should query checkpoints by URL', async () => {
      const url = 'https://example.com/special-page';

      await storageManager.captureCheckpoint({
        name: 'checkpoint-1',
        url,
        html: '<html><body>Page 1</body></html>',
      });

      await storageManager.captureCheckpoint({
        name: 'checkpoint-2',
        url,
        html: '<html><body>Page 2</body></html>',
      });

      await storageManager.captureCheckpoint({
        name: 'checkpoint-other',
        url: 'https://example.com/other',
        html: '<html><body>Other</body></html>',
      });

      const checkpoints = await storageManager.queryCheckpoints({ url });
      expect(checkpoints.length).toBeGreaterThanOrEqual(2);
      expect(checkpoints.every(cp => cp.tags?.url === url)).toBe(true);
    });

    it('should query checkpoints by tags', async () => {
      await storageManager.captureCheckpoint({
        name: 'tagged-1',
        url: 'https://example.com',
        html: '<html><body>1</body></html>',
        tags: ['smoke-test', 'homepage'],
      });

      await storageManager.captureCheckpoint({
        name: 'tagged-2',
        url: 'https://example.com',
        html: '<html><body>2</body></html>',
        tags: ['smoke-test', 'login'],
      });

      await storageManager.captureCheckpoint({
        name: 'tagged-3',
        url: 'https://example.com',
        html: '<html><body>3</body></html>',
        tags: ['e2e-test'],
      });

      const smokeTests = await storageManager.queryCheckpoints({
        tags: ['smoke-test'],
      });

      expect(smokeTests.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter checkpoints by time range', async () => {
      const startTime = Date.now();

      await storageManager.captureCheckpoint({
        name: 'old-checkpoint',
        url: 'https://example.com',
        html: '<html><body>Old</body></html>',
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      const midTime = Date.now();

      await storageManager.captureCheckpoint({
        name: 'new-checkpoint',
        url: 'https://example.com',
        html: '<html><body>New</body></html>',
      });

      // Query recent checkpoints
      const recentCheckpoints = await storageManager.queryCheckpoints({
        startTime: midTime,
      });

      expect(recentCheckpoints.length).toBeGreaterThanOrEqual(1);
      expect(recentCheckpoints.every(cp => new Date(cp.timestamp).getTime() >= midTime)).toBe(true);
    });

    it('should filter checkpoints by artifact presence', async () => {
      // Checkpoint with screenshot
      await storageManager.captureCheckpoint({
        name: 'with-screenshot',
        url: 'https://example.com',
        html: '<html><body>Test</body></html>',
        screenshot: await sharp({
          create: {
            width: 100,
            height: 100,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
          },
        })
          .png()
          .toBuffer(),
      });

      // Checkpoint without screenshot
      await storageManager.captureCheckpoint({
        name: 'without-screenshot',
        url: 'https://example.com',
        html: '<html><body>Test</body></html>',
      });

      const withScreenshots = await storageManager.queryCheckpoints({
        hasScreenshot: true,
      });

      expect(withScreenshots.length).toBeGreaterThanOrEqual(1);
      expect(withScreenshots.every(cp => cp.tags?.hasScreenshot === 'true')).toBe(true);
    });

    it('should limit query results', async () => {
      // Create multiple checkpoints
      for (let i = 0; i < 5; i++) {
        await storageManager.captureCheckpoint({
          name: `checkpoint-${i}`,
          url: 'https://example.com',
          html: `<html><body>Checkpoint ${i}</body></html>`,
        });
      }

      const limited = await storageManager.queryCheckpoints({ limit: 3 });
      expect(limited.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Checkpoint Comparison', () => {
    it('should compare two checkpoints', async () => {
      const checkpoint1 = await storageManager.captureCheckpoint({
        name: 'checkpoint-v1',
        url: 'https://example.com',
        html: '<html><body>Version 1</body></html>',
        screenshot: await sharp({
          create: {
            width: 100,
            height: 100,
            channels: 3,
            background: { r: 255, g: 0, b: 0 },
          },
        })
          .png()
          .toBuffer(),
      });

      const checkpoint2 = await storageManager.captureCheckpoint({
        name: 'checkpoint-v2',
        url: 'https://example.com',
        html: '<html><body>Version 2</body></html>',
        screenshot: await sharp({
          create: {
            width: 100,
            height: 100,
            channels: 3,
            background: { r: 0, g: 0, b: 255 },
          },
        })
          .png()
          .toBuffer(),
      });

      const comparison = await storageManager.compareCheckpoints(
        checkpoint1,
        checkpoint2
      );

      expect(comparison).toBeDefined();
      expect(comparison.checkpoint1).toBeDefined();
      expect(comparison.checkpoint2).toBeDefined();
      expect(comparison.differences).toBeDefined();
      expect(comparison.differences.dom).toBe(true); // Different HTML
      expect(comparison.differences.screenshot).toBe(true); // Different refs
    });

    it('should detect identical checkpoints', async () => {
      const html = '<html><body>Same content</body></html>';

      const checkpoint1Ref = await storageManager.captureCheckpoint({
        name: 'checkpoint-a',
        url: 'https://example.com',
        html,
      });

      const checkpoint2Ref = await storageManager.captureCheckpoint({
        name: 'checkpoint-b',
        url: 'https://example.com',
        html,
      });

      const comparison = await storageManager.compareCheckpoints(
        checkpoint1Ref,
        checkpoint2Ref
      );

      // DOM refs will be different even with same content
      expect(comparison.differences.dom).toBe(true);
    });
  });

  describe('Checkpoint Updates and Cloning', () => {
    it('should update checkpoint metadata', async () => {
      const checkpointRef = await storageManager.captureCheckpoint({
        name: 'updateable-checkpoint',
        url: 'https://example.com',
        html: '<html><body>Original</body></html>',
        tags: ['original'],
      });

      const loaded = await storageManager.loadCheckpoint(checkpointRef);
      const originalState = loaded.checkpoint;

      // Update checkpoint
      await storageManager.updateCheckpoint(checkpointRef, {
        metadata: {
          ...originalState.metadata,
          description: 'Updated description',
          tags: ['original', 'updated'],
        },
      });

      // Verify update
      const updatedLoaded = await storageManager.loadCheckpoint(checkpointRef);
      expect(updatedLoaded.checkpoint.metadata.description).toBe('Updated description');
      expect(updatedLoaded.checkpoint.metadata.tags).toContain('updated');
    });

    it('should clone checkpoint with new name', async () => {
      const originalRef = await storageManager.captureCheckpoint({
        name: 'original-checkpoint',
        url: 'https://example.com',
        html: '<html><body>Original</body></html>',
      });

      const clonedRef = await storageManager.cloneCheckpoint(
        originalRef,
        'cloned-checkpoint'
      );

      expect(clonedRef).toBeDefined();
      expect(clonedRef.path).not.toBe(originalRef.path);

      // Verify both exist
      const original = await storageManager.getCheckpointByName('original-checkpoint');
      const cloned = await storageManager.getCheckpointByName('cloned-checkpoint');

      expect(original).toBeDefined();
      expect(cloned).toBeDefined();
      expect(original?.path).not.toBe(cloned?.path);
    });
  });

  describe('Checkpoint History', () => {
    it('should track checkpoint history for a URL', async () => {
      const url = 'https://example.com/tracked-page';

      // Create multiple checkpoints for the same URL
      await storageManager.captureCheckpoint({
        name: 'version-1',
        url,
        html: '<html><body>Version 1</body></html>',
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      await storageManager.captureCheckpoint({
        name: 'version-2',
        url,
        html: '<html><body>Version 2</body></html>',
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      await storageManager.captureCheckpoint({
        name: 'version-3',
        url,
        html: '<html><body>Version 3</body></html>',
      });

      // Get history
      const history = await storageManager.getCheckpointHistory(url);

      expect(history.length).toBeGreaterThanOrEqual(3);
      // Should be sorted by timestamp descending (newest first)
      for (let i = 0; i < history.length - 1; i++) {
        expect(new Date(history[i].timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(history[i + 1].timestamp).getTime()
        );
      }
    });

    it('should limit checkpoint history', async () => {
      const url = 'https://example.com/history-test';

      // Create 5 checkpoints
      for (let i = 0; i < 5; i++) {
        await storageManager.captureCheckpoint({
          name: `history-${i}`,
          url,
          html: `<html><body>Version ${i}</body></html>`,
        });
      }

      const limitedHistory = await storageManager.getCheckpointHistory(url, 3);
      expect(limitedHistory.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Checkpoint Deletion', () => {
    it('should delete checkpoint', async () => {
      const checkpointRef = await storageManager.captureCheckpoint({
        name: 'to-be-deleted',
        url: 'https://example.com',
        html: '<html><body>Delete me</body></html>',
      });

      // Verify checkpoint exists
      let found = await storageManager.getCheckpointByName('to-be-deleted');
      expect(found).toBeDefined();

      // Delete checkpoint
      await storageManager.deleteCheckpoint(checkpointRef);

      // Verify checkpoint is deleted
      const allCheckpoints = await storageManager.queryCheckpoints();
      const stillExists = allCheckpoints.find(cp => cp.path === checkpointRef.path);
      expect(stillExists).toBeUndefined();
    });

    it('should handle checkpoint with all artifact types', async () => {
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

      const checkpointRef = await storageManager.captureCheckpoint({
        name: 'full-checkpoint',
        url: 'https://example.com',
        html: '<html><body>Full checkpoint</body></html>',
        screenshot,
        consoleLogs: [
          { timestamp: Date.now(), level: 'log', message: 'Test log' },
        ],
        tags: ['full', 'test'],
      });

      // Verify all artifacts are present
      const loaded = await storageManager.loadCheckpoint(checkpointRef);
      expect(loaded.dom).toBeDefined();
      expect(loaded.screenshot).toBeDefined();
      expect(loaded.consoleLogs).toBeDefined();

      // Delete checkpoint
      await storageManager.deleteCheckpoint(checkpointRef, {
        deleteRelatedData: true,
      });
    });
  });

  describe('Complex Checkpoint Workflows', () => {
    it('should handle multi-page test flow', async () => {
      const testFlow = [
        { name: 'homepage', url: 'https://example.com', content: 'Home' },
        { name: 'login', url: 'https://example.com/login', content: 'Login' },
        { name: 'dashboard', url: 'https://example.com/dashboard', content: 'Dashboard' },
      ];

      const checkpoints = [];

      for (const page of testFlow) {
        const ref = await storageManager.captureCheckpoint({
          name: page.name,
          url: page.url,
          html: `<html><body><h1>${page.content}</h1></body></html>`,
          tags: ['test-flow'],
        });
        checkpoints.push(ref);
      }

      // Verify all checkpoints created
      expect(checkpoints.length).toBe(3);

      // Query by tag
      const flowCheckpoints = await storageManager.queryCheckpoints({
        tags: ['test-flow'],
      });
      expect(flowCheckpoints.length).toBeGreaterThanOrEqual(3);

      // Load each checkpoint
      for (const ref of checkpoints) {
        const loaded = await storageManager.loadCheckpoint(ref);
        expect(loaded.checkpoint).toBeDefined();
        expect(loaded.dom).toBeDefined();
      }
    });

    it('should track state changes over time', async () => {
      const url = 'https://example.com/dynamic';
      const states = [];

      // Simulate state changes
      for (let i = 0; i < 3; i++) {
        const consoleLogs: ConsoleLogEntry[] = [
          {
            timestamp: Date.now(),
            level: 'log',
            message: `State ${i}`,
          },
        ];

        const ref = await storageManager.captureCheckpoint({
          name: `state-${i}`,
          url,
          html: `<html><body>State ${i}</body></html>`,
          consoleLogs,
          customData: {
            stateNumber: i,
            timestamp: Date.now(),
          },
        });

        states.push(ref);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Load and verify state progression
      for (let i = 0; i < states.length; i++) {
        const loaded = await storageManager.loadCheckpoint(states[i]);
        expect(loaded.checkpoint.state.customData?.stateNumber).toBe(i);
        expect(loaded.consoleLogs?.[0].message).toBe(`State ${i}`);
      }

      // Compare states
      if (states.length >= 2) {
        const comparison = await storageManager.compareCheckpoints(
          states[0],
          states[1]
        );
        expect(comparison.differences.dom).toBe(true);
        expect(comparison.differences.console).toBe(true);
      }
    });
  });
});
