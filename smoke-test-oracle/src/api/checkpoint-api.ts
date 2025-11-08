/**
 * Checkpoint API
 *
 * High-level API for managing checkpoints.
 * Provides methods to create, retrieve, update, and compare checkpoints.
 */

import type {
  StorageRef,
} from '../core/types.js';
import type { StorageManager } from '../storage/index.js';
import type {
  CheckpointQueryFilter,
  CheckpointState,
} from '../storage/checkpoint-store.js';

/**
 * Checkpoint API configuration
 */
export interface CheckpointApiConfig {
  storage: StorageManager;
}

/**
 * Checkpoint comparison result
 */
export interface CheckpointComparisonResult {
  checkpoint1: CheckpointState;
  checkpoint2: CheckpointState;
  differences: {
    screenshot?: {
      different: boolean;
      diffPercentage?: number;
    };
    html?: {
      different: boolean;
      changes?: string[];
    };
    console?: {
      different: boolean;
      newErrors?: number;
      newWarnings?: number;
    };
  };
  timestamp: string;
}

/**
 * Checkpoint API class
 */
export class CheckpointApi {
  private storage: StorageManager;

  constructor(config: CheckpointApiConfig) {
    this.storage = config.storage;
  }

  /**
   * Get checkpoint by name
   */
  async getByName(name: string): Promise<CheckpointState | null> {
    try {
      const ref = await this.storage.getCheckpointByName(name);
      if (!ref) {
        return null;
      }
      return await this.storage.retrieveCheckpoint(ref);
    } catch (error) {
      throw new Error(
        `Failed to get checkpoint by name "${name}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get checkpoint by reference
   */
  async get(ref: StorageRef): Promise<CheckpointState> {
    try {
      return await this.storage.retrieveCheckpoint(ref);
    } catch (error) {
      throw new Error(
        `Failed to get checkpoint: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Query checkpoints
   */
  async query(filter?: CheckpointQueryFilter): Promise<StorageRef[]> {
    try {
      return await this.storage.queryCheckpoints(filter);
    } catch (error) {
      throw new Error(
        `Failed to query checkpoints: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get all checkpoints for a URL
   */
  async getByUrl(url: string, limit?: number): Promise<StorageRef[]> {
    try {
      return await this.storage.getCheckpointHistory(url, limit);
    } catch (error) {
      throw new Error(
        `Failed to get checkpoints for URL "${url}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get checkpoints by tag
   */
  async getByTag(tag: string): Promise<StorageRef[]> {
    try {
      return await this.query({ tags: [tag] });
    } catch (error) {
      throw new Error(
        `Failed to get checkpoints by tag "${tag}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get latest checkpoint
   */
  async getLatest(filter?: CheckpointQueryFilter): Promise<StorageRef | null> {
    try {
      const results = await this.query({ ...filter, limit: 1 });
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      throw new Error(
        `Failed to get latest checkpoint: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Compare two checkpoints
   */
  async compare(
    ref1: StorageRef,
    ref2: StorageRef
  ): Promise<CheckpointComparisonResult> {
    try {
      const [checkpoint1, checkpoint2] = await Promise.all([
        this.storage.retrieveCheckpoint(ref1),
        this.storage.retrieveCheckpoint(ref2),
      ]);

      const differences: CheckpointComparisonResult['differences'] = {};

      // Compare screenshots if both exist
      if (checkpoint1.state.screenshotRef && checkpoint2.state.screenshotRef) {
        differences.screenshot = {
          different: checkpoint1.state.screenshotRef !== checkpoint2.state.screenshotRef,
        };
      }

      // Compare HTML if both exist
      if (checkpoint1.state.domRef && checkpoint2.state.domRef) {
        differences.html = {
          different: checkpoint1.state.domRef !== checkpoint2.state.domRef,
          changes: checkpoint1.state.domRef !== checkpoint2.state.domRef ? ['HTML content differs'] : [],
        };
      }

      // Compare console logs if both exist
      if (checkpoint1.state.consoleRef && checkpoint2.state.consoleRef) {
        differences.console = {
          different: checkpoint1.state.consoleRef !== checkpoint2.state.consoleRef,
        };
      }

      return {
        checkpoint1,
        checkpoint2,
        differences,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to compare checkpoints: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Update a checkpoint
   */
  async update(ref: StorageRef, updates: Partial<CheckpointState>): Promise<void> {
    try {
      await this.storage.updateCheckpoint(ref, updates);
    } catch (error) {
      throw new Error(
        `Failed to update checkpoint: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Delete a checkpoint
   */
  async delete(ref: StorageRef, options?: { deleteRelatedData?: boolean }): Promise<void> {
    try {
      await this.storage.deleteCheckpoint(ref, options);
    } catch (error) {
      throw new Error(
        `Failed to delete checkpoint: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Clone a checkpoint with a new name
   */
  async clone(ref: StorageRef, newName: string): Promise<StorageRef> {
    try {
      return await this.storage.cloneCheckpoint(ref, newName);
    } catch (error) {
      throw new Error(
        `Failed to clone checkpoint: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Load complete checkpoint data including artifacts
   */
  async load(ref: StorageRef): Promise<{
    checkpoint: CheckpointState;
    dom?: string;
    screenshot?: Buffer;
    consoleLogs?: any[];
  }> {
    try {
      return await this.storage.loadCheckpoint(ref);
    } catch (error) {
      throw new Error(
        `Failed to load checkpoint: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get checkpoint statistics
   */
  async getStats(filter?: CheckpointQueryFilter): Promise<{
    total: number;
    withScreenshots: number;
    withHtml: number;
    withConsole: number;
    oldestTimestamp?: string;
    newestTimestamp?: string;
  }> {
    try {
      const checkpoints = await this.query(filter);

      let withScreenshots = 0;
      let withHtml = 0;
      let withConsole = 0;
      let oldestTimestamp: number | undefined;
      let newestTimestamp: number | undefined;

      for (const ref of checkpoints) {
        if (ref.tags?.hasScreenshot === 'true') withScreenshots++;
        if (ref.tags?.hasDOM === 'true') withHtml++;
        if (ref.tags?.hasConsole === 'true') withConsole++;

        const refTime = new Date(ref.timestamp).getTime();
        if (!oldestTimestamp || refTime < oldestTimestamp) {
          oldestTimestamp = refTime;
        }
        if (!newestTimestamp || refTime > newestTimestamp) {
          newestTimestamp = refTime;
        }
      }

      return {
        total: checkpoints.length,
        withScreenshots,
        withHtml,
        withConsole,
        oldestTimestamp: oldestTimestamp
          ? new Date(oldestTimestamp).toISOString()
          : undefined,
        newestTimestamp: newestTimestamp
          ? new Date(newestTimestamp).toISOString()
          : undefined,
      };
    } catch (error) {
      throw new Error(
        `Failed to get checkpoint stats: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
