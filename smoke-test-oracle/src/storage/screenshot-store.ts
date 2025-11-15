import path from 'path';
import { StorageProvider, StorageConfig } from './storage-provider.js';
import { StorageRef, StorageCategory } from '../core/types.js';
import sharp from 'sharp';

/**
 * Screenshot data
 */
export interface ScreenshotData {
  image: Buffer;
  url?: string;
  viewport?: {
    width: number;
    height: number;
  };
  deviceScaleFactor?: number;
}

/**
 * Screenshot metadata
 */
export interface ScreenshotMetadata {
  url?: string;
  width: number;
  height: number;
  format: string;
  size: number;
  deviceScaleFactor?: number;
  thumbnailId?: string;
}

/**
 * Screenshot query filter
 */
export interface ScreenshotQueryFilter {
  url?: string;
  startTime?: number;
  endTime?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  limit?: number;
}

/**
 * Screenshot storage with thumbnail generation
 */
export class ScreenshotStore extends StorageProvider<Buffer> {
  private readonly thumbnailWidth: number;
  private readonly thumbnailHeight: number;
  private readonly quality: number;

  constructor(config: StorageConfig & {
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    quality?: number;
  }) {
    super(config);
    this.thumbnailWidth = config.thumbnailWidth || 320;
    this.thumbnailHeight = config.thumbnailHeight || 240;
    this.quality = config.quality || 80;
  }

  /**
   * Store screenshot with thumbnail generation
   */
  async store(imageBuffer: Buffer | ScreenshotData, metadata?: Record<string, any>): Promise<StorageRef> {
    try {
      const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : imageBuffer.image;
      const screenshotData = Buffer.isBuffer(imageBuffer) ? undefined : imageBuffer;

      const id = this.generateId('screenshot');

      // Get image metadata
      const imageMetadata = await sharp(buffer).metadata();

      // Store full screenshot
      const screenshotPath = this.getItemPath(id, '.png');
      await this.writeBinary(screenshotPath, buffer);

      // Generate and store thumbnail
      const thumbnailId = await this.generateThumbnail(id, buffer);

      // Create metadata
      const storedMetadata: ScreenshotMetadata = {
        url: metadata?.url || screenshotData?.url,
        width: imageMetadata.width || 0,
        height: imageMetadata.height || 0,
        format: imageMetadata.format || 'png',
        size: buffer.length,
        deviceScaleFactor: metadata?.deviceScaleFactor || screenshotData?.deviceScaleFactor,
        thumbnailId,
      };

      // Store metadata
      await this.storeMetadata(id, storedMetadata);

      // Update index
      await this.updateIndex(id, storedMetadata);

      return this.createRef(
        StorageCategory.SCREENSHOT,
        metadata?.testId || 'default',
        screenshotPath,
        buffer.length,
        {
          stepId: metadata?.stepId,
          tags: {
            url: storedMetadata.url || '',
            width: String(storedMetadata.width),
            height: String(storedMetadata.height),
            format: storedMetadata.format,
            thumbnailId: storedMetadata.thumbnailId || '',
          },
        }
      );
    } catch (error) {
      throw new Error(`Failed to store screenshot: ${error}`);
    }
  }

  /**
   * Retrieve full screenshot by reference
   */
  async retrieve(ref: StorageRef): Promise<Buffer> {
    try {
      return await this.readBinary(ref.path);
    } catch (error) {
      throw new Error(`Failed to retrieve screenshot ${ref.path}: ${error}`);
    }
  }

  /**
   * Retrieve thumbnail by reference
   */
  async retrieveThumbnail(ref: StorageRef): Promise<Buffer> {
    try {
      const thumbnailId = ref.tags?.thumbnailId;
      if (!thumbnailId) {
        throw new Error('No thumbnail available for this screenshot');
      }

      const thumbnailPath = this.getItemPath(thumbnailId, '.png');
      return await this.readBinary(thumbnailPath);
    } catch (error) {
      throw new Error(`Failed to retrieve thumbnail for ${ref.path}: ${error}`);
    }
  }

  /**
   * Get screenshot metadata
   */
  async getScreenshotMetadata(ref: StorageRef): Promise<ScreenshotMetadata> {
    try {
      // Extract id from path (remove directory and extension)
      const id = path.basename(ref.path, '.png');
      const metadata = await super.getMetadata(id);
      if (!metadata) {
        throw new Error('Metadata not found');
      }
      return metadata as ScreenshotMetadata;
    } catch (error) {
      throw new Error(`Failed to get screenshot metadata: ${error}`);
    }
  }

  /**
   * Compare two screenshots and return diff
   */
  async compare(ref1: StorageRef, ref2: StorageRef, options?: {
    threshold?: number;
    includeAA?: boolean;
  }): Promise<{
    diffPercentage: number;
    diffImage?: Buffer;
    totalPixels: number;
    differentPixels: number;
  }> {
    try {
      const [img1, img2] = await Promise.all([
        this.retrieve(ref1),
        this.retrieve(ref2),
      ]);

      // Use sharp to get image info and resize if needed
      const [meta1, meta2] = await Promise.all([
        sharp(img1).metadata(),
        sharp(img2).metadata(),
      ]);

      if (meta1.width !== meta2.width || meta1.height !== meta2.height) {
        throw new Error('Screenshots must have the same dimensions for comparison');
      }

      const width = meta1.width!;
      const height = meta1.height!;

      // Convert to raw pixel data
      const [raw1, raw2] = await Promise.all([
        sharp(img1).raw().toBuffer(),
        sharp(img2).raw().toBuffer(),
      ]);

      // Simple pixel comparison
      let differentPixels = 0;
      const totalPixels = width * height;
      const threshold = options?.threshold || 0.1;

      for (let i = 0; i < raw1.length; i += 3) {
        const r1 = raw1[i];
        const g1 = raw1[i + 1];
        const b1 = raw1[i + 2];
        const r2 = raw2[i];
        const g2 = raw2[i + 1];
        const b2 = raw2[i + 2];

        const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
        if (diff > threshold * 255 * 3) {
          differentPixels++;
        }
      }

      const diffPercentage = (differentPixels / totalPixels) * 100;

      return {
        diffPercentage,
        totalPixels,
        differentPixels,
      };
    } catch (error) {
      throw new Error(`Failed to compare screenshots: ${error}`);
    }
  }

  /**
   * Query stored screenshots
   */
  async query(filter?: ScreenshotQueryFilter): Promise<StorageRef[]> {
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
          refs = refs.filter(ref => new Date(ref.timestamp).getTime() >= filter.startTime!);
        }
        if (filter.endTime) {
          refs = refs.filter(ref => new Date(ref.timestamp).getTime() <= filter.endTime!);
        }
        if (filter.minWidth) {
          refs = refs.filter(ref => Number(ref.tags?.width || 0) >= filter.minWidth!);
        }
        if (filter.maxWidth) {
          refs = refs.filter(ref => Number(ref.tags?.width || 0) <= filter.maxWidth!);
        }
        if (filter.minHeight) {
          refs = refs.filter(ref => Number(ref.tags?.height || 0) >= filter.minHeight!);
        }
        if (filter.maxHeight) {
          refs = refs.filter(ref => Number(ref.tags?.height || 0) <= filter.maxHeight!);
        }
        if (filter.limit) {
          refs = refs.slice(0, filter.limit);
        }
      }

      return refs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      throw new Error(`Failed to query screenshots: ${error}`);
    }
  }

  /**
   * Resize screenshot
   */
  async resize(ref: StorageRef, width: number, height?: number): Promise<Buffer> {
    try {
      const buffer = await this.retrieve(ref);
      const resized = await sharp(buffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer();

      return resized;
    } catch (error) {
      throw new Error(`Failed to resize screenshot: ${error}`);
    }
  }

  /**
   * Convert screenshot to different format
   */
  async convert(ref: StorageRef, format: 'png' | 'jpeg' | 'webp'): Promise<Buffer> {
    try {
      const buffer = await this.retrieve(ref);
      let pipeline = sharp(buffer);

      switch (format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: this.quality });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: this.quality });
          break;
        case 'png':
        default:
          pipeline = pipeline.png();
          break;
      }

      return await pipeline.toBuffer();
    } catch (error) {
      throw new Error(`Failed to convert screenshot to ${format}: ${error}`);
    }
  }

  /**
   * Generate thumbnail for screenshot
   */
  private async generateThumbnail(screenshotId: string, buffer: Buffer): Promise<string> {
    try {
      const thumbnailId = `${screenshotId}_thumb`;
      const thumbnailPath = this.getItemPath(thumbnailId, '.png');

      const thumbnail = await sharp(buffer)
        .resize(this.thumbnailWidth, this.thumbnailHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({ quality: this.quality })
        .toBuffer();

      await this.writeBinary(thumbnailPath, thumbnail);

      return thumbnailId;
    } catch (error) {
      throw new Error(`Failed to generate thumbnail: ${error}`);
    }
  }

  /**
   * Update index for quick queries
   */
  private async updateIndex(id: string, metadata: ScreenshotMetadata): Promise<void> {
    try {
      const indexPath = this.getItemPath('index', '.json');
      let index: Record<string, any> = {};

      if (await this.exists('index', '.json')) {
        index = await this.readJson(indexPath);
      }

      const screenshotPath = this.getItemPath(id, '.png');
      index[id] = this.createRef(
        StorageCategory.SCREENSHOT,
        'default',
        screenshotPath,
        metadata.size,
        {
          tags: {
            url: metadata.url || '',
            width: String(metadata.width),
            height: String(metadata.height),
            format: metadata.format,
            thumbnailId: metadata.thumbnailId || '',
          },
        }
      );

      await this.writeJson(indexPath, index);
    } catch (error) {
      throw new Error(`Failed to update screenshot index: ${error}`);
    }
  }
}
