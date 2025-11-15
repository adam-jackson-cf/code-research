/**
 * Visual diff engine for image comparison using Pixelmatch
 */

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import {
  DiffOptions,
  DiffResult,
  StorageRef,
  VisualRegion,
  StorageCategory,
  StorageMetadata,
  StorageProvider,
} from '../core/types.js';

/**
 * Visual comparison engine for screenshot validation
 */
export class VisualDiffEngine {
  private storage: StorageProvider;
  private defaultThreshold: number;

  constructor(storage: StorageProvider, options?: { defaultThreshold?: number }) {
    this.storage = storage;
    this.defaultThreshold = options?.defaultThreshold ?? 0.1;
  }

  /**
   * Compare two images and return diff result
   */
  async compare(
    baselineRef: StorageRef | Buffer,
    currentRef: StorageRef | Buffer,
    options?: DiffOptions
  ): Promise<DiffResult> {
    try {
      // Load images
      const [baselineBuffer, currentBuffer] = await Promise.all([
        this.loadImage(baselineRef),
        this.loadImage(currentRef),
      ]);

      // Parse PNG images
      const baseline = PNG.sync.read(baselineBuffer);
      const current = PNG.sync.read(currentBuffer);

      // Validate dimensions
      if (baseline.width !== current.width || baseline.height !== current.height) {
        // Attempt to resize current to match baseline
        const resizedCurrent = await this.resizeImage(
          currentBuffer,
          baseline.width,
          baseline.height
        );
        return this.compare(baselineRef, resizedCurrent, options);
      }

      const width = baseline.width;
      const height = baseline.height;

      // Create diff image
      const diff = new PNG({ width, height });

      // Apply region masks if specified
      const { maskedBaseline, maskedCurrent } = this.applyRegionMasks(
        baseline,
        current,
        options
      );

      // Configure pixelmatch options
      const threshold = options?.threshold ?? this.defaultThreshold;
      const includeAA = options?.antialiasing ?? true;
      const diffColorOption = options?.diffColor ?? { r: 255, g: 0, b: 0 };
      const diffColor: [number, number, number] = [
        diffColorOption.r,
        diffColorOption.g,
        diffColorOption.b,
      ];

      // Perform pixel comparison
      const diffPixels = pixelmatch(
        maskedBaseline.data,
        maskedCurrent.data,
        diff.data,
        width,
        height,
        {
          threshold,
          includeAA,
          diffColor,
          diffColorAlt: diffColor,
        }
      );

      const totalPixels = width * height;
      const diffPercentage = (diffPixels / totalPixels) * 100;
      const passed = diffPercentage <= (threshold * 100);

      // Calculate diff bounds
      const diffBounds = this.calculateDiffBounds(diff.data, width, height, diffColorOption);

      // Generate diff image reference if requested
      let diffImageRef: StorageRef | undefined;
      if (options?.includeDiffImage) {
        const diffBuffer = PNG.sync.write(diff);
        diffImageRef = await this.storage.store(
          StorageCategory.VISUAL_DIFF,
          diffBuffer,
          {
            testId: this.getTestId(baselineRef, currentRef),
            contentType: 'image/png',
            encoding: 'binary',
            description: 'Visual diff comparison result',
            tags: {
              diffPercentage: diffPercentage.toFixed(2),
              passed: passed.toString(),
            },
          } as Partial<StorageMetadata>
        );
      }

      // Perform detailed analysis
      const analysis = this.analyzeSignificantRegions(
        diff.data,
        width,
        height,
        diffColorOption,
        options
      );

      const result: DiffResult = {
        passed,
        diffPercentage,
        diffPixels,
        totalPixels,
        diffImageRef,
        diffBounds,
        analysis,
      };

      return result;
    } catch (error) {
      throw new Error(`Visual diff comparison failed: ${error}`);
    }
  }

  /**
   * Compare a specific region of two images
   */
  async compareRegion(
    baselineRef: StorageRef | Buffer,
    currentRef: StorageRef | Buffer,
    region: VisualRegion,
    options?: DiffOptions
  ): Promise<DiffResult> {
    // Load and crop images to the specified region
    const [baselineBuffer, currentBuffer] = await Promise.all([
      this.loadImage(baselineRef),
      this.loadImage(currentRef),
    ]);

    const baselineMeta = await sharp(baselineBuffer).metadata();

    const regionCoords = this.normalizeRegion(
      region,
      baselineMeta.width!,
      baselineMeta.height!
    );

    const [croppedBaseline, croppedCurrent] = await Promise.all([
      this.cropImage(baselineBuffer, regionCoords),
      this.cropImage(currentBuffer, regionCoords),
    ]);

    return this.compare(croppedBaseline, croppedCurrent, options);
  }

  /**
   * Load image from StorageRef or Buffer
   */
  private async loadImage(source: StorageRef | Buffer): Promise<Buffer> {
    if (Buffer.isBuffer(source)) {
      return source;
    }

    return this.storage.retrieve(source) as Promise<Buffer>;
  }

  /**
   * Resize image to specified dimensions
   */
  private async resizeImage(
    buffer: Buffer,
    width: number,
    height: number
  ): Promise<Buffer> {
    return sharp(buffer)
      .resize(width, height, { fit: 'fill' })
      .png()
      .toBuffer();
  }

  /**
   * Crop image to specified region
   */
  private async cropImage(
    buffer: Buffer,
    region: { x: number; y: number; width: number; height: number }
  ): Promise<Buffer> {
    return sharp(buffer)
      .extract({
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height,
      })
      .png()
      .toBuffer();
  }

  /**
   * Apply region masks to images based on include/exclude regions
   */
  private applyRegionMasks(
    baseline: PNG,
    current: PNG,
    options?: DiffOptions
  ): { maskedBaseline: PNG; maskedCurrent: PNG } {
    if (!options?.excludeRegions || options.excludeRegions.length === 0) {
      return { maskedBaseline: baseline, maskedCurrent: current };
    }

    const maskedBaseline = new PNG({ width: baseline.width, height: baseline.height });
    const maskedCurrent = new PNG({ width: current.width, height: current.height });

    maskedBaseline.data = Buffer.from(baseline.data);
    maskedCurrent.data = Buffer.from(current.data);

    // Mask excluded regions (make them identical to avoid diff)
    for (const region of options.excludeRegions) {
      const normalized = this.normalizeRegion(region, baseline.width, baseline.height);
      this.maskRegion(maskedBaseline, maskedCurrent, normalized);
    }

    return { maskedBaseline, maskedCurrent };
  }

  /**
   * Mask a region by making it identical in both images
   */
  private maskRegion(
    png1: PNG,
    png2: PNG,
    region: { x: number; y: number; width: number; height: number }
  ): void {
    const { x, y, width, height } = region;
    const endX = Math.min(x + width, png1.width);
    const endY = Math.min(y + height, png1.height);

    for (let row = y; row < endY; row++) {
      for (let col = x; col < endX; col++) {
        const idx = (png1.width * row + col) << 2;
        // Set both images to neutral gray in this region
        png1.data[idx] = png1.data[idx + 1] = png1.data[idx + 2] = 128;
        png1.data[idx + 3] = 255;
        png2.data[idx] = png2.data[idx + 1] = png2.data[idx + 2] = 128;
        png2.data[idx + 3] = 255;
      }
    }
  }

  /**
   * Convert region with percentage or pixel values to absolute pixels
   */
  private normalizeRegion(
    region: VisualRegion,
    imageWidth: number,
    imageHeight: number
  ): { x: number; y: number; width: number; height: number } {
    const normalize = (value: number | string, max: number): number => {
      if (typeof value === 'string' && value.endsWith('%')) {
        const percentage = parseFloat(value);
        return Math.round((percentage / 100) * max);
      }
      return typeof value === 'number' ? value : parseInt(value, 10);
    };

    return {
      x: normalize(region.x, imageWidth),
      y: normalize(region.y, imageHeight),
      width: normalize(region.width, imageWidth),
      height: normalize(region.height, imageHeight),
    };
  }

  /**
   * Calculate bounding box of differences
   */
  private calculateDiffBounds(
    diffData: Buffer,
    width: number,
    height: number,
    diffColor: { r: number; g: number; b: number }
  ): { x: number; y: number; width: number; height: number } | undefined {
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasDiff = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        const r = diffData[idx];
        const g = diffData[idx + 1];
        const b = diffData[idx + 2];

        // Check if this pixel is a diff pixel (matches diff color)
        if (
          Math.abs(r - diffColor.r) < 10 &&
          Math.abs(g - diffColor.g) < 10 &&
          Math.abs(b - diffColor.b) < 10
        ) {
          hasDiff = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasDiff) {
      return undefined;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * Analyze significant regions with differences
   */
  private analyzeSignificantRegions(
    diffData: Buffer,
    width: number,
    height: number,
    diffColor: { r: number; g: number; b: number },
    _options?: DiffOptions
  ): DiffResult['analysis'] {
    const gridSize = 50; // Divide image into 50x50 pixel regions
    const regions: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      diffPercentage: number;
    }> = [];

    for (let y = 0; y < height; y += gridSize) {
      for (let x = 0; x < width; x += gridSize) {
        const regionWidth = Math.min(gridSize, width - x);
        const regionHeight = Math.min(gridSize, height - y);
        let diffPixels = 0;
        const totalPixels = regionWidth * regionHeight;

        for (let ry = y; ry < y + regionHeight; ry++) {
          for (let rx = x; rx < x + regionWidth; rx++) {
            const idx = (width * ry + rx) << 2;
            const r = diffData[idx];
            const g = diffData[idx + 1];
            const b = diffData[idx + 2];

            if (
              Math.abs(r - diffColor.r) < 10 &&
              Math.abs(g - diffColor.g) < 10 &&
              Math.abs(b - diffColor.b) < 10
            ) {
              diffPixels++;
            }
          }
        }

        const diffPercentage = (diffPixels / totalPixels) * 100;
        if (diffPercentage > 5) {
          // Only include regions with >5% difference
          regions.push({
            x,
            y,
            width: regionWidth,
            height: regionHeight,
            diffPercentage,
          });
        }
      }
    }

    return {
      significantRegions: regions.sort((a, b) => b.diffPercentage - a.diffPercentage),
    };
  }

  /**
   * Get test ID from StorageRef or generate one
   */
  private getTestId(
    ref1: StorageRef | Buffer,
    ref2: StorageRef | Buffer
  ): string {
    if (!Buffer.isBuffer(ref1) && 'testId' in ref1) {
      return ref1.testId;
    }
    if (!Buffer.isBuffer(ref2) && 'testId' in ref2) {
      return ref2.testId;
    }
    return `visual-diff-${Date.now()}`;
  }
}
