import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      // Resolve .js imports to .ts files in src
      // This regex matches any .js import and tries to resolve to .ts
    },
  },
  esbuild: {
    // Transform TypeScript files
    target: 'node18',
  },
});
