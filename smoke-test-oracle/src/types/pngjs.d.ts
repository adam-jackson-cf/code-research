/**
 * Type declarations for pngjs
 */

declare module 'pngjs' {
  export interface PNGOptions {
    width?: number;
    height?: number;
    fill?: boolean;
    colorType?: number;
    inputColorType?: number;
    inputHasAlpha?: boolean;
    bgColor?: { red: number; green: number; blue: number };
    checkCRC?: boolean;
    filterType?: number;
  }

  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    gamma?: number;

    constructor(options?: PNGOptions);

    static sync: {
      read(buffer: Buffer, options?: PNGOptions): PNG;
      write(png: PNG, options?: PNGOptions): Buffer;
    };

    pack(): PNG;
    parse(data: Buffer, callback?: (error: Error | null, data: PNG) => void): PNG;

    on(event: 'metadata', callback: (metadata: any) => void): this;
    on(event: 'parsed', callback: (data: Buffer) => void): this;
    on(event: 'error', callback: (error: Error) => void): this;
    on(event: string, callback: (...args: any[]) => void): this;
  }
}
