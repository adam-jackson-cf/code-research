import { StorageProvider, StorageConfig } from './storage-provider.js';
import { StorageRef, StorageCategory } from '../core/types.js';
import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio';

/**
 * DOM node for chunking
 */
interface DOMNode {
  tag: string;
  attributes?: Record<string, string>;
  text?: string;
  children?: DOMNode[];
}

/**
 * Chunked DOM data
 */
interface ChunkedDOM {
  url: string;
  timestamp: number;
  totalNodes: number;
  chunks: DOMChunk[];
  metadata: {
    title?: string;
    charset?: string;
    viewport?: string;
  };
}

/**
 * Single DOM chunk
 */
interface DOMChunk {
  index: number;
  nodeCount: number;
  nodes: DOMNode[];
}

/**
 * DOM query filter
 */
export interface DOMQueryFilter {
  url?: string;
  selector?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

/**
 * DOM storage with chunking capability
 */
export class DOMStore extends StorageProvider<string> {
  private readonly chunkSize: number;

  constructor(config: StorageConfig & { chunkSize?: number }) {
    super(config);
    this.chunkSize = config.chunkSize || 1000;
  }

  /**
   * Store DOM HTML with chunking
   */
  async store(html: string, metadata?: Record<string, any>): Promise<StorageRef> {
    try {
      const id = this.generateId('dom');
      const chunkedDOM = await this.chunkDOM(html, metadata);

      // Store the chunked DOM
      const filePath = this.getItemPath(id, '.json');
      await this.writeJson(filePath, chunkedDOM);

      // Store index for quick queries
      await this.updateIndex(id, chunkedDOM);

      const fileSize = Buffer.byteLength(JSON.stringify(chunkedDOM), 'utf8');
      return this.createRef(
        StorageCategory.HTML,
        metadata?.testId || 'default',
        filePath,
        fileSize,
        {
          stepId: metadata?.stepId,
          tags: {
            url: metadata?.url || '',
            totalNodes: String(chunkedDOM.totalNodes),
            chunkCount: String(chunkedDOM.chunks.length),
            title: chunkedDOM.metadata.title || '',
          },
        }
      );
    } catch (error) {
      throw new Error(`Failed to store DOM: ${error}`);
    }
  }

  /**
   * Retrieve full DOM by reference
   */
  async retrieve(ref: StorageRef): Promise<string> {
    try {
      const chunkedDOM: ChunkedDOM = await this.readJson(ref.path);
      return this.reconstructHTML(chunkedDOM);
    } catch (error) {
      throw new Error(`Failed to retrieve DOM ${ref.path}: ${error}`);
    }
  }

  /**
   * Retrieve specific chunk
   */
  async retrieveChunk(ref: StorageRef, chunkIndex: number): Promise<DOMChunk | null> {
    try {
      const chunkedDOM: ChunkedDOM = await this.readJson(ref.path);
      return chunkedDOM.chunks[chunkIndex] || null;
    } catch (error) {
      throw new Error(`Failed to retrieve DOM chunk ${ref.path}[${chunkIndex}]: ${error}`);
    }
  }

  /**
   * Query DOM by selector without loading full DOM
   */
  async queryBySelector(ref: StorageRef, selector: string): Promise<any[]> {
    try {
      const html = await this.retrieve(ref);
      const $ = cheerio.load(html);
      const results: any[] = [];

      $(selector).each((_i: number, elem: cheerio.Element) => {
        const element = elem as cheerio.TagElement;
        results.push({
          tag: element.tagName || element.name,
          attributes: element.attribs || {},
          text: $(elem).text().trim(),
          html: $(elem).html() || '',
        });
      });

      return results;
    } catch (error) {
      throw new Error(`Failed to query DOM by selector: ${error}`);
    }
  }

  /**
   * Query stored DOMs
   */
  async query(filter?: DOMQueryFilter): Promise<StorageRef[]> {
    try {
      const indexPath = this.getItemPath('index', '.json');
      if (!await this.exists('index', '.json')) {
        return [];
      }

      const index: Record<string, any> = await this.readJson(indexPath);
      let refs = Object.values(index) as StorageRef[];

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
        if (filter.limit) {
          refs = refs.slice(0, filter.limit);
        }
      }

      return refs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      throw new Error(`Failed to query DOMs: ${error}`);
    }
  }

  /**
   * Get DOM statistics
   */
  async getStats(ref: StorageRef): Promise<{
    totalNodes: number;
    chunkCount: number;
    title?: string;
    url?: string;
  }> {
    try {
      const chunkedDOM: ChunkedDOM = await this.readJson(ref.path);

      return {
        totalNodes: chunkedDOM.totalNodes,
        chunkCount: chunkedDOM.chunks.length,
        title: chunkedDOM.metadata.title,
        url: chunkedDOM.url,
      };
    } catch (error) {
      throw new Error(`Failed to get DOM stats: ${error}`);
    }
  }

  /**
   * Chunk DOM into manageable pieces
   */
  private async chunkDOM(html: string, metadata?: Record<string, any>): Promise<ChunkedDOM> {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract metadata
    const title = document.title;
    const charset = document.characterSet;
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const viewport = viewportMeta?.getAttribute('content') || undefined;

    // Parse DOM into nodes
    const nodes = this.parseNode(document.documentElement);
    const totalNodes = this.countNodes(nodes);

    // Create chunks
    const chunks: DOMChunk[] = [];
    const flatNodes = this.flattenNodes(nodes);

    for (let i = 0; i < flatNodes.length; i += this.chunkSize) {
      chunks.push({
        index: chunks.length,
        nodeCount: Math.min(this.chunkSize, flatNodes.length - i),
        nodes: flatNodes.slice(i, i + this.chunkSize),
      });
    }

    return {
      url: metadata?.url || '',
      timestamp: Date.now(),
      totalNodes,
      chunks,
      metadata: {
        title,
        charset,
        viewport,
      },
    };
  }

  /**
   * Parse DOM node recursively
   */
  private parseNode(node: any): DOMNode {
    const element = node as any;
    const result: DOMNode = {
      tag: node.nodeName.toLowerCase(),
    };

    // Parse attributes
    if (element.attributes) {
      result.attributes = {};
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        result.attributes[attr.name] = attr.value;
      }
    }

    // Parse text content
    if (node.nodeType === 3) { // Text node
      result.text = node.textContent?.trim() || '';
    }

    // Parse children
    if (node.childNodes.length > 0) {
      result.children = [];
      node.childNodes.forEach((child: any) => {
        if (child.nodeType === 1 || (child.nodeType === 3 && child.textContent?.trim())) {
          result.children!.push(this.parseNode(child));
        }
      });
    }

    return result;
  }

  /**
   * Count total nodes
   */
  private countNodes(node: DOMNode): number {
    let count = 1;
    if (node.children) {
      node.children.forEach(child => {
        count += this.countNodes(child);
      });
    }
    return count;
  }

  /**
   * Flatten nodes for chunking
   */
  private flattenNodes(node: DOMNode): DOMNode[] {
    const result: DOMNode[] = [node];
    if (node.children) {
      node.children.forEach(child => {
        result.push(...this.flattenNodes(child));
      });
    }
    return result;
  }

  /**
   * Reconstruct HTML from chunked DOM
   */
  private reconstructHTML(chunkedDOM: ChunkedDOM): string {
    // Combine all chunks
    const allNodes: DOMNode[] = [];
    chunkedDOM.chunks.forEach(chunk => {
      allNodes.push(...chunk.nodes);
    });

    // Reconstruct HTML (simplified)
    if (allNodes.length === 0) {
      return '';
    }

    return this.nodeToHTML(allNodes[0]);
  }

  /**
   * Convert node to HTML string
   */
  private nodeToHTML(node: DOMNode): string {
    if (node.text && !node.children) {
      return node.text;
    }

    let html = `<${node.tag}`;

    // Add attributes
    if (node.attributes) {
      for (const [key, value] of Object.entries(node.attributes)) {
        html += ` ${key}="${value}"`;
      }
    }

    html += '>';

    // Add children
    if (node.children) {
      node.children.forEach(child => {
        html += this.nodeToHTML(child);
      });
    }

    html += `</${node.tag}>`;

    return html;
  }

  /**
   * Update index for quick queries
   */
  private async updateIndex(id: string, chunkedDOM: ChunkedDOM): Promise<void> {
    try {
      const indexPath = this.getItemPath('index', '.json');
      let index: Record<string, any> = {};

      if (await this.exists('index', '.json')) {
        index = await this.readJson(indexPath);
      }

      const filePath = this.getItemPath(id, '.json');
      const fileSize = Buffer.byteLength(JSON.stringify(chunkedDOM), 'utf8');

      index[id] = this.createRef(
        StorageCategory.HTML,
        'default',
        filePath,
        fileSize,
        {
          tags: {
            url: chunkedDOM.url,
            totalNodes: String(chunkedDOM.totalNodes),
            chunkCount: String(chunkedDOM.chunks.length),
            title: chunkedDOM.metadata.title || '',
          },
        }
      );

      await this.writeJson(indexPath, index);
    } catch (error) {
      throw new Error(`Failed to update DOM index: ${error}`);
    }
  }
}
