import path from 'path';
import fs from 'fs-extra';
import { DOMStore, DOMQueryFilter } from './dom-store.js';
import { ScreenshotStore, ScreenshotData, ScreenshotQueryFilter } from './screenshot-store.js';
import { ConsoleStore, ConsoleLogEntry, ConsoleQueryFilter } from './console-store.js';
import { CheckpointStore, CheckpointState, CheckpointQueryFilter } from './checkpoint-store.js';
import { StorageRef } from '../core/types.js';

/**
 * Storage manager configuration
 */
export interface StorageManagerConfig {
  baseDir?: string;
  domChunkSize?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  quality?: number;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  checkpoints: number;
  screenshots: number;
  doms: number;
  consoleLogs: number;
  totalSize: number;
  lastModified: number;
}

/**
 * Storage manager that coordinates all stores
 * Provides a unified interface for managing all storage operations
 */
export class StorageManager {
  private baseDir: string;
  private domStore: DOMStore;
  private screenshotStore: ScreenshotStore;
  private consoleStore: ConsoleStore;
  private checkpointStore: CheckpointStore;
  private initialized: boolean = false;

  constructor(config: StorageManagerConfig = {}) {
    this.baseDir = config.baseDir || path.join(process.cwd(), 'storage');

    // Initialize individual stores
    this.domStore = new DOMStore({
      baseDir: this.baseDir,
      namespace: 'doms',
      chunkSize: config.domChunkSize,
    });

    this.screenshotStore = new ScreenshotStore({
      baseDir: this.baseDir,
      namespace: 'screenshots',
      thumbnailWidth: config.thumbnailWidth,
      thumbnailHeight: config.thumbnailHeight,
      quality: config.quality,
    });

    this.consoleStore = new ConsoleStore({
      baseDir: this.baseDir,
      namespace: 'console',
    });

    this.checkpointStore = new CheckpointStore({
      baseDir: this.baseDir,
      namespace: 'checkpoints',
    });
  }

  /**
   * Initialize all storage directories
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await fs.ensureDir(this.baseDir);
      await Promise.all([
        this.domStore.initialize(),
        this.screenshotStore.initialize(),
        this.consoleStore.initialize(),
        this.checkpointStore.initialize(),
      ]);
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize storage manager: ${error}`);
    }
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ============================================================================
  // DOM Storage Methods
  // ============================================================================

  /**
   * Store DOM HTML
   */
  async storeDOM(html: string, metadata?: Record<string, any>): Promise<StorageRef> {
    await this.ensureInitialized();
    return this.domStore.store(html, metadata);
  }

  /**
   * Retrieve DOM HTML
   */
  async retrieveDOM(ref: StorageRef): Promise<string> {
    await this.ensureInitialized();
    return this.domStore.retrieve(ref);
  }

  /**
   * Query DOM by selector
   */
  async queryDOMBySelector(ref: StorageRef, selector: string): Promise<any[]> {
    await this.ensureInitialized();
    return this.domStore.queryBySelector(ref, selector);
  }

  /**
   * Query stored DOMs
   */
  async queryDOMs(filter?: DOMQueryFilter): Promise<StorageRef[]> {
    await this.ensureInitialized();
    return this.domStore.query(filter);
  }

  /**
   * Get DOM statistics
   */
  async getDOMStats(ref: StorageRef): Promise<any> {
    await this.ensureInitialized();
    return this.domStore.getStats(ref);
  }

  // ============================================================================
  // Screenshot Storage Methods
  // ============================================================================

  /**
   * Store screenshot
   */
  async storeScreenshot(
    imageBuffer: Buffer | ScreenshotData,
    metadata?: Record<string, any>
  ): Promise<StorageRef> {
    await this.ensureInitialized();
    return this.screenshotStore.store(imageBuffer, metadata);
  }

  /**
   * Retrieve screenshot
   */
  async retrieveScreenshot(ref: StorageRef): Promise<Buffer> {
    await this.ensureInitialized();
    return this.screenshotStore.retrieve(ref);
  }

  /**
   * Retrieve screenshot thumbnail
   */
  async retrieveScreenshotThumbnail(ref: StorageRef): Promise<Buffer> {
    await this.ensureInitialized();
    return this.screenshotStore.retrieveThumbnail(ref);
  }

  /**
   * Compare two screenshots
   */
  async compareScreenshots(
    ref1: StorageRef,
    ref2: StorageRef,
    options?: { threshold?: number; includeAA?: boolean }
  ): Promise<{
    diffPercentage: number;
    diffImage?: Buffer;
    totalPixels: number;
    differentPixels: number;
  }> {
    await this.ensureInitialized();
    return this.screenshotStore.compare(ref1, ref2, options);
  }

  /**
   * Query stored screenshots
   */
  async queryScreenshots(filter?: ScreenshotQueryFilter): Promise<StorageRef[]> {
    await this.ensureInitialized();
    return this.screenshotStore.query(filter);
  }

  /**
   * Resize screenshot
   */
  async resizeScreenshot(ref: StorageRef, width: number, height?: number): Promise<Buffer> {
    await this.ensureInitialized();
    return this.screenshotStore.resize(ref, width, height);
  }

  /**
   * Convert screenshot to different format
   */
  async convertScreenshot(ref: StorageRef, format: 'png' | 'jpeg' | 'webp'): Promise<Buffer> {
    await this.ensureInitialized();
    return this.screenshotStore.convert(ref, format);
  }

  // ============================================================================
  // Console Log Storage Methods
  // ============================================================================

  /**
   * Store console logs
   */
  async storeConsoleLogs(
    entries: ConsoleLogEntry[],
    metadata?: Record<string, any>
  ): Promise<StorageRef> {
    await this.ensureInitialized();
    return this.consoleStore.store(entries, metadata);
  }

  /**
   * Retrieve console logs
   */
  async retrieveConsoleLogs(ref: StorageRef): Promise<ConsoleLogEntry[]> {
    await this.ensureInitialized();
    return this.consoleStore.retrieve(ref);
  }

  /**
   * Get console log errors
   */
  async getConsoleErrors(ref: StorageRef): Promise<ConsoleLogEntry[]> {
    await this.ensureInitialized();
    return this.consoleStore.getErrors(ref);
  }

  /**
   * Get console log warnings
   */
  async getConsoleWarnings(ref: StorageRef): Promise<ConsoleLogEntry[]> {
    await this.ensureInitialized();
    return this.consoleStore.getWarnings(ref);
  }

  /**
   * Get console log summary
   */
  async getConsoleSummary(ref: StorageRef): Promise<any> {
    await this.ensureInitialized();
    return this.consoleStore.getSummary(ref);
  }

  /**
   * Query stored console logs
   */
  async queryConsoleLogs(filter?: ConsoleQueryFilter): Promise<StorageRef[]> {
    await this.ensureInitialized();
    return this.consoleStore.query(filter);
  }

  /**
   * Search console logs by text
   */
  async searchConsoleLogs(
    searchText: string,
    filter?: ConsoleQueryFilter
  ): Promise<{ ref: StorageRef; matches: ConsoleLogEntry[] }[]> {
    await this.ensureInitialized();
    return this.consoleStore.search(searchText, filter);
  }

  // ============================================================================
  // Checkpoint Storage Methods
  // ============================================================================

  /**
   * Create checkpoint
   */
  async createCheckpoint(state: CheckpointState): Promise<StorageRef> {
    await this.ensureInitialized();
    return this.checkpointStore.store(state);
  }

  /**
   * Retrieve checkpoint
   */
  async retrieveCheckpoint(ref: StorageRef): Promise<CheckpointState> {
    await this.ensureInitialized();
    return this.checkpointStore.retrieve(ref);
  }

  /**
   * Update checkpoint
   */
  async updateCheckpoint(ref: StorageRef, updates: Partial<CheckpointState>): Promise<void> {
    await this.ensureInitialized();
    return this.checkpointStore.update(ref, updates);
  }

  /**
   * Get checkpoint by name
   */
  async getCheckpointByName(name: string): Promise<StorageRef | null> {
    await this.ensureInitialized();
    return this.checkpointStore.getByName(name);
  }

  /**
   * Query stored checkpoints
   */
  async queryCheckpoints(filter?: CheckpointQueryFilter): Promise<StorageRef[]> {
    await this.ensureInitialized();
    return this.checkpointStore.query(filter);
  }

  /**
   * Compare two checkpoints
   */
  async compareCheckpoints(ref1: StorageRef, ref2: StorageRef): Promise<any> {
    await this.ensureInitialized();
    return this.checkpointStore.compare(ref1, ref2);
  }

  /**
   * Clone checkpoint
   */
  async cloneCheckpoint(ref: StorageRef, newName: string): Promise<StorageRef> {
    await this.ensureInitialized();
    return this.checkpointStore.clone(ref, newName);
  }

  /**
   * Get checkpoint history for URL
   */
  async getCheckpointHistory(url: string, limit?: number): Promise<StorageRef[]> {
    await this.ensureInitialized();
    return this.checkpointStore.getHistory(url, limit);
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(ref: StorageRef, options?: { deleteRelatedData?: boolean }): Promise<void> {
    await this.ensureInitialized();
    await this.checkpointStore.deleteCheckpoint(ref, options);
  }

  // ============================================================================
  // Composite Operations
  // ============================================================================

  /**
   * Create a complete checkpoint with all data
   */
  async captureCheckpoint(data: {
    name: string;
    url: string;
    html?: string;
    screenshot?: Buffer | ScreenshotData;
    consoleLogs?: ConsoleLogEntry[];
    customData?: Record<string, any>;
    tags?: string[];
    description?: string;
    viewport?: { width: number; height: number };
  }): Promise<StorageRef> {
    await this.ensureInitialized();

    try {
      const state: CheckpointState = {
        name: data.name,
        url: data.url,
        timestamp: Date.now(),
        state: {
          customData: data.customData,
        },
        metadata: {
          description: data.description,
          tags: data.tags,
          viewport: data.viewport,
        },
      };

      // Store DOM if provided
      if (data.html) {
        const domRef = await this.storeDOM(data.html, { url: data.url });
        state.state.domRef = path.basename(domRef.path, '.json');
      }

      // Store screenshot if provided
      if (data.screenshot) {
        const screenshotRef = await this.storeScreenshot(data.screenshot, { url: data.url });
        state.state.screenshotRef = path.basename(screenshotRef.path, '.png');
      }

      // Store console logs if provided
      if (data.consoleLogs && data.consoleLogs.length > 0) {
        const consoleRef = await this.storeConsoleLogs(data.consoleLogs, { url: data.url });
        state.state.consoleRef = path.basename(consoleRef.path, '.json');
      }

      // Create checkpoint
      return await this.createCheckpoint(state);
    } catch (error) {
      throw new Error(`Failed to capture checkpoint: ${error}`);
    }
  }

  /**
   * Load complete checkpoint with all related data
   */
  async loadCheckpoint(ref: StorageRef): Promise<{
    checkpoint: CheckpointState;
    dom?: string;
    screenshot?: Buffer;
    consoleLogs?: ConsoleLogEntry[];
  }> {
    await this.ensureInitialized();

    try {
      const checkpoint = await this.retrieveCheckpoint(ref);
      const result: any = { checkpoint };

      // Load DOM if available
      if (checkpoint.state.domRef) {
        try {
          const domPath = this.domStore['getItemPath'](checkpoint.state.domRef, '.json');
          result.dom = await this.retrieveDOM({
            category: 1 as any, // HTML enum value
            testId: 'default',
            path: domPath,
            size: 0,
            hash: '',
            timestamp: new Date(checkpoint.timestamp).toISOString(),
            compressed: false,
          });
        } catch (error) {
          // Failed to load DOM, skip it
        }
      }

      // Load screenshot if available
      if (checkpoint.state.screenshotRef) {
        try {
          const screenshotPath = this.screenshotStore['getItemPath'](checkpoint.state.screenshotRef, '.png');
          result.screenshot = await this.retrieveScreenshot({
            category: 0 as any, // SCREENSHOT enum value
            testId: 'default',
            path: screenshotPath,
            size: 0,
            hash: '',
            timestamp: new Date(checkpoint.timestamp).toISOString(),
            compressed: false,
          });
        } catch (error) {
          // Failed to load screenshot, skip it
        }
      }

      // Load console logs if available
      if (checkpoint.state.consoleRef) {
        try {
          const consolePath = this.consoleStore['getItemPath'](checkpoint.state.consoleRef, '.json');
          result.consoleLogs = await this.retrieveConsoleLogs({
            category: 2 as any, // CONSOLE_LOG enum value
            testId: 'default',
            path: consolePath,
            size: 0,
            hash: '',
            timestamp: new Date(checkpoint.timestamp).toISOString(),
            compressed: false,
          });
        } catch (error) {
          // Failed to load console logs, skip it
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to load checkpoint: ${error}`);
    }
  }

  // ============================================================================
  // Storage Management Methods
  // ============================================================================

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    await this.ensureInitialized();

    try {
      const [checkpoints, screenshots, doms, consoleLogs] = await Promise.all([
        this.queryCheckpoints(),
        this.queryScreenshots(),
        this.queryDOMs(),
        this.queryConsoleLogs(),
      ]);

      // Calculate total size
      let totalSize = 0;
      const stats = await fs.promises.stat(this.baseDir).catch(() => null);

      // Get directory size recursively
      const getDirSize = async (dirPath: string): Promise<number> => {
        let size = 0;
        try {
          const files = await fs.readdir(dirPath);
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
              size += await getDirSize(filePath);
            } else {
              size += stat.size;
            }
          }
        } catch (error) {
          // Ignore errors
        }
        return size;
      };

      totalSize = await getDirSize(this.baseDir);

      return {
        checkpoints: checkpoints.length,
        screenshots: screenshots.length,
        doms: doms.length,
        consoleLogs: consoleLogs.length,
        totalSize,
        lastModified: stats?.mtimeMs || Date.now(),
      };
    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error}`);
    }
  }

  /**
   * Clean up old storage data
   */
  async cleanup(options?: {
    olderThan?: number; // timestamp
    keepLast?: number; // keep last N items
    types?: ('checkpoint' | 'screenshot' | 'dom' | 'console')[];
  }): Promise<{
    deleted: number;
    freedSpace: number;
  }> {
    await this.ensureInitialized();

    try {
      let deleted = 0;
      let freedSpace = 0;

      const types = options?.types || ['checkpoint', 'screenshot', 'dom', 'console'];

      // Cleanup each type
      for (const type of types) {
        let refs: StorageRef[] = [];

        switch (type) {
          case 'checkpoint':
            refs = await this.queryCheckpoints();
            break;
          case 'screenshot':
            refs = await this.queryScreenshots();
            break;
          case 'dom':
            refs = await this.queryDOMs();
            break;
          case 'console':
            refs = await this.queryConsoleLogs();
            break;
        }

        // Filter by age
        if (options?.olderThan) {
          refs = refs.filter(ref => new Date(ref.timestamp).getTime() < options.olderThan!);
        }

        // Keep last N
        if (options?.keepLast && refs.length > options.keepLast) {
          refs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          refs = refs.slice(options.keepLast);
        }

        // Delete items
        for (const ref of refs) {
          try {
            // Get size before deletion
            const stat = await fs.stat(ref.path).catch(() => null);
            if (stat) {
              freedSpace += stat.size;
            }

            // Delete based on type
            const id = path.basename(ref.path, path.extname(ref.path));
            switch (type) {
              case 'checkpoint':
                await this.checkpointStore.deleteCheckpoint(ref);
                break;
              case 'screenshot':
                await this.screenshotStore.delete(id, '.png');
                break;
              case 'dom':
                await this.domStore.delete(id, '.json');
                break;
              case 'console':
                await this.consoleStore.delete(id, '.json');
                break;
            }

            deleted++;
          } catch (error) {
            // Failed to delete item, continue with others
          }
        }
      }

      return { deleted, freedSpace };
    } catch (error) {
      throw new Error(`Failed to cleanup storage: ${error}`);
    }
  }

  /**
   * Export storage data
   */
  async export(outputPath: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await fs.copy(this.baseDir, outputPath);
    } catch (error) {
      throw new Error(`Failed to export storage: ${error}`);
    }
  }

  /**
   * Import storage data
   */
  async import(inputPath: string, options?: { merge?: boolean }): Promise<void> {
    await this.ensureInitialized();

    try {
      if (options?.merge) {
        // Copy files while preserving existing ones
        await fs.copy(inputPath, this.baseDir, { overwrite: false });
      } else {
        // Replace all data
        await fs.remove(this.baseDir);
        await fs.copy(inputPath, this.baseDir);
      }

      // Re-initialize after import
      this.initialized = false;
      await this.initialize();
    } catch (error) {
      throw new Error(`Failed to import storage: ${error}`);
    }
  }

  /**
   * Clear all storage data
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    try {
      await fs.remove(this.baseDir);
      this.initialized = false;
      await this.initialize();
    } catch (error) {
      throw new Error(`Failed to clear storage: ${error}`);
    }
  }

  /**
   * Get base directory path
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}

// Export all types and classes
export type { StorageRef } from '../core/types.js';
export { DOMStore } from './dom-store.js';
export type { DOMQueryFilter } from './dom-store.js';
export { ScreenshotStore } from './screenshot-store.js';
export type { ScreenshotData, ScreenshotQueryFilter } from './screenshot-store.js';
export { ConsoleStore } from './console-store.js';
export type { ConsoleLogEntry, ConsoleQueryFilter } from './console-store.js';
export { CheckpointStore } from './checkpoint-store.js';
export type { CheckpointState, CheckpointQueryFilter } from './checkpoint-store.js';

// Default export
export default StorageManager;
