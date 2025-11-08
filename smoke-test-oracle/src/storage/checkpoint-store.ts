import path from 'path';
import { StorageProvider, StorageConfig } from './storage-provider.js';
import { StorageRef, StorageCategory } from '../core/types.js';

/**
 * Checkpoint state data
 */
export interface CheckpointState {
  name: string;
  url: string;
  timestamp: number;
  state: {
    // DOM reference
    domRef?: string;
    // Screenshot reference
    screenshotRef?: string;
    // Console logs reference
    consoleRef?: string;
    // Network activity reference
    networkRef?: string;
    // Custom state data
    customData?: Record<string, any>;
  };
  metadata: {
    description?: string;
    tags?: string[];
    viewport?: {
      width: number;
      height: number;
    };
    userAgent?: string;
  };
}

/**
 * Checkpoint comparison result
 */
export interface CheckpointComparison {
  checkpoint1: StorageRef;
  checkpoint2: StorageRef;
  differences: {
    dom?: boolean;
    screenshot?: boolean;
    console?: boolean;
    network?: boolean;
    custom?: string[];
  };
  timestamp: number;
}

/**
 * Checkpoint query filter
 */
export interface CheckpointQueryFilter {
  name?: string;
  url?: string;
  tags?: string[];
  startTime?: number;
  endTime?: number;
  hasScreenshot?: boolean;
  hasDOM?: boolean;
  hasConsole?: boolean;
  limit?: number;
}

/**
 * Checkpoint state persistence
 */
export class CheckpointStore extends StorageProvider<CheckpointState> {
  constructor(config: StorageConfig) {
    super(config);
  }

  /**
   * Store checkpoint state
   */
  async store(state: CheckpointState, _metadata?: Record<string, any>): Promise<StorageRef> {
    try {
      const id = this.generateId('checkpoint');

      // Store the checkpoint state
      const filePath = this.getItemPath(id, '.json');
      await this.writeJson(filePath, {
        ...state,
        timestamp: state.timestamp || Date.now(),
      });

      // Update indexes
      await this.updateIndexes(id, state);

      const fileSize = Buffer.byteLength(JSON.stringify(state), 'utf8');

      return this.createRef(
        StorageCategory.METADATA,
        'default',
        filePath,
        fileSize,
        {
          tags: {
            name: state.name,
            url: state.url,
            ...(state.metadata.tags?.reduce((acc, tag) => ({ ...acc, [tag]: 'true' }), {}) || {}),
            hasScreenshot: String(!!state.state.screenshotRef),
            hasDOM: String(!!state.state.domRef),
            hasConsole: String(!!state.state.consoleRef),
          },
        }
      );
    } catch (error) {
      throw new Error(`Failed to store checkpoint: ${error}`);
    }
  }

  /**
   * Retrieve checkpoint state by reference
   */
  async retrieve(ref: StorageRef): Promise<CheckpointState> {
    try {
      return await this.readJson<CheckpointState>(ref.path);
    } catch (error) {
      throw new Error(`Failed to retrieve checkpoint ${ref.path}: ${error}`);
    }
  }

  /**
   * Update checkpoint state
   */
  async update(ref: StorageRef, updates: Partial<CheckpointState>): Promise<void> {
    try {
      const current = await this.retrieve(ref);
      const updated: CheckpointState = {
        ...current,
        ...updates,
        state: {
          ...current.state,
          ...updates.state,
        },
        metadata: {
          ...current.metadata,
          ...updates.metadata,
        },
      };

      await this.writeJson(ref.path, updated);

      // Update indexes if name or tags changed
      if (updates.name || updates.metadata?.tags) {
        const id = path.basename(ref.path, '.json');
        await this.updateIndexes(id, updated);
      }
    } catch (error) {
      throw new Error(`Failed to update checkpoint ${ref.path}: ${error}`);
    }
  }

  /**
   * Get checkpoint by name
   */
  async getByName(name: string): Promise<StorageRef | null> {
    try {
      const nameIndexPath = this.getItemPath('name_index', '.json');
      if (!await this.exists('name_index', '.json')) {
        return null;
      }

      const nameIndex: Record<string, string> = await this.readJson(nameIndexPath);
      const id = nameIndex[name];

      if (!id) {
        return null;
      }

      const metadata = await this.getMetadata(id);
      const filePath = this.getItemPath(id, '.json');
      const fileSize = 0; // Will be filled from metadata if needed

      return this.createRef(
        StorageCategory.METADATA,
        'default',
        filePath,
        fileSize,
        { tags: metadata as Record<string, string> || {} }
      );
    } catch (error) {
      throw new Error(`Failed to get checkpoint by name: ${error}`);
    }
  }

  /**
   * Query stored checkpoints
   */
  async query(filter?: CheckpointQueryFilter): Promise<StorageRef[]> {
    try {
      const indexPath = this.getItemPath('index', '.json');
      if (!await this.exists('index', '.json')) {
        return [];
      }

      const index: Record<string, StorageRef> = await this.readJson(indexPath);
      let refs = Object.values(index);

      // Apply filters
      if (filter) {
        if (filter.name) {
          refs = refs.filter(ref => ref.tags?.name === filter.name);
        }
        if (filter.url) {
          refs = refs.filter(ref => ref.tags?.url === filter.url);
        }
        if (filter.tags && filter.tags.length > 0) {
          refs = refs.filter(ref => {
            return filter.tags!.some(tag => ref.tags?.[tag] === 'true');
          });
        }
        if (filter.startTime) {
          refs = refs.filter(ref => new Date(ref.timestamp).getTime() >= filter.startTime!);
        }
        if (filter.endTime) {
          refs = refs.filter(ref => new Date(ref.timestamp).getTime() <= filter.endTime!);
        }
        if (filter.hasScreenshot !== undefined) {
          refs = refs.filter(ref => (ref.tags?.hasScreenshot === 'true') === filter.hasScreenshot);
        }
        if (filter.hasDOM !== undefined) {
          refs = refs.filter(ref => (ref.tags?.hasDOM === 'true') === filter.hasDOM);
        }
        if (filter.hasConsole !== undefined) {
          refs = refs.filter(ref => (ref.tags?.hasConsole === 'true') === filter.hasConsole);
        }
        if (filter.limit) {
          refs = refs.slice(0, filter.limit);
        }
      }

      return refs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      throw new Error(`Failed to query checkpoints: ${error}`);
    }
  }

  /**
   * Query checkpoints by tag
   */
  async queryByTag(tag: string): Promise<StorageRef[]> {
    try {
      const tagIndexPath = this.getItemPath(`tag_index_${tag}`, '.json');
      if (!await this.exists(`tag_index_${tag}`, '.json')) {
        return [];
      }

      const tagIndex: string[] = await this.readJson(tagIndexPath);
      const refs: StorageRef[] = [];

      for (const id of tagIndex) {
        const metadata = await this.getMetadata(id);
        if (metadata) {
          const filePath = this.getItemPath(id, '.json');
          const fileSize = 0; // Will be filled from metadata if needed
          refs.push(this.createRef(
            StorageCategory.METADATA,
            'default',
            filePath,
            fileSize,
            { tags: metadata as Record<string, string> || {} }
          ));
        }
      }

      return refs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      throw new Error(`Failed to query by tag ${tag}: ${error}`);
    }
  }

  /**
   * Compare two checkpoints
   */
  async compare(ref1: StorageRef, ref2: StorageRef): Promise<CheckpointComparison> {
    try {
      const [state1, state2] = await Promise.all([
        this.retrieve(ref1),
        this.retrieve(ref2),
      ]);

      const differences: CheckpointComparison['differences'] = {
        dom: state1.state.domRef !== state2.state.domRef,
        screenshot: state1.state.screenshotRef !== state2.state.screenshotRef,
        console: state1.state.consoleRef !== state2.state.consoleRef,
        network: state1.state.networkRef !== state2.state.networkRef,
        custom: [],
      };

      // Compare custom data
      const keys1 = Object.keys(state1.state.customData || {});
      const keys2 = Object.keys(state2.state.customData || {});
      const allKeys = [...new Set([...keys1, ...keys2])];

      for (const key of allKeys) {
        const val1 = state1.state.customData?.[key];
        const val2 = state2.state.customData?.[key];
        if (JSON.stringify(val1) !== JSON.stringify(val2)) {
          differences.custom!.push(key);
        }
      }

      return {
        checkpoint1: ref1,
        checkpoint2: ref2,
        differences,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`Failed to compare checkpoints: ${error}`);
    }
  }

  /**
   * Clone checkpoint with new name
   */
  async clone(ref: StorageRef, newName: string): Promise<StorageRef> {
    try {
      const state = await this.retrieve(ref);
      const clonedState: CheckpointState = {
        ...state,
        name: newName,
        timestamp: Date.now(),
      };

      return await this.store(clonedState);
    } catch (error) {
      throw new Error(`Failed to clone checkpoint: ${error}`);
    }
  }

  /**
   * Get checkpoint history for a URL
   */
  async getHistory(url: string, limit?: number): Promise<StorageRef[]> {
    return this.query({
      url,
      limit,
    });
  }

  /**
   * Get all tags used in checkpoints
   */
  async getAllTags(): Promise<string[]> {
    try {
      const refs = await this.query();
      const tagsSet = new Set<string>();

      for (const ref of refs) {
        if (ref.tags) {
          // Filter out the special tags (name, url, hasScreenshot, hasDOM, hasConsole)
          Object.keys(ref.tags).forEach((tag) => {
            if (!['name', 'url', 'hasScreenshot', 'hasDOM', 'hasConsole'].includes(tag)) {
              tagsSet.add(tag);
            }
          });
        }
      }

      return Array.from(tagsSet).sort();
    } catch (error) {
      throw new Error(`Failed to get all tags: ${error}`);
    }
  }

  /**
   * Delete checkpoint and related data
   */
  async deleteCheckpoint(ref: StorageRef, options?: {
    deleteRelatedData?: boolean;
  }): Promise<void> {
    try {
      // If requested, note related refs for potential cleanup
      if (options?.deleteRelatedData) {
        // Related refs could be retrieved and returned for cleanup by caller
        // Actual deletion would be handled by the storage manager
        // const state = await this.retrieve(ref);
      }

      // Delete the checkpoint file
      const id = path.basename(ref.path, '.json');
      await this.delete(id, '.json');

      // Remove from indexes
      await this.removeFromIndexes(id);
    } catch (error) {
      throw new Error(`Failed to delete checkpoint: ${error}`);
    }
  }

  /**
   * Update all indexes
   */
  private async updateIndexes(id: string, state: CheckpointState): Promise<void> {
    try {
      // Update main index
      await this.updateMainIndex(id, state);

      // Update name index
      await this.updateNameIndex(id, state.name);

      // Update tag indexes
      if (state.metadata.tags) {
        for (const tag of state.metadata.tags) {
          await this.updateTagIndex(id, tag);
        }
      }
    } catch (error) {
      throw new Error(`Failed to update indexes: ${error}`);
    }
  }

  /**
   * Update main index
   */
  private async updateMainIndex(id: string, state: CheckpointState): Promise<void> {
    const indexPath = this.getItemPath('index', '.json');
    let index: Record<string, any> = {};

    if (await this.exists('index', '.json')) {
      index = await this.readJson(indexPath);
    }

    const filePath = this.getItemPath(id, '.json');
    const fileSize = Buffer.byteLength(JSON.stringify(state), 'utf8');

    index[id] = this.createRef(
      StorageCategory.METADATA,
      'default',
      filePath,
      fileSize,
      {
        tags: {
          name: state.name,
          url: state.url,
          ...(state.metadata.tags?.reduce((acc, tag) => ({ ...acc, [tag]: 'true' }), {}) || {}),
          hasScreenshot: String(!!state.state.screenshotRef),
          hasDOM: String(!!state.state.domRef),
          hasConsole: String(!!state.state.consoleRef),
        },
      }
    );

    await this.writeJson(indexPath, index);
  }

  /**
   * Update name index
   */
  private async updateNameIndex(id: string, name: string): Promise<void> {
    const nameIndexPath = this.getItemPath('name_index', '.json');
    let nameIndex: Record<string, string> = {};

    if (await this.exists('name_index', '.json')) {
      nameIndex = await this.readJson(nameIndexPath);
    }

    nameIndex[name] = id;
    await this.writeJson(nameIndexPath, nameIndex);
  }

  /**
   * Update tag index
   */
  private async updateTagIndex(id: string, tag: string): Promise<void> {
    const tagIndexPath = this.getItemPath(`tag_index_${tag}`, '.json');
    let tagIndex: string[] = [];

    if (await this.exists(`tag_index_${tag}`, '.json')) {
      tagIndex = await this.readJson(tagIndexPath);
    }

    if (!tagIndex.includes(id)) {
      tagIndex.push(id);
      await this.writeJson(tagIndexPath, tagIndex);
    }
  }

  /**
   * Remove from all indexes
   */
  private async removeFromIndexes(id: string): Promise<void> {
    try {
      // Remove from main index
      const indexPath = this.getItemPath('index', '.json');
      if (await this.exists('index', '.json')) {
        const index: Record<string, any> = await this.readJson(indexPath);
        delete index[id];
        await this.writeJson(indexPath, index);
      }

      // Note: Tag and name indexes are not cleaned up here for performance
      // They will naturally be filtered out when queried
    } catch (error) {
      // Non-critical error, silently ignore
      // In production, this could be logged to a proper logging system
    }
  }
}
