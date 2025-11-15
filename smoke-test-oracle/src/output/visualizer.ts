/**
 * Visual diff rendering and output formatting
 */

import { PNG } from 'pngjs';
import sharp from 'sharp';
import {
  DiffResult,
  StorageRef,
  CheckpointState,
  StorageProvider,
} from '../core/types.js';

/**
 * Options for rendering visual diffs
 */
export interface VisualizerOptions {
  /** Whether to include side-by-side comparison */
  sideBySide?: boolean;

  /** Whether to highlight diff regions */
  highlightRegions?: boolean;

  /** Scale factor for output images */
  scale?: number;

  /** Output format */
  format?: 'png' | 'jpeg' | 'webp';

  /** Quality for lossy formats */
  quality?: number;

  /** Add labels and annotations */
  annotate?: boolean;
}

/**
 * Visual diff visualizer for creating comparison images and HTML reports
 */
export class VisualDiffVisualizer {
  private storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  /**
   * Create a side-by-side comparison image
   */
  async createSideBySide(
    baselineRef: StorageRef,
    currentRef: StorageRef,
    diffResult: DiffResult,
    options?: VisualizerOptions
  ): Promise<Buffer> {
    try {
      // Load all images
      const [baseline, current, diff] = await Promise.all([
        this.storage.retrieve(baselineRef) as Promise<Buffer>,
        this.storage.retrieve(currentRef) as Promise<Buffer>,
        diffResult.diffImageRef
          ? (this.storage.retrieve(diffResult.diffImageRef) as Promise<Buffer>)
          : this.createBlankImage(1, 1),
      ]);

      const baselineMeta = await sharp(baseline).metadata();

      const width = baselineMeta.width || 0;
      const height = baselineMeta.height || 0;
      const scale = options?.scale || 1;

      // Resize images if scale is specified
      const scaledWidth = Math.round(width * scale);
      const scaledHeight = Math.round(height * scale);

      const processImage = async (img: Buffer) => {
        let pipeline = sharp(img).resize(scaledWidth, scaledHeight, { fit: 'fill' });

        if (options?.format === 'jpeg') {
          pipeline = pipeline.jpeg({ quality: options.quality || 90 });
        } else if (options?.format === 'webp') {
          pipeline = pipeline.webp({ quality: options.quality || 90 });
        } else {
          pipeline = pipeline.png();
        }

        return pipeline.toBuffer();
      };

      const [scaledBaseline, scaledCurrent, scaledDiff] = await Promise.all([
        processImage(baseline),
        processImage(current),
        diffResult.diffImageRef ? processImage(diff) : this.createBlankImage(scaledWidth, scaledHeight),
      ]);

      // Create composite image with three panels
      const padding = 10;
      const labelHeight = options?.annotate ? 30 : 0;
      const compositeWidth = scaledWidth * 3 + padding * 4;
      const compositeHeight = scaledHeight + labelHeight + padding * 2;

      // Create blank canvas
      const canvas = sharp({
        create: {
          width: compositeWidth,
          height: compositeHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      });

      // Composite the three images
      const composite = await canvas
        .composite([
          { input: scaledBaseline, left: padding, top: padding + labelHeight },
          { input: scaledCurrent, left: scaledWidth + padding * 2, top: padding + labelHeight },
          { input: scaledDiff, left: scaledWidth * 2 + padding * 3, top: padding + labelHeight },
        ])
        .png()
        .toBuffer();

      // Add annotations if requested
      if (options?.annotate) {
        return this.addAnnotations(composite);
      }

      return composite;
    } catch (error) {
      throw new Error(`Failed to create side-by-side comparison: ${error}`);
    }
  }

  /**
   * Create highlighted diff overlay
   */
  async createHighlightedDiff(
    currentRef: StorageRef,
    diffResult: DiffResult
  ): Promise<Buffer> {
    try {
      if (!diffResult.diffImageRef) {
        throw new Error('No diff image available');
      }

      const [current, diff] = await Promise.all([
        this.storage.retrieve(currentRef) as Promise<Buffer>,
        this.storage.retrieve(diffResult.diffImageRef) as Promise<Buffer>,
      ]);

      // Create semi-transparent overlay
      const diffPng = PNG.sync.read(diff);
      const overlay = new PNG({ width: diffPng.width, height: diffPng.height });

      // Make diff regions semi-transparent red
      for (let i = 0; i < diffPng.data.length; i += 4) {
        const r = diffPng.data[i];
        const g = diffPng.data[i + 1];
        const b = diffPng.data[i + 2];

        // Check if this is a diff pixel (red)
        if (r > 200 && g < 50 && b < 50) {
          overlay.data[i] = 255; // R
          overlay.data[i + 1] = 0; // G
          overlay.data[i + 2] = 0; // B
          overlay.data[i + 3] = 128; // A (semi-transparent)
        } else {
          overlay.data[i] = overlay.data[i + 1] = overlay.data[i + 2] = 0;
          overlay.data[i + 3] = 0; // Fully transparent
        }
      }

      const overlayBuffer = PNG.sync.write(overlay);

      // Composite overlay onto current image
      const result = await sharp(current)
        .composite([{ input: overlayBuffer, blend: 'over' }])
        .png()
        .toBuffer();

      return result;
    } catch (error) {
      throw new Error(`Failed to create highlighted diff: ${error}`);
    }
  }

  /**
   * Generate HTML report for visual diff
   */
  async generateHTMLReport(
    checkpointState: CheckpointState,
    diffResult: DiffResult,
    options?: {
      includeImages?: boolean;
      embedImages?: boolean;
    }
  ): Promise<string> {
    const includeImages = options?.includeImages ?? true;
    const embedImages = options?.embedImages ?? false;

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Diff Report - ${checkpointState.checkpointId}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            margin-top: 0;
            color: #333;
        }
        .status {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 4px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .status.passed {
            background: #d4edda;
            color: #155724;
        }
        .status.failed {
            background: #f8d7da;
            color: #721c24;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .metric {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 4px solid #007bff;
        }
        .metric-label {
            font-size: 12px;
            color: #6c757d;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
        .images {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        .image-panel {
            border: 1px solid #dee2e6;
            border-radius: 4px;
            overflow: hidden;
        }
        .image-header {
            background: #f8f9fa;
            padding: 10px;
            font-weight: bold;
            border-bottom: 1px solid #dee2e6;
        }
        .image-container {
            padding: 15px;
            background: #fff;
        }
        .image-container img {
            max-width: 100%;
            height: auto;
            display: block;
        }
        .regions {
            margin-top: 30px;
        }
        .region {
            padding: 10px;
            margin: 10px 0;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            border-radius: 4px;
        }
        .timestamp {
            color: #6c757d;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Visual Diff Report</h1>
        <div class="timestamp">Checkpoint: ${checkpointState.checkpointId} | ${new Date(checkpointState.timestamp).toLocaleString()}</div>

        <div class="status ${diffResult.passed ? 'passed' : 'failed'}">
            ${diffResult.passed ? '✓ PASSED' : '✗ FAILED'}
        </div>

        <div class="metrics">
            <div class="metric">
                <div class="metric-label">Difference</div>
                <div class="metric-value">${diffResult.diffPercentage.toFixed(2)}%</div>
            </div>
            <div class="metric">
                <div class="metric-label">Different Pixels</div>
                <div class="metric-value">${diffResult.diffPixels.toLocaleString()}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Total Pixels</div>
                <div class="metric-value">${diffResult.totalPixels.toLocaleString()}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Status</div>
                <div class="metric-value">${checkpointState.status.toUpperCase()}</div>
            </div>
        </div>
`;

    if (includeImages && checkpointState.refs.screenshot) {
      html += `
        <div class="images">
            <div class="image-panel">
                <div class="image-header">Current Screenshot</div>
                <div class="image-container">
                    <img src="${embedImages ? await this.imageToDataURL(checkpointState.refs.screenshot) : checkpointState.refs.screenshot.path}" alt="Current" />
                </div>
            </div>
`;

      if (diffResult.diffImageRef) {
        html += `
            <div class="image-panel">
                <div class="image-header">Visual Diff</div>
                <div class="image-container">
                    <img src="${embedImages ? await this.imageToDataURL(diffResult.diffImageRef) : diffResult.diffImageRef.path}" alt="Diff" />
                </div>
            </div>
`;
      }

      html += `
        </div>
`;
    }

    if (diffResult.diffBounds) {
      html += `
        <div class="regions">
            <h2>Difference Bounds</h2>
            <div class="region">
                Position: (${diffResult.diffBounds.x}, ${diffResult.diffBounds.y})<br>
                Size: ${diffResult.diffBounds.width} × ${diffResult.diffBounds.height}
            </div>
        </div>
`;
    }

    if (diffResult.analysis?.significantRegions && diffResult.analysis.significantRegions.length > 0) {
      html += `
        <div class="regions">
            <h2>Significant Regions (${diffResult.analysis.significantRegions.length})</h2>
`;
      diffResult.analysis.significantRegions.slice(0, 10).forEach((region, idx) => {
        html += `
            <div class="region">
                Region ${idx + 1}: (${region.x}, ${region.y}) - ${region.width} × ${region.height} - ${region.diffPercentage.toFixed(2)}% different
            </div>
`;
      });
      html += `
        </div>
`;
    }

    html += `
    </div>
</body>
</html>
`;

    return html;
  }

  /**
   * Create a blank image
   */
  private async createBlankImage(width: number, height: number): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 200, g: 200, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  }

  /**
   * Add text annotations to composite image
   */
  private async addAnnotations(
    image: Buffer
  ): Promise<Buffer> {
    // This is a simplified version - in a real implementation,
    // you might use a library like node-canvas or sharp's text support
    // For now, we return the image as-is since sharp has limited text support
    return image;
  }

  /**
   * Convert image to data URL for embedding
   */
  private async imageToDataURL(ref: StorageRef): Promise<string> {
    const buffer = await this.storage.retrieve(ref) as Buffer;
    const base64 = buffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  }
}
