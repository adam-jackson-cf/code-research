import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';
import { StorageRef, StorageCategory } from '../core/types.js';

// Re-export StorageRef for external use
export type { StorageRef };

/**
 * Base configuration for all storage providers
 */
export interface StorageConfig {
  baseDir: string;
  namespace: string;
}

/**
 * Base storage provider with common functionality
 */
export abstract class StorageProvider<T = any> {
  protected baseDir: string;
  protected namespace: string;
  protected storageDir: string;

  constructor(config: StorageConfig) {
    this.baseDir = config.baseDir;
    this.namespace = config.namespace;
    this.storageDir = path.join(this.baseDir, this.namespace);
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.storageDir);
    } catch (error) {
      throw new Error(`Failed to initialize storage for ${this.namespace}: ${error}`);
    }
  }

  /**
   * Generate a unique ID for storage
   */
  protected generateId(prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  /**
   * Generate a hash for content
   */
  protected generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Get the full path for a stored item
   */
  protected getItemPath(id: string, extension: string = '.json'): string {
    return path.join(this.storageDir, `${id}${extension}`);
  }

  /**
   * Write JSON data to file
   */
  protected async writeJson(filePath: string, data: any): Promise<void> {
    try {
      await fs.writeJson(filePath, data, { spaces: 2 });
    } catch (error) {
      throw new Error(`Failed to write JSON to ${filePath}: ${error}`);
    }
  }

  /**
   * Read JSON data from file
   */
  protected async readJson<R = any>(filePath: string): Promise<R> {
    try {
      return await fs.readJson(filePath);
    } catch (error) {
      throw new Error(`Failed to read JSON from ${filePath}: ${error}`);
    }
  }

  /**
   * Write binary data to file
   */
  protected async writeBinary(filePath: string, data: Buffer): Promise<void> {
    try {
      await fs.writeFile(filePath, data);
    } catch (error) {
      throw new Error(`Failed to write binary to ${filePath}: ${error}`);
    }
  }

  /**
   * Read binary data from file
   */
  protected async readBinary(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new Error(`Failed to read binary from ${filePath}: ${error}`);
    }
  }

  /**
   * Check if an item exists
   */
  async exists(id: string, extension: string = '.json'): Promise<boolean> {
    const filePath = this.getItemPath(id, extension);
    return fs.pathExists(filePath);
  }

  /**
   * Delete an item
   */
  async delete(id: string, extension: string = '.json'): Promise<void> {
    try {
      const filePath = this.getItemPath(id, extension);
      await fs.remove(filePath);
    } catch (error) {
      throw new Error(`Failed to delete item ${id}: ${error}`);
    }
  }

  /**
   * List all items in storage
   */
  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.storageDir);
      return files.filter((f: string) => !f.startsWith('.'));
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to list items in ${this.namespace}: ${error}`);
    }
  }

  /**
   * Get metadata for an item
   */
  protected async getMetadata(id: string): Promise<Record<string, any> | null> {
    const metaPath = this.getItemPath(`${id}.meta`, '.json');
    if (await fs.pathExists(metaPath)) {
      return this.readJson(metaPath);
    }
    return null;
  }

  /**
   * Store metadata for an item
   */
  protected async storeMetadata(id: string, metadata: Record<string, any>): Promise<void> {
    const metaPath = this.getItemPath(`${id}.meta`, '.json');
    await this.writeJson(metaPath, metadata);
  }

  /**
   * Create a storage reference
   */
  protected createRef(
    category: StorageCategory,
    testId: string,
    path: string,
    size: number,
    options?: {
      stepId?: string;
      hash?: string;
      compressed?: boolean;
      tags?: Record<string, string>;
    }
  ): StorageRef {
    return {
      category,
      testId,
      stepId: options?.stepId,
      path,
      size,
      hash: options?.hash || this.generateHash(path),
      timestamp: new Date().toISOString(),
      compressed: options?.compressed || false,
      tags: options?.tags,
    };
  }

  /**
   * Store data and return a reference
   */
  abstract store(data: T, metadata?: Record<string, any>): Promise<StorageRef>;

  /**
   * Retrieve data by reference
   */
  abstract retrieve(ref: StorageRef): Promise<T>;

  /**
   * Query stored items
   */
  abstract query(filter?: any): Promise<StorageRef[]>;
}
