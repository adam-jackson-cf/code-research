import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CheckpointStore, CheckpointState } from '../../../src/storage/checkpoint-store.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('CheckpointStore', () => {
  let store: CheckpointStore;
  let tempDir: string;

  const createCheckpointState = (name: string, url: string): CheckpointState => ({
    name,
    url,
    timestamp: Date.now(),
    state: {
      domRef: 'dom_123',
      screenshotRef: 'screenshot_456',
      consoleRef: 'console_789',
      customData: {
        userAction: 'clicked button',
        formData: { username: 'test' },
      },
    },
    metadata: {
      description: `Checkpoint for ${name}`,
      tags: ['test', 'automated'],
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Test Browser',
    },
  });

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `checkpoint-store-test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    store = new CheckpointStore({
      baseDir: tempDir,
      namespace: 'checkpoint-test',
    });

    await store.initialize();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('store', () => {
    it('should store checkpoint state and return lightweight StorageRef', async () => {
      const state = createCheckpointState('login-page', 'https://example.com/login');
      const ref = await store.store(state);

      // Verify StorageRef is lightweight
      expect(ref).toHaveProperty('id');
      expect(ref).toHaveProperty('timestamp');
      expect(ref).toHaveProperty('type', 'checkpoint');
      expect(ref.metadata).toHaveProperty('name', 'login-page');
      expect(ref.metadata).toHaveProperty('url', 'https://example.com/login');
      expect(ref.metadata).toHaveProperty('tags');
      expect(ref.metadata).toHaveProperty('hasScreenshot', true);
      expect(ref.metadata).toHaveProperty('hasDOM', true);
      expect(ref.metadata).toHaveProperty('hasConsole', true);

      // Verify no full state in ref
      const serialized = JSON.stringify(ref);
      expect(serialized).not.toContain('customData');
      expect(serialized).not.toContain('clicked button');
    });

    it('should track which data types are present', async () => {
      const stateWithScreenshot: CheckpointState = {
        name: 'test',
        url: 'https://example.com',
        timestamp: Date.now(),
        state: {
          screenshotRef: 'screenshot_123',
        },
        metadata: {},
      };

      const stateWithAll: CheckpointState = {
        name: 'test-all',
        url: 'https://example.com',
        timestamp: Date.now(),
        state: {
          domRef: 'dom_123',
          screenshotRef: 'screenshot_456',
          consoleRef: 'console_789',
        },
        metadata: {},
      };

      const ref1 = await store.store(stateWithScreenshot);
      const ref2 = await store.store(stateWithAll);

      expect(ref1.metadata?.hasScreenshot).toBe(true);
      expect(ref1.metadata?.hasDOM).toBe(false);
      expect(ref1.metadata?.hasConsole).toBe(false);

      expect(ref2.metadata?.hasScreenshot).toBe(true);
      expect(ref2.metadata?.hasDOM).toBe(true);
      expect(ref2.metadata?.hasConsole).toBe(true);
    });

    it('should preserve custom data', async () => {
      const state = createCheckpointState('test', 'https://example.com');
      state.state.customData = {
        formValues: { email: 'test@example.com' },
        sessionId: 'abc123',
      };

      const ref = await store.store(state);
      const retrieved = await store.retrieve(ref);

      expect(retrieved.state.customData).toEqual({
        formValues: { email: 'test@example.com' },
        sessionId: 'abc123',
      });
    });

    it('should handle checkpoints without optional fields', async () => {
      const minimalState: CheckpointState = {
        name: 'minimal',
        url: 'https://example.com',
        timestamp: Date.now(),
        state: {},
        metadata: {},
      };

      const ref = await store.store(minimalState);
      expect(ref.id).toBeDefined();
    });
  });

  describe('retrieve', () => {
    it('should retrieve full checkpoint state', async () => {
      const state = createCheckpointState('dashboard', 'https://example.com/dashboard');
      const ref = await store.store(state);

      const retrieved = await store.retrieve(ref);

      expect(retrieved.name).toBe('dashboard');
      expect(retrieved.url).toBe('https://example.com/dashboard');
      expect(retrieved.state.domRef).toBe('dom_123');
      expect(retrieved.state.screenshotRef).toBe('screenshot_456');
      expect(retrieved.state.consoleRef).toBe('console_789');
      expect(retrieved.metadata.description).toBe('Checkpoint for dashboard');
    });

    it('should throw error for non-existent checkpoint', async () => {
      const fakeRef = {
        id: 'non-existent',
        timestamp: Date.now(),
        type: 'checkpoint',
      };

      await expect(async () => {
        await store.retrieve(fakeRef);
      }).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update checkpoint state', async () => {
      const state = createCheckpointState('test', 'https://example.com');
      const ref = await store.store(state);

      await store.update(ref, {
        name: 'updated-test',
        metadata: {
          description: 'Updated description',
        },
      });

      const retrieved = await store.retrieve(ref);
      expect(retrieved.name).toBe('updated-test');
      expect(retrieved.metadata.description).toBe('Updated description');
    });

    it('should merge state updates', async () => {
      const state = createCheckpointState('test', 'https://example.com');
      const ref = await store.store(state);

      await store.update(ref, {
        state: {
          networkRef: 'network_999',
        },
      });

      const retrieved = await store.retrieve(ref);
      expect(retrieved.state.domRef).toBe('dom_123'); // Original preserved
      expect(retrieved.state.networkRef).toBe('network_999'); // New added
    });

    it('should update indexes when name changes', async () => {
      const state = createCheckpointState('original-name', 'https://example.com');
      const ref = await store.store(state);

      await store.update(ref, { name: 'new-name' });

      const byName = await store.getByName('new-name');
      expect(byName?.id).toBe(ref.id);
    });

    it('should throw error for non-existent checkpoint', async () => {
      const fakeRef = {
        id: 'non-existent',
        timestamp: Date.now(),
        type: 'checkpoint',
      };

      await expect(async () => {
        await store.update(fakeRef, { name: 'new-name' });
      }).rejects.toThrow();
    });
  });

  describe('getByName', () => {
    it('should retrieve checkpoint by name', async () => {
      const state = createCheckpointState('unique-checkpoint', 'https://example.com');
      const ref = await store.store(state);

      const byName = await store.getByName('unique-checkpoint');

      expect(byName).toBeDefined();
      expect(byName?.id).toBe(ref.id);
    });

    it('should return null when checkpoint name not found', async () => {
      const byName = await store.getByName('non-existent');
      expect(byName).toBeNull();
    });

    it('should return most recent when duplicate names exist', async () => {
      const state1 = createCheckpointState('duplicate', 'https://example.com');
      await store.store(state1);

      await new Promise(resolve => setTimeout(resolve, 10));

      const state2 = createCheckpointState('duplicate', 'https://example.com');
      const ref2 = await store.store(state2);

      // Name index should have the latest
      const byName = await store.getByName('duplicate');
      expect(byName?.id).toBe(ref2.id);
    });
  });

  describe('query', () => {
    it('should query checkpoints without loading full state', async () => {
      const state1 = createCheckpointState('cp1', 'https://example.com/page1');
      const state2 = createCheckpointState('cp2', 'https://example.com/page2');

      await store.store(state1);
      await store.store(state2);

      const results = await store.query();
      expect(results).toHaveLength(2);

      // Verify refs are lightweight
      const serialized = JSON.stringify(results);
      expect(serialized).not.toContain('customData');
      expect(serialized).not.toContain('clicked button');
    });

    it('should filter by name', async () => {
      await store.store(createCheckpointState('login', 'https://example.com'));
      await store.store(createCheckpointState('dashboard', 'https://example.com'));
      await store.store(createCheckpointState('login', 'https://example.com'));

      const results = await store.query({ name: 'login' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.metadata?.name === 'login')).toBe(true);
    });

    it('should filter by URL', async () => {
      await store.store(createCheckpointState('cp1', 'https://example.com'));
      await store.store(createCheckpointState('cp2', 'https://test.com'));
      await store.store(createCheckpointState('cp3', 'https://example.com'));

      const results = await store.query({ url: 'https://example.com' });
      expect(results).toHaveLength(2);
    });

    it('should filter by tags', async () => {
      const state1 = createCheckpointState('cp1', 'https://example.com');
      state1.metadata.tags = ['login', 'auth'];

      const state2 = createCheckpointState('cp2', 'https://example.com');
      state2.metadata.tags = ['dashboard', 'main'];

      const state3 = createCheckpointState('cp3', 'https://example.com');
      state3.metadata.tags = ['login', 'form'];

      await store.store(state1);
      await store.store(state2);
      await store.store(state3);

      const results = await store.query({ tags: ['login'] });
      expect(results).toHaveLength(2);
    });

    it('should filter by time range', async () => {
      const state = createCheckpointState('test', 'https://example.com');
      const startTime = Date.now();

      await store.store(state);

      await new Promise(resolve => setTimeout(resolve, 10));
      const midTime = Date.now();

      await store.store(state);

      const results = await store.query({ startTime: midTime });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by hasScreenshot', async () => {
      const withScreenshot: CheckpointState = {
        name: 'with-ss',
        url: 'https://example.com',
        timestamp: Date.now(),
        state: { screenshotRef: 'ss_123' },
        metadata: {},
      };

      const withoutScreenshot: CheckpointState = {
        name: 'without-ss',
        url: 'https://example.com',
        timestamp: Date.now(),
        state: { domRef: 'dom_123' },
        metadata: {},
      };

      await store.store(withScreenshot);
      await store.store(withoutScreenshot);

      const results = await store.query({ hasScreenshot: true });
      expect(results).toHaveLength(1);
      expect(results[0].metadata?.hasScreenshot).toBe(true);
    });

    it('should filter by hasDOM', async () => {
      const withDOM: CheckpointState = {
        name: 'with-dom',
        url: 'https://example.com',
        timestamp: Date.now(),
        state: { domRef: 'dom_123' },
        metadata: {},
      };

      const withoutDOM: CheckpointState = {
        name: 'without-dom',
        url: 'https://example.com',
        timestamp: Date.now(),
        state: { screenshotRef: 'ss_123' },
        metadata: {},
      };

      await store.store(withDOM);
      await store.store(withoutDOM);

      const results = await store.query({ hasDOM: true });
      expect(results).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
      const state = createCheckpointState('test', 'https://example.com');

      await store.store(state);
      await store.store(state);
      await store.store(state);

      const results = await store.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should sort results by timestamp (newest first)', async () => {
      const state = createCheckpointState('test', 'https://example.com');

      const ref1 = await store.store(state);
      await new Promise(resolve => setTimeout(resolve, 10));
      const ref2 = await store.store(state);
      await new Promise(resolve => setTimeout(resolve, 10));
      const ref3 = await store.store(state);

      const results = await store.query();
      expect(results[0].timestamp).toBeGreaterThanOrEqual(results[1].timestamp);
      expect(results[1].timestamp).toBeGreaterThanOrEqual(results[2].timestamp);
    });

    it('should return empty array when no checkpoints exist', async () => {
      const results = await store.query();
      expect(results).toHaveLength(0);
    });
  });

  describe('queryByTag', () => {
    it('should query checkpoints by specific tag', async () => {
      const state1 = createCheckpointState('cp1', 'https://example.com');
      state1.metadata.tags = ['login', 'auth'];

      const state2 = createCheckpointState('cp2', 'https://example.com');
      state2.metadata.tags = ['dashboard'];

      const state3 = createCheckpointState('cp3', 'https://example.com');
      state3.metadata.tags = ['login', 'form'];

      await store.store(state1);
      await store.store(state2);
      await store.store(state3);

      const results = await store.queryByTag('login');
      expect(results).toHaveLength(2);
    });

    it('should return empty array when tag not found', async () => {
      const state = createCheckpointState('test', 'https://example.com');
      state.metadata.tags = ['other-tag'];

      await store.store(state);

      const results = await store.queryByTag('non-existent-tag');
      expect(results).toHaveLength(0);
    });
  });

  describe('compare', () => {
    it('should compare two checkpoints', async () => {
      const state1 = createCheckpointState('cp1', 'https://example.com');
      const state2 = createCheckpointState('cp2', 'https://example.com');
      state2.state.domRef = 'different_dom';

      const ref1 = await store.store(state1);
      const ref2 = await store.store(state2);

      const comparison = await store.compare(ref1, ref2);

      expect(comparison.checkpoint1).toBe(ref1);
      expect(comparison.checkpoint2).toBe(ref2);
      expect(comparison.differences.dom).toBe(true);
      expect(comparison.differences.screenshot).toBe(false);
      expect(comparison.timestamp).toBeDefined();
    });

    it('should detect custom data differences', async () => {
      const state1 = createCheckpointState('cp1', 'https://example.com');
      state1.state.customData = { key1: 'value1', key2: 'value2' };

      const state2 = createCheckpointState('cp2', 'https://example.com');
      state2.state.customData = { key1: 'different', key3: 'value3' };

      const ref1 = await store.store(state1);
      const ref2 = await store.store(state2);

      const comparison = await store.compare(ref1, ref2);

      expect(comparison.differences.custom).toContain('key1');
      expect(comparison.differences.custom).toContain('key2');
      expect(comparison.differences.custom).toContain('key3');
    });

    it('should identify identical checkpoints', async () => {
      const state = createCheckpointState('test', 'https://example.com');
      const ref1 = await store.store(state);
      const ref2 = await store.store(state);

      const comparison = await store.compare(ref1, ref2);

      expect(comparison.differences.dom).toBe(false);
      expect(comparison.differences.screenshot).toBe(false);
      expect(comparison.differences.console).toBe(false);
      expect(comparison.differences.custom).toHaveLength(0);
    });
  });

  describe('clone', () => {
    it('should clone checkpoint with new name', async () => {
      const state = createCheckpointState('original', 'https://example.com');
      const ref = await store.store(state);

      const clonedRef = await store.clone(ref, 'cloned');

      expect(clonedRef.id).not.toBe(ref.id);
      expect(clonedRef.metadata?.name).toBe('cloned');

      const cloned = await store.retrieve(clonedRef);
      expect(cloned.name).toBe('cloned');
      expect(cloned.state.domRef).toBe(state.state.domRef);
    });

    it('should preserve all state in clone', async () => {
      const state = createCheckpointState('original', 'https://example.com');
      state.state.customData = { important: 'data' };

      const ref = await store.store(state);
      const clonedRef = await store.clone(ref, 'clone');

      const cloned = await store.retrieve(clonedRef);
      expect(cloned.state.customData).toEqual({ important: 'data' });
    });
  });

  describe('getHistory', () => {
    it('should get checkpoint history for a URL', async () => {
      const url = 'https://example.com/page';

      await store.store(createCheckpointState('cp1', url));
      await store.store(createCheckpointState('cp2', 'https://other.com'));
      await store.store(createCheckpointState('cp3', url));

      const history = await store.getHistory(url);
      expect(history).toHaveLength(2);
      expect(history.every(h => h.metadata?.url === url)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const url = 'https://example.com';

      await store.store(createCheckpointState('cp1', url));
      await store.store(createCheckpointState('cp2', url));
      await store.store(createCheckpointState('cp3', url));

      const history = await store.getHistory(url, 2);
      expect(history).toHaveLength(2);
    });
  });

  describe('getAllTags', () => {
    it('should get all unique tags', async () => {
      const state1 = createCheckpointState('cp1', 'https://example.com');
      state1.metadata.tags = ['tag1', 'tag2'];

      const state2 = createCheckpointState('cp2', 'https://example.com');
      state2.metadata.tags = ['tag2', 'tag3'];

      const state3 = createCheckpointState('cp3', 'https://example.com');
      state3.metadata.tags = ['tag1', 'tag4'];

      await store.store(state1);
      await store.store(state2);
      await store.store(state3);

      const tags = await store.getAllTags();
      expect(tags).toEqual(['tag1', 'tag2', 'tag3', 'tag4']);
    });

    it('should return empty array when no checkpoints exist', async () => {
      const tags = await store.getAllTags();
      expect(tags).toHaveLength(0);
    });

    it('should handle checkpoints without tags', async () => {
      const state = createCheckpointState('test', 'https://example.com');
      delete state.metadata.tags;

      await store.store(state);

      const tags = await store.getAllTags();
      expect(tags).toHaveLength(0);
    });
  });

  describe('deleteCheckpoint', () => {
    it('should delete checkpoint', async () => {
      const state = createCheckpointState('to-delete', 'https://example.com');
      const ref = await store.store(state);

      await store.deleteCheckpoint(ref);

      await expect(async () => {
        await store.retrieve(ref);
      }).rejects.toThrow();
    });

    it('should remove checkpoint from index', async () => {
      const state = createCheckpointState('to-delete', 'https://example.com');
      const ref = await store.store(state);

      const beforeDelete = await store.query();
      expect(beforeDelete).toHaveLength(1);

      await store.deleteCheckpoint(ref);

      const afterDelete = await store.query();
      expect(afterDelete).toHaveLength(0);
    });
  });

  describe('progressive disclosure', () => {
    it('should not load full state when querying', async () => {
      const state = createCheckpointState('test', 'https://example.com');
      state.state.customData = { largeData: 'x'.repeat(10000) };

      await store.store(state);

      const results = await store.query();

      // Results should not contain the large custom data
      const serialized = JSON.stringify(results);
      expect(serialized).not.toContain('largeData');
    });

    it('should only load state when explicitly retrieved', async () => {
      const state = createCheckpointState('test', 'https://example.com');
      const ref = await store.store(state);

      // Querying should not load state
      await store.query();

      // Only retrieve should load full state
      const retrieved = await store.retrieve(ref);
      expect(retrieved.state.customData).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error on storage failures', async () => {
      const invalidStore = new CheckpointStore({
        baseDir: '/invalid/path',
        namespace: 'test',
      });

      const state = createCheckpointState('test', 'https://example.com');

      await expect(async () => {
        await invalidStore.store(state);
      }).rejects.toThrow('Failed to store checkpoint');
    });

    it('should handle retrieval errors gracefully', async () => {
      const fakeRef = {
        id: 'non-existent',
        timestamp: Date.now(),
        type: 'checkpoint',
      };

      await expect(async () => {
        await store.retrieve(fakeRef);
      }).rejects.toThrow('Failed to retrieve checkpoint');
    });

    it('should handle comparison errors when checkpoints do not exist', async () => {
      const fakeRef1 = {
        id: 'fake1',
        timestamp: Date.now(),
        type: 'checkpoint',
      };
      const fakeRef2 = {
        id: 'fake2',
        timestamp: Date.now(),
        type: 'checkpoint',
      };

      await expect(async () => {
        await store.compare(fakeRef1, fakeRef2);
      }).rejects.toThrow();
    });
  });
});
