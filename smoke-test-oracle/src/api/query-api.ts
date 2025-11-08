/**
 * Query API
 *
 * High-level API for querying stored test data.
 * Provides convenient methods to search and filter test artifacts.
 */

import type {
  StorageRef,
} from '../core/types.js';
import { StorageCategory } from '../core/types.js';
import type { StorageManager } from '../storage/index.js';
import type {
  DOMQueryFilter,
  ScreenshotQueryFilter,
  ConsoleQueryFilter,
  CheckpointQueryFilter,
} from '../storage/index.js';

/**
 * Query API configuration
 */
export interface QueryApiConfig {
  storage: StorageManager;
}

/**
 * Query result with metadata
 */
export interface QueryResult<T = any> {
  refs: StorageRef[];
  total: number;
  data?: T[];
}

/**
 * Time range filter
 */
export interface TimeRange {
  start: Date | string | number;
  end: Date | string | number;
}

/**
 * Query API class
 */
export class QueryApi {
  private storage: StorageManager;

  constructor(config: QueryApiConfig) {
    this.storage = config.storage;
  }

  /**
   * Query checkpoints
   */
  async checkpoints(filter?: CheckpointQueryFilter): Promise<QueryResult<any>> {
    try {
      const refs = await this.storage.queryCheckpoints(filter);
      return {
        refs,
        total: refs.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to query checkpoints: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Query screenshots
   */
  async screenshots(filter?: ScreenshotQueryFilter): Promise<QueryResult> {
    try {
      const refs = await this.storage.queryScreenshots(filter);
      return {
        refs,
        total: refs.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to query screenshots: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Query DOM snapshots
   */
  async doms(filter?: DOMQueryFilter): Promise<QueryResult> {
    try {
      const refs = await this.storage.queryDOMs(filter);
      return {
        refs,
        total: refs.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to query DOM snapshots: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Query console logs
   */
  async consoleLogs(filter?: ConsoleQueryFilter): Promise<QueryResult> {
    try {
      const refs = await this.storage.queryConsoleLogs(filter);
      return {
        refs,
        total: refs.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to query console logs: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Query by test ID
   */
  async byTestId(testId: string, category?: StorageCategory): Promise<QueryResult> {
    try {
      let refs: StorageRef[] = [];

      if (!category) {
        // Query all categories
        const [checkpoints, screenshots, doms, consoleLogs] = await Promise.all([
          this.storage.queryCheckpoints({ limit: undefined }),
          this.storage.queryScreenshots(),
          this.storage.queryDOMs(),
          this.storage.queryConsoleLogs(),
        ]);

        refs = [...checkpoints, ...screenshots, ...doms, ...consoleLogs];
      } else {
        // Query specific category
        switch (category) {
          case StorageCategory.METADATA:
            refs = await this.storage.queryCheckpoints();
            break;
          case StorageCategory.SCREENSHOT:
            refs = await this.storage.queryScreenshots();
            break;
          case StorageCategory.HTML:
            refs = await this.storage.queryDOMs();
            break;
          case StorageCategory.CONSOLE_LOG:
            refs = await this.storage.queryConsoleLogs();
            break;
          default:
            refs = [];
        }
      }

      // Filter by testId
      refs = refs.filter(ref => ref.tags?.testId === testId);

      return {
        refs,
        total: refs.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to query by test ID: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Query by time range
   */
  async byTimeRange(
    range: TimeRange,
    category?: StorageCategory
  ): Promise<QueryResult> {
    try {
      const startTime = this.normalizeTimestamp(range.start);
      const endTime = this.normalizeTimestamp(range.end);

      let refs: StorageRef[] = [];

      if (!category) {
        // Query all categories
        const [checkpoints, screenshots, doms, consoleLogs] = await Promise.all([
          this.storage.queryCheckpoints({ startTime, endTime }),
          this.storage.queryScreenshots(),
          this.storage.queryDOMs(),
          this.storage.queryConsoleLogs(),
        ]);

        refs = [...checkpoints, ...screenshots, ...doms, ...consoleLogs];
      } else {
        // Query specific category
        switch (category) {
          case StorageCategory.METADATA:
            refs = await this.storage.queryCheckpoints({ startTime, endTime });
            break;
          case StorageCategory.SCREENSHOT:
            refs = await this.storage.queryScreenshots();
            break;
          case StorageCategory.HTML:
            refs = await this.storage.queryDOMs();
            break;
          case StorageCategory.CONSOLE_LOG:
            refs = await this.storage.queryConsoleLogs();
            break;
          default:
            refs = [];
        }
      }

      // Additional time filtering for categories that don't support it natively
      refs = refs.filter(ref => {
        const timestamp = new Date(ref.timestamp).getTime();
        return timestamp >= startTime && timestamp <= endTime;
      });

      return {
        refs,
        total: refs.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to query by time range: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Query by tags
   */
  async byTags(tags: string[]): Promise<QueryResult> {
    try {
      const refs = await this.storage.queryCheckpoints({ tags });
      return {
        refs,
        total: refs.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to query by tags: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Search console logs by text
   */
  async searchConsole(
    searchText: string,
    filter?: ConsoleQueryFilter
  ): Promise<QueryResult<any>> {
    try {
      const results = await this.storage.searchConsoleLogs(searchText, filter);

      const refs = results.map(r => r.ref);
      const data = results.map(r => r.matches);

      return {
        refs,
        total: refs.length,
        data,
      };
    } catch (error) {
      throw new Error(
        `Failed to search console logs: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    checkpoints: number;
    screenshots: number;
    doms: number;
    consoleLogs: number;
    totalSize: number;
    lastModified: number;
  }> {
    try {
      return await this.storage.getStats();
    } catch (error) {
      throw new Error(
        `Failed to get storage stats: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Find duplicates (e.g., identical screenshots or DOM snapshots)
   */
  async findDuplicates(category: StorageCategory): Promise<Map<string, StorageRef[]>> {
    try {
      let refs: StorageRef[] = [];

      switch (category) {
        case StorageCategory.SCREENSHOT:
          refs = await this.storage.queryScreenshots();
          break;
        case StorageCategory.HTML:
          refs = await this.storage.queryDOMs();
          break;
        case StorageCategory.CONSOLE_LOG:
          refs = await this.storage.queryConsoleLogs();
          break;
        default:
          return new Map();
      }

      // Group by hash
      const hashMap = new Map<string, StorageRef[]>();

      for (const ref of refs) {
        const hash = ref.hash || 'no-hash';
        if (!hashMap.has(hash)) {
          hashMap.set(hash, []);
        }
        hashMap.get(hash)!.push(ref);
      }

      // Filter out non-duplicates
      const duplicates = new Map<string, StorageRef[]>();
      for (const [hash, refList] of hashMap.entries()) {
        if (refList.length > 1) {
          duplicates.set(hash, refList);
        }
      }

      return duplicates;
    } catch (error) {
      throw new Error(
        `Failed to find duplicates: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get recent items
   */
  async getRecent(
    category: StorageCategory,
    limit: number = 10
  ): Promise<QueryResult> {
    try {
      let refs: StorageRef[] = [];

      switch (category) {
        case StorageCategory.METADATA:
          refs = await this.storage.queryCheckpoints({ limit });
          break;
        case StorageCategory.SCREENSHOT:
          refs = await this.storage.queryScreenshots();
          break;
        case StorageCategory.HTML:
          refs = await this.storage.queryDOMs();
          break;
        case StorageCategory.CONSOLE_LOG:
          refs = await this.storage.queryConsoleLogs();
          break;
        default:
          refs = [];
      }

      // Sort by timestamp descending and take limit
      refs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      refs = refs.slice(0, limit);

      return {
        refs,
        total: refs.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to get recent items: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Clean up old data
   */
  async cleanup(options?: {
    olderThan?: Date | string | number;
    keepLast?: number;
    categories?: ('checkpoint' | 'screenshot' | 'dom' | 'console')[];
  }): Promise<{
    deleted: number;
    freedSpace: number;
  }> {
    try {
      const cleanupOptions: any = {
        keepLast: options?.keepLast,
        types: options?.categories,
      };

      if (options?.olderThan) {
        cleanupOptions.olderThan = this.normalizeTimestamp(options.olderThan);
      }

      return await this.storage.cleanup(cleanupOptions);
    } catch (error) {
      throw new Error(
        `Failed to cleanup storage: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Helper: Normalize timestamp to number
   */
  private normalizeTimestamp(timestamp: Date | string | number): number {
    if (timestamp instanceof Date) {
      return timestamp.getTime();
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp).getTime();
    }
    return timestamp;
  }
}
