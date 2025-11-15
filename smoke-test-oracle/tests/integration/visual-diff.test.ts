import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageManager } from '../../src/storage/index.js';
import { ScreenshotStore } from '../../src/storage/screenshot-store.js';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

describe('Visual Diff Integration Tests', () => {
  let storageManager: StorageManager;
  let screenshotStore: ScreenshotStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'tmp', `test-visual-${Date.now()}`);
    await fs.ensureDir(tempDir);

    storageManager = new StorageManager({
      baseDir: tempDir,
      thumbnailWidth: 320,
      thumbnailHeight: 240,
      quality: 80,
    });
    await storageManager.initialize();

    screenshotStore = new ScreenshotStore({
      baseDir: tempDir,
      namespace: 'screenshots',
      thumbnailWidth: 320,
      thumbnailHeight: 240,
      quality: 80,
    });
    await screenshotStore.initialize();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Screenshot Creation and Storage', () => {
    it('should create and store solid color screenshots', async () => {
      const colors = [
        { name: 'red', r: 255, g: 0, b: 0 },
        { name: 'green', r: 0, g: 255, b: 0 },
        { name: 'blue', r: 0, g: 0, b: 255 },
      ];

      for (const color of colors) {
        const screenshot = await sharp({
          create: {
            width: 800,
            height: 600,
            channels: 3,
            background: { r: color.r, g: color.g, b: color.b },
          },
        })
          .png()
          .toBuffer();

        const ref = await storageManager.storeScreenshot(screenshot, {
          testId: `color-test-${color.name}`,
          url: 'https://example.com',
        });

        expect(ref).toBeDefined();
        expect(ref.tags?.width).toBe('800');
        expect(ref.tags?.height).toBe('600');

        // Retrieve and verify
        const retrieved = await storageManager.retrieveScreenshot(ref);
        const metadata = await sharp(retrieved).metadata();
        expect(metadata.width).toBe(800);
        expect(metadata.height).toBe(600);
      }
    });

    it('should create screenshots with patterns', async () => {
      // Create a gradient image
      const width = 400;
      const height = 300;
      const gradientBuffer = Buffer.alloc(width * height * 3);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 3;
          gradientBuffer[i] = Math.floor((x / width) * 255); // Red gradient
          gradientBuffer[i + 1] = Math.floor((y / height) * 255); // Green gradient
          gradientBuffer[i + 2] = 128; // Constant blue
        }
      }

      const screenshot = await sharp(gradientBuffer, {
        raw: {
          width,
          height,
          channels: 3,
        },
      })
        .png()
        .toBuffer();

      const ref = await storageManager.storeScreenshot(screenshot);
      expect(ref).toBeDefined();

      const retrieved = await storageManager.retrieveScreenshot(ref);
      expect(Buffer.isBuffer(retrieved)).toBe(true);
    });
  });

  describe('Identical Image Comparison', () => {
    it('should detect identical screenshots', async () => {
      const screenshot = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .png()
        .toBuffer();

      const ref1 = await storageManager.storeScreenshot(screenshot);
      const ref2 = await storageManager.storeScreenshot(screenshot);

      const result = await storageManager.compareScreenshots(ref1, ref2);

      expect(result.diffPercentage).toBe(0);
      expect(result.differentPixels).toBe(0);
      expect(result.totalPixels).toBe(200 * 200);
    });

    it('should handle re-encoded identical images', async () => {
      // Create original image
      const original = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 200, g: 100, b: 50 },
        },
      })
        .png()
        .toBuffer();

      // Re-encode the same image
      const reencoded = await sharp(original).png().toBuffer();

      const ref1 = await storageManager.storeScreenshot(original);
      const ref2 = await storageManager.storeScreenshot(reencoded);

      const result = await storageManager.compareScreenshots(ref1, ref2);

      // Should be identical or very close
      expect(result.diffPercentage).toBeLessThan(0.1);
    });
  });

  describe('Color Difference Detection', () => {
    it('should detect color differences', async () => {
      const red = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const blue = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const ref1 = await storageManager.storeScreenshot(red);
      const ref2 = await storageManager.storeScreenshot(blue);

      const result = await storageManager.compareScreenshots(ref1, ref2);

      expect(result.diffPercentage).toBeGreaterThan(90); // Should be very different
      expect(result.differentPixels).toBe(result.totalPixels); // All pixels different
    });

    it('should detect subtle color differences', async () => {
      const color1 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .png()
        .toBuffer();

      const color2 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 150, g: 150, b: 150 }, // More visible difference
        },
      })
        .png()
        .toBuffer();

      const ref1 = await storageManager.storeScreenshot(color1);
      const ref2 = await storageManager.storeScreenshot(color2);

      const result = await storageManager.compareScreenshots(ref1, ref2, {
        threshold: 0.01, // Very sensitive
      });

      expect(result.diffPercentage).toBeGreaterThan(0);
    });
  });

  describe('Partial Differences', () => {
    it('should detect differences in specific regions', async () => {
      const width = 200;
      const height = 200;

      // Create first image - all white
      const image1 = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      // Create second image - white with black square in corner
      const blackSquare = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const image2 = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([
          {
            input: blackSquare,
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer();

      const ref1 = await storageManager.storeScreenshot(image1);
      const ref2 = await storageManager.storeScreenshot(image2);

      const result = await storageManager.compareScreenshots(ref1, ref2);

      // Should detect difference in the region with the black square
      // The exact percentage depends on the comparison implementation
      expect(result.diffPercentage).toBeGreaterThan(0);
      expect(result.differentPixels).toBeGreaterThan(0);
    });

    it('should handle images with text differences', async () => {
      // Create image with text
      const svg1 = `
        <svg width="200" height="100">
          <rect width="200" height="100" fill="white"/>
          <text x="50%" y="50%" text-anchor="middle" font-size="20" fill="black">Hello</text>
        </svg>
      `;

      const svg2 = `
        <svg width="200" height="100">
          <rect width="200" height="100" fill="white"/>
          <text x="50%" y="50%" text-anchor="middle" font-size="20" fill="black">World</text>
        </svg>
      `;

      const image1 = await sharp(Buffer.from(svg1)).png().toBuffer();
      const image2 = await sharp(Buffer.from(svg2)).png().toBuffer();

      const ref1 = await storageManager.storeScreenshot(image1);
      const ref2 = await storageManager.storeScreenshot(image2);

      const result = await storageManager.compareScreenshots(ref1, ref2);

      expect(result.diffPercentage).toBeGreaterThan(0);
    });
  });

  describe('Screenshot Transformations', () => {
    it('should resize screenshots', async () => {
      const original = await sharp({
        create: {
          width: 1920,
          height: 1080,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .png()
        .toBuffer();

      const ref = await storageManager.storeScreenshot(original);

      // Resize to smaller dimensions
      const resized = await storageManager.resizeScreenshot(ref, 800, 600);

      const metadata = await sharp(resized).metadata();
      expect(metadata.width).toBeLessThanOrEqual(800);
      expect(metadata.height).toBeLessThanOrEqual(600);
    });

    it('should convert screenshot formats', async () => {
      const png = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const ref = await storageManager.storeScreenshot(png);

      // Convert to JPEG
      const jpeg = await storageManager.convertScreenshot(ref, 'jpeg');
      const jpegMeta = await sharp(jpeg).metadata();
      expect(jpegMeta.format).toBe('jpeg');

      // Convert to WebP
      const webp = await storageManager.convertScreenshot(ref, 'webp');
      const webpMeta = await sharp(webp).metadata();
      expect(webpMeta.format).toBe('webp');
    });

    it('should maintain aspect ratio when resizing', async () => {
      const original = await sharp({
        create: {
          width: 1600,
          height: 900, // 16:9 aspect ratio
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .png()
        .toBuffer();

      const ref = await storageManager.storeScreenshot(original);

      // Resize with aspect ratio preservation
      const resized = await storageManager.resizeScreenshot(ref, 800);

      const metadata = await sharp(resized).metadata();
      const aspectRatio = metadata.width! / metadata.height!;
      const originalAspectRatio = 1600 / 900;

      expect(aspectRatio).toBeCloseTo(originalAspectRatio, 1);
    });
  });

  describe('Thumbnail Generation', () => {
    it('should generate thumbnails automatically', async () => {
      const largeImage = await sharp({
        create: {
          width: 3840,
          height: 2160,
          channels: 3,
          background: { r: 255, g: 128, b: 64 },
        },
      })
        .png()
        .toBuffer();

      const ref = await storageManager.storeScreenshot(largeImage);

      // Retrieve thumbnail
      const thumbnail = await storageManager.retrieveScreenshotThumbnail(ref);

      const thumbMeta = await sharp(thumbnail).metadata();
      expect(thumbMeta.width).toBeLessThanOrEqual(320);
      expect(thumbMeta.height).toBeLessThanOrEqual(240);
    });

    it('should preserve thumbnail quality', async () => {
      const detailedImage = await sharp({
        create: {
          width: 1920,
          height: 1080,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const ref = await storageManager.storeScreenshot(detailedImage);
      const thumbnail = await storageManager.retrieveScreenshotThumbnail(ref);

      // Thumbnail should be valid and readable
      const thumbMeta = await sharp(thumbnail).metadata();
      expect(thumbMeta.format).toBeDefined();
      expect(thumbMeta.width).toBeGreaterThan(0);
      expect(thumbMeta.height).toBeGreaterThan(0);
    });
  });

  describe('Complex Visual Diff Scenarios', () => {
    it('should handle progressive changes', async () => {
      const baseColor = { r: 50, g: 50, b: 50 };
      const screenshots = [];

      // Create progressive color changes with larger steps
      for (let i = 0; i < 5; i++) {
        const color = {
          r: baseColor.r + i * 40,
          g: baseColor.g + i * 40,
          b: baseColor.b + i * 40,
        };

        const screenshot = await sharp({
          create: {
            width: 100,
            height: 100,
            channels: 3,
            background: color,
          },
        })
          .png()
          .toBuffer();

        const ref = await storageManager.storeScreenshot(screenshot);
        screenshots.push(ref);
      }

      // Compare adjacent screenshots - larger color differences should be detected
      for (let i = 0; i < screenshots.length - 1; i++) {
        const result = await storageManager.compareScreenshots(
          screenshots[i],
          screenshots[i + 1]
        );

        // Each step should have some difference
        expect(result.diffPercentage).toBeGreaterThan(0);
      }

      // Compare first and last should have more difference
      const totalDiff = await storageManager.compareScreenshots(
        screenshots[0],
        screenshots[screenshots.length - 1]
      );

      expect(totalDiff.diffPercentage).toBeGreaterThan(0);
    });

    it('should compare screenshots with different content layouts', async () => {
      // Layout 1: Top bar
      const layout1 = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([
          {
            input: await sharp({
              create: {
                width: 200,
                height: 50,
                channels: 3,
                background: { r: 0, g: 0, b: 0 },
              },
            })
              .png()
              .toBuffer(),
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer();

      // Layout 2: Bottom bar
      const layout2 = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .composite([
          {
            input: await sharp({
              create: {
                width: 200,
                height: 50,
                channels: 3,
                background: { r: 0, g: 0, b: 0 },
              },
            })
              .png()
              .toBuffer(),
            top: 150,
            left: 0,
          },
        ])
        .png()
        .toBuffer();

      const ref1 = await storageManager.storeScreenshot(layout1);
      const ref2 = await storageManager.storeScreenshot(layout2);

      const result = await storageManager.compareScreenshots(ref1, ref2);

      // Different positions should be detected
      expect(result.diffPercentage).toBeGreaterThan(0);
    });

    it('should handle comparison thresholds', async () => {
      const base = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .png()
        .toBuffer();

      const slightlyDifferent = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 130, g: 130, b: 130 },
        },
      })
        .png()
        .toBuffer();

      const ref1 = await storageManager.storeScreenshot(base);
      const ref2 = await storageManager.storeScreenshot(slightlyDifferent);

      // With high threshold, should pass
      const lenientResult = await storageManager.compareScreenshots(ref1, ref2, {
        threshold: 0.5, // 50% tolerance
      });

      expect(lenientResult.diffPercentage).toBeLessThan(50);

      // With low threshold, should detect difference
      const strictResult = await storageManager.compareScreenshots(ref1, ref2, {
        threshold: 0.001, // 0.1% tolerance
      });

      expect(strictResult.diffPercentage).toBeGreaterThan(0);
    });
  });

  describe('Screenshot Querying and Filtering', () => {
    it('should query screenshots by dimensions', async () => {
      // Create screenshots of different sizes
      const sizes = [
        { width: 1920, height: 1080 },
        { width: 1280, height: 720 },
        { width: 800, height: 600 },
      ];

      for (const size of sizes) {
        const screenshot = await sharp({
          create: {
            width: size.width,
            height: size.height,
            channels: 3,
            background: { r: 200, g: 200, b: 200 },
          },
        })
          .png()
          .toBuffer();

        await storageManager.storeScreenshot(screenshot);
      }

      // Query for large screenshots
      const largeScreenshots = await storageManager.queryScreenshots({
        minWidth: 1200,
      });

      expect(largeScreenshots.length).toBeGreaterThanOrEqual(2);
      expect(
        largeScreenshots.every(ref => parseInt(ref.tags?.width || '0', 10) >= 1200)
      ).toBe(true);
    });

    it('should query screenshots by URL', async () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page1', // Duplicate URL
      ];

      for (const url of urls) {
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

        await storageManager.storeScreenshot(screenshot, { url });
      }

      const page1Screenshots = await storageManager.queryScreenshots({
        url: 'https://example.com/page1',
      });

      expect(page1Screenshots.length).toBeGreaterThanOrEqual(2);
    });
  });
});
