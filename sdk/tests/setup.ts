/**
 * Global test setup file
 * This file runs after the test framework is set up but before tests run
 */

import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config();

// Mock global File constructor for Node.js environment
if (typeof global.File === 'undefined') {
  global.File = class File {
    public name: string;
    public type: string;
    public size: number;
    private content: string[];

    constructor(content: string[], filename: string, options: { type?: string } = {}) {
      this.content = content;
      this.name = filename;
      this.type = options.type || '';
      this.size = content.join('').length;
    }

    text(): Promise<string> {
      return Promise.resolve(this.content.join(''));
    }

    arrayBuffer(): Promise<ArrayBuffer> {
      const str = this.content.join('');
      const buffer = new ArrayBuffer(str.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < str.length; i++) {
        view[i] = str.charCodeAt(i);
      }
      return Promise.resolve(buffer);
    }
  } as any;
}

// Mock global Blob constructor for Node.js environment
if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    public size: number;
    public type: string;
    private content: (string | Buffer | ArrayBuffer)[];

    constructor(content: (string | Buffer | ArrayBuffer)[], options: { type?: string } = {}) {
      this.content = content;
      this.type = options.type || '';
      this.size = content.reduce((acc, item) => {
        if (typeof item === 'string') return acc + item.length;
        if (item instanceof Buffer) return acc + item.length;
        if (item instanceof ArrayBuffer) return acc + item.byteLength;
        return acc;
      }, 0);
    }

    text(): Promise<string> {
      const str = this.content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item instanceof Buffer) return item.toString();
          if (item instanceof ArrayBuffer) return Buffer.from(item).toString();
          return '';
        })
        .join('');
      return Promise.resolve(str);
    }

    arrayBuffer(): Promise<ArrayBuffer> {
      const buffers = this.content.map((item) => {
        if (typeof item === 'string') return Buffer.from(item);
        if (item instanceof Buffer) return item;
        if (item instanceof ArrayBuffer) return Buffer.from(item);
        return Buffer.alloc(0);
      });
      const combined = Buffer.concat(buffers);
      return Promise.resolve(combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength));
    }

    // Add stream method for compatibility with FormData
    stream(): ReadableStream {
      const content = this.content;
      return new ReadableStream({
        start(controller) {
          content.forEach((item) => {
            if (typeof item === 'string') {
              controller.enqueue(new TextEncoder().encode(item));
            } else if (item instanceof Buffer) {
              controller.enqueue(new Uint8Array(item));
            } else if (item instanceof ArrayBuffer) {
              controller.enqueue(new Uint8Array(item));
            }
          });
          controller.close();
        },
      });
    }

    // Add valueOf method to return the buffer for FormData compatibility
    valueOf(): Buffer {
      const buffers = this.content.map((item) => {
        if (typeof item === 'string') return Buffer.from(item);
        if (item instanceof Buffer) return item;
        if (item instanceof ArrayBuffer) return Buffer.from(item);
        return Buffer.alloc(0);
      });
      return Buffer.concat(buffers);
    }

    // Add toString method
    toString(): string {
      return this.content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item instanceof Buffer) return item.toString();
          if (item instanceof ArrayBuffer) return Buffer.from(item).toString();
          return '';
        })
        .join('');
    }

    // Make it look like a File to FormData
    get name(): string {
      return 'blob';
    }

    get lastModified(): number {
      return Date.now();
    }
  } as any;

  // Also add ReadableStream if not available
  if (typeof global.ReadableStream === 'undefined') {
    global.ReadableStream = class ReadableStream {
      constructor(private source: any) {}
    } as any;
  }

  // Add TextEncoder if not available
  if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = class TextEncoder {
      encode(input: string): Uint8Array {
        return new Uint8Array(Buffer.from(input));
      }
    } as any;
  }
}

// Set up global test timeouts
jest.setTimeout(30000);

// Configure console output for tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Filter out expected warnings/errors during tests
console.error = (...args: any[]) => {
  // Suppress axios warnings during mocking
  if (args[0]?.includes?.('axios') || args[0]?.includes?.('mock')) {
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  // Suppress axios warnings during mocking
  if (args[0]?.includes?.('axios') || args[0]?.includes?.('mock')) {
    return;
  }
  originalConsoleWarn(...args);
};

// Restore console methods after tests
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
global.testUtils = {
  skipIfNoCredentials: () => {
    if (!process.env.ANAF_CLIENT_ID || !process.env.ANAF_CLIENT_SECRET) {
      console.log('⚠️ Skipping test - OAuth credentials not available');
      return true;
    }
    return false;
  },
};
