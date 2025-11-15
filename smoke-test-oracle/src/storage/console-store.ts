import { StorageProvider, StorageConfig } from './storage-provider.js';
import { StorageRef, StorageCategory } from '../core/types.js';

/**
 * Console log entry
 */
export interface ConsoleLogEntry {
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  args?: any[];
  stackTrace?: string;
  source?: {
    url?: string;
    line?: number;
    column?: number;
  };
}

/**
 * Console log collection
 */
interface ConsoleLogCollection {
  url: string;
  startTime: number;
  endTime: number;
  entries: ConsoleLogEntry[];
  summary: {
    total: number;
    byLevel: Record<string, number>;
    errorCount: number;
    warningCount: number;
  };
}

/**
 * Console query filter
 */
export interface ConsoleQueryFilter {
  url?: string;
  level?: ConsoleLogEntry['level'] | ConsoleLogEntry['level'][];
  startTime?: number;
  endTime?: number;
  hasErrors?: boolean;
  hasWarnings?: boolean;
  searchText?: string;
  limit?: number;
}

/**
 * Console log storage with indexing by error level
 */
export class ConsoleStore extends StorageProvider<ConsoleLogEntry[]> {
  constructor(config: StorageConfig) {
    super(config);
  }

  /**
   * Store console logs with indexing
   */
  async store(entries: ConsoleLogEntry[], metadata?: Record<string, any>): Promise<StorageRef> {
    try {
      const id = this.generateId('console');

      // Create collection
      const collection: ConsoleLogCollection = {
        url: metadata?.url || '',
        startTime: entries.length > 0 ? entries[0].timestamp : Date.now(),
        endTime: entries.length > 0 ? entries[entries.length - 1].timestamp : Date.now(),
        entries,
        summary: this.generateSummary(entries),
      };

      // Store the collection
      const filePath = this.getItemPath(id, '.json');
      await this.writeJson(filePath, collection);

      // Update indexes
      await this.updateIndexes(id, collection);

      const fileSize = Buffer.byteLength(JSON.stringify(collection), 'utf8');

      return this.createRef(
        StorageCategory.CONSOLE_LOG,
        metadata?.testId || 'default',
        filePath,
        fileSize,
        {
          stepId: metadata?.stepId,
          tags: {
            url: collection.url,
            entryCount: String(entries.length),
            errorCount: String(collection.summary.errorCount),
            warningCount: String(collection.summary.warningCount),
            startTime: String(collection.startTime),
            endTime: String(collection.endTime),
          },
        }
      );
    } catch (error) {
      throw new Error(`Failed to store console logs: ${error}`);
    }
  }

  /**
   * Retrieve all console logs by reference
   */
  async retrieve(ref: StorageRef): Promise<ConsoleLogEntry[]> {
    try {
      const collection: ConsoleLogCollection = await this.readJson(ref.path);
      return collection.entries;
    } catch (error) {
      throw new Error(`Failed to retrieve console logs ${ref.path}: ${error}`);
    }
  }

  /**
   * Retrieve console logs with filtering
   */
  async retrieveFiltered(ref: StorageRef, filter: ConsoleQueryFilter): Promise<ConsoleLogEntry[]> {
    try {
      const entries = await this.retrieve(ref);
      return this.filterEntries(entries, filter);
    } catch (error) {
      throw new Error(`Failed to retrieve filtered console logs: ${error}`);
    }
  }

  /**
   * Get only errors from a collection
   */
  async getErrors(ref: StorageRef): Promise<ConsoleLogEntry[]> {
    return this.retrieveFiltered(ref, { level: 'error' });
  }

  /**
   * Get only warnings from a collection
   */
  async getWarnings(ref: StorageRef): Promise<ConsoleLogEntry[]> {
    return this.retrieveFiltered(ref, { level: 'warn' });
  }

  /**
   * Get console log summary
   */
  async getSummary(ref: StorageRef): Promise<ConsoleLogCollection['summary']> {
    try {
      const collection: ConsoleLogCollection = await this.readJson(ref.path);
      return collection.summary;
    } catch (error) {
      throw new Error(`Failed to get console log summary: ${error}`);
    }
  }

  /**
   * Query stored console logs
   */
  async query(filter?: ConsoleQueryFilter): Promise<StorageRef[]> {
    try {
      const indexPath = this.getItemPath('index', '.json');
      if (!await this.exists('index', '.json')) {
        return [];
      }

      const index: Record<string, StorageRef> = await this.readJson(indexPath);
      let refs = Object.values(index);

      // Apply filters
      if (filter) {
        if (filter.url) {
          refs = refs.filter(ref => ref.tags?.url === filter.url);
        }
        if (filter.startTime) {
          refs = refs.filter(ref =>
            Number(ref.tags?.endTime || 0) >= filter.startTime!
          );
        }
        if (filter.endTime) {
          refs = refs.filter(ref =>
            Number(ref.tags?.startTime || 0) <= filter.endTime!
          );
        }
        if (filter.hasErrors) {
          refs = refs.filter(ref => Number(ref.tags?.errorCount || 0) > 0);
        }
        if (filter.hasWarnings) {
          refs = refs.filter(ref => Number(ref.tags?.warningCount || 0) > 0);
        }
        if (filter.limit) {
          refs = refs.slice(0, filter.limit);
        }
      }

      return refs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      throw new Error(`Failed to query console logs: ${error}`);
    }
  }

  /**
   * Query by error level using index
   */
  async queryByLevel(level: ConsoleLogEntry['level']): Promise<StorageRef[]> {
    try {
      const levelIndexPath = this.getItemPath(`level_index_${level}`, '.json');
      if (!await this.exists(`level_index_${level}`, '.json')) {
        return [];
      }

      const levelIndex: string[] = await this.readJson(levelIndexPath);
      const refs: StorageRef[] = [];

      for (const id of levelIndex) {
        const metadata = await this.getMetadata(id);
        if (metadata) {
          const filePath = this.getItemPath(id, '.json');
          const fileSize = 0; // Will be filled from metadata if needed
          refs.push(this.createRef(
            StorageCategory.CONSOLE_LOG,
            'default',
            filePath,
            fileSize,
            { tags: metadata as Record<string, string> }
          ));
        }
      }

      return refs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      throw new Error(`Failed to query by level ${level}: ${error}`);
    }
  }

  /**
   * Search console logs by text
   */
  async search(searchText: string, filter?: ConsoleQueryFilter): Promise<{
    ref: StorageRef;
    matches: ConsoleLogEntry[];
  }[]> {
    try {
      const refs = await this.query(filter);
      const results: { ref: StorageRef; matches: ConsoleLogEntry[] }[] = [];

      for (const ref of refs) {
        const entries = await this.retrieve(ref);
        const matches = entries.filter(entry =>
          entry.message.toLowerCase().includes(searchText.toLowerCase())
        );

        if (matches.length > 0) {
          results.push({ ref, matches });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to search console logs: ${error}`);
    }
  }

  /**
   * Get statistics across all console logs
   */
  async getGlobalStats(): Promise<{
    totalCollections: number;
    totalEntries: number;
    totalErrors: number;
    totalWarnings: number;
    byLevel: Record<string, number>;
  }> {
    try {
      const refs = await this.query();
      let totalEntries = 0;
      let totalErrors = 0;
      let totalWarnings = 0;
      const byLevel: Record<string, number> = {
        log: 0,
        info: 0,
        warn: 0,
        error: 0,
        debug: 0,
      };

      for (const ref of refs) {
        totalEntries += Number(ref.tags?.entryCount || 0);
        totalErrors += Number(ref.tags?.errorCount || 0);
        totalWarnings += Number(ref.tags?.warningCount || 0);

        const summary = await this.getSummary(ref);
        for (const [level, count] of Object.entries(summary.byLevel)) {
          byLevel[level] = (byLevel[level] || 0) + count;
        }
      }

      return {
        totalCollections: refs.length,
        totalEntries,
        totalErrors,
        totalWarnings,
        byLevel,
      };
    } catch (error) {
      throw new Error(`Failed to get global stats: ${error}`);
    }
  }

  /**
   * Generate summary from entries
   */
  private generateSummary(entries: ConsoleLogEntry[]): ConsoleLogCollection['summary'] {
    const byLevel: Record<string, number> = {
      log: 0,
      info: 0,
      warn: 0,
      error: 0,
      debug: 0,
    };

    let errorCount = 0;
    let warningCount = 0;

    for (const entry of entries) {
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
      if (entry.level === 'error') errorCount++;
      if (entry.level === 'warn') warningCount++;
    }

    return {
      total: entries.length,
      byLevel,
      errorCount,
      warningCount,
    };
  }

  /**
   * Filter entries based on criteria
   */
  private filterEntries(entries: ConsoleLogEntry[], filter: ConsoleQueryFilter): ConsoleLogEntry[] {
    let filtered = entries;

    if (filter.level) {
      const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
      filtered = filtered.filter(entry => levels.includes(entry.level));
    }

    if (filter.startTime) {
      filtered = filtered.filter(entry => entry.timestamp >= filter.startTime!);
    }

    if (filter.endTime) {
      filtered = filtered.filter(entry => entry.timestamp <= filter.endTime!);
    }

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.message.toLowerCase().includes(searchLower)
      );
    }

    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Update all indexes
   */
  private async updateIndexes(id: string, collection: ConsoleLogCollection): Promise<void> {
    try {
      // Update main index
      await this.updateMainIndex(id, collection);

      // Update level indexes
      for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
        const count = collection.summary.byLevel[level] || 0;
        if (count > 0) {
          await this.updateLevelIndex(id, level as ConsoleLogEntry['level']);
        }
      }

      // Update error index if has errors
      if (collection.summary.errorCount > 0) {
        await this.updateErrorIndex(id, collection);
      }
    } catch (error) {
      throw new Error(`Failed to update indexes: ${error}`);
    }
  }

  /**
   * Update main index
   */
  private async updateMainIndex(id: string, collection: ConsoleLogCollection): Promise<void> {
    const indexPath = this.getItemPath('index', '.json');
    let index: Record<string, any> = {};

    if (await this.exists('index', '.json')) {
      index = await this.readJson(indexPath);
    }

    const filePath = this.getItemPath(id, '.json');
    const fileSize = Buffer.byteLength(JSON.stringify(collection), 'utf8');

    index[id] = this.createRef(
      StorageCategory.CONSOLE_LOG,
      'default',
      filePath,
      fileSize,
      {
        tags: {
          url: collection.url,
          entryCount: String(collection.entries.length),
          errorCount: String(collection.summary.errorCount),
          warningCount: String(collection.summary.warningCount),
          startTime: String(collection.startTime),
          endTime: String(collection.endTime),
        },
      }
    );

    await this.writeJson(indexPath, index);
  }

  /**
   * Update level-specific index
   */
  private async updateLevelIndex(id: string, level: ConsoleLogEntry['level']): Promise<void> {
    const levelIndexPath = this.getItemPath(`level_index_${level}`, '.json');
    let levelIndex: string[] = [];

    if (await this.exists(`level_index_${level}`, '.json')) {
      levelIndex = await this.readJson(levelIndexPath);
    }

    if (!levelIndex.includes(id)) {
      levelIndex.push(id);
      await this.writeJson(levelIndexPath, levelIndex);
    }
  }

  /**
   * Update error index for quick error queries
   */
  private async updateErrorIndex(id: string, collection: ConsoleLogCollection): Promise<void> {
    const errorIndexPath = this.getItemPath('error_index', '.json');
    let errorIndex: Record<string, any> = {};

    if (await this.exists('error_index', '.json')) {
      errorIndex = await this.readJson(errorIndexPath);
    }

    errorIndex[id] = {
      url: collection.url,
      errorCount: collection.summary.errorCount,
      timestamp: collection.startTime,
      errors: collection.entries
        .filter(e => e.level === 'error')
        .map(e => ({
          message: e.message,
          timestamp: e.timestamp,
          source: e.source,
        })),
    };

    await this.writeJson(errorIndexPath, errorIndex);
  }
}
